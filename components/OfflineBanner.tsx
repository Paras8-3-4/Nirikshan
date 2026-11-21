"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { db } from "@/lib/db";

interface OfflineBannerProps {
  onSynced?: () => void;
}

export default function OfflineBanner({ onSynced }: OfflineBannerProps) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<string>("");

  const queueItems = useLiveQuery(() => db.syncQueue.toArray(), [], []);
  const pendingCount = queueItems.length;

  const flushSyncQueue = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLastMessage("Offline — edits stay saved on device.");
      return;
    }

    const items = await db.syncQueue.toArray();
    if (items.length === 0) {
      return;
    }

    // Group queued snapshots by inspectionId and keep the latest payload per inspection
    const latestByInspection = new Map<
      string,
      { latestPayload: (typeof items)[number]["payload"]; queueIds: number[] }
    >();

    for (const entry of items) {
      const existing = latestByInspection.get(entry.inspectionId);
      if (!existing) {
        latestByInspection.set(entry.inspectionId, {
          latestPayload: entry.payload,
          queueIds: entry.id !== undefined ? [entry.id] : [],
        });
      } else {
        const prevTime = new Date(existing.latestPayload.updatedAt || 0).getTime();
        const nextTime = new Date(entry.payload.updatedAt || 0).getTime();
        if (nextTime >= prevTime) {
          existing.latestPayload = entry.payload;
        }
        if (entry.id !== undefined) {
          existing.queueIds.push(entry.id);
        }
      }
    }

    setIsSyncing(true);
    setLastMessage("");

    try {
      let conflictFound = false;

      for (const { latestPayload, queueIds } of latestByInspection.values()) {
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ record: latestPayload }),
        });

        if (!res.ok) {
          throw new Error(`Sync failed with status ${res.status}`);
        }

        const data = await res.json();
        const serverRecord = data.record;
        const hasConflicts =
          Array.isArray(data.newConflicts) && data.newConflicts.length > 0;
        if (hasConflicts || serverRecord?.syncStatus === "conflict") {
          conflictFound = true;
        }

        if (serverRecord) {
          await db.inspections.put(serverRecord);
        }

        if (queueIds.length > 0) {
          await db.syncQueue.bulkDelete(queueIds);
        }
      }

      setLastMessage(
        conflictFound
          ? "Synced with 1+ item conflict — review on Supervisor view."
          : "All offline changes synced!"
      );
      onSynced?.();
    } catch {
      setLastMessage("Sync paused — will retry when connection stabilizes.");
    } finally {
      setIsSyncing(false);
    }
  }, [onSynced]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) {
        void flushSyncQueue();
      }
    };

    setIsOnline(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, [flushSyncQueue]);

  return (
    <div
      className={`w-full px-4 py-2.5 text-sm font-medium flex flex-wrap items-center justify-between gap-2 border-b ${
        !isOnline
          ? "bg-amber-950 text-amber-100 border-amber-800"
          : pendingCount > 0
          ? "bg-blue-950 text-blue-100 border-blue-800"
          : "bg-slate-900 text-slate-100 border-slate-800"
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Offline Mode — saving locally to IndexedDB</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <AlertTriangle className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Online — {pendingCount} queued edit(s) ready to sync</span>
          </>
        ) : (
          <>
            <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Online &amp; Up to Date</span>
          </>
        )}

        {lastMessage && (
          <span className="ml-2 text-xs opacity-85 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 inline" />
            {lastMessage}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => void flushSyncQueue()}
        disabled={!isOnline || isSyncing}
        className="inline-flex items-center gap-1.5 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 px-3 py-1 text-xs font-semibold transition"
      >
        <RefreshCw
          className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`}
        />
        {isSyncing ? "Syncing..." : `Sync Now (${pendingCount})`}
      </button>
    </div>
  );
}