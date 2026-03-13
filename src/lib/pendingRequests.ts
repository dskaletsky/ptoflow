import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

function approverFilter(userId: string, orgId: string, role: UserRole) {
  return role === UserRole.ADMIN
    ? { organizationId: orgId }
    : { organizationId: orgId, managerId: userId };
}

export async function countPendingForApprover(
  userId: string,
  orgId: string,
  role: UserRole
): Promise<number> {
  return prisma.leaveRequest.count({
    where: { status: "PENDING", user: approverFilter(userId, orgId, role) },
  });
}

export async function getPendingForApprover(
  userId: string,
  orgId: string,
  role: UserRole
) {
  return prisma.leaveRequest.findMany({
    where: { status: "PENDING", user: approverFilter(userId, orgId, role) },
    include: {
      category: true,
      user: { select: { id: true, name: true, email: true, image: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}
