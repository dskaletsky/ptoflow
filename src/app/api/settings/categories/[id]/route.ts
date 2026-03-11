import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

function isAdmin(session: { user?: { role?: string; organizationId?: string | null } } | null) {
  return session?.user?.role === UserRole.ADMIN;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, emoji, isUnlimited, defaultDays, minimumDays, requiresApproval } = body;

  const cat = await prisma.leaveCategory.findUnique({ where: { id } });
  if (!cat || cat.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newIsUnlimited = isUnlimited ?? cat.isUnlimited;
  const newDefaultDays = newIsUnlimited ? null : (defaultDays ?? cat.defaultDays);

  const updated = await prisma.leaveCategory.update({
    where: { id },
    data: {
      name: name ?? cat.name,
      emoji: emoji ?? cat.emoji,
      isUnlimited: newIsUnlimited,
      defaultDays: newDefaultDays,
      minimumDays: minimumDays !== undefined ? minimumDays : cat.minimumDays,
      requiresApproval: requiresApproval ?? cat.requiresApproval,
    },
  });

  // If the category is now limited, provision banks for any org users who don't have one yet
  if (!newIsUnlimited && newDefaultDays) {
    const orgId = session.user.organizationId;
    const year = new Date().getFullYear();

    const [org, users, existingBanks] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { prorateNewEmployees: true } }),
      prisma.user.findMany({ where: { organizationId: orgId }, select: { id: true, startDate: true } }),
      prisma.leaveBank.findMany({
        where: { categoryId: id, year },
        select: { userId: true },
      }),
    ]);

    const usersWithBank = new Set(existingBanks.map(b => b.userId));

    for (const user of users) {
      if (usersWithBank.has(user.id)) continue;

      let allocated = newDefaultDays;

      if (org?.prorateNewEmployees && user.startDate) {
        const start = new Date(user.startDate);
        if (start.getUTCFullYear() === year) {
          const yearStart = Date.UTC(year, 0, 1);
          const yearEnd = Date.UTC(year, 11, 31);
          const userStart = start.getTime();
          const totalMs = yearEnd - yearStart;
          const remainingMs = yearEnd - userStart;
          allocated = Math.round((remainingMs / totalMs) * newDefaultDays);
        }
      }

      await prisma.leaveBank.create({
        data: { userId: user.id, categoryId: id, year, allocatedDays: allocated, usedDays: 0 },
      });
    }
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const cat = await prisma.leaveCategory.findUnique({ where: { id } });
  if (!cat || cat.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Soft delete — deactivate rather than hard delete to preserve history
  const updated = await prisma.leaveCategory.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json(updated);
}
