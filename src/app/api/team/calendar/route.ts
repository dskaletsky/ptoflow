import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const upcoming = searchParams.get("upcoming") === "true";

  let dateFilter: { startDate?: object; endDate?: object };
  if (upcoming) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateFilter = { endDate: { gte: today } };
  } else {
    const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
    const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0, 23, 59, 59);
    dateFilter = { startDate: { lte: lastDay }, endDate: { gte: firstDay } };
  }

  const requests = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      ...dateFilter,
      user: { organizationId: session.user.organizationId },
    },
    include: {
      category: { select: { id: true, name: true, emoji: true } },
      user: { select: { id: true, name: true, image: true } },
      // workingDaysCount included via default select
    },
    orderBy: { startDate: "asc" },
  });

  const holidays = await prisma.companyHoliday.findMany({
    where: { organizationId: session.user.organizationId },
  });

  return NextResponse.json({ requests, holidays });
}
