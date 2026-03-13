"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Category {
  id: string;
  name: string;
  emoji: string;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  workingDaysCount: number;
  description: string | null;
  category: Category;
  user: { id: string; name: string | null; email: string | null; image: string | null };
}

interface Props {
  pendingRequests: LeaveRequest[];
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RequestsClient({ pendingRequests: initialRequests }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  async function handleApprove(id: string) {
    const res = await fetch(`/api/pto/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    if (res.ok) {
      setRequests(requests.filter((r) => r.id !== id));
      router.refresh();
    }
  }

  async function handleReject(id: string) {
    const res = await fetch(`/api/pto/requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejectionReason }),
    });
    if (res.ok) {
      setRequests(requests.filter((r) => r.id !== id));
      setRejectingId(null);
      setRejectionReason("");
      router.refresh();
    }
  }

  return (
    <div className="px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Requests</h1>
        <p className="text-gray-500 mt-1 text-sm">
          PTO requests awaiting your approval.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {requests.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-2xl mb-3">🎉</p>
            <p className="text-gray-500 text-sm font-medium">All caught up — no pending requests.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Employee</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Type</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Dates</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Days</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Note</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      {req.user.image ? (
                        <img src={req.user.image} className="w-7 h-7 rounded-full" alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700">
                          {req.user.name?.[0] ?? "?"}
                        </div>
                      )}
                      <span className="font-medium text-gray-800 whitespace-nowrap">
                        {req.user.name ?? req.user.email}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span>{req.category.emoji}</span>
                      <span className="text-gray-700 whitespace-nowrap">{req.category.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                    {formatDate(req.startDate)} – {formatDate(req.endDate)}
                  </td>
                  <td className="px-5 py-3 text-gray-600 whitespace-nowrap">
                    {req.workingDaysCount}d
                  </td>
                  <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                    {req.description ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleApprove(req.id)}
                        className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors font-medium whitespace-nowrap"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { setRejectingId(req.id); setRejectionReason(""); }}
                        className="text-xs bg-white border border-red-300 text-red-600 px-3 py-1.5 rounded-md hover:bg-red-50 transition-colors font-medium whitespace-nowrap"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Rejection reason modal */}
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
                onClick={() => handleReject(rejectingId)}
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
