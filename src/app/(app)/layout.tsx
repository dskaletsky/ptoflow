import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/auth/signin");
  }

  const isManagerOrAdmin =
    session.user.role === UserRole.ADMIN ||
    session.user.role === UserRole.MANAGER;

  const pendingCount =
    isManagerOrAdmin && session.user.organizationId
      ? await prisma.leaveRequest.count({
          where: {
            status: "PENDING",
            user: { organizationId: session.user.organizationId },
          },
        })
      : 0;

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar user={session.user} pendingCount={pendingCount} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
