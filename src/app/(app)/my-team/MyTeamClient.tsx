"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface User {
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
}

interface LeaveBank {
  id: string;
  userId: string;
  categoryId: string;
  year: number;
  allocatedDays: number;
  usedDays: number;
}

interface Props {
  users: User[];
  categories: Category[];
  leaveBanks: LeaveBank[];
  allTeams: { id: string; name: string }[];
  isAdmin: boolean;
}

function sortCategories<T extends { name: string; isUnlimited: boolean }>(cats: T[]): T[] {
  return [...cats].sort((a, b) => {
    if (a.name === "Vacation") return -1;
    if (b.name === "Vacation") return 1;
    if (!a.isUnlimited && b.isUnlimited) return -1;
    if (a.isUnlimited && !b.isUnlimited) return 1;
    return a.name.localeCompare(b.name);
  });
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

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MyTeamClient({ users: initialUsers, categories, leaveBanks, allTeams, isAdmin }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [showAddUser, setShowAddUser] = useState(false);
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uTitle, setUTitle] = useState("");
  const [uRole, setURole] = useState<"ADMIN" | "MANAGER" | "TEAM_MEMBER">("TEAM_MEMBER");
  const [uStartDate, setUStartDate] = useState("");
  const [uManagerId, setUManagerId] = useState("");
  const [uTeamIds, setUTeamIds] = useState<string[]>([]);
  const [uError, setUError] = useState("");
  const [uSaving, setUSaving] = useState(false);

  const managersAndAdmins = users.filter(
    (u) => u.role === "ADMIN" || u.role === "MANAGER"
  );

  function resetForm() {
    setUName(""); setUEmail(""); setUTitle(""); setURole("TEAM_MEMBER");
    setUStartDate(""); setUManagerId(""); setUTeamIds([]); setUError("");
  }

  function toggleTeam(teamId: string) {
    setUTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setUError(""); setUSaving(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: uName, email: uEmail, title: uTitle || null,
          role: uRole, startDate: uStartDate || null, managerId: uManagerId || null,
          teamIds: uTeamIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setUError(data.error ?? "Failed to add employee"); return; }
      const manager = managersAndAdmins.find((u) => u.id === uManagerId);
      const selectedTeams = allTeams.filter((t) => uTeamIds.includes(t.id));
      setUsers([
        ...users,
        { ...data, teams: selectedTeams, manager: manager ? { id: manager.id, name: manager.name ?? "" } : null },
      ].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
      setShowAddUser(false);
      resetForm();
      router.refresh();
    } finally { setUSaving(false); }
  }

  const sortedCategories = sortCategories(categories);

  // Build bank lookup: { [userId]: { [categoryId]: LeaveBank } }
  const bankMap: Record<string, Record<string, LeaveBank>> = {};
  for (const bank of leaveBanks) {
    if (!bankMap[bank.userId]) bankMap[bank.userId] = {};
    bankMap[bank.userId][bank.categoryId] = bank;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isAdmin ? "All employees in your organization." : "Your direct reports."}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { resetForm(); setShowAddUser(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            + Add employee
          </button>
        )}
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">No team members found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Name</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Email</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Role</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Title</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Team(s)</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Manager</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500 whitespace-nowrap">Start date</th>
                {sortedCategories.map((cat) => (
                  <th key={cat.id} className="text-left px-5 py-3 font-medium text-gray-500 whitespace-nowrap min-w-[120px]">
                    <div>{cat.emoji} {cat.name}</div>
                    <div className="font-normal text-xs text-gray-400 mt-0.5">
                      {cat.isUnlimited ? "Unlimited" : `${cat.defaultDays} days`}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3">
                    <Link href={`/my-team/${user.id}`} className="flex items-center gap-2 group">
                      {user.image ? (
                        <img src={user.image} className="w-7 h-7 rounded-full" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                          {user.name?.[0] ?? "?"}
                        </div>
                      )}
                      <span className="font-medium text-blue-700 whitespace-nowrap group-hover:underline">{user.name}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{user.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap ${roleBadge[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{user.title ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {user.teams.length > 0 ? user.teams.map((t) => t.name).join(", ") : "—"}
                  </td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{user.manager?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">
                    {user.startDate ? formatDate(user.startDate) : "—"}
                  </td>
                  {sortedCategories.map((cat) => {
                    const bank = bankMap[user.id]?.[cat.id];
                    const d = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
                    if (cat.isUnlimited) {
                      return (
                        <td key={cat.id} className="px-5 py-3 text-gray-600 whitespace-nowrap">
                          {bank ? d(bank.usedDays) : "0 days"}
                        </td>
                      );
                    }
                    if (!bank) {
                      return (
                        <td key={cat.id} className="px-5 py-3 text-gray-600 whitespace-nowrap">—</td>
                      );
                    }
                    const remaining = bank.allocatedDays - bank.usedDays;
                    return (
                      <td key={cat.id} className="px-5 py-3 whitespace-nowrap">
                        <div className="text-gray-800 font-medium">{d(bank.usedDays)}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{d(remaining)} remaining</div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add employee modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add employee</h2>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text" value={uName} onChange={(e) => setUName(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email" value={uEmail} onChange={(e) => setUEmail(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text" value={uTitle} onChange={(e) => setUTitle(e.target.value)}
                  placeholder="e.g. Senior Engineer"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={uRole}
                    onChange={(e) => setURole(e.target.value as "ADMIN" | "MANAGER" | "TEAM_MEMBER")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TEAM_MEMBER">Team Member</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start date <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="date" value={uStartDate} onChange={(e) => setUStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Manager <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <select
                  value={uManagerId} onChange={(e) => setUManagerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— No manager —</option>
                  {managersAndAdmins.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              {allTeams.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teams <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <div className="space-y-2">
                    {allTeams.map((team) => (
                      <label key={team.id} className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={uTeamIds.includes(team.id)}
                          onChange={() => toggleTeam(team.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{team.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {uError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {uError}
                </p>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAddUser(false); resetForm(); }}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={uSaving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
                >
                  {uSaving ? "Adding..." : "Add employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
