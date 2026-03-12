import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { slack } from "@/lib/slack";
import { syncApprovedRequestToCalendars, removeRequestFromCalendars } from "@/lib/google-calendar";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isManagerOrAdmin =
    session.user.role === UserRole.ADMIN ||
    session.user.role === UserRole.MANAGER;

  if (!isManagerOrAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action, rejectionReason } = body;

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (leaveRequest.status !== "PENDING") {
    return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
  }

  if (action === "approve") {
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "APPROVED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
      include: { category: true },
    });

    // Deduct from bank if not unlimited
    if (!leaveRequest.category.isUnlimited) {
      const year = new Date(leaveRequest.startDate).getFullYear();
      await prisma.leaveBank.update({
        where: {
          userId_categoryId_year: {
            userId: leaveRequest.userId,
            categoryId: leaveRequest.categoryId,
            year,
          },
        },
        data: { usedDays: { increment: leaveRequest.workingDaysCount } },
      });
    }

    // DM employee via Slack if they have a slackUserId
    const employee = await prisma.user.findUnique({
      where: { id: leaveRequest.userId },
      select: { slackUserId: true },
    });

    if (employee?.slackUserId) {
      const days = `${leaveRequest.workingDaysCount} working day${leaveRequest.workingDaysCount !== 1 ? "s" : ""}`;
      let remainingNote = "";
      if (!leaveRequest.category.isUnlimited) {
        const year = new Date(leaveRequest.startDate).getFullYear();
        const bank = await prisma.leaveBank.findUnique({
          where: { userId_categoryId_year: { userId: leaveRequest.userId, categoryId: leaveRequest.categoryId, year } },
        });
        if (bank) {
          const remaining = bank.allocatedDays - bank.usedDays;
          remainingNote = `\n*Days remaining in your ${leaveRequest.category.name} bank:* ${remaining}`;
        }
      }
      await slack.chat.postMessage({
        channel: employee.slackUserId,
        text: `🎉 Your PTO request has been approved!`,
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🎉 *Congratulations! Your ${leaveRequest.category.emoji} ${leaveRequest.category.name} request has been approved.*\n\n*Dates:* ${formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}\n*Duration:* ${days}${remainingNote}`,
          },
        }],
      }).catch(console.error);
    }

    // Sync to Google Calendar — must await before returning
    // (Vercel terminates the function as soon as the response is sent)
    await syncApprovedRequestToCalendars(id);

    return NextResponse.json(updated);
  } else {
    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        rejectionReason: rejectionReason || null,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
      },
      include: { category: true },
    });

    // DM employee via Slack if they have a slackUserId
    const employee = await prisma.user.findUnique({
      where: { id: leaveRequest.userId },
      select: { slackUserId: true },
    });

    if (employee?.slackUserId) {
      const days = `${leaveRequest.workingDaysCount} working day${leaveRequest.workingDaysCount !== 1 ? "s" : ""}`;
      const reasonNote = rejectionReason ? `\n*Reason:* ${rejectionReason}` : "";
      await slack.chat.postMessage({
        channel: employee.slackUserId,
        text: "❌ Your PTO request has been denied",
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: `❌ *Your ${leaveRequest.category.emoji} ${leaveRequest.category.name} request has been denied.*\n\n*Dates:* ${formatDateRange(leaveRequest.startDate, leaveRequest.endDate)}\n*Duration:* ${days}${reasonNote}`,
          },
        }],
      }).catch(console.error);
    }

    return NextResponse.json(updated);
  }
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    new Date(d).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric", year: "numeric",
    });
  const s = fmt(start);
  const e = fmt(end);
  return s === e ? s : `${s} – ${e}`;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { id },
    include: { category: true },
  });

  if (!leaveRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (leaveRequest.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!["PENDING", "APPROVED"].includes(leaveRequest.status)) {
    return NextResponse.json({ error: "Cannot cancel this request" }, { status: 400 });
  }

  await prisma.leaveRequest.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  // Refund bank if it was approved and non-unlimited
  if (leaveRequest.status === "APPROVED" && !leaveRequest.category.isUnlimited) {
    const year = new Date(leaveRequest.startDate).getFullYear();
    await prisma.leaveBank.update({
      where: {
        userId_categoryId_year: {
          userId: leaveRequest.userId,
          categoryId: leaveRequest.categoryId,
          year,
        },
      },
      data: { usedDays: { decrement: leaveRequest.workingDaysCount } },
    });
  }

  // Remove calendar events if this was approved (fire-and-forget)
  if (leaveRequest.status === "APPROVED") {
    removeRequestFromCalendars(id).catch(console.error);
  }

  return NextResponse.json({ success: true });
}
