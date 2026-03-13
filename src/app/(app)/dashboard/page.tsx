import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import Link from "next/link";
import { RequestPtoButton } from "@/components/RequestPtoButton";

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  APPROVED: "bg-green-50 text-green-700 border border-green-200",
  REJECTED: "bg-red-50 text-red-700 border border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border border-gray-200",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  const userId = session.user.id;
  const orgId = session.user.organizationId;
  const year = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isManagerOrAdmin =
    session.user.role === UserRole.ADMIN ||
    session.user.role === UserRole.MANAGER;

  // Fetch leave banks and categories
  const [banks, categories] = await Promise.all([
    orgId
      ? prisma.leaveBank.findMany({
          where: { userId, year },
          include: { category: true },
        })
      : [],
    orgId
      ? prisma.leaveCategory.findMany({
          where: { organizationId: orgId, isActive: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);

  // Fetch upcoming approved requests
  const upcomingRequests = await prisma.leaveRequest.findMany({
    where: { userId, status: "APPROVED", endDate: { gte: today } },
    include: { category: true },
    orderBy: { startDate: "asc" },
    take: 5,
  });

  const isAdmin = session.user.role === UserRole.ADMIN;
  const pendingUserFilter = isAdmin
    ? { organizationId: orgId }
    : { organizationId: orgId, managerId: userId };

  // Fetch pending requests (for manager/admin review)
  const pendingRequests =
    isManagerOrAdmin && orgId
      ? await prisma.leaveRequest.findMany({
          where: {
            status: "PENDING",
            user: pendingUserFilter,
          },
          include: { category: true, user: true },
          orderBy: { createdAt: "asc" },
        })
      : [];

  // Fetch team out of office today
  const teamOutToday = orgId
    ? await prisma.leaveRequest.findMany({
        where: {
          status: "APPROVED",
          startDate: { lte: today },
          endDate: { gte: today },
          user: { organizationId: orgId, id: { not: userId } },
        },
        include: { category: true, user: true },
      })
    : [];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {greeting()}, {session.user.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">
            Here's what's happening with your team's time off.
          </p>
        </div>
        <RequestPtoButton
          categories={JSON.parse(JSON.stringify(categories))}
          banks={JSON.parse(JSON.stringify(banks))}
        />
      </div>

      {/* Bank balances */}
      {banks.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Your Leave Balances ({year})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {banks.map((bank) => {
              const remaining = bank.allocatedDays - bank.usedDays;
              const pct = bank.allocatedDays > 0
                ? Math.round((bank.usedDays / bank.allocatedDays) * 100)
                : 0;
              return (
                <div
                  key={bank.id}
                  className="bg-white rounded-xl border border-gray-200 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{bank.category.emoji}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {bank.category.name}
                    </span>
                  </div>
                  <div className="flex items-end justify-between mb-2">
                    <span className="text-2xl font-bold text-gray-900">
                      {remaining}
                    </span>
                    <span className="text-sm text-gray-400">
                      of {bank.allocatedDays} days left
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming PTO */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Your upcoming time off
            </h2>
            <Link
              href="/my-pto"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View all →
            </Link>
          </div>
          {upcomingRequests.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">No upcoming time off.</p>
              <Link
                href="/my-pto"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-1 inline-block"
              >
                Request time off →
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {upcomingRequests.map((req) => (
                <li key={req.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{req.category.emoji}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {req.category.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(req.startDate)} – {formatDate(req.endDate)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {req.workingDaysCount}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Pending approvals (admin/manager) */}
        {isManagerOrAdmin && (
          <section className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Pending approvals
              </h2>
              {pendingRequests.length > 0 && (
                <span className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </div>
            {pendingRequests.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-gray-400">
                  No requests waiting for review.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {pendingRequests.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span>{req.category.emoji}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {req.user.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {req.category.name} · {formatDate(req.startDate)} –{" "}
                          {formatDate(req.endDate)} · {req.workingDaysCount}d
                        </p>
                      </div>
                    </div>
                    <Link
                      href="/my-pto?tab=approvals"
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Review →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Team out today */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Out of office today
          </h2>
          {teamOutToday.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">
                Everyone is in today.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {teamOutToday.map((req) => (
                <li key={req.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-medium text-blue-700">
                    {req.user.name?.[0] ?? "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {req.user.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {req.category.emoji} {req.category.name} · back{" "}
                      {formatDate(req.endDate)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
