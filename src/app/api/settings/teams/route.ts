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

  const teams = await prisma.team.findMany({
    where: { organizationId: session.user.organizationId },
    include: {
      manager: { select: { id: true, name: true } },
      members: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(teams);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, managerId } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: {
      name: name.trim(),
      organizationId: session.user.organizationId,
      managerId: managerId || null,
    },
    include: {
      manager: { select: { id: true, name: true } },
      members: { select: { id: true, name: true, email: true, image: true } },
    },
  });

  return NextResponse.json(team, { status: 201 });
}
