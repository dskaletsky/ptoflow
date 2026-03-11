import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

function isAdmin(session: { user?: { role?: string; organizationId?: string | null } } | null) {
  return session?.user?.role === UserRole.ADMIN;
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

  const holiday = await prisma.companyHoliday.findUnique({ where: { id } });
  if (!holiday || holiday.organizationId !== session.user.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.companyHoliday.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
