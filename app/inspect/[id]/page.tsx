"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowLeft,
  Camera,
  MapPin,
  FileDown,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
} from "lucide-react";
import {
  db,
  seedInitialInspections,
  type CheckStatus,
  type InspectionRecord,
} from "@/lib/db";
import SignaturePad from "@/components/SignaturePad";
import { generateInspectionPdf } from "@/lib/pdfGenerator";

export default function InspectionDetailPage() {
  const params = useParams<{ id: string }>();
  const inspectionId = params?.id;

  const [inspectorName, setInspectorName] = useState<string>("Aarav (Inspector A)");
  const [newItemLabel, setNewItemLabel] = useState<string>("");
  const [gpsStatusMsg, setGpsStatusMsg] = useState<string>("");
  const [saveToast, setSaveToast] = useState<string>("");

  useEffect(() => {
    void seedInitialInspections();
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("fieldinspect_active_inspector");
      if (saved) setInspectorName(saved);
    }
  }, []);

  const record = useLiveQuery(
    () => (inspectionId ? db.inspections.get(inspectionId) : undefined),
    [inspectionId],
    undefined as InspectionRecord | undefined
  );

  const persistRecord = async (
    updated: InspectionRecord,
    toastText = "Saved offline"
  ) => {
    const stamped: InspectionRecord = {
      ...updated,
      inspectorName,
      syncStatus: updated.syncStatus === "conflict" ? "conflict" : "pending",
      updatedAt: new Date().toISOString(),
    };

    await db.inspections.put(stamped);
    await db.syncQueue.add({
      inspectionId: stamped.id,
      payload: stamped,
      queuedAt: stamped.updatedAt,
    });

    setSaveToast(toastText);
    setTimeout(() => setSaveToast(""), 2000);
  };

  const handleStatusChange = async (itemId: string, nextStatus: CheckStatus) => {
    if (!record) return;
    const now = new Date().toISOString();
    const updatedItems = record.items.map((item) =>
      item.id === itemId
        ? { ...item, status: nextStatus, updatedAt: now, updatedBy: inspectorName }
        : item
    );
    await persistRecord({ ...record, items: updatedItems });
  };

  const handleNoteChange = async (itemId: string, note: string) => {
    if (!record) return;
    const now = new Date().toISOString();
    const updatedItems = record.items.map((item) =>
      item.id === itemId
        ? { ...item, note, updatedAt: now, updatedBy: inspectorName }
        : item
    );
    await persistRecord({ ...record, items: updatedItems }, "Note saved locally");
  };

  const handlePhotoUpload = async (
    itemId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !record) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl =
        typeof reader.result === "string" ? reader.result : undefined;
      if (!dataUrl) return;
      const now = new Date().toISOString();
      const updatedItems = record.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              photoDataUrl: dataUrl,
              updatedAt: now,
              updatedBy: inspectorName,
            }
          : item
      );
      await persistRecord(
        { ...record, items: updatedItems },
        "Photo attached offline"
      );
    };
    reader.readAsDataURL(file);
  };

  const handleCaptureGps = async (itemId: string) => {
    if (!record) return;
    setGpsStatusMsg("Fetching GPS coordinates...");

    const applyCoords = async (lat: number, lng: number, accuracy?: number) => {
      const now = new Date().toISOString();
      const updatedItems = record.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              gps: { lat, lng, accuracy, capturedAt: now },
              updatedAt: now,
              updatedBy: inspectorName,
            }
          : item
      );
      await persistRecord({ ...record, items: updatedItems }, "GPS pinned");
      setGpsStatusMsg(`Pinned: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    };

    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void applyCoords(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy
          );
        },
        async () => {
          await applyCoords(26.9124, 75.7873, 15);
          setGpsStatusMsg("Using fallback field GPS (26.9124, 75.7873)");
        },
        { timeout: 5000 }
      );
    } else {
      await applyCoords(26.9124, 75.7873, 15);
      setGpsStatusMsg("Using fallback field GPS (26.9124, 75.7873)");
    }
  };

  const handleAddChecklistItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!record || !newItemLabel.trim()) return;
    const now = new Date().toISOString();
    const added = {
      id: `item-${Date.now()}`,
      label: newItemLabel.trim(),
      status: "pending" as CheckStatus,
      note: "",
      updatedAt: now,
      updatedBy: inspectorName,
    };
    setNewItemLabel("");
    await persistRecord(
      { ...record, items: [...record.items, added] },
      "Checklist item added"
    );
  };

  const handleSaveSignature = async (signatureDataUrl: string) => {
    if (!record) return;
    await persistRecord(
      {
        ...record,
        signatureDataUrl,
        signedAt: new Date().toISOString(),
      },
      "Signature saved offline"
    );
  };

  if (!record) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center space-y-3">
        <p className="text-slate-700 font-medium">
          Loading inspection or record not found...
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assignments
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          All Sites
        </Link>

        <div className="flex items-center gap-2">
          {saveToast && (
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-semibold">
              {saveToast}
            </span>
          )}
          <button
            type="button"
            onClick={() => generateInspectionPdf(record)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition"
          >
            <FileDown className="w-4 h-4" />
            Export Signed PDF
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            {record.siteType} • Due {record.dueDate}
          </span>
          <span className="text-xs font-medium text-slate-500">
            Editing as: <strong>{inspectorName}</strong>
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{record.siteName}</h1>
        {gpsStatusMsg && (
          <p className="text-xs text-slate-600 pt-1">{gpsStatusMsg}</p>
        )}
      </div>

      <div className="space-y-4">
        {record.items.map((item, idx) => (
          <div
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1 max-w-2xl">
                <div className="text-xs font-semibold text-slate-400">
                  ITEM #{idx + 1} • Last by {item.updatedBy}
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  {item.label}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleStatusChange(item.id, "pass")}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    item.status === "pass"
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-emerald-50"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pass
                </button>
                <button
                  type="button"
                  onClick={() => void handleStatusChange(item.id, "fail")}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    item.status === "fail"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-red-50"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Fail
                </button>
                <button
                  type="button"
                  onClick={() => void handleStatusChange(item.id, "pending")}
                  className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                    item.status === "pending"
                      ? "bg-amber-500 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-amber-50"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Pending
                </button>
              </div>
            </div>

            <input
              type="text"
              defaultValue={item.note}
              onBlur={(e) => void handleNoteChange(item.id, e.target.value)}
              placeholder="Add observation note (saves automatically)..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Camera className="w-3.5 h-3.5 text-blue-600" />
                {item.photoDataUrl ? "Replace Photo" : "Attach Photo"}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void handlePhotoUpload(item.id, e)}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => void handleCaptureGps(item.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                Tag GPS Location
              </button>

              {item.gps && (
                <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md">
                  GPS: {item.gps.lat.toFixed(4)}, {item.gps.lng.toFixed(4)}
                </span>
              )}
            </div>

            {item.photoDataUrl && (
              <div>
                <img
                  src={item.photoDataUrl}
                  alt={`Evidence for ${item.label}`}
                  className="h-36 w-auto rounded-xl border border-slate-200 object-cover"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      <form
        onSubmit={handleAddChecklistItem}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3"
      >
        <input
          type="text"
          value={newItemLabel}
          onChange={(e) => setNewItemLabel(e.target.value)}
          placeholder="Add another field check item..."
          className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </form>

      <SignaturePad
        existingSignature={record.signatureDataUrl}
        signedAt={record.signedAt}
        onSaveSignature={handleSaveSignature}
      />
    </div>
  );
}