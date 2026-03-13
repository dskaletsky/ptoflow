"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  emoji: string;
  isUnlimited: boolean;
  defaultDays: number | null;
  requiresApproval: boolean;
}

interface Bank {
  id: string;
  categoryId: string;
  allocatedDays: number;
  usedDays: number;
}

function isWeekendOnly(start: string, end: string): boolean {
  if (!start || !end) return false;
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const d = new Date(s);
  while (d <= e) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) return false;
    d.setDate(d.getDate() + 1);
  }
  return true;
}

interface Props {
  categories: Category[];
  banks: Bank[];
}

export function RequestPtoButton({ categories, banks }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);

  const [categoryId, setCategoryId] = useState(
    categories.find((c) => c.name === "Vacation")?.id ?? categories[0]?.id ?? ""
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [markAsOOO, setMarkAsOOO] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const selectedBank = banks.find((b) => b.categoryId === categoryId);
  const remaining = selectedBank ? selectedBank.allocatedDays - selectedBank.usedDays : null;
  const weekendOnly = isWeekendOnly(startDate, endDate);

  function openForm() {
    setCategoryId(categories.find((c) => c.name === "Vacation")?.id ?? categories[0]?.id ?? "");
    setStartDate("");
    setEndDate("");
    setDescription("");
    setMarkAsOOO(true);
    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/pto/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId, startDate, endDate, description, markAsOOO }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Something went wrong.");
        return;
      }
      setShowForm(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={openForm}
        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
      >
        + Request PTO
      </button>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Request time off</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type of leave</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                  ))}
                </select>
                {selectedCategory && !selectedCategory.isUnlimited && remaining !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    {remaining} day{remaining !== 1 ? "s" : ""} remaining in your {selectedCategory.name} bank.
                  </p>
                )}
                {selectedCategory && !selectedCategory.requiresApproval && (
                  <p className="text-xs text-green-600 mt-1">✓ This type is automatically approved.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
                  <input
                    type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End date</label>
                  <input
                    type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required min={startDate}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {weekendOnly && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  This request is on a weekend which is a non-working day. Please adjust and resubmit.
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Note <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  placeholder="Add any context for your manager..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <label className="flex items-start gap-3 cursor-pointer py-1">
                <input
                  type="checkbox" checked={markAsOOO} onChange={(e) => setMarkAsOOO(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">
                  Mark me as Out of Office during this time
                  <span className="block text-xs text-gray-500 mt-0.5">
                    If checked, Google will automatically decline meeting invitations during this period.
                  </span>
                </span>
              </label>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={submitting || weekendOnly}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
