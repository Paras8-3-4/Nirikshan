"use client";

import React from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { ItemConflict } from "@/lib/serverStore";

interface ConflictModalProps {
  conflict: ItemConflict | null;
  onResolve: (
    conflictId: string,
    choice: "server" | "incoming"
  ) => Promise<void>;
  onClose: () => void;
}

export default function ConflictModal({
  conflict,
  onResolve,
  onClose,
}: ConflictModalProps) {
  if (!conflict) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="rounded-full bg-amber-100 p-2 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Sync Conflict Detected
              </h2>
              <p className="text-xs text-slate-500">
                {conflict.siteName} — {conflict.itemLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            Close
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Current Server Version
            </div>
            <div className="text-sm font-semibold text-slate-900">
              Status:{" "}
              <span className="uppercase">{conflict.serverItem.status}</span>
            </div>
            <p className="text-xs text-slate-600">
              Note: {conflict.serverItem.note || "(No note)"}
            </p>
            <p className="text-xs text-slate-500">
              By: {conflict.serverItem.updatedBy}
            </p>
            <button
              type="button"
              onClick={() => void onResolve(conflict.conflictId, "server")}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              <CheckCircle className="w-4 h-4" />
              Keep Server Version
            </button>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Incoming Synced Version
            </div>
            <div className="text-sm font-semibold text-slate-900">
              Status:{" "}
              <span className="uppercase">{conflict.incomingItem.status}</span>
            </div>
            <p className="text-xs text-slate-600">
              Note: {conflict.incomingItem.note || "(No note)"}
            </p>
            <p className="text-xs text-slate-500">
              By: {conflict.incomingItem.updatedBy}
            </p>
            <button
              type="button"
              onClick={() => void onResolve(conflict.conflictId, "incoming")}
              className="mt-2 w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <CheckCircle className="w-4 h-4" />
              Accept Incoming Version
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}