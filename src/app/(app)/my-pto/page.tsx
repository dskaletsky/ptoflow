import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { MyPtoClient } from "./MyPtoClient";

export default async function MyPtoPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const userId = session.user.id;
  const orgId = session.user.organizationId;
  const year = new Date().getFullYear();

  const isManagerOrAdmin =
    session.user.role === UserRole.ADMIN ||
    session.user.role === UserRole.MANAGER;

  const [categories, banks, myRequests, pendingRequests] = await Promise.all([
    orgId
      ? prisma.leaveCategory.findMany({
          where: { organizationId: orgId, isActive: true },
          orderBy: { name: "asc" },
        })
      : [],
    prisma.leaveBank.findMany({
      where: { userId, year },
      include: { category: true },
    }),
    prisma.leaveRequest.findMany({
      where: { userId },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    }),
    isManagerOrAdmin && orgId
      ? prisma.leaveRequest.findMany({
          where: { status: "PENDING", user: { organizationId: orgId } },
          include: { category: true, user: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);

  return (
    <MyPtoClient
      categories={JSON.parse(JSON.stringify(categories))}
      banks={JSON.parse(JSON.stringify(banks))}
      myRequests={JSON.parse(JSON.stringify(myRequests))}
      pendingRequests={JSON.parse(JSON.stringify(pendingRequests))}
      isManagerOrAdmin={isManagerOrAdmin}
    />
  );
}
