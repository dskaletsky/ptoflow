import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countWorkingDays } from "@/lib/workingDays";
import { syncApprovedRequestToCalendars } from "@/lib/google-calendar";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await prisma.leaveRequest.findMany({
    where: { userId: session.user.id },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { categoryId, startDate, endDate, description, markAsOOO } = body;

  if (!categoryId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
  }

  // Fetch holidays for working day calculation
  const holidays = await prisma.companyHoliday.findMany({
    where: { organizationId: session.user.organizationId },
    select: { date: true },
  });

  const workingDaysCount = countWorkingDays(
    start,
    end,
    holidays.map((h) => h.date)
  );

  if (workingDaysCount === 0) {
    return NextResponse.json({ error: "Request contains no working days" }, { status: 400 });
  }

  // Check for overlapping approved PTO
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      userId: session.user.id,
      status: "APPROVED",
      startDate: { lte: end },
      endDate: { gte: start },
    },
    include: { category: true },
  });

  if (overlapping) {
    const fmt = (d: Date) => new Date(d).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });
    const dateStr = overlapping.startDate.toDateString() === overlapping.endDate.toDateString()
      ? fmt(overlapping.startDate)
      : `${fmt(overlapping.startDate)} – ${fmt(overlapping.endDate)}`;
    return NextResponse.json(
      { error: `${overlapping.category.emoji} You already have approved PTO for that date. Existing approval: ${dateStr}.` },
      { status: 422 }
    );
  }

  // Fetch category to determine approval requirement and bank limits
  const category = await prisma.leaveCategory.findUnique({
    where: { id: categoryId },
  });

  if (!category || category.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  // Check bank balance for non-unlimited categories
  if (!category.isUnlimited) {
    const year = start.getFullYear();
    const bank = await prisma.leaveBank.findUnique({
      where: { userId_categoryId_year: { userId: session.user.id, categoryId, year } },
    });

    if (!bank) {
      return NextResponse.json({ error: "No leave bank found for this category" }, { status: 400 });
    }

    const remaining = bank.allocatedDays - bank.usedDays;
    if (workingDaysCount > remaining) {
      return NextResponse.json(
        {
          error: `Insufficient balance. You have ${remaining} day(s) remaining but requested ${workingDaysCount}.`,
          remaining,
          requested: workingDaysCount,
        },
        { status: 422 }
      );
    }
  }

  // Determine initial status — auto-approve if category doesn't require it,
  // or if the requester is an admin or has no manager (nobody to approve it)
  const requester = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { managerId: true },
  });
  const noApprover = !requester?.managerId;
  const status = !category.requiresApproval || noApprover ? "APPROVED" : "PENDING";

  const leaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: session.user.id,
      categoryId,
      startDate: start,
      endDate: end,
      workingDaysCount,
      description: description || null,
      status,
      markAsOOO: markAsOOO !== false, // default true unless explicitly false
    },
    include: { category: true },
  });

  // If auto-approved, deduct from bank immediately
  if (status === "APPROVED" && !category.isUnlimited) {
    const year = start.getFullYear();
    await prisma.leaveBank.update({
      where: { userId_categoryId_year: { userId: session.user.id, categoryId, year } },
      data: { usedDays: { increment: workingDaysCount } },
    });
  }

  // Sync to Google Calendar if auto-approved (fire-and-forget)
  if (status === "APPROVED") {
    syncApprovedRequestToCalendars(leaveRequest.id).catch(console.error);
  }

  return NextResponse.json(leaveRequest, { status: 201 });
}
