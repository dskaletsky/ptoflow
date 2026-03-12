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

  const users = await prisma.user.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      teams: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, email, title, role, startDate, managerId, teamIds } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.organizationId === session.user.organizationId) {
      return NextResponse.json({ error: "A user with this email already exists in your organization" }, { status: 409 });
    }
    // User exists but in no org — assign them
    const updated = await prisma.user.update({
      where: { email },
      data: {
        name,
        title: title ?? null,
        organizationId: session.user.organizationId,
        role: role ?? UserRole.TEAM_MEMBER,
        startDate: startDate ? new Date(startDate) : null,
        managerId: managerId || null,
      },
    });
    return NextResponse.json(updated, { status: 201 });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      title: title ?? null,
      organizationId: session.user.organizationId,
      role: role ?? UserRole.TEAM_MEMBER,
      startDate: startDate ? new Date(startDate) : null,
      managerId: managerId || null,
      ...(teamIds?.length ? {
        teams: { connect: teamIds.map((id: string) => ({ id })) },
      } : {}),
    },
  });

  // Provision leave banks for non-unlimited categories
  const categories = await prisma.leaveCategory.findMany({
    where: { organizationId: session.user.organizationId, isActive: true, isUnlimited: false },
  });

  const year = new Date().getFullYear();
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
  });

  for (const cat of categories) {
    if (!cat.defaultDays) continue;

    let allocated = cat.defaultDays;

    // Prorate if org setting is enabled and startDate is provided
    if (org?.prorateNewEmployees && startDate) {
      const start = new Date(startDate);
      const startYear = start.getFullYear();
      if (startYear === year) {
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        const totalDays = (yearEnd.getTime() - yearStart.getTime()) / 86400000;
        const remainingDays = (yearEnd.getTime() - start.getTime()) / 86400000;
        allocated = Math.round((remainingDays / totalDays) * cat.defaultDays);
      }
    }

    await prisma.leaveBank.create({
      data: {
        userId: user.id,
        categoryId: cat.id,
        year,
        allocatedDays: allocated,
        usedDays: 0,
      },
    });
  }

  return NextResponse.json(user, { status: 201 });
}
