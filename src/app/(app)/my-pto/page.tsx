import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MyPtoClient } from "./MyPtoClient";

export default async function MyPtoPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const userId = session.user.id;
  const orgId = session.user.organizationId;
  const year = new Date().getFullYear();

  const [categories, banks, myRequests] = await Promise.all([
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
  ]);

  return (
    <MyPtoClient
      categories={JSON.parse(JSON.stringify(categories))}
      banks={JSON.parse(JSON.stringify(banks))}
      myRequests={JSON.parse(JSON.stringify(myRequests))}
    />
  );
}
