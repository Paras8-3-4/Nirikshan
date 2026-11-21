"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ClipboardCheck,
  Plus,
  ShieldAlert,
  UserCheck,
  ArrowRight,
  MapPin,
  Clock,
} from "lucide-react";
import {
  db,
  seedInitialInspections,
  type InspectionRecord,
} from "@/lib/db";

const INSPECTORS = ["Aarav (Inspector A)", "Meera (Inspector B)"];

export default function InspectorHomePage() {
  const [activeInspector, setActiveInspector] = useState<string>(INSPECTORS[0]);
  const [newSiteName, setNewSiteName] = useState<string>("");
  const [newSiteType, setNewSiteType] = useState<
    "Construction" | "Farm" | "Factory"
  >("Construction");

  useEffect(() => {
    void seedInitialInspections();
    const savedInspector =
      typeof window !== "undefined"
        ? window.localStorage.getItem("fieldinspect_active_inspector")
        : null;
    if (savedInspector) {
      setActiveInspector(savedInspector);
    }
  }, []);

  const handleInspectorChange = (name: string) => {
    setActiveInspector(name);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("fieldinspect_active_inspector", name);
    }
  };

  const inspections = useLiveQuery(
    () => db.inspections.toArray(),
    [],
    [] as InspectionRecord[]
  );

  const handleCreateInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSiteName.trim();
    if (!trimmed) return;

    const now = new Date().toISOString();
    const dueTomorrow = new Date(Date.now() + 86400000 * 2)
      .toISOString()
      .slice(0, 10);

    const id = `insp-${Date.now()}`;
    const record: InspectionRecord = {
      id,
      siteName: trimmed,
      siteType: newSiteType,
      dueDate: dueTomorrow,
      inspectorName: activeInspector,
      syncStatus: "pending",
      updatedAt: now,
      items: [
        {
          id: "item-1",
          label: "Perimeter safety signage and access barriers in place",
          status: "pending",
          note: "",
          updatedAt: now,
          updatedBy: activeInspector,
        },
        {
          id: "item-2",
          label: "Electrical cables elevated and free of standing water",
          status: "pending",
          note: "",
          updatedAt: now,
          updatedBy: activeInspector,
        },
        {
          id: "item-3",
          label: "First-aid kit & emergency contact board visible",
          status: "pending",
          note: "",
          updatedAt: now,
          updatedBy: activeInspector,
        },
      ],
    };

    await db.inspections.put(record);
    await db.syncQueue.add({
      inspectionId: id,
      payload: record,
      queuedAt: now,
    });
    setNewSiteName("");
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-blue-600" />
            Field Inspection Assignments
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Complete checklists offline with GPS &amp; photos. Syncs automatically when online.
          </p>
        </div>

        <Link
          href="/supervisor"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          Supervisor Dashboard
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <UserCheck className="w-5 h-5 text-emerald-600" />
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Active Field Inspector
            </div>
            <div className="text-sm text-slate-700">
              Switch between Inspector A &amp; B to test multi-inspector conflict detection
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {INSPECTORS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => handleInspectorChange(name)}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                activeInspector === name
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={handleCreateInspection}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap items-center gap-3"
      >
        <input
          type="text"
          value={newSiteName}
          onChange={(e) => setNewSiteName(e.target.value)}
          placeholder="New site name (e.g., Block C Bridge Deck)"
          className="flex-1 min-w-[220px] rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={newSiteType}
          onChange={(e) =>
            setNewSiteType(
              e.target.value as "Construction" | "Farm" | "Factory"
            )
          }
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm bg-white"
        >
          <option value="Construction">Construction</option>
          <option value="Farm">Farm</option>
          <option value="Factory">Factory</option>
        </select>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
        >
          <Plus className="w-4 h-4" />
          Add Site
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {inspections.map((insp) => {
          const passedCount = insp.items.filter((i) => i.status === "pass").length;
          const failedCount = insp.items.filter((i) => i.status === "fail").length;
          const isOverdue = insp.dueDate < todayStr;

          return (
            <Link
              key={insp.id}
              href={`/inspect/${insp.id}`}
              className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                    <MapPin className="w-3 h-3" />
                    {insp.siteType}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {isOverdue && (
                      <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-semibold">
                        Overdue
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        insp.syncStatus === "conflict"
                          ? "bg-amber-100 text-amber-800"
                          : insp.syncStatus === "pending"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-emerald-100 text-emerald-800"
                      }`}
                    >
                      {insp.syncStatus.toUpperCase()}
                    </span>
                  </div>
                </div>

                <h2 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition">
                  {insp.siteName}
                </h2>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Due: {insp.dueDate}
                  </span>
                  <span>•</span>
                  <span>{insp.inspectorName}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 text-xs font-medium">
                  <span className="text-emerald-700">{passedCount} Pass</span>
                  <span className="text-red-700">{failedCount} Fail</span>
                  <span className="text-slate-500">
                    {insp.items.length} Total Items
                  </span>
                </div>

                <span className="inline-flex items-center gap-1 font-semibold text-blue-600 group-hover:translate-x-0.5 transition">
                  Inspect
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}