import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

function isAdmin(session: { user?: { role?: string; organizationId?: string | null } } | null) {
  return session?.user?.role === UserRole.ADMIN;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId || !isAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, emoji, isUnlimited, defaultDays, minimumDays, requiresApproval } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const category = await prisma.leaveCategory.create({
    data: {
      name,
      emoji: emoji || "📅",
      organizationId: session.user.organizationId,
      isUnlimited: isUnlimited ?? true,
      defaultDays: isUnlimited ? null : (defaultDays ?? null),
      minimumDays: minimumDays ?? null,
      requiresApproval: requiresApproval ?? true,
    },
  });

  return NextResponse.json(category, { status: 201 });
}
