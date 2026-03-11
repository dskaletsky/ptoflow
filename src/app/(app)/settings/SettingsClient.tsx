"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Org {
  id: string;
  name: string;
  domain: string | null;
  prorateNewEmployees: boolean;
  googleCalendarId: string | null;
  googleCalendarName: string | null;
  googleAdminEmail: string | null;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  role: "ADMIN" | "MANAGER" | "TEAM_MEMBER";
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
  minimumDays: number | null;
  requiresApproval: boolean;
  isActive: boolean;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
}

interface Team {
  id: string;
  name: string;
  manager: { id: string; name: string } | null;
  members: { id: string; name: string | null; email: string | null; image: string | null }[];
  googleCalendarId: string | null;
  googleCalendarName: string | null;
  googleCalendarCreatedAt: string | null;
  googleCalendarOwner: string | null;
}

interface Props {
  org: Org;
  users: User[];
  categories: Category[];
  holidays: Holiday[];
  teams: Team[];
  currentUserId: string;
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
    timeZone: "UTC", month: "short", day: "numeric", year: "numeric",
  });
}

export function SettingsClient({ org: initialOrg, users: initialUsers, categories: initialCategories, holidays: initialHolidays, teams: initialTeams, currentUserId }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"team" | "teams" | "categories" | "holidays" | "organization" | "calendars">("team");

  // Team state
  const [users, setUsers] = useState(initialUsers);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Category state
  const [categories, setCategories] = useState(initialCategories);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Holiday state
  const [holidays, setHolidays] = useState(initialHolidays);
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  // Org state
  const [org, setOrg] = useState(initialOrg);
  const [orgName, setOrgName] = useState(initialOrg.name);
  const [prorateNewEmployees, setProrateNewEmployees] = useState(initialOrg.prorateNewEmployees);
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  // User form state
  const [uName, setUName] = useState("");
  const [uEmail, setUEmail] = useState("");
  const [uRole, setURole] = useState<"ADMIN" | "MANAGER" | "TEAM_MEMBER">("TEAM_MEMBER");
  const [uStartDate, setUStartDate] = useState("");
  const [uManagerId, setUManagerId] = useState("");
  const [uError, setUError] = useState("");
  const [uSaving, setUSaving] = useState(false);

  // Category form state
  const [cName, setCName] = useState("");
  const [cEmoji, setCEmoji] = useState("📅");
  const [cUnlimited, setCUnlimited] = useState(true);
  const [cDays, setCDays] = useState("");
  const [cMinDays, setCMinDays] = useState("");
  const [cApproval, setCApproval] = useState(true);
  const [cError, setCError] = useState("");
  const [cSaving, setCSaving] = useState(false);

  // Holiday form state
  const [hName, setHName] = useState("");
  const [hDate, setHDate] = useState("");
  const [hRecurring, setHRecurring] = useState(true);
  const [hError, setHError] = useState("");
  const [hSaving, setHSaving] = useState(false);

  // Teams state
  const [teams, setTeams] = useState(initialTeams);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [tName, setTName] = useState("");
  const [tManagerId, setTManagerId] = useState("");
  const [tMemberIds, setTMemberIds] = useState<string[]>([]);
  const [tError, setTError] = useState("");
  const [tSaving, setTSaving] = useState(false);

  // Google Calendar state
  const [gcOrgCalendarId, setGcOrgCalendarId] = useState(initialOrg.googleCalendarId ?? "");
  const [gcAdminEmail, setGcAdminEmail] = useState(initialOrg.googleAdminEmail ?? "");
  const [gcCalendarName, setGcCalendarName] = useState(initialOrg.googleCalendarName ?? `${initialOrg.name} PTO`);
  const [gcNameInput, setGcNameInput] = useState(initialOrg.googleCalendarName ?? `${initialOrg.name} PTO`);
  const [gcEditingName, setGcEditingName] = useState(false);
  const [gcSaving, setGcSaving] = useState(false);
  const [gcRenameSaving, setGcRenameSaving] = useState(false);
  const [gcSyncing, setGcSyncing] = useState(false);
  const [gcSyncResult, setGcSyncResult] = useState("");
  const [gcError, setGcError] = useState("");
  const [gcRenameError, setGcRenameError] = useState("");
  const [gcTeamDeleting, setGcTeamDeleting] = useState<string | null>(null);
  const [gcTeamSyncing, setGcTeamSyncing] = useState<string | null>(null);
  const [gcTeamSyncResult, setGcTeamSyncResult] = useState<Record<string, string>>({});
  const [gcTeamSaving, setGcTeamSaving] = useState<string | null>(null);
  const [gcTeamRenameSaving, setGcTeamRenameSaving] = useState<string | null>(null);
  const [gcTeamEditingName, setGcTeamEditingName] = useState<string | null>(null);
  const [gcTeamNameInput, setGcTeamNameInput] = useState("");

  interface TeamCalendarMeta { calendarId: string; calendarName: string; calendarCreatedAt: string | null; calendarOwner: string | null; }
  const [gcTeamCalendars, setGcTeamCalendars] = useState<Record<string, TeamCalendarMeta>>(
    Object.fromEntries(
      initialTeams
        .filter(t => t.googleCalendarId)
        .map(t => [t.id, {
          calendarId: t.googleCalendarId!,
          calendarName: t.googleCalendarName ?? `${t.name} PTO`,
          calendarCreatedAt: t.googleCalendarCreatedAt ?? null,
          calendarOwner: t.googleCalendarOwner ?? null,
        }])
    )
  );

  function openEditUser(user: User) {
    setUName(user.name ?? "");
    setUEmail(user.email ?? "");
    setURole(user.role);
    setUStartDate(user.startDate ? user.startDate.split("T")[0] : "");
    setUManagerId(user.manager?.id ?? "");
    setUError("");
    setEditingUser(user);
  }

  function openEditCategory(cat: Category) {
    setCName(cat.name);
    setCEmoji(cat.emoji);
    setCUnlimited(cat.isUnlimited);
    setCDays(cat.defaultDays?.toString() ?? "");
    setCMinDays(cat.minimumDays?.toString() ?? "");
    setCApproval(cat.requiresApproval);
    setCError("");
    setEditingCategory(cat);
  }

  function resetUserForm() {
    setUName(""); setUEmail(""); setURole("TEAM_MEMBER");
    setUStartDate(""); setUManagerId(""); setUError("");
  }

  function resetCategoryForm() {
    setCName(""); setCEmoji("📅"); setCUnlimited(true);
    setCDays(""); setCMinDays(""); setCApproval(true); setCError("");
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setUError(""); setUSaving(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: uName, email: uEmail, role: uRole, startDate: uStartDate || null, managerId: uManagerId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setUError(data.error ?? "Failed to add user"); return; }
      setUsers([...users, { ...data, teams: [], manager: users.find(u => u.id === uManagerId) ? { id: uManagerId, name: users.find(u => u.id === uManagerId)!.name ?? "" } : null }].sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")));
      setShowAddUser(false);
      resetUserForm();
      router.refresh();
    } finally { setUSaving(false); }
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setUError(""); setUSaving(true);
    try {
      const res = await fetch(`/api/settings/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: uName, role: uRole, startDate: uStartDate || null, managerId: uManagerId || null }),
      });
      const data = await res.json();
      if (!res.ok) { setUError(data.error ?? "Failed to update user"); return; }
      setUsers(users.map(u => u.id === editingUser.id ? data : u));
      setEditingUser(null);
      resetUserForm();
      router.refresh();
    } finally { setUSaving(false); }
  }

  async function handleRemoveUser(id: string) {
    if (!confirm("Remove this employee from your organization?")) return;
    const res = await fetch(`/api/settings/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(users.filter(u => u.id !== id));
      router.refresh();
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    setCError(""); setCSaving(true);
    try {
      const res = await fetch("/api/settings/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cName, emoji: cEmoji, isUnlimited: cUnlimited, defaultDays: cUnlimited ? null : parseInt(cDays) || null, minimumDays: cMinDays ? parseInt(cMinDays) : null, requiresApproval: cApproval }),
      });
      const data = await res.json();
      if (!res.ok) { setCError(data.error ?? "Failed to add category"); return; }
      setCategories([...categories, data].sort((a, b) => a.name.localeCompare(b.name)));
      setShowAddCategory(false);
      resetCategoryForm();
      router.refresh();
    } finally { setCSaving(false); }
  }

  async function handleEditCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!editingCategory) return;
    setCError(""); setCSaving(true);
    try {
      const res = await fetch(`/api/settings/categories/${editingCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cName, emoji: cEmoji, isUnlimited: cUnlimited, defaultDays: cUnlimited ? null : parseInt(cDays) || null, minimumDays: cMinDays ? parseInt(cMinDays) : null, requiresApproval: cApproval }),
      });
      const data = await res.json();
      if (!res.ok) { setCError(data.error ?? "Failed to update category"); return; }
      setCategories(categories.map(c => c.id === editingCategory.id ? data : c));
      setEditingCategory(null);
      resetCategoryForm();
      router.refresh();
    } finally { setCSaving(false); }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Deactivate this leave category? Existing requests will be preserved.")) return;
    const res = await fetch(`/api/settings/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories(categories.map(c => c.id === id ? { ...c, isActive: false } : c));
      router.refresh();
    }
  }

  async function handleAddHoliday(e: React.FormEvent) {
    e.preventDefault();
    setHError(""); setHSaving(true);
    try {
      const res = await fetch("/api/settings/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: hName, date: hDate, recurring: hRecurring }),
      });
      const data = await res.json();
      if (!res.ok) { setHError(data.error ?? "Failed to add holiday"); return; }
      setHolidays([...holidays, data].sort((a, b) => a.date.localeCompare(b.date)));
      setShowAddHoliday(false);
      setHName(""); setHDate(""); setHRecurring(true);
      router.refresh();
    } finally { setHSaving(false); }
  }

  async function handleDeleteHoliday(id: string) {
    const res = await fetch(`/api/settings/holidays/${id}`, { method: "DELETE" });
    if (res.ok) {
      setHolidays(holidays.filter(h => h.id !== id));
      router.refresh();
    }
  }

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    setSavingOrg(true);
    try {
      const res = await fetch("/api/settings/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: orgName, prorateNewEmployees }),
      });
      const data = await res.json();
      if (res.ok) {
        setOrg(data);
        setOrgSaved(true);
        setTimeout(() => setOrgSaved(false), 2000);
        router.refresh();
      }
    } finally { setSavingOrg(false); }
  }

  function openAddTeam() {
    setTName(""); setTManagerId(""); setTMemberIds([]); setTError("");
    setEditingTeam(null);
    setShowAddTeam(true);
  }

  function openEditTeam(team: Team) {
    setTName(team.name);
    setTManagerId(team.manager?.id ?? "");
    setTMemberIds(team.members.map(m => m.id));
    setTError("");
    setEditingTeam(team);
    setShowAddTeam(true);
  }

  async function handleSaveTeam(e: React.FormEvent) {
    e.preventDefault();
    setTError(""); setTSaving(true);
    try {
      if (editingTeam) {
        const prevMemberIds = editingTeam.members.map(m => m.id);
        const addMemberIds = tMemberIds.filter(id => !prevMemberIds.includes(id));
        const removeMemberIds = prevMemberIds.filter(id => !tMemberIds.includes(id));
        const res = await fetch(`/api/settings/teams/${editingTeam.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tName, managerId: tManagerId || null, addMemberIds, removeMemberIds }),
        });
        const data = await res.json();
        if (!res.ok) { setTError(data.error ?? "Failed to update team"); return; }
        setTeams(teams.map(t => t.id === editingTeam.id ? data : t));
      } else {
        const res = await fetch("/api/settings/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: tName, managerId: tManagerId || null }),
        });
        const data = await res.json();
        if (!res.ok) { setTError(data.error ?? "Failed to create team"); return; }
        // Add initial members if any
        if (tMemberIds.length > 0) {
          await fetch(`/api/settings/teams/${data.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ addMemberIds: tMemberIds }),
          });
          const updated = await fetch(`/api/settings/teams/${data.id}`).then(r => r.json()).catch(() => data);
          setTeams([...teams, updated].sort((a, b) => a.name.localeCompare(b.name)));
        } else {
          setTeams([...teams, data].sort((a, b) => a.name.localeCompare(b.name)));
        }
        setShowAddTeam(false);
        router.refresh();
        return;
      }
      setShowAddTeam(false);
      router.refresh();
    } finally { setTSaving(false); }
  }

  async function handleDeleteTeam(id: string) {
    if (!confirm("Delete this team? Members will be unassigned but not removed from the organization.")) return;
    const res = await fetch(`/api/settings/teams/${id}`, { method: "DELETE" });
    if (res.ok) {
      setTeams(teams.filter(t => t.id !== id));
      router.refresh();
    }
  }

  const managersAndAdmins = users.filter(u => u.role === "ADMIN" || u.role === "MANAGER");

  const tabs = [
    { key: "team", label: "Employees", count: users.length },
    { key: "teams", label: "Teams", count: teams.length },
    { key: "categories", label: "Leave Categories", count: categories.filter(c => c.isActive).length },
    { key: "holidays", label: "Holidays", count: holidays.length },
    { key: "organization", label: "Organization", count: null },
    { key: "calendars", label: "Calendars", count: null },
  ] as const;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1 text-sm">Configure your PTOFlow account.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            {t.label}
            {t.count !== null && (
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${tab === t.key ? "bg-gray-100 text-gray-600" : "bg-gray-200 text-gray-500"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TEAM TAB ── */}
      {tab === "team" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Employees</h2>
            <button
              onClick={() => { resetUserForm(); setShowAddUser(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Add employee
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Name</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Email</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Team(s)</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Manager</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Start date</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {user.image ? (
                          <img src={user.image} className="w-7 h-7 rounded-full" alt="" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                            {user.name?.[0] ?? "?"}
                          </div>
                        )}
                        <span className="font-medium text-gray-800">{user.name}</span>
                        {user.id === currentUserId && (
                          <span className="text-xs text-gray-400">(you)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{user.email}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${roleBadge[user.role]}`}>
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {user.teams.length > 0 ? user.teams.map(t => t.name).join(", ") : "—"}
                    </td>
                    <td className="px-5 py-3 text-gray-500">{user.manager?.name ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {user.startDate ? formatDate(user.startDate) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3 justify-end">
                        <button onClick={() => openEditUser(user)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                        {user.id !== currentUserId && (
                          <button onClick={() => handleRemoveUser(user.id)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">Remove</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TEAMS TAB ── */}
      {tab === "teams" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Teams</h2>
            <button onClick={openAddTeam} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
              + Create team
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <p className="text-gray-400 text-sm mb-2">No teams yet.</p>
              <button onClick={openAddTeam} className="text-blue-600 text-sm font-medium hover:text-blue-700">Create your first team →</button>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map(team => (
                <div key={team.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Manager: {team.manager?.name ?? <span className="italic">None assigned</span>}
                        {" · "}{team.members.length} member{team.members.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => openEditTeam(team)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                      <button onClick={() => handleDeleteTeam(team.id)} className="text-sm text-gray-400 hover:text-red-600 transition-colors">Delete</button>
                    </div>
                  </div>
                  {team.members.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {team.members.map(member => (
                        <div key={member.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                            {member.name?.[0] ?? "?"}
                          </div>
                          <span className="text-xs text-gray-700 font-medium">{member.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CATEGORIES TAB ── */}
      {tab === "categories" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Leave Categories</h2>
            <button
              onClick={() => { resetCategoryForm(); setShowAddCategory(true); }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Add category
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Category</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Bank</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Approval</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => (
                  <tr key={cat.id} className={`border-b border-gray-50 last:border-0 ${!cat.isActive ? "opacity-50" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{cat.emoji}</span>
                        <span className="font-medium text-gray-800">{cat.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {cat.isUnlimited ? (
                        <span>Unlimited{cat.minimumDays ? ` (min ${cat.minimumDays}d)` : ""}</span>
                      ) : (
                        <span>{cat.defaultDays} days/year</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${cat.requiresApproval ? "bg-yellow-50 text-yellow-700 border border-yellow-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
                        {cat.requiresApproval ? "Required" : "Auto-approved"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${cat.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {cat.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {cat.isActive && (
                        <div className="flex items-center gap-3 justify-end">
                          <button onClick={() => openEditCategory(cat)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Edit</button>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">Deactivate</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── HOLIDAYS TAB ── */}
      {tab === "holidays" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-800">Company Holidays</h2>
            <button
              onClick={() => setShowAddHoliday(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              + Add holiday
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Holiday</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Date</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Recurring</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {holidays.map(h => (
                  <tr key={h.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 font-medium text-gray-800">{h.name}</td>
                    <td className="px-5 py-3 text-gray-600">{formatDate(h.date)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${h.recurring ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-500"}`}>
                        {h.recurring ? "Annual" : "One-time"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => handleDeleteHoliday(h.id)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ORGANIZATION TAB ── */}
      {tab === "organization" && (
        <div className="max-w-lg">
          <h2 className="text-base font-semibold text-gray-800 mb-4">Organization Settings</h2>
          <form onSubmit={handleSaveOrg} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Organization name</label>
              <input
                type="text"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-between py-3 border-t border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-800">Prorate new employees</p>
                <p className="text-xs text-gray-500 mt-0.5">New employees added mid-year receive a prorated leave bank based on their start date.</p>
              </div>
              <button
                type="button"
                onClick={() => setProrateNewEmployees(!prorateNewEmployees)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${prorateNewEmployees ? "bg-blue-600" : "bg-gray-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${prorateNewEmployees ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={savingOrg}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {savingOrg ? "Saving..." : "Save changes"}
              </button>
              {orgSaved && <span className="text-sm text-green-600 font-medium">✓ Saved</span>}
            </div>
          </form>
        </div>
      )}

      {/* ── CALENDARS TAB ── */}
      {tab === "calendars" && (
        <div className="max-w-2xl space-y-6">
          <div>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Google Calendar Integration</h2>
            <p className="text-sm text-gray-500">Create shared PTO calendars for your teams and organization that employees can subscribe to in Google Calendar.</p>
          </div>

          {/* Admin email + All Company calendar */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            {!gcOrgCalendarId && (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠️ No All Company calendar set up yet.</p>
            )}
            <h3 className="text-sm font-semibold text-gray-800">All Company Calendar</h3>
            <p className="text-sm text-gray-500">Creates a shared PTO calendar in your Google account that all employees can subscribe to in Google Calendar.</p>

            {/* Calendar name — editable before and after creation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Calendar name</label>
              {gcOrgCalendarId && !gcEditingName ? (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-800">{gcCalendarName}</span>
                  <button
                    onClick={() => { setGcNameInput(gcCalendarName); setGcEditingName(true); setGcRenameError(""); }}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Rename
                  </button>
                </div>
              ) : gcOrgCalendarId && gcEditingName ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={gcNameInput}
                    onChange={e => setGcNameInput(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {gcRenameError && <p className="text-xs text-red-600">{gcRenameError}</p>}
                  <div className="flex gap-2">
                    <button
                      disabled={gcRenameSaving || !gcNameInput.trim()}
                      onClick={async () => {
                        setGcRenameSaving(true); setGcRenameError("");
                        try {
                          const res = await fetch("/api/settings/google-calendar/setup", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ calendarName: gcNameInput.trim() }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setGcRenameError(data.error ?? "Failed to rename"); return; }
                          setGcCalendarName(data.calendarName);
                          setGcEditingName(false);
                        } finally { setGcRenameSaving(false); }
                      }}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      {gcRenameSaving ? "Saving..." : "Save name"}
                    </button>
                    <button
                      onClick={() => setGcEditingName(false)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <input
                  type="text"
                  value={gcNameInput}
                  onChange={e => setGcNameInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {gcOrgCalendarId && (
              <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 space-y-1.5">
                <p>✅ Calendar configured</p>
                {gcAdminEmail && <p className="text-xs text-green-600">Owned by: {gcAdminEmail}</p>}
                <a
                  href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(gcOrgCalendarId)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-blue-600 hover:underline"
                >
                  Subscribe in Google Calendar →
                </a>
              </div>
            )}
            {gcOrgCalendarId && (
              <div className="flex items-center gap-3">
                <button
                  disabled={gcSyncing}
                  onClick={async () => {
                    setGcSyncing(true); setGcSyncResult(""); setGcError("");
                    try {
                      const res = await fetch("/api/settings/google-calendar/sync", { method: "POST" });
                      const data = await res.json();
                      if (!res.ok) { setGcError(data.error ?? "Sync failed"); return; }
                      setGcSyncResult(data.synced === 0 ? "All events already synced." : `✓ ${data.synced} PTO event${data.synced !== 1 ? "s" : ""} added to calendar.`);
                    } finally { setGcSyncing(false); }
                  }}
                  className="text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors"
                >
                  {gcSyncing ? "Syncing..." : "Sync existing PTO to calendar"}
                </button>
                {gcSyncResult && <span className="text-sm text-green-600">{gcSyncResult}</span>}
              </div>
            )}
            {gcError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{gcError}</p>}
            {!gcOrgCalendarId && (
              <button
                disabled={gcSaving || !gcNameInput.trim()}
                onClick={async () => {
                  setGcSaving(true); setGcError("");
                  try {
                    const res = await fetch("/api/settings/google-calendar/setup", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ calendarName: gcNameInput.trim() }),
                    });
                    const data = await res.json();
                    if (!res.ok) { setGcError(data.error ?? "Failed to create calendar"); return; }
                    setGcOrgCalendarId(data.calendarId);
                    setGcAdminEmail(data.googleAdminEmail);
                    setGcCalendarName(data.calendarName);
                  } finally { setGcSaving(false); }
                }}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {gcSaving ? "Creating..." : "Create All Company Calendar"}
              </button>
            )}
          </div>

          {/* Team calendars */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Team Calendars</h3>
              <p className="text-xs text-gray-500 mt-0.5">Create a dedicated PTO calendar for each team. Requires All Company calendar to be configured first.</p>
            </div>
            {teams.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-4">No teams configured yet. Create teams first in the Teams tab.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {[...teams].sort((a, b) => {
                  const aHas = !!gcTeamCalendars[a.id];
                  const bHas = !!gcTeamCalendars[b.id];
                  if (aHas === bHas) return 0;
                  return aHas ? -1 : 1;
                }).map(team => {
                  const cal = gcTeamCalendars[team.id];
                  const isEditingName = gcTeamEditingName === team.id;
                  return (
                    <div key={team.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-sm font-semibold text-gray-800">{team.name}</p>
                        {cal && (
                          <button
                            disabled={gcTeamDeleting === team.id}
                            onClick={async () => {
                              if (!confirm(`Remove the calendar configuration for ${team.name}? This will delete the calendar from Google Calendar.`)) return;
                              setGcTeamDeleting(team.id);
                              try {
                                const res = await fetch(`/api/settings/google-calendar/teams/${team.id}`, { method: "DELETE" });
                                const data = await res.json();
                                if (res.ok) {
                                  setGcTeamCalendars(prev => {
                                    const next = { ...prev };
                                    delete next[team.id];
                                    return next;
                                  });
                                } else {
                                  alert(data.error ?? "Failed to delete calendar");
                                }
                              } finally { setGcTeamDeleting(null); }
                            }}
                            className="shrink-0 text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-40"
                          >
                            {gcTeamDeleting === team.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                        {!cal && (
                          <button
                            disabled={gcTeamSaving === team.id || !gcOrgCalendarId}
                            onClick={async () => {
                              setGcTeamSaving(team.id);
                              try {
                                const res = await fetch(`/api/settings/google-calendar/teams/${team.id}`, { method: "POST" });
                                const data = await res.json();
                                if (res.ok) {
                                  setGcTeamCalendars(prev => ({ ...prev, [team.id]: {
                                    calendarId: data.calendarId,
                                    calendarName: data.calendarName,
                                    calendarCreatedAt: data.calendarCreatedAt,
                                    calendarOwner: data.calendarOwner,
                                  }}));
                                } else {
                                  alert(data.error ?? "Failed to create team calendar");
                                }
                              } finally { setGcTeamSaving(null); }
                            }}
                            className="shrink-0 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                          >
                            {gcTeamSaving === team.id ? "Creating..." : "Create Calendar"}
                          </button>
                        )}
                      </div>

                      {!cal && (
                        <p className="text-xs text-amber-600 mt-1">⚠️ No calendar set up yet.</p>
                      )}

                      {cal && (
                        <>
                        <div className="mt-3 space-y-2 text-xs text-gray-600">
                          {/* Calendar name */}
                          <div className="flex items-center gap-2">
                            <span className="w-24 text-gray-400 shrink-0">Calendar name</span>
                            {isEditingName ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input
                                  type="text"
                                  value={gcTeamNameInput}
                                  onChange={e => setGcTeamNameInput(e.target.value)}
                                  className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  disabled={gcTeamRenameSaving === team.id || !gcTeamNameInput.trim()}
                                  onClick={async () => {
                                    setGcTeamRenameSaving(team.id);
                                    try {
                                      const res = await fetch(`/api/settings/google-calendar/teams/${team.id}`, {
                                        method: "PATCH",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ calendarName: gcTeamNameInput.trim() }),
                                      });
                                      const data = await res.json();
                                      if (res.ok) {
                                        setGcTeamCalendars(prev => ({ ...prev, [team.id]: { ...prev[team.id], calendarName: data.calendarName } }));
                                        setGcTeamEditingName(null);
                                      } else {
                                        alert(data.error ?? "Failed to rename");
                                      }
                                    } finally { setGcTeamRenameSaving(null); }
                                  }}
                                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded-md hover:bg-blue-700 disabled:opacity-60"
                                >
                                  {gcTeamRenameSaving === team.id ? "Saving..." : "Save"}
                                </button>
                                <button onClick={() => setGcTeamEditingName(null)} className="text-gray-400 hover:text-gray-600">Cancel</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-800">{cal.calendarName}</span>
                                <button
                                  onClick={() => { setGcTeamNameInput(cal.calendarName); setGcTeamEditingName(team.id); }}
                                  className="text-blue-600 hover:underline"
                                >
                                  Rename
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Created */}
                          {cal.calendarCreatedAt && (
                            <div className="flex items-center gap-2">
                              <span className="w-24 text-gray-400 shrink-0">Created</span>
                              <span className="text-gray-800">{new Date(cal.calendarCreatedAt).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</span>
                            </div>
                          )}

                          {/* Owner */}
                          {cal.calendarOwner && (
                            <div className="flex items-center gap-2">
                              <span className="w-24 text-gray-400 shrink-0">Owner</span>
                              <span className="text-gray-800">{cal.calendarOwner}</span>
                            </div>
                          )}

                          {/* Calendar ID */}
                          <div className="flex items-start gap-2">
                            <span className="w-24 text-gray-400 shrink-0">Calendar ID</span>
                            <span className="text-gray-500 font-mono break-all">{cal.calendarId}</span>
                          </div>

                          {/* Subscribe link */}
                          <div className="flex items-center gap-2">
                            <span className="w-24 text-gray-400 shrink-0">Subscribe</span>
                            <a
                              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(cal.calendarId)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Open in Google Calendar →
                            </a>
                          </div>
                        </div>

                        {/* Sync button */}
                        <div className="mt-3 flex items-center gap-3">
                          <button
                            disabled={gcTeamSyncing === team.id}
                            onClick={async () => {
                              setGcTeamSyncing(team.id);
                              setGcTeamSyncResult(prev => ({ ...prev, [team.id]: "" }));
                              try {
                                const res = await fetch(`/api/settings/google-calendar/teams/${team.id}/sync`, { method: "POST" });
                                const data = await res.json();
                                if (res.ok) {
                                  setGcTeamSyncResult(prev => ({ ...prev, [team.id]: data.synced === 0 ? "All events already synced." : `✓ ${data.synced} event${data.synced !== 1 ? "s" : ""} resynced.` }));
                                } else {
                                  setGcTeamSyncResult(prev => ({ ...prev, [team.id]: data.error ?? "Sync failed." }));
                                }
                              } finally { setGcTeamSyncing(null); }
                            }}
                            className="text-xs border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-60 transition-colors"
                          >
                            {gcTeamSyncing === team.id ? "Syncing..." : "Sync PTO to calendar"}
                          </button>
                          {gcTeamSyncResult[team.id] && (
                            <span className="text-xs text-green-600">{gcTeamSyncResult[team.id]}</span>
                          )}
                        </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* How employees subscribe */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">How employees subscribe to PTO calendars</h3>
            <ol className="text-sm text-gray-600 space-y-1 list-decimal list-inside">
              <li>Open Google Calendar and click <strong>+ Other Calendars → Subscribe to calendar</strong>.</li>
              <li>Paste the Calendar ID (shown above after setup).</li>
              <li>The calendar will appear under <strong>Other Calendars</strong> in their sidebar.</li>
            </ol>
          </div>
        </div>
      )}

      {/* ── USER MODAL (add/edit) ── */}
      {(showAddUser || editingUser) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editingUser ? "Edit employee" : "Add employee"}</h2>
            </div>
            <form onSubmit={editingUser ? handleEditUser : handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input type="text" value={uName} onChange={e => setUName(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={uEmail} onChange={e => setUEmail(e.target.value)} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={uRole} onChange={e => setURole(e.target.value as "ADMIN" | "MANAGER" | "TEAM_MEMBER")}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="TEAM_MEMBER">Team Member</option>
                    <option value="MANAGER">Manager</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input type="date" value={uStartDate} onChange={e => setUStartDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager <span className="text-gray-400 font-normal">(optional)</span></label>
                <select value={uManagerId} onChange={e => setUManagerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No manager</option>
                  {users.filter(u => u.role === "ADMIN" || u.role === "MANAGER").map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              {uError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAddUser(false); setEditingUser(null); resetUserForm(); }}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={uSaving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                  {uSaving ? "Saving..." : editingUser ? "Save changes" : "Add employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CATEGORY MODAL (add/edit) ── */}
      {(showAddCategory || editingCategory) && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editingCategory ? "Edit category" : "Add category"}</h2>
            </div>
            <form onSubmit={editingCategory ? handleEditCategory : handleAddCategory} className="p-6 space-y-4">
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
                  <input type="text" value={cEmoji} onChange={e => setCEmoji(e.target.value)} maxLength={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input type="text" value={cName} onChange={e => setCName(e.target.value)} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank type</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={cUnlimited} onChange={() => setCUnlimited(true)} className="text-blue-600" />
                    <span className="text-sm text-gray-700">Unlimited</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={!cUnlimited} onChange={() => setCUnlimited(false)} className="text-blue-600" />
                    <span className="text-sm text-gray-700">Limited</span>
                  </label>
                </div>
              </div>
              {!cUnlimited && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Days per year</label>
                  <input type="number" min="1" value={cDays} onChange={e => setCDays(e.target.value)} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              {cUnlimited && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Minimum days <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input type="number" min="0" value={cMinDays} onChange={e => setCMinDays(e.target.value)}
                    placeholder="No minimum"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">Requires approval</p>
                  <p className="text-xs text-gray-500">If off, requests are auto-approved.</p>
                </div>
                <button type="button" onClick={() => setCApproval(!cApproval)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${cApproval ? "bg-blue-600" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${cApproval ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {cError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{cError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAddCategory(false); setEditingCategory(null); resetCategoryForm(); }}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={cSaving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                  {cSaving ? "Saving..." : editingCategory ? "Save changes" : "Add category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── TEAM MODAL (add/edit) ── */}
      {showAddTeam && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">{editingTeam ? "Edit team" : "Create team"}</h2>
            </div>
            <form onSubmit={handleSaveTeam} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team name</label>
                <input type="text" value={tName} onChange={e => setTName(e.target.value)} required
                  placeholder="e.g. Engineering, Marketing"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manager <span className="text-gray-400 font-normal">(optional)</span></label>
                <select value={tManagerId} onChange={e => setTManagerId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">No manager</option>
                  {managersAndAdmins.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {tManagerId && (
                  <p className="text-xs text-gray-500 mt-1">All team members will be assigned this manager by default.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Members</label>
                <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-50">
                  {users.map(u => {
                    const checked = tMemberIds.includes(u.id);
                    const otherTeams = u.teams.filter(t => t.id !== editingTeam?.id);
                    return (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setTMemberIds(checked ? tMemberIds.filter(id => id !== u.id) : [...tMemberIds, u.id])}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {u.image ? (
                            <img src={u.image} className="w-6 h-6 rounded-full shrink-0" alt="" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700 shrink-0">
                              {u.name?.[0] ?? "?"}
                            </div>
                          )}
                          <span className="text-sm text-gray-800 truncate">{u.name}</span>
                          <span className="text-xs text-gray-400 truncate">{u.email}</span>
                          {otherTeams.length > 0 && (
                            <span className="text-xs text-gray-400 shrink-0">· also in {otherTeams.map(t => t.name).join(", ")}</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                  {users.length === 0 && (
                    <p className="text-sm text-gray-400 px-3 py-4 text-center">No employees found.</p>
                  )}
                </div>
                {tMemberIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">{tMemberIds.length} member{tMemberIds.length !== 1 ? "s" : ""} selected</p>
                )}
              </div>
              {tError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{tError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAddTeam(false); setEditingTeam(null); setTName(""); setTManagerId(""); setTMemberIds([]); setTError(""); }}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={tSaving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                  {tSaving ? "Saving..." : editingTeam ? "Save changes" : "Create team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── HOLIDAY MODAL ── */}
      {showAddHoliday && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add holiday</h2>
            </div>
            <form onSubmit={handleAddHoliday} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Holiday name</label>
                <input type="text" value={hName} onChange={e => setHName(e.target.value)} required
                  placeholder="e.g. New Year's Day"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={hDate} onChange={e => setHDate(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-center justify-between py-1">
                <p className="text-sm font-medium text-gray-800">Repeats annually</p>
                <button type="button" onClick={() => setHRecurring(!hRecurring)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hRecurring ? "bg-blue-600" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${hRecurring ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
              {hError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{hError}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAddHoliday(false); setHName(""); setHDate(""); setHError(""); }}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={hSaving}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                  {hSaving ? "Saving..." : "Add holiday"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
