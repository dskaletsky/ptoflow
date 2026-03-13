"use client";

import { useState } from "react";

interface Category {
  id: string;
  name: string;
  emoji: string;
}

export interface PtoCalendarRequest {
  id: string;
  startDate: string;
  endDate: string;
  workingDaysCount: number;
  status: string;
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
  requests: PtoCalendarRequest[];
  holidays: Holiday[];
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string, reason: string) => Promise<void>;
  onCancel?: (id: string) => Promise<void>;
}

const COLORS = [
  { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500", border: "border-blue-300" },
  { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500", border: "border-purple-300" },
  { bg: "bg-pink-100", text: "text-pink-800", dot: "bg-pink-500", border: "border-pink-300" },
  { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500", border: "border-orange-300" },
  { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500", border: "border-green-300" },
  { bg: "bg-teal-100", text: "text-teal-800", dot: "bg-teal-500", border: "border-teal-300" },
  { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500", border: "border-yellow-300" },
  { bg: "bg-rose-100", text: "text-rose-800", dot: "bg-rose-500", border: "border-rose-300" },
  { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-500", border: "border-indigo-300" },
  { bg: "bg-cyan-100", text: "text-cyan-800", dot: "bg-cyan-500", border: "border-cyan-300" },
];

function getCategoryColor(categoryId: string) {
  let hash = 0;
  for (let i = 0; i < categoryId.length; i++) {
    hash = (hash * 31 + categoryId.charCodeAt(i)) % COLORS.length;
  }
  return COLORS[hash];
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateStr(isoStr: string): Date {
  const [y, m, d] = isoStr.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(isoStr: string) {
  return parseDateStr(isoStr).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusStyles: Record<string, string> = {
  APPROVED: "bg-green-50 text-green-700 border border-green-200",
  PENDING: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  REJECTED: "bg-red-50 text-red-700 border border-red-200",
  CANCELLED: "bg-gray-100 text-gray-500 border border-gray-200",
};

export function PtoCalendar({ requests, holidays, onApprove, onReject, onCancel }: Props) {
  const today = new Date();
  const todayStr = toDateStr(today);

  const [view, setView] = useState<"calendar" | "list">("list");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionInProgress, setActionInProgress] = useState(false);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelectedDay(null);
  }

  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelectedDay(null);
  }

  // Requests that overlap with the current month
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const monthRequests = requests.filter(req => {
    if (req.status === "REJECTED" || req.status === "CANCELLED") return false;
    const s = parseDateStr(req.startDate);
    const e = parseDateStr(req.endDate);
    return s <= monthEnd && e >= monthStart;
  });

  // Build day → requests map
  const dayMap: Record<string, PtoCalendarRequest[]> = {};
  for (const req of monthRequests) {
    const s = parseDateStr(req.startDate);
    const e = parseDateStr(req.endDate);
    const cur = new Date(s);
    while (cur <= e) {
      const key = toDateStr(cur);
      if (!dayMap[key]) dayMap[key] = [];
      dayMap[key].push(req);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Holiday map
  const holidayMap: Record<string, string> = {};
  for (const h of holidays) {
    const [, hm, hd] = h.date.split("T")[0].split("-");
    const key = h.recurring ? `${year}-${hm}-${hd}` : h.date.split("T")[0];
    holidayMap[key] = h.name;
  }

  const days = getDaysInMonth(year, month);
  const firstDayOfWeek = days[0].getDay();
  const selectedRequests = selectedDay ? (dayMap[selectedDay] ?? []) : [];
  const selectedHoliday = selectedDay ? holidayMap[selectedDay] : null;

  async function handleApprove(id: string) {
    if (!onApprove) return;
    setActionInProgress(true);
    try { await onApprove(id); } finally { setActionInProgress(false); }
  }

  async function handleReject() {
    if (!onReject || !rejectingId) return;
    setActionInProgress(true);
    try {
      await onReject(rejectingId, rejectionReason);
      setRejectingId(null);
      setRejectionReason("");
    } finally { setActionInProgress(false); }
  }

  async function handleCancel(id: string) {
    if (!onCancel) return;
    setActionInProgress(true);
    try { await onCancel(id); } finally { setActionInProgress(false); }
  }

  function ActionButtons({ req }: { req: PtoCalendarRequest }) {
    const canCancel = onCancel && (req.status === "PENDING" || req.status === "APPROVED");
    const canApprove = onApprove && req.status === "PENDING";
    const canReject = onReject && req.status === "PENDING";
    if (!canCancel && !canApprove && !canReject) return null;
    return (
      <div className="flex gap-2 mt-2 flex-wrap">
        {canApprove && (
          <button
            onClick={() => handleApprove(req.id)}
            disabled={actionInProgress}
            className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
          >
            Approve
          </button>
        )}
        {canReject && (
          <button
            onClick={() => { setRejectingId(req.id); setRejectionReason(""); }}
            disabled={actionInProgress}
            className="text-xs border border-red-300 text-red-600 bg-white px-2.5 py-1 rounded-md hover:bg-red-50 disabled:opacity-50 font-medium"
          >
            Reject
          </button>
        )}
        {canCancel && (
          <button
            onClick={() => handleCancel(req.id)}
            disabled={actionInProgress}
            className="text-xs text-gray-400 hover:text-red-600 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* View toggle + month nav */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView("calendar")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "calendar" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            📅 Calendar
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}
          >
            📋 List
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">←</button>
          <span className="text-sm font-semibold text-gray-900 min-w-[130px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">→</button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth() + 1); setSelectedDay(todayStr); }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Today
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          {monthRequests.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-400 text-sm">No time off in {MONTH_NAMES[month - 1]} {year}.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Dates</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Days</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {monthRequests.map(req => (
                  <tr key={req.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span>{req.category.emoji}</span>
                        <span className="font-medium text-gray-800">{req.category.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                      {formatDate(req.startDate)} – {formatDate(req.endDate)}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{req.workingDaysCount}d</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${statusStyles[req.status]}`}>
                        {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {onApprove && req.status === "PENDING" && (
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={actionInProgress}
                            className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
                          >
                            Approve
                          </button>
                        )}
                        {onReject && req.status === "PENDING" && (
                          <button
                            onClick={() => { setRejectingId(req.id); setRejectionReason(""); }}
                            disabled={actionInProgress}
                            className="text-xs border border-red-300 text-red-600 bg-white px-2.5 py-1 rounded-md hover:bg-red-50 disabled:opacity-50 font-medium"
                          >
                            Reject
                          </button>
                        )}
                        {onCancel && (req.status === "PENDING" || req.status === "APPROVED") && (
                          <button
                            onClick={() => handleCancel(req.id)}
                            disabled={actionInProgress}
                            className="text-xs text-gray-400 hover:text-red-600 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && (
        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-7 mb-1">
              {DAY_NAMES.map(d => (
                <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-gray-50 min-h-[90px]" />
              ))}
              {days.map(day => {
                const dateStr = toDateStr(day);
                const isToday = dateStr === todayStr;
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                const isSelected = dateStr === selectedDay;
                const holiday = holidayMap[dateStr];
                const dayRequests = dayMap[dateStr] ?? [];
                const hasEvents = dayRequests.length > 0 || !!holiday;
                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={`min-h-[90px] p-1.5 cursor-pointer transition-colors
                      ${isWeekend ? "bg-gray-50" : "bg-white"}
                      ${isSelected ? "ring-2 ring-inset ring-blue-400" : ""}
                      ${hasEvents && !isWeekend ? "hover:bg-blue-50/30" : "hover:bg-gray-50"}
                    `}
                  >
                    <div className="mb-1">
                      <span className={`text-xs font-semibold w-6 h-6 inline-flex items-center justify-center rounded-full
                        ${isToday ? "bg-blue-600 text-white" : isWeekend ? "text-gray-400" : "text-gray-700"}`}>
                        {day.getDate()}
                      </span>
                    </div>
                    {holiday && (
                      <div className="text-[10px] text-amber-700 bg-amber-50 rounded px-1 py-0.5 mb-0.5 truncate font-medium">
                        {holiday}
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {dayRequests.slice(0, 3).map(req => {
                        const color = getCategoryColor(req.category.id);
                        const isPending = req.status === "PENDING";
                        return (
                          <div
                            key={req.id}
                            className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate
                              ${color.bg} ${color.text}
                              ${isPending ? "opacity-60 border border-dashed " + color.border : ""}
                            `}
                          >
                            <span>{req.category.emoji}</span>
                            <span className="truncate">{isPending ? "⏳ " : ""}{req.category.name}</span>
                          </div>
                        );
                      })}
                      {dayRequests.length > 3 && (
                        <div className="text-[10px] text-gray-500 px-1">+{dayRequests.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side panel */}
          <div className="w-60 shrink-0">
            {selectedDay ? (
              <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-8">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  {(() => {
                    const [y, m, d] = selectedDay.split("-").map(Number);
                    return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
                  })()}
                </h3>
                {selectedHoliday && (
                  <div className="flex items-center gap-2 mb-3 p-2 bg-amber-50 rounded-lg">
                    <span>🎉</span>
                    <div>
                      <p className="text-xs font-semibold text-amber-800">{selectedHoliday}</p>
                      <p className="text-xs text-amber-600">Company holiday</p>
                    </div>
                  </div>
                )}
                {selectedRequests.length === 0 && !selectedHoliday ? (
                  <p className="text-sm text-gray-400">No time off this day.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedRequests.map(req => {
                      const color = getCategoryColor(req.category.id);
                      return (
                        <div key={req.id} className={`p-3 rounded-lg ${color.bg}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-semibold ${color.text}`}>
                              {req.category.emoji} {req.category.name}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusStyles[req.status]}`}>
                              {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                            </span>
                          </div>
                          <p className={`text-[11px] ${color.text} opacity-80`}>
                            {formatDate(req.startDate)} – {formatDate(req.endDate)} · {req.workingDaysCount}d
                          </p>
                          <ActionButtons req={req} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <p className="text-sm text-gray-400 text-center">Click a day to see details.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection modal */}
      {rejectingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Reject request</h2>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-gray-400 font-normal">(optional)</span>
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
                onClick={handleReject}
                disabled={actionInProgress}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60"
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
