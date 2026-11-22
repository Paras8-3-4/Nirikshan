import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Camera,
  CheckCircle2,
  Database,
  GitCompare,
  Layers,
  MapPin,
  PenTool,
  ShieldCheck,
  WifiOff,
  X,
} from "lucide-react";
import type { AuthUser, UserRole } from "../lib/types.ts";
import PWAInstallButton from "./PWAInstallButton.tsx";

interface BootstrapInspectorInfo {
  id: string;
  name: string;
  code: string;
  region: string;
  claimed: boolean;
}

interface BootstrapStatus {
  supervisorClaimed: boolean;
  envPasscodeConfigured: boolean;
  inspectors: BootstrapInspectorInfo[];
}

interface ProductLandingPageProps {
  onAuthenticated: (user: AuthUser, token: string) => void;
}

type PreviewTabId = "offline" | "directory" | "sync";

const PREVIEW_STATES: Record<
  PreviewTabId,
  {
    label: string;
    heading: string;
    statusText: string;
    statusTone: "amber" | "slate" | "emerald";
    metrics: Array<{ label: string; value: string }>;
    summary: string;
  }
> = {
  offline: {
    label: "Offline Ready (IndexedDB)",
    heading: "Local Field Execution Engine",
    statusText: "IndexedDB Persistence Active",
    statusTone: "amber",
    metrics: [
      { label: "Storage Layer", value: "Dexie / IndexedDB" },
      { label: "Arrival Verification", value: "Selfie + GPS + Time" },
      { label: "PDF Export", value: "Online & Offline" },
    ],
    summary:
      "Checklists, multi-stage readings, per-parameter photos, and glass signatures commit immediately offline and auto-sync when connectivity returns.",
  },
  directory: {
    label: "Multi-Site Directory",
    heading: "Facilities, Teams & Live Workload",
    statusText: "4 Regions · Active Filters",
    statusTone: "slate",
    metrics: [
      { label: "Site Filters", value: "City / Country / Type" },
      { label: "Workload Engine", value: "Assigned / Pending / Done" },
      { label: "Map View", value: "Site Coords & Overview" },
    ],
    summary:
      "Assign engineers across factories, farms, and cold-chain hubs while tracking current active site load and archive states in one directory.",
  },
  sync: {
    label: "Zero-Conflict Sync",
    heading: "Supervisor Conflict Queue",
    statusText: "Item-Level Diff Verified",
    statusTone: "emerald",
    metrics: [
      { label: "Conflict Handling", value: "Non-Destructive Queue" },
      { label: "Authority", value: "Supervisor Merge / Pick" },
      { label: "Stage Support", value: "Single & Multi-Stage" },
    ],
    summary:
      "Concurrent offline edits never overwrite server data—conflicting submissions queue cleanly for side-by-side Supervisor review and resolution.",
  },
};

export default function ProductLandingPage({
  onAuthenticated,
}: ProductLandingPageProps) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authRole, setAuthRole] = useState<UserRole>("inspector");
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [previewTab, setPreviewTab] = useState<PreviewTabId>("offline");

  // Supervisor form state
  const [supName, setSupName] = useState("Sarah Jenkins");
  const [supEmail, setSupEmail] = useState("supervisor@nirikshan.ops");
  const [supPassword, setSupPassword] = useState("");

  // Inspector form state
  const [selectedInspId, setSelectedInspId] = useState("");
  const [inspPassword, setInspPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [facilityImgFailed, setFacilityImgFailed] = useState(false);

  async function fetchBootstrapStatus() {
    try {
      const res = await fetch("/api/auth/bootstrap-status");
      if (res.ok) {
        const data: BootstrapStatus = await res.json();
        setStatus(data);
        if (!selectedInspId && data.inspectors.length > 0) {
          setSelectedInspId(data.inspectors[0].id);
        }
      }
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    fetchBootstrapStatus();
  }, []);

  const selectedInspector = status?.inspectors.find(
    (i) => i.id === selectedInspId
  );

  async function handleSupervisorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setAuthError(null);

    try {
      const isClaimFlow = status && !status.supervisorClaimed;
      const endpoint = isClaimFlow
        ? "/api/auth/supervisor/claim"
        : "/api/auth/supervisor/login";
      const payload = isClaimFlow
        ? { name: supName, email: supEmail, password: supPassword }
        : { password: supPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Supervisor authentication failed.");
      }
      onAuthenticated(data.user, data.token);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Could not sign in as supervisor."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInspectorSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInspector) {
      setAuthError("Select an active inspector profile.");
      return;
    }
    setSubmitting(true);
    setAuthError(null);

    try {
      const isClaimFlow = !selectedInspector.claimed;
      const endpoint = isClaimFlow
        ? "/api/auth/inspector/claim"
        : "/api/auth/inspector/login";

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspectorId: selectedInspector.id,
          password: inspPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Inspector authentication failed.");
      }
      onAuthenticated(data.user, data.token);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : "Could not sign in as inspector."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function jumpToSignIn(role: UserRole, openModal = false) {
    setAuthRole(role);
    setAuthError(null);
    if (openModal) {
      setAuthModalOpen(true);
      return;
    }
    const el = document.getElementById("sign-in");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setAuthModalOpen(true);
    }
  }

  const activePreview = PREVIEW_STATES[previewTab];

  function renderAuthFormFields(idPrefix: string) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setAuthRole("inspector");
              setAuthError(null);
            }}
            className={`min-h-[38px] rounded text-xs font-semibold transition-colors whitespace-nowrap ${
              authRole === "inspector"
                ? "bg-white text-slate-950 shadow-xs"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Field Inspector
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthRole("supervisor");
              setAuthError(null);
            }}
            className={`min-h-[38px] rounded text-xs font-semibold transition-colors whitespace-nowrap ${
              authRole === "supervisor"
                ? "bg-white text-slate-950 shadow-xs"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Supervisor / Ops Manager
          </button>
        </div>

        {authError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        {loadingStatus ? (
          <div className="py-6 text-center text-xs text-slate-500">
            Checking workspace access status...
          </div>
        ) : authRole === "supervisor" ? (
          <form onSubmit={handleSupervisorSubmit} className="space-y-4">
            {status && !status.supervisorClaimed ? (
              <>
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                  First-run setup: Set your Supervisor name and password to
                  activate central dispatch, multi-stage creation, and conflict
                  resolution authority.
                </div>
                <div>
                  <label
                    htmlFor={`${idPrefix}-sup-name`}
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Supervisor Name *
                  </label>
                  <input
                    id={`${idPrefix}-sup-name`}
                    type="text"
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`${idPrefix}-sup-email`}
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Work Email
                  </label>
                  <input
                    id={`${idPrefix}-sup-email`}
                    type="email"
                    value={supEmail}
                    onChange={(e) => setSupEmail(e.target.value)}
                    className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950"
                  />
                </div>
              </>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                Enter your Supervisor password to access Sites, Inspectors,
                Workload Analytics, and QA Conflict Resolution.
              </div>
            )}

            <div>
              <label
                htmlFor={`${idPrefix}-sup-pw`}
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {status && !status.supervisorClaimed
                  ? "Create Supervisor Password (min 6 chars) *"
                  : "Supervisor Password *"}
              </label>
              <input
                id={`${idPrefix}-sup-pw`}
                type="password"
                required
                minLength={status && !status.supervisorClaimed ? 6 : 1}
                value={supPassword}
                onChange={(e) => setSupPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[40px] w-full rounded-md bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {submitting
                ? "Verifying..."
                : status && !status.supervisorClaimed
                ? "Activate & Open Supervisor Console"
                : "Sign In to Supervisor Console"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleInspectorSubmit} className="space-y-4">
            <div>
              <label
                htmlFor={`${idPrefix}-insp-select`}
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Active Inspector Profile *
              </label>
              <select
                id={`${idPrefix}-insp-select`}
                value={selectedInspId}
                onChange={(e) => {
                  setSelectedInspId(e.target.value);
                  setAuthError(null);
                }}
                className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950"
              >
                {(status?.inspectors ?? []).map((insp) => (
                  <option key={insp.id} value={insp.id}>
                    {insp.name} ({insp.code}) —{" "}
                    {insp.claimed ? "Activated" : "First-time setup"}
                  </option>
                ))}
              </select>
            </div>

            {selectedInspector && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                {selectedInspector.claimed
                  ? `Sign in as ${selectedInspector.name} (${selectedInspector.code}) to open your assigned field queue.`
                  : `First-time activation for ${selectedInspector.name} (${selectedInspector.code}): set a personal password to enter your inspector queue.`}
              </div>
            )}

            <div>
              <label
                htmlFor={`${idPrefix}-insp-pw`}
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {selectedInspector?.claimed
                  ? "Inspector Password *"
                  : "Create Personal Password (min 6 chars) *"}
              </label>
              <input
                id={`${idPrefix}-insp-pw`}
                type="password"
                required
                minLength={selectedInspector?.claimed ? 1 : 6}
                value={inspPassword}
                onChange={(e) => setInspPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950"
              />
            </div>

            <button
              type="submit"
              disabled={submitting || !selectedInspector}
              className="min-h-[40px] w-full rounded-md bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {submitting
                ? "Verifying..."
                : selectedInspector?.claimed
                ? "Open Inspector Queue"
                : "Activate & Open Inspector Queue"}
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Sticky Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
          >
            Nirikshan
          </a>

          {/* Zone 2: Clean single-line anchor links */}
          <nav
            aria-label="Product navigation"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
          >
            <a
              href="#about"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              About
            </a>
            <a
              href="#capabilities"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Capabilities
            </a>
            <a
              href="#who-its-for"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Who It&apos;s For
            </a>
            <a
              href="#sign-in"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Access Portal
            </a>
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => jumpToSignIn("inspector", true)}
              className="min-h-[40px] rounded-md bg-slate-950 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* 1. Hero Section */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1200px] px-6 py-12 lg:py-16 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <p className="text-xs font-medium text-slate-500">
                  Nirikshan · Offline-First Field Inspection · Multi-Site Compliance
                </p>
                <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-950 leading-[1.08]">
                  Field inspections that never stop when the signal drops.
                </h1>
                <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                  Offline-first field inspection and multi-site compliance, built
                  for zero-signal reality. Nirikshan unifies multi-site directory
                  management, live inspector workload tracking, and offline
                  checklist execution with supervisor conflict resolution.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => jumpToSignIn("supervisor", false)}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-md bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => jumpToSignIn("inspector", false)}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <span>Inspector Sign In</span>
                </button>
                <PWAInstallButton />
              </div>
            </div>

            {/* Hero Visual & Interactive System State Preview */}
            <div className="lg:col-span-6 flex flex-col justify-between gap-4">
              <div className="flex-1 min-h-[220px] rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                {heroImgFailed ? (
                  <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-slate-100">
                    <Building2 className="h-10 w-10 text-slate-500 mb-3" />
                    <span className="text-sm font-semibold text-slate-800">
                      Industrial Facility Walkdown &amp; Telemetry
                    </span>
                  </div>
                ) : (
                  <img
                    src="/src/assets/images/hero_field_inspection_1795300668356.jpg"
                    alt="Engineers inspecting precision industrial turbine assembly equipment on a clean plant floor"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover aspect-video"
                  />
                )}
              </div>

              {/* Minimal Interactive Preview Switcher */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div
                  role="tablist"
                  aria-label="System state preview"
                  className="flex flex-wrap gap-1 rounded-md bg-slate-200/70 p-1"
                >
                  {(
                    [
                      { id: "offline", title: "Offline Ready (IndexedDB)" },
                      { id: "directory", title: "Multi-Site Directory" },
                      { id: "sync", title: "Zero-Conflict Sync" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={previewTab === t.id}
                      onClick={() => setPreviewTab(t.id)}
                      className={`flex-1 min-h-[32px] rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        previewTab === t.id
                          ? "bg-white text-slate-950 shadow-xs"
                          : "text-slate-600 hover:text-slate-950"
                      }`}
                    >
                      {t.title}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-950">
                    {activePreview.heading}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      activePreview.statusTone === "emerald"
                        ? "text-emerald-600"
                        : activePreview.statusTone === "amber"
                        ? "text-amber-600"
                        : "text-slate-700"
                    }`}
                  >
                    {activePreview.statusTone === "emerald" ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : activePreview.statusTone === "amber" ? (
                      <Database className="h-3.5 w-3.5" />
                    ) : (
                      <Building2 className="h-3.5 w-3.5" />
                    )}
                    {activePreview.statusText}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 border-y border-slate-200 py-2.5 text-xs">
                  {activePreview.metrics.map((m) => (
                    <div key={m.label}>
                      <div className="text-[11px] text-slate-500">{m.label}</div>
                      <div className="font-mono font-semibold text-slate-900 tabular-nums mt-0.5 truncate">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {activePreview.summary}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 2. USPs (3-Column Structured Grid) */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-[1200px] px-6 py-12 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-0 lg:divide-x divide-slate-200">
            <div className="lg:pr-8 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 tabular-nums">
                <span>01 · OFFLINE EXECUTION</span>
                <WifiOff className="h-4 w-4 text-amber-600" />
              </div>
              <h2 className="text-base font-bold text-slate-950">
                100% Offline Execution
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Full checklists, photo evidence, GPS tagging, arrival selfies,
                and digital signatures work in basements, factories, and remote
                solar fields via local IndexedDB—syncing automatically when
                connectivity returns.
              </p>
            </div>

            <div className="lg:px-8 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 tabular-nums">
                <span>02 · CONFLICT SAFETY</span>
                <GitCompare className="h-4 w-4 text-emerald-600" />
              </div>
              <h2 className="text-base font-bold text-slate-950">
                Item-Level Conflict Resolution
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                When two inspectors edit the same site checklist offline,
                Nirikshan detects exact item-level diffs, queues conflicting
                submissions, and lets supervisors resolve conflicts side-by-side
                without data loss.
              </p>
            </div>

            <div className="lg:pl-8 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-500 tabular-nums">
                <span>03 · WORKLOAD ENGINE</span>
                <Layers className="h-4 w-4 text-slate-700" />
              </div>
              <h2 className="text-base font-bold text-slate-950">
                Live Multi-Site &amp; Workload Intelligence
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Dynamically computes every inspector&apos;s assigned, pending,
                completed, and current active inspection sites across cities,
                countries, and facility types.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Capabilities / FABs (Features -> Advantages -> Benefits Matrix) */}
        <section
          id="capabilities"
          className="mx-auto max-w-[1200px] px-6 py-16 space-y-8"
        >
          <div className="max-w-2xl space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
              Built for field execution from site arrival to QA sign-off
            </h2>
            <p className="text-sm text-slate-600">
              Every engineering feature maps directly to an operational advantage
              and measurable field compliance outcome.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* FAB 1 */}
            <article className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-950">
                  01. Offline Checklist, Photo, GPS &amp; E-Signature Capture
                </h3>
                <Camera className="h-4 w-4 text-slate-500 shrink-0" />
              </div>
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-2.5 grid grid-cols-1 sm:grid-cols-4 gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Feature
                  </dt>
                  <dd className="sm:col-span-3 text-slate-800">
                    Offline-ready checklist parameters with arrival selfie
                    geotagging, per-item hardware GPS, photo attachments, and
                    on-glass signatures.
                  </dd>
                </div>
                <div className="py-2.5 grid grid-cols-1 sm:grid-cols-4 gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Advantage
                  </dt>
                  <dd className="sm:col-span-3 text-slate-600">
                    Runs natively in the browser as an installable PWA backed by
                    Dexie IndexedDB local storage.
                  </dd>
                </div>
                <div className="pt-2.5 grid grid-cols-1 sm:grid-cols-4 gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Benefit
                  </dt>
                  <dd className="sm:col-span-3 font-medium text-slate-900">
                    Zero paper forms, zero re-entry delays, and instant
                    print-ready PDF reports generated directly on site.
                  </dd>
                </div>
              </dl>
            </article>

            {/* FAB 2 */}
            <article className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-950">
                  02. Multi-Field Site &amp; Inspector Directory
                </h3>
                <MapPin className="h-4 w-4 text-slate-500 shrink-0" />
              </div>
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-2.5 space-y-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Feature
                  </dt>
                  <dd className="text-slate-800">
                    Centralized sites and inspectors directory with locked site
                    coordinates and supervisor overviews.
                  </dd>
                </div>
                <div className="py-2.5 space-y-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Advantage
                  </dt>
                  <dd className="text-slate-600">
                    Filter by city, country, facility type, or assigned engineer
                    with non-destructive archive/restore controls and site map
                    pins.
                  </dd>
                </div>
                <div className="pt-2.5 space-y-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Benefit
                  </dt>
                  <dd className="font-medium text-slate-900">
                    Operations managers assign the right engineer to the right
                    facility in seconds.
                  </dd>
                </div>
              </dl>
            </article>

            {/* FAB 3 */}
            <article className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-950">
                  03. Dynamic Inspector Workload Engine
                </h3>
                <ShieldCheck className="h-4 w-4 text-slate-500 shrink-0" />
              </div>
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-2.5 space-y-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Feature
                  </dt>
                  <dd className="text-slate-800">
                    Live cross-referencing between active facility rosters and
                    field inspection records.
                  </dd>
                </div>
                <div className="py-2.5 space-y-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Advantage
                  </dt>
                  <dd className="text-slate-600">
                    Real-time calculation of active, pending, and completed sites
                    per inspector without manual spreadsheets.
                  </dd>
                </div>
                <div className="pt-2.5 space-y-0.5">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Benefit
                  </dt>
                  <dd className="font-medium text-slate-900">
                    Prevents field burnout, surfaces bottlenecks early, and
                    eliminates missed due dates.
                  </dd>
                </div>
              </dl>
            </article>

            {/* FAB 4 */}
            <article className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-slate-950">
                  04. Single &amp; Multi-Stage Inspection Parameter Builder
                </h3>
                <PenTool className="h-4 w-4 text-slate-500 shrink-0" />
              </div>
              <dl className="divide-y divide-slate-100 text-sm">
                <div className="py-2.5 grid grid-cols-1 sm:grid-cols-4 gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Feature
                  </dt>
                  <dd className="sm:col-span-3 text-slate-800">
                    Define single-stage or sequential multi-stage inspections
                    directly from supervisor dispatch.
                  </dd>
                </div>
                <div className="py-2.5 grid grid-cols-1 sm:grid-cols-4 gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Advantage
                  </dt>
                  <dd className="sm:col-span-3 text-slate-600">
                    Attach custom parameter names, target thresholds, and units
                    (e.g., Oil Temp &lt; 75 °C, Valve Pressure 1.5–2.5 bar) per
                    stage.
                  </dd>
                </div>
                <div className="pt-2.5 grid grid-cols-1 sm:grid-cols-4 gap-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    Benefit
                  </dt>
                  <dd className="sm:col-span-3 font-medium text-slate-900">
                    Adapts cleanly to factories, solar plants, substations, and
                    cold-chain farms without code changes.
                  </dd>
                </div>
              </dl>
            </article>
          </div>
        </section>

        {/* 4. About Nirikshan */}
        <section
          id="about"
          className="border-t border-slate-200 bg-white py-16"
        >
          <div className="mx-auto max-w-[1200px] px-6 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-stretch">
            <div className="lg:col-span-5">
              <div className="h-full min-h-[260px] rounded-lg border border-slate-200 overflow-hidden bg-slate-100">
                {facilityImgFailed ? (
                  <div className="h-full w-full flex flex-col items-center justify-center p-8 text-center bg-slate-100">
                    <ShieldCheck className="h-10 w-10 text-slate-500 mb-3" />
                    <span className="text-sm font-semibold text-slate-800">
                      Agricultural &amp; Cold-Chain Facility Audit
                    </span>
                  </div>
                ) : (
                  <img
                    src="/src/assets/images/facility_safety_audit_1795300666870.jpg"
                    alt="Commercial hydroponic greenhouse with stainless steel sensors inspected with Nirikshan"
                    referrerPolicy="no-referrer"
                    onError={() => setFacilityImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-mono uppercase tracking-wide text-slate-500">
                  About Nirikshan
                </p>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                  Built for close observation where network reliability ends
                </h2>
              </div>

              <div className="space-y-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                <p>
                  Named after the Sanskrit word for{" "}
                  <strong className="text-slate-900">
                    inspection and close observation
                  </strong>
                  , Nirikshan was built to bridge the gap between rugged,
                  disconnected field environments and real-time operational
                  oversight. Sub-basement turbine rooms, insulated cold-storage
                  bays, and remote solar arrays rarely offer dependable cellular
                  coverage when critical safety checks happen.
                </p>
                <p>
                  Instead of forcing field teams back onto clipboards and manual
                  spreadsheet entry, Nirikshan stores every verification—from
                  arrival check-in selfies and hardware GPS trails to multi-stage
                  sensor checks—inside local IndexedDB first, synchronizing
                  automatically upon reconnect while giving supervisors clear
                  authority over conflicting field submissions and QA sign-off.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Who It's For (Target Personas — 4 Clean Cards) */}
        <section
          id="who-its-for"
          className="border-t border-slate-200 bg-slate-50 py-16"
        >
          <div className="mx-auto max-w-[1200px] px-6 space-y-8">
            <div className="max-w-2xl space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                Who uses Nirikshan
              </h2>
              <p className="text-sm text-slate-600">
                Role-separated workflows keep field engineers focused on accurate
                walkdowns while giving supervisors full dispatch and QA control.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-2">
                <h3 className="text-base font-bold text-slate-950">
                  Field Inspectors &amp; Site Engineers
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Execute single-stage or multi-stage walkdowns offline, verify
                  arrival with geotagged photos, attach per-parameter evidence,
                  sign on glass, and export PDFs on the spot.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-2">
                <h3 className="text-base font-bold text-slate-950">
                  Operations &amp; Plant Supervisors
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Monitor live sync status, catch failed or overdue checks
                  immediately, co-sign completed inspections, and resolve queued
                  multi-inspector sync conflicts side-by-side.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-2">
                <h3 className="text-base font-bold text-slate-950">
                  Multi-Site Facility &amp; Asset Managers
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Maintain a structured directory of factories, solar plants,
                  warehouses, and agricultural sites with live Google Maps pins
                  while balancing team workload across regions.
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-2">
                <h3 className="text-base font-bold text-slate-950">
                  EHS &amp; QA Compliance Teams
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Enforce standardized safety gates alongside custom technical
                  thresholds and units, backed by timestamped arrival
                  verifications and dual-role digital sign-offs.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Sign-In & Role Access Portal */}
        <section
          id="sign-in"
          className="border-t border-slate-200 bg-white py-16"
        >
          <div className="mx-auto max-w-[1200px] px-6 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-mono uppercase tracking-wide text-slate-500">
                Role Access Portal
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950">
                Sign in to your operational console
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Inspectors enter their locked field queue directly; Supervisors
                access the Multi-Site Directory, Workload Intelligence, Custom
                Stage Builder, and Conflict Resolution Console.
              </p>

              <ul className="space-y-2.5 pt-2 text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Field Inspector:</strong> View only assigned sites,
                    capture offline GPS &amp; arrival selfies, and sync reports.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Supervisor / Ops Manager:</strong> Manage sites and
                    inspectors, dispatch multi-stage audits, and resolve sync
                    conflicts.
                  </span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-7">
              <div className="rounded-lg border border-slate-200 bg-white p-6">
                {renderAuthFormFields("portal")}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-[1200px] px-6 py-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500">
          <div className="font-semibold text-slate-900">Nirikshan</div>
          <div>
            Offline-First Field Inspection &amp; Multi-Site Operational Compliance
          </div>
          <button
            type="button"
            onClick={() => jumpToSignIn("supervisor", true)}
            className="text-left sm:text-right font-medium text-slate-700 hover:text-slate-950 underline underline-offset-2"
          >
            Access Console
          </button>
        </div>
      </footer>

      {/* Sign In Modal (Quick Access from Top Navbar) */}
      {authModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={() => setAuthModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 space-y-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2
                  id="auth-modal-title"
                  className="text-lg font-bold text-slate-950"
                >
                  Sign In to Nirikshan
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select your operational role to enter your workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                aria-label="Close sign in dialog"
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {renderAuthFormFields("modal")}
          </div>
        </div>
      )}
    </div>
  );
}
