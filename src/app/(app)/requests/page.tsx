import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { RequestsClient } from "./RequestsClient";

export default async function RequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role === UserRole.TEAM_MEMBER) redirect("/dashboard");

  const orgId = session.user.organizationId!;
  const isAdmin = session.user.role === UserRole.ADMIN;
  const userFilter = isAdmin
    ? { organizationId: orgId }
    : { organizationId: orgId, managerId: session.user.id };

  const [pendingRequests, previousRequests] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: { status: "PENDING", user: userFilter },
      include: {
        category: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: { in: ["APPROVED", "REJECTED", "CANCELLED"] },
        user: userFilter,
      },
      include: {
        category: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <RequestsClient
      pendingRequests={JSON.parse(JSON.stringify(pendingRequests))}
      previousRequests={JSON.parse(JSON.stringify(previousRequests))}
    />
  );
}
