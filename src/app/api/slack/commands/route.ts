import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifySlackSignature,
  findUserBySlackId,
  slack,
  buildRequestModal,
  buildStatusMessage,
  buildPendingRequestsMessage,
} from "@/lib/slack";
import { UserRole } from "@prisma/client";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifySlackSignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const slackUserId = params.get("user_id") ?? "";
  const triggerId = params.get("trigger_id") ?? "";
  const text = (params.get("text") ?? "").trim().toLowerCase();

  // /pto request — open modal
  // Always return 200 to Slack regardless of what happens — any unhandled
  // exception here causes a 500 which Slack reports as "app did not respond".
  // trigger_id is only valid for 3s, so skip findUserBySlackId (which may hit
  // the slow Slack API fallback) and do a minimal direct DB lookup instead.
  if (text === "request" || text === "") {
    try {
      const userForModal = await prisma.user.findUnique({
        where: { slackUserId },
        select: { organizationId: true },
      });

      if (!userForModal?.organizationId) {
        return NextResponse.json({
          response_type: "ephemeral",
          text: "⚠️ Your Slack account is not linked to a PTOFlow account. Please sign in to PTOFlow first.",
        });
      }

      const categories = await prisma.leaveCategory.findMany({
        where: { organizationId: userForModal.organizationId, isActive: true },
        select: { id: true, name: true, emoji: true },
        orderBy: { name: "asc" },
      });

      await slack.views.open({
        trigger_id: triggerId,
        view: buildRequestModal(categories),
      });
    } catch (err) {
      console.error("[Slack] Failed to open PTO request modal:", err);
    }

    return new NextResponse(null, { status: 200 });
  }

  const user = await findUserBySlackId(slackUserId);

  if (!user) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "⚠️ Your Slack account is not linked to a PTOFlow account. Please sign in to PTOFlow first.",
    });
  }

  // /pto status — show leave balances
  if (text === "status") {
    const year = new Date().getFullYear();
    const banks = await prisma.leaveBank.findMany({
      where: { userId: user.id, year },
      include: { category: true },
      orderBy: { category: { name: "asc" } },
    });

    // Also include unlimited categories (they may not have a bank row)
    const unlimitedCategories = await prisma.leaveCategory.findMany({
      where: {
        organizationId: user.organizationId!,
        isActive: true,
        isUnlimited: true,
      },
    });

    // Merge: banks for limited + synthetic rows for unlimited categories without a bank
    const bankCategoryIds = new Set(banks.map((b) => b.categoryId));
    const syntheticBanks = unlimitedCategories
      .filter((c) => !bankCategoryIds.has(c.id))
      .map((c) => ({
        id: `synthetic_${c.id}`,
        userId: user.id,
        categoryId: c.id,
        year,
        allocatedDays: 0,
        usedDays: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        category: c,
      }));

    const allBanks = [...banks, ...syntheticBanks].sort((a, b) =>
      a.category.name.localeCompare(b.category.name)
    );

    return NextResponse.json({
      response_type: "ephemeral",
      blocks: buildStatusMessage(allBanks),
    });
  }

  // /pto pending — manager/admin only
  if (text === "pending") {
    const isManagerOrAdmin =
      user.role === UserRole.ADMIN || user.role === UserRole.MANAGER;

    if (!isManagerOrAdmin) {
      return NextResponse.json({
        response_type: "ephemeral",
        text: "⚠️ Only managers and admins can view pending requests.",
      });
    }

    // Admins see all pending in org; managers see requests from their reports
    const where =
      user.role === UserRole.ADMIN
        ? { status: "PENDING" as const, user: { organizationId: user.organizationId! } }
        : { status: "PENDING" as const, user: { managerId: user.id } };

    const requests = await prisma.leaveRequest.findMany({
      where,
      include: {
        category: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      response_type: "ephemeral",
      blocks: buildPendingRequestsMessage(requests),
    });
  }

  // Unknown subcommand
  return NextResponse.json({
    response_type: "ephemeral",
    text: "Usage: `/pto request` | `/pto status` | `/pto pending`",
  });
}
