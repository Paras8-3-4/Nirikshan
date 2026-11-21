"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  AlertOctagon,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import type { InspectionRecord } from "@/lib/db";
import type { ItemConflict } from "@/lib/serverStore";
import ConflictModal from "@/components/ConflictModal";

export default function SupervisorDashboardPage() {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [conflicts, setConflicts] = useState<ItemConflict[]>([]);
  const [selectedConflict, setSelectedConflict] = useState<ItemConflict | null>(
    null
  );
  const [loading, setLoading] = useState<boolean>(true);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await fetch("/api/inspections", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setInspections(Array.isArray(data.inspections) ? data.inspections : []);
      setConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
    const timer = setInterval(() => {
      void loadDashboard();
    }, 3000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  const handleResolveConflict = async (
    conflictId: string,
    choice: "server" | "incoming"
  ) => {
    const res = await fetch("/api/inspections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conflictId, choice }),
    });
    if (res.ok) {
      const data = await res.json();
      setInspections(Array.isArray(data.inspections) ? data.inspections : []);
      setConflicts(Array.isArray(data.conflicts) ? data.conflicts : []);
      setSelectedConflict(null);
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const openConflicts = conflicts.filter((c) => !c.resolved);

  const failedCount = inspections.filter((r) =>
    r.items.some((item) => item.status === "fail")
  ).length;

  const overdueCount = inspections.filter((r) => r.dueDate < todayStr).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Inspector View
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">
            Supervisor Live Operations Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Live sync status, overdue &amp; failed inspection flags, and conflict resolution.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDashboard()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Now
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <div className="text-xs font-bold uppercase text-red-700">
            Sites With Failed Items
          </div>
          <div className="text-3xl font-extrabold text-red-900 mt-1">
            {failedCount}
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4">
          <div className="text-xs font-bold uppercase text-rose-700">
            Overdue Inspections
          </div>
          <div className="text-3xl font-extrabold text-rose-900 mt-1">
            {overdueCount}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="text-xs font-bold uppercase text-amber-800">
            Unresolved Sync Conflicts
          </div>
          <div className="text-3xl font-extrabold text-amber-950 mt-1">
            {openConflicts.length}
          </div>
        </div>
      </div>

      {openConflicts.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 space-y-3">
          <div className="flex items-center gap-2 font-bold text-amber-950">
            <AlertTriangle className="w-5 h-5 text-amber-700" />
            Conflicts Needing Supervisor Decision ({openConflicts.length})
          </div>

          <div className="space-y-2">
            {openConflicts.map((c) => (
              <div
                key={c.conflictId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 p-3.5"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {c.siteName} — {c.itemLabel}
                  </div>
                  <div className="text-xs text-slate-600">
                    Server ({c.serverItem.updatedBy}):{" "}
                    <strong>{c.serverItem.status.toUpperCase()}</strong> vs. Incoming (
                    {c.incomingItem.updatedBy}):{" "}
                    <strong>{c.incomingItem.status.toUpperCase()}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedConflict(c)}
                  className="rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                >
                  Compare &amp; Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">Loading live server state...</div>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                <th className="py-3 px-4">Site</th>
                <th className="py-3 px-4">Inspector</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4">Flags</th>
                <th className="py-3 px-4">Sync Status</th>
                <th className="py-3 px-4">Last Synced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {inspections.map((rec) => {
                const hasFail = rec.items.some((i) => i.status === "fail");
                const isOverdue = rec.dueDate < todayStr;

                return (
                  <tr key={rec.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {rec.siteName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {rec.inspectorName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{rec.dueDate}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5">
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2.5 py-0.5 text-xs font-bold">
                            <AlertOctagon className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                        {hasFail && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-800 px-2.5 py-0.5 text-xs font-bold">
                            Failed Item
                          </span>
                        )}
                        {!isOverdue && !hasFail && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            Healthy
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          rec.syncStatus === "conflict"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {rec.syncStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {new Date(rec.updatedAt).toLocaleTimeString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConflictModal
        conflict={selectedConflict}
        onResolve={handleResolveConflict}
        onClose={() => setSelectedConflict(null)}
      />
    </div>
  );
}