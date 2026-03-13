"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PtoCalendar } from "@/components/PtoCalendar";

interface Employee {
  id: string;
  name: string | null;
  email: string | null;
  role: "ADMIN" | "MANAGER" | "TEAM_MEMBER";
  title: string | null;
  startDate: string | null;
  image: string | null;
  teams: { id: string; name: string }[];
  manager: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
  emoji: string;
  isUnlimited: boolean;
  defaultDays: number | null;
  requiresApproval: boolean;
}

interface LeaveBank {
  id: string;
  categoryId: string;
  allocatedDays: number;
  usedDays: number;
}

interface LeaveRequest {
  id: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  workingDaysCount: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  description: string | null;
  rejectionReason: string | null;
  category: Category;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
}

interface Props {
  employee: Employee;
  categories: Category[];
  banks: LeaveBank[];
  pendingRequests: LeaveRequest[];
  historyRequests: LeaveRequest[];
  allTeams: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  holidays: Holiday[];
  isAdmin: boolean;
}

const roleLabels: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  TEAM_MEMBER: "Team Member",
};

const roleBadge: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700",
  MANAGER: "bg-blue-100 text-blue-700",
  TEAM_MEMBER: "bg-gray-100 text-gray-600",
};

function sortCategories<T extends { name: string; isUnlimited: boolean }>(cats: T[]): T[] {
  return [...cats].sort((a, b) => {
    if (a.name === "Vacation") return -1;
    if (b.name === "Vacation") return 1;
    if (!a.isUnlimited && b.isUnlimited) return -1;
    if (a.isUnlimited && !b.isUnlimited) return 1;
    return a.name.localeCompare(b.name);
  });
}

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  APPROVED: "bg-green-50 text-green-700 border border-green-200",
  REJECTED: "bg-red-50 text-red-700 border border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border border-gray-200",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function EmployeeProfileClient({
  employee: initialEmployee,
  categories,
  banks,
  pendingRequests: initialPending,
  historyRequests: initialHistory,
  allTeams,
  managers,
  holidays,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [employee, setEmployee] = useState(initialEmployee);
  const [pendingRequests, setPendingRequests] = useState(initialPending);
  const [historyRequests, setHistoryRequests] = useState(initialHistory);

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState(employee.name ?? "");
  const [editTitle, setEditTitle] = useState(employee.title ?? "");
  const [editRole, setEditRole] = useState(employee.role);
  const [editStartDate, setEditStartDate] = useState(
    employee.startDate ? employee.startDate.slice(0, 10) : ""
  );
  const [editManagerId, setEditManagerId] = useState(
    employee.manager?.id ?? ""
  );
  const [editTeamIds, setEditTeamIds] = useState<string[]>(
    employee.teams.map((t) => t.id)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Rejection modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Build bank lookup
  const bankMap: Record<string, LeaveBank> = {};
  for (const bank of banks) {
    bankMap[bank.categoryId] = bank;
  }

  const limitedCategories = sortCategories(categories.filter((c) => !c.isUnlimited));

  function openEdit() {
    setEditName(employee.name ?? "");
    setEditTitle(employee.title ?? "");
    setEditRole(employee.role);
    setEditStartDate(employee.startDate ? employee.startDate.slice(0, 10) : "");
    setEditManagerId(employee.manager?.id ?? "");
    setEditTeamIds(employee.teams.map((t) => t.id));
    setSaveError("");
    setShowEdit(true);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");

    const originalTeamIds = employee.teams.map((t) => t.id);
    const addTeamIds = editTeamIds.filter((id) => !originalTeamIds.includes(id));
    const removeTeamIds = originalTeamIds.filter(
      (id) => !editTeamIds.includes(id)
    );

    try {
      const res = await fetch(`/api/settings/users/${employee.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          title: editTitle,
          role: editRole,
          startDate: editStartDate || null,
          managerId: editManagerId || null,
          addTeamIds,
          removeTeamIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Something went wrong.");
        return;
      }

      setEmployee(data);
      setShowEdit(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  function toggleTeam(teamId: string) {
    setEditTeamIds((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId]
    );
  }

  async function handleApprove(id: string) {
    const res = await fetch(`/api/pto/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });

    if (res.ok) {
      const approved = pendingRequests.find((r) => r.id === id);
      if (approved) {
        setPendingRequests(pendingRequests.filter((r) => r.id !== id));
        setHistoryRequests([
          { ...approved, status: "APPROVED" },
          ...historyRequests,
        ]);
      }
      router.refresh();
    }
  }

  async function handleRejectWithReason(id: string, reason: string) {
    const res = await fetch(`/api/pto/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejectionReason: reason }),
    });

    if (res.ok) {
      const rejected = pendingRequests.find((r) => r.id === id);
      if (rejected) {
        setPendingRequests(pendingRequests.filter((r) => r.id !== id));
        setHistoryRequests([
          { ...rejected, status: "REJECTED", rejectionReason: reason },
          ...historyRequests,
        ]);
      }
      setRejectingId(null);
      setRejectionReason("");
      router.refresh();
    }
  }

  async function handleCancel(id: string) {
    const res = await fetch(`/api/pto/requests/${id}`, { method: "DELETE" });
    if (res.ok) {
      setPendingRequests(pendingRequests.map((r) => r.id === id ? { ...r, status: "CANCELLED" } : r));
      setHistoryRequests(historyRequests.map((r) => r.id === id ? { ...r, status: "CANCELLED" } : r));
      router.refresh();
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/my-team"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-6"
      >
        ← Back to My Team
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          {employee.image ? (
            <img
              src={employee.image}
              className="w-16 h-16 rounded-full"
              alt=""
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-700">
              {employee.name?.[0] ?? "?"}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {employee.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-500">
              <span
                className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${roleBadge[employee.role]}`}
              >
                {roleLabels[employee.role]}
              </span>
              {employee.title && <span>{employee.title}</span>}
              {employee.teams.length > 0 && (
                <span>{employee.teams.map((t) => t.name).join(", ")}</span>
              )}
              {employee.manager && (
                <span>Reports to {employee.manager.name}</span>
              )}
              {employee.startDate && (
                <span>Started {formatDate(employee.startDate)}</span>
              )}
            </div>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={openEdit}
            className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Edit employee
          </button>
        )}
      </div>

      {/* Leave stats (limited categories only) */}
      {limitedCategories.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Leave Balance
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {limitedCategories.map((cat) => {
              const bank = bankMap[cat.id];
              if (!bank) return null;
              const remaining = bank.allocatedDays - bank.usedDays;
              return (
                <div
                  key={cat.id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{cat.emoji}</span>
                    <span className="text-sm font-medium text-gray-700">
                      {cat.name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {bank.usedDays} used of {bank.allocatedDays} days
                  </p>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {remaining} remaining
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Pending requests (admin/manager only) */}
      {pendingRequests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Pending Requests
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Type
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Dates
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Days
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">
                    Note
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {pendingRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span>{req.category.emoji}</span>
                        <span className="font-medium text-gray-800">
                          {req.category.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(req.startDate)} – {formatDate(req.endDate)}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {req.workingDaysCount}d
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                      {req.description ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleApprove(req.id)}
                          className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors font-medium"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setRejectingId(req.id);
                            setRejectionReason("");
                          }}
                          className="text-xs bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors font-medium"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Request history */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Request History
        </h2>
        <PtoCalendar
          requests={[...pendingRequests, ...historyRequests]}
          holidays={holidays}
          onApprove={handleApprove}
          onReject={handleRejectWithReason}
          onCancel={handleCancel}
        />
      </section>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit employee
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="e.g. Senior Engineer"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) =>
                    setEditRole(
                      e.target.value as "ADMIN" | "MANAGER" | "TEAM_MEMBER"
                    )
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="TEAM_MEMBER">Team Member</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start date{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="date"
                  value={editStartDate}
                  onChange={(e) => setEditStartDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manager{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={editManagerId}
                  onChange={(e) => setEditManagerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No manager —</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {allTeams.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teams
                  </label>
                  <div className="space-y-2">
                    {allTeams.map((team) => (
                      <label
                        key={team.id}
                        className="flex items-center gap-3 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={editTeamIds.includes(team.id)}
                          onChange={() => toggleTeam(team.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {team.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {saveError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {saveError}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection reason modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Reject request
            </h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Let the employee know why..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setRejectingId(null)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRejectWithReason(rejectingId, rejectionReason)}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
