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
  const { name, managerId, addMemberIds, removeMemberIds } = body;

  const team = await prisma.team.findUnique({ where: { id } });
  if (!team || team.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const managerChanged = managerId !== undefined && managerId !== team.managerId;

  // Update team name and/or manager
  const updatedTeam = await prisma.team.update({
    where: { id },
    data: {
      name: name ?? team.name,
      managerId: managerId !== undefined ? (managerId || null) : team.managerId,
    },
  });

  // Add new members
  if (addMemberIds?.length) {
    await prisma.team.update({
      where: { id },
      data: { members: { connect: addMemberIds.map((uid: string) => ({ id: uid })) } },
    });
  }

  // Remove members
  if (removeMemberIds?.length) {
    await prisma.team.update({
      where: { id },
      data: { members: { disconnect: removeMemberIds.map((uid: string) => ({ id: uid })) } },
    });
  }

  // If manager changed, update all current team members' managerId as default
  if (managerChanged) {
    const newManagerId = managerId || null;
    const existingMemberIds: string[] = await prisma.user
      .findMany({ where: { teams: { some: { id } } }, select: { id: true } })
      .then(users => users.map(u => u.id));
    const memberIds: string[] = (addMemberIds ?? []).concat(existingMemberIds);
    const allMemberIds = [...new Set(memberIds)];
    if (allMemberIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: allMemberIds } },
        data: { managerId: newManagerId },
      });
    }
  }

  const result = await prisma.team.findUnique({
    where: { id },
    include: {
      manager: { select: { id: true, name: true } },
      members: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json(result);
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

  const team = await prisma.team.findUnique({ where: { id } });
  if (!team || team.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Disconnect all members from team before deleting
  await prisma.team.update({
    where: { id },
    data: { members: { set: [] } },
  });

  await prisma.team.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
