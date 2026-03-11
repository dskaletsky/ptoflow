"use client";

import { useState, useEffect, useCallback } from "react";

interface Category {
  id: string;
  name: string;
  emoji: string;
}

interface User {
  id: string;
  name: string | null;
  image: string | null;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  workingDaysCount: number;
  category: Category;
  user: User;
}

interface Holiday {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
}

const COLORS = [
  { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-500" },
  { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-500" },
  { bg: "bg-pink-100", text: "text-pink-800", dot: "bg-pink-500" },
  { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-500" },
  { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  { bg: "bg-teal-100", text: "text-teal-800", dot: "bg-teal-500" },
  { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  { bg: "bg-rose-100", text: "text-rose-800", dot: "bg-rose-500" },
  { bg: "bg-indigo-100", text: "text-indigo-800", dot: "bg-indigo-500" },
  { bg: "bg-cyan-100", text: "text-cyan-800", dot: "bg-cyan-500" },
];

function getUserColor(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % COLORS.length;
  }
  return COLORS[hash];
}

function toDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDate(isoStr: string) {
  // Parse date portion only to avoid timezone shifts
  const [y, m, d] = isoStr.split("T")[0].split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
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

export function TeamCalendar() {
  const today = new Date();
  const todayStr = toDateStr(today);

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchData = useCallback(async (y: number, m: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/team/calendar?year=${y}&month=${m}`);
      const data = await res.json();
      setRequests(data.requests ?? []);
      setHolidays(data.holidays ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(year, month);
  }, [year, month, fetchData]);

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

  // Build day → requests map for calendar view
  const dayMap: Record<string, LeaveRequest[]> = {};
  for (const req of requests) {
    const [sy, sm, sd] = req.startDate.split("T")[0].split("-").map(Number);
    const [ey, em, ed] = req.endDate.split("T")[0].split("-").map(Number);
    const start = new Date(sy, sm - 1, sd);
    const end = new Date(ey, em - 1, ed);
    const cur = new Date(start);
    while (cur <= end) {
      const key = toDateStr(cur);
      if (!dayMap[key]) dayMap[key] = [];
      if (!dayMap[key].find(r => r.user.id === req.user.id)) {
        dayMap[key].push(req);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  // Holiday map
  const holidayMap: Record<string, string> = {};
  for (const h of holidays) {
    const [, hm, hd] = h.date.split("T")[0].split("-");
    const key = h.recurring
      ? `${year}-${hm}-${hd}`
      : h.date.split("T")[0];
    holidayMap[key] = h.name;
  }

  const days = getDaysInMonth(year, month);
  const firstDayOfWeek = days[0].getDay();
  const selectedRequests = selectedDay ? (dayMap[selectedDay] ?? []) : [];
  const selectedHoliday = selectedDay ? holidayMap[selectedDay] : null;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 mt-1 text-sm">See when your teammates are out.</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
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

          {/* Month nav — shared across both views */}
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors">←</button>
          <span className="text-base font-semibold text-gray-900 min-w-[140px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 hover:text-gray-900 transition-colors">→</button>
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-sm text-gray-400">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 text-sm">No time off scheduled for {MONTH_NAMES[month - 1]} {year}.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Person</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Start</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">End</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Days</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(req => {
                  const color = getUserColor(req.user.id);
                  const [sy, sm, sd] = req.startDate.split("T")[0].split("-").map(Number);
                  const [ey, em, ed] = req.endDate.split("T")[0].split("-").map(Number);
                  const startD = new Date(sy, sm - 1, sd);
                  const endD = new Date(ey, em - 1, ed);
                  const isActive = startD <= today && endD >= today;
                  return (
                    <tr key={req.id} className={`border-b border-gray-50 last:border-0 ${isActive ? "bg-green-50/50" : ""}`}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${color.dot} text-white shrink-0`}>
                            {req.user.name?.[0] ?? "?"}
                          </div>
                          <span className="font-medium text-gray-800">{req.user.name}</span>
                          {isActive && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">Out now</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span>{req.category.emoji}</span>
                          <span className="text-gray-700">{req.category.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{formatDate(req.startDate)}</td>
                      <td className="px-5 py-3 text-gray-600">{formatDate(req.endDate)}</td>
                      <td className="px-5 py-3 text-gray-500">{req.workingDaysCount}d</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── CALENDAR VIEW ── */}
      {view === "calendar" && (
        <div className="flex gap-6">
          <div className="flex-1">
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
                        const color = getUserColor(req.user.id);
                        return (
                          <div key={req.user.id} className={`flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate ${color.bg} ${color.text}`}>
                            <span>{req.category.emoji}</span>
                            <span className="truncate">{req.user.name?.split(" ")[0]}</span>
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
            {loading && <div className="text-center py-4 text-sm text-gray-400">Loading...</div>}
          </div>

          {/* Side panel */}
          <div className="w-64 shrink-0">
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
                  <p className="text-sm text-gray-400">Everyone is in.</p>
                ) : selectedRequests.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Out of office</p>
                    {selectedRequests.map(req => {
                      const color = getUserColor(req.user.id);
                      return (
                        <div key={req.user.id} className={`flex items-center gap-2 p-2 rounded-lg ${color.bg}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${color.dot} text-white shrink-0`}>
                            {req.user.name?.[0] ?? "?"}
                          </div>
                          <div className="min-w-0">
                            <p className={`text-xs font-semibold truncate ${color.text}`}>{req.user.name}</p>
                            <p className={`text-xs truncate ${color.text} opacity-80`}>{req.category.emoji} {req.category.name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <p className="text-sm text-gray-400 text-center">Click a day to see details.</p>
              </div>
            )}
            {requests.length > 0 && (
              <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">People</p>
                <div className="space-y-2">
                  {Array.from(new Map(requests.map(r => [r.user.id, r.user])).values()).map(user => {
                    const color = getUserColor(user.id);
                    return (
                      <div key={user.id} className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full ${color.dot} shrink-0`} />
                        <span className="text-xs text-gray-700 truncate">{user.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
