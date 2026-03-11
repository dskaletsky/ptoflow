import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

function isAdmin(session: { user?: { role?: string; organizationId?: string | null } } | null) {
  return session?.user?.role === UserRole.ADMIN;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holidays = await prisma.companyHoliday.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(holidays);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, date, recurring } = body;

  if (!name || !date) {
    return NextResponse.json({ error: "Name and date are required" }, { status: 400 });
  }

  const holiday = await prisma.companyHoliday.create({
    data: {
      name,
      date: new Date(date),
      recurring: recurring ?? true,
      organizationId: session.user.organizationId,
    },
  });

  return NextResponse.json(holiday, { status: 201 });
}
