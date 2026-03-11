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
  const { name, role, startDate, managerId, addTeamIds, removeTeamIds } = body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      name: name ?? user.name,
      role: role ?? user.role,
      startDate: startDate !== undefined ? (startDate ? new Date(startDate) : null) : user.startDate,
      managerId: managerId !== undefined ? (managerId || null) : user.managerId,
      ...(addTeamIds?.length || removeTeamIds?.length ? {
        teams: {
          connect: (addTeamIds ?? []).map((tid: string) => ({ id: tid })),
          disconnect: (removeTeamIds ?? []).map((tid: string) => ({ id: tid })),
        },
      } : {}),
    },
    include: {
      teams: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true } },
    },
  });

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

  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || user.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Remove from org rather than deleting the user record
  await prisma.user.update({
    where: { id },
    data: { organizationId: null, managerId: null, teams: { set: [] } },
  });

  return NextResponse.json({ success: true });
}
