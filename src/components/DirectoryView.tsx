import React, { useMemo, useState } from "react";
import {
  Archive,
  Building2,
  ChevronDown,
  ChevronUp,
  Edit3,
  Plus,
  RotateCcw,
  Search,
  UserPlus,
  X,
} from "lucide-react";
import {
  computeInspectorWorkload,
  type InspectionRecordForWorkload,
} from "../lib/inspectorWorkload.ts";
import type {
  InspectionRecord,
  Inspector,
  Site,
  SiteType,
} from "../lib/types.ts";
import CreateInspectionForm from "./CreateInspectionForm.tsx";

export type DirectoryTab = "sites" | "inspectors" | "new";

interface DirectoryViewProps {
  activeTab: DirectoryTab;
  onTabChange: (tab: DirectoryTab) => void;
  sites: Site[];
  inspectors: Inspector[];
  serverInspections: InspectionRecord[];
  authToken: string;
  loading: boolean;
  offlineMode: boolean;
  onRefreshAll: () => Promise<void>;
  onNavigateToExecution: () => void;
  onNavigateToMap?: () => void;
}

export default function DirectoryView({
  activeTab,
  onTabChange,
  sites,
  inspectors,
  serverInspections,
  authToken,
  loading,
  offlineMode,
  onRefreshAll,
  onNavigateToExecution,
  onNavigateToMap,
}: DirectoryViewProps) {
  // --- Sites Filters & Form State ---
  const [siteSearch, setSiteSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | SiteType>("all");
  const [inspectorFilter, setInspectorFilter] = useState("all");
  const [showArchivedSites, setShowArchivedSites] = useState(false);

  const [siteFormOpen, setSiteFormOpen] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [siteName, setSiteName] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [siteType, setSiteType] = useState<SiteType>("Factory");
  const [siteLocation, setSiteLocation] = useState("");
  const [siteCity, setSiteCity] = useState("");
  const [siteCountry, setSiteCountry] = useState("");
  const [siteOverview, setSiteOverview] = useState("");
  const [siteLat, setSiteLat] = useState("");
  const [siteLng, setSiteLng] = useState("");
  const [siteAssignedIds, setSiteAssignedIds] = useState<string[]>([]);
  const [siteSaving, setSiteSaving] = useState(false);
  const [siteError, setSiteError] = useState<string | null>(null);
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [detailModalSite, setDetailModalSite] = useState<Site | null>(null);

  // --- Inspectors Filters & Form State ---
  const [inspectorSearch, setInspectorSearch] = useState("");
  const [showArchivedInspectors, setShowArchivedInspectors] = useState(false);
  const [expandedInspectorId, setExpandedInspectorId] = useState<string | null>(
    null
  );

  const [inspFormOpen, setInspFormOpen] = useState(false);
  const [editingInspId, setEditingInspId] = useState<string | null>(null);
  const [inspName, setInspName] = useState("");
  const [inspCode, setInspCode] = useState("");
  const [inspEmail, setInspEmail] = useState("");
  const [inspRegion, setInspRegion] = useState("");
  const [inspPhone, setInspPhone] = useState("");
  const [inspCerts, setInspCerts] = useState("");
  const [inspBio, setInspBio] = useState("");
  const [inspSaving, setInspSaving] = useState(false);
  const [inspError, setInspError] = useState<string | null>(null);

  const cities = useMemo(
    () =>
      Array.from(new Set(sites.map((s) => s.city).filter(Boolean))).sort(),
    [sites]
  );

  const countries = useMemo(
    () =>
      Array.from(new Set(sites.map((s) => s.country).filter(Boolean))).sort(),
    [sites]
  );

  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    return sites.filter((site) => {
      if (!showArchivedSites && !site.active) return false;
      if (cityFilter !== "all" && site.city !== cityFilter) return false;
      if (countryFilter !== "all" && site.country !== countryFilter) return false;
      if (typeFilter !== "all" && site.type !== typeFilter) return false;
      if (
        inspectorFilter !== "all" &&
        !site.assignedInspectorIds.includes(inspectorFilter)
      ) {
        return false;
      }
      if (!q) return true;
      return (
        site.name.toLowerCase().includes(q) ||
        site.code.toLowerCase().includes(q) ||
        site.city.toLowerCase().includes(q) ||
        site.country.toLowerCase().includes(q) ||
        site.location.toLowerCase().includes(q)
      );
    });
  }, [
    sites,
    siteSearch,
    cityFilter,
    countryFilter,
    typeFilter,
    inspectorFilter,
    showArchivedSites,
  ]);

  const filteredInspectors = useMemo(() => {
    const q = inspectorSearch.trim().toLowerCase();
    return inspectors.filter((insp) => {
      if (!showArchivedInspectors && !insp.active) return false;
      if (!q) return true;
      return (
        insp.name.toLowerCase().includes(q) ||
        insp.code.toLowerCase().includes(q) ||
        insp.region.toLowerCase().includes(q) ||
        insp.email.toLowerCase().includes(q)
      );
    });
  }, [inspectors, inspectorSearch, showArchivedInspectors]);

  const workloadMap = useMemo(() => {
    const recs = serverInspections as InspectionRecordForWorkload[];
    const map = new Map<string, ReturnType<typeof computeInspectorWorkload>>();
    for (const insp of inspectors) {
      map.set(insp.id, computeInspectorWorkload(insp, sites, recs));
    }
    return map;
  }, [inspectors, sites, serverInspections]);

  function openNewSiteForm() {
    setEditingSiteId(null);
    setSiteName("");
    setSiteCode("");
    setSiteType("Factory");
    setSiteLocation("");
    setSiteCity("");
    setSiteCountry("");
    setSiteOverview("");
    setSiteLat("");
    setSiteLng("");
    setSiteAssignedIds([]);
    setSiteError(null);
    setSiteFormOpen(true);
  }

  function openEditSiteForm(site: Site) {
    setEditingSiteId(site.id);
    setSiteName(site.name);
    setSiteCode(site.code);
    setSiteType(site.type);
    setSiteLocation(site.location);
    setSiteCity(site.city);
    setSiteCountry(site.country);
    setSiteOverview(site.overview ?? "");
    setSiteLat(typeof site.latitude === "number" ? String(site.latitude) : "");
    setSiteLng(typeof site.longitude === "number" ? String(site.longitude) : "");
    setSiteAssignedIds([...site.assignedInspectorIds]);
    setSiteError(null);
    setSiteFormOpen(true);
  }

  function toggleSiteInspectorAssignment(inspId: string) {
    setSiteAssignedIds((prev) =>
      prev.includes(inspId)
        ? prev.filter((id) => id !== inspId)
        : [...prev, inspId]
    );
  }

  async function handleSaveSite(e: React.FormEvent) {
    e.preventDefault();
    if (offlineMode) {
      setSiteError("Disable Offline Mode before modifying directory records.");
      return;
    }
    setSiteSaving(true);
    setSiteError(null);

    try {
      const latVal =
        siteLat.trim() === "" ? null : Number.parseFloat(siteLat.trim());
      const lngVal =
        siteLng.trim() === "" ? null : Number.parseFloat(siteLng.trim());
      if (latVal !== null && (!Number.isFinite(latVal) || latVal < -90 || latVal > 90)) {
        throw new Error("Latitude must be between -90 and 90.");
      }
      if (lngVal !== null && (!Number.isFinite(lngVal) || lngVal < -180 || lngVal > 180)) {
        throw new Error("Longitude must be between -180 and 180.");
      }

      const payload = {
        name: siteName,
        code: siteCode,
        type: siteType,
        location: siteLocation,
        city: siteCity,
        country: siteCountry,
        overview: siteOverview,
        latitude: latVal,
        longitude: lngVal,
        assignedInspectorIds: siteAssignedIds,
      };
      const url = editingSiteId ? `/api/sites/${editingSiteId}` : "/api/sites";
      const method = editingSiteId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save site");
      }

      setSiteFormOpen(false);
      await onRefreshAll();
    } catch (err) {
      setSiteError(err instanceof Error ? err.message : "Could not save site");
    } finally {
      setSiteSaving(false);
    }
  }

  async function handleToggleSiteArchive(site: Site) {
    if (offlineMode) return;
    await fetch(`/api/sites/${site.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ active: !site.active }),
    });
    await onRefreshAll();
  }

  function openNewInspectorForm() {
    setEditingInspId(null);
    setInspName("");
    setInspCode("");
    setInspEmail("");
    setInspRegion("");
    setInspPhone("");
    setInspCerts("");
    setInspBio("");
    setInspError(null);
    setInspFormOpen(true);
  }

  function openEditInspectorForm(insp: Inspector) {
    setEditingInspId(insp.id);
    setInspName(insp.name);
    setInspCode(insp.code);
    setInspEmail(insp.email);
    setInspRegion(insp.region);
    setInspPhone(insp.phone ?? "");
    setInspCerts(insp.certifications ?? "");
    setInspBio(insp.bio ?? "");
    setInspError(null);
    setInspFormOpen(true);
  }

  async function handleSaveInspector(e: React.FormEvent) {
    e.preventDefault();
    if (offlineMode) {
      setInspError("Disable Offline Mode before modifying inspector records.");
      return;
    }
    setInspSaving(true);
    setInspError(null);

    try {
      const payload = {
        name: inspName,
        code: inspCode,
        email: inspEmail,
        region: inspRegion,
        phone: inspPhone,
        certifications: inspCerts,
        bio: inspBio,
      };
      const url = editingInspId
        ? `/api/inspectors/${editingInspId}`
        : "/api/inspectors";
      const method = editingInspId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save inspector");
      }

      setInspFormOpen(false);
      await onRefreshAll();
    } catch (err) {
      setInspError(
        err instanceof Error ? err.message : "Could not save inspector"
      );
    } finally {
      setInspSaving(false);
    }
  }

  async function handleToggleInspectorArchive(insp: Inspector) {
    if (offlineMode) return;
    await fetch(`/api/inspectors/${insp.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ active: !insp.active }),
    });
    await onRefreshAll();
  }

  async function handleResetInspectorClaim(insp: Inspector) {
    if (offlineMode) return;
    await fetch(`/api/inspectors/${insp.id}/reset-credentials`, {
      method: "POST",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    await onRefreshAll();
  }

  const hasActiveSiteFilters =
    siteSearch.trim() !== "" ||
    cityFilter !== "all" ||
    countryFilter !== "all" ||
    typeFilter !== "all" ||
    inspectorFilter !== "all" ||
    showArchivedSites;

  function resetSiteFilters() {
    setSiteSearch("");
    setCityFilter("all");
    setCountryFilter("all");
    setTypeFilter("all");
    setInspectorFilter("all");
    setShowArchivedSites(false);
  }

  const activeSiteCount = sites.filter((s) => s.active).length;
  const activeInspectorCount = inspectors.filter((i) => i.active).length;

  return (
    <div className="space-y-6">
      {/* Directory Header & Segmented View Tabs */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Operations Directory
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 tabular-nums">
            <span>{activeSiteCount} active sites</span>
            <span aria-hidden="true">·</span>
            <span>{activeInspectorCount} active inspectors</span>
            <span aria-hidden="true">·</span>
            <span>{serverInspections.length} server inspections</span>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Directory sections"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1 self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "sites"}
            onClick={() => onTabChange("sites")}
            className={`min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "sites"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sites
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "inspectors"}
            onClick={() => onTabChange("inspectors")}
            className={`min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "inspectors"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Inspectors
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "new"}
            onClick={() => onTabChange("new")}
            className={`min-h-[36px] rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "new"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:text-slate-900"
            }`}
          >
            + New Inspection
          </button>
        </div>
      </div>

      {/* TAB 1: SITES */}
      {activeTab === "sites" && (
        <div className="space-y-4">
          {/* Multi-Field Filter Bar */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5 flex-1">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={siteSearch}
                    onChange={(e) => setSiteSearch(e.target.value)}
                    placeholder="Search name, code, address..."
                    className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <select
                  aria-label="Filter by city"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="all">All Cities</option>
                  {cities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by country"
                  value={countryFilter}
                  onChange={(e) => setCountryFilter(e.target.value)}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="all">All Countries</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by site type"
                  value={typeFilter}
                  onChange={(e) =>
                    setTypeFilter(e.target.value as "all" | SiteType)
                  }
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="all">All Types</option>
                  <option value="Factory">Factory</option>
                  <option value="Farm">Farm</option>
                </select>

                <select
                  aria-label="Filter by assigned inspector"
                  value={inspectorFilter}
                  onChange={(e) => setInspectorFilter(e.target.value)}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="all">All Inspectors</option>
                  {inspectors.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showArchivedSites}
                    onChange={(e) => setShowArchivedSites(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  <span>Show archived</span>
                </label>

                {hasActiveSiteFilters && (
                  <button
                    type="button"
                    onClick={resetSiteFilters}
                    className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2 whitespace-nowrap"
                  >
                    Reset
                  </button>
                )}

                <button
                  type="button"
                  disabled={offlineMode}
                  onClick={openNewSiteForm}
                  className="min-h-[38px] inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap shrink-0"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Add Site
                </button>
              </div>
            </div>
          </div>

          {/* Site Create / Edit Form Panel */}
          {siteFormOpen && (
            <form
              onSubmit={handleSaveSite}
              className="rounded-lg border border-slate-300 bg-white p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingSiteId ? "Edit Site Record" : "Register New Site"}
                </h3>
                <button
                  type="button"
                  onClick={() => setSiteFormOpen(false)}
                  aria-label="Close site form"
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {siteError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {siteError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Site Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="e.g. Hamburg Automated Logistics Plant"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Site Code
                  </label>
                  <input
                    type="text"
                    value={siteCode}
                    onChange={(e) => setSiteCode(e.target.value)}
                    placeholder="Auto if blank (e.g. HAM-F07)"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Type *
                  </label>
                  <select
                    value={siteType}
                    onChange={(e) => setSiteType(e.target.value as SiteType)}
                    className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="Factory">Factory</option>
                    <option value="Farm">Farm</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteCity}
                    onChange={(e) => setSiteCity(e.target.value)}
                    placeholder="Munich"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteCountry}
                    onChange={(e) => setSiteCountry(e.target.value)}
                    placeholder="Germany"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Street / Address *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteLocation}
                    onChange={(e) => setSiteLocation(e.target.value)}
                    placeholder="Industriestrasse 22"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supervisor Site Overview &amp; Hazard Briefing
                  </label>
                  <textarea
                    rows={2}
                    value={siteOverview}
                    onChange={(e) => setSiteOverview(e.target.value)}
                    placeholder="PPE requirements, entry gate rules, high-risk equipment notes for field inspectors..."
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={siteLat}
                    onChange={(e) => setSiteLat(e.target.value)}
                    placeholder="48.1874"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={siteLng}
                    onChange={(e) => setSiteLng(e.target.value)}
                    placeholder="11.6152"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-slate-700">
                  Assigned Inspectors
                </span>
                <div className="flex flex-wrap gap-2">
                  {inspectors
                    .filter((i) => i.active)
                    .map((insp) => {
                      const checked = siteAssignedIds.includes(insp.id);
                      return (
                        <label
                          key={insp.id}
                          className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                            checked
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              toggleSiteInspectorAssignment(insp.id)
                            }
                            className="sr-only"
                          />
                          <span>
                            {insp.name} ({insp.code})
                          </span>
                        </label>
                      );
                    })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSiteFormOpen(false)}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={siteSaving}
                  className="min-h-[38px] rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {siteSaving
                    ? "Saving..."
                    : editingSiteId
                    ? "Save Site Changes"
                    : "Create Site"}
                </button>
              </div>
            </form>
          )}

          {/* Sites Data Table */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-10 rounded bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredSites.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-slate-600">
                  No sites match your active filters.
                </p>
                <button
                  type="button"
                  onClick={resetSiteFilters}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Site & Code</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4">Location</th>
                      <th className="py-2.5 px-4">Assigned Inspectors</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredSites.map((site) => {
                      const assignedNames = site.assignedInspectorIds
                        .map((id) => inspectors.find((i) => i.id === id))
                        .filter((i): i is Inspector => Boolean(i));
                      const isSiteExpanded = expandedSiteId === site.id;
                      const siteInspections = serverInspections.filter(
                        (rec) =>
                          rec.siteId === site.id ||
                          rec.siteName.toLowerCase() === site.name.toLowerCase()
                      );
                      return (
                        <React.Fragment key={site.id}>
                          <tr
                            className={`hover:bg-slate-50 transition-colors ${
                              !site.active ? "bg-slate-50/70 text-slate-500" : ""
                            }`}
                          >
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSiteId(
                                    isSiteExpanded ? null : site.id
                                  )
                                }
                                aria-expanded={isSiteExpanded}
                                className="group inline-flex items-center gap-1.5 text-left font-semibold text-slate-900 hover:underline underline-offset-2"
                              >
                                <span>{site.name}</span>
                                {isSiteExpanded ? (
                                  <ChevronUp className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
                                )}
                              </button>
                              <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                                {site.code}
                                {typeof site.latitude === "number" &&
                                  typeof site.longitude === "number" &&
                                  ` · ${site.latitude.toFixed(4)}, ${site.longitude.toFixed(4)}`}
                              </div>
                              {site.overview && !isSiteExpanded && (
                                <p className="text-[11px] text-slate-600 mt-1 max-w-md line-clamp-2">
                                  {site.overview}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {site.type}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              <div>{site.location}</div>
                              <div className="text-[11px] text-slate-500">
                                {site.city}, {site.country}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              {assignedNames.length === 0 ? (
                                <span className="text-slate-400">
                                  Unassigned
                                </span>
                              ) : (
                                <span>
                                  {assignedNames
                                    .map((i) => `${i.name} (${i.code})`)
                                    .join(", ")}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 font-semibold">
                              {site.active ? (
                                <span className="text-emerald-700">Active</span>
                              ) : (
                                <span className="text-red-700">Archived</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-3">
                                <button
                                  type="button"
                                  disabled={offlineMode}
                                  onClick={() => openEditSiteForm(site)}
                                  className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={offlineMode}
                                  onClick={() => handleToggleSiteArchive(site)}
                                  className={`inline-flex items-center gap-1 font-medium disabled:opacity-40 ${
                                    site.active
                                      ? "text-amber-700 hover:text-amber-900"
                                      : "text-emerald-700 hover:text-emerald-900"
                                  }`}
                                >
                                  {site.active ? (
                                    <>
                                      <Archive className="h-3.5 w-3.5" />
                                      Archive
                                    </>
                                  ) : (
                                    <>
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Restore
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isSiteExpanded && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={6} className="px-4 py-4 space-y-3">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 text-xs">
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Supervisor Site Overview &amp; Hazards
                                    </div>
                                    <p className="text-slate-700 leading-relaxed">
                                      {site.overview ||
                                        "No supervisor hazard briefing provided yet."}
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Facility Coordinates &amp; Address
                                    </div>
                                    <div className="text-slate-800">
                                      {site.location}, {site.city},{" "}
                                      {site.country}
                                    </div>
                                    <div className="font-mono text-[11px] text-slate-600 tabular-nums">
                                      {typeof site.latitude === "number" &&
                                      typeof site.longitude === "number"
                                        ? `GPS: ${site.latitude.toFixed(6)}, ${site.longitude.toFixed(6)}`
                                        : "GPS coordinates not locked"}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                      Assigned Field Engineers (
                                      {assignedNames.length})
                                    </div>
                                    {assignedNames.length === 0 ? (
                                      <div className="text-slate-400">
                                        No inspectors assigned
                                      </div>
                                    ) : (
                                      <ul className="space-y-1 text-slate-700">
                                        {assignedNames.map((insp) => (
                                          <li key={insp.id}>
                                            <span className="font-medium text-slate-900">
                                              {insp.name}
                                            </span>{" "}
                                            <span className="font-mono text-[11px] text-slate-500">
                                              ({insp.code})
                                            </span>
                                            {insp.email ? ` · ${insp.email}` : ""}
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>

                                <div className="border-t border-slate-200 pt-3 space-y-1.5">
                                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                    Inspections at This Site (
                                    {siteInspections.length})
                                  </div>
                                  {siteInspections.length === 0 ? (
                                    <p className="text-xs text-slate-500">
                                      No inspections recorded for this site yet.
                                    </p>
                                  ) : (
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                      {siteInspections.map((rec) => {
                                        const done = rec.items.filter(
                                          (it) => it.status !== "pending"
                                        ).length;
                                        return (
                                          <div
                                            key={rec.id}
                                            className="rounded border border-slate-200 bg-white px-3 py-2 space-y-0.5 text-[11px]"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="font-mono font-semibold text-slate-900">
                                                {rec.id}
                                              </span>
                                              <span className="capitalize font-semibold text-slate-700">
                                                {rec.status}
                                              </span>
                                            </div>
                                            <div className="text-slate-600">
                                              {rec.inspectorName} · Due{" "}
                                              <span className="font-mono tabular-nums">
                                                {rec.dueDate}
                                              </span>
                                            </div>
                                            <div className="font-mono text-slate-500 tabular-nums">
                                              {done}/{rec.items.length} checks ·{" "}
                                              {rec.inspectionMode === "multi-stage"
                                                ? `${rec.stages?.length ?? 0} stages`
                                                : "Single-stage"}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INSPECTORS & LIVE WORKLOAD */}
      {activeTab === "inspectors" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={inspectorSearch}
                onChange={(e) => setInspectorSearch(e.target.value)}
                placeholder="Search inspector name, code, region..."
                className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showArchivedInspectors}
                  onChange={(e) => setShowArchivedInspectors(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span>Show archived</span>
              </label>

              <button
                type="button"
                disabled={offlineMode}
                onClick={openNewInspectorForm}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45 whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add Inspector
              </button>
            </div>
          </div>

          {inspFormOpen && (
            <form
              onSubmit={handleSaveInspector}
              className="rounded-lg border border-slate-300 bg-white p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {editingInspId ? "Edit Inspector" : "Register New Inspector"}
                </h3>
                <button
                  type="button"
                  onClick={() => setInspFormOpen(false)}
                  aria-label="Close inspector form"
                  className="text-slate-500 hover:text-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {inspError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {inspError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={inspName}
                    onChange={(e) => setInspName(e.target.value)}
                    placeholder="e.g. Nadia Al-Mansoor"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Inspector Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={inspCode}
                    onChange={(e) => setInspCode(e.target.value)}
                    placeholder="INSP-508"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={inspEmail}
                    onChange={(e) => setInspEmail(e.target.value)}
                    placeholder="name@nirikshan.ops"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Region
                  </label>
                  <input
                    type="text"
                    value={inspRegion}
                    onChange={(e) => setInspRegion(e.target.value)}
                    placeholder="EU-Central"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={inspPhone}
                    onChange={(e) => setInspPhone(e.target.value)}
                    placeholder="+49 89 5550 1420"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Certifications
                  </label>
                  <input
                    type="text"
                    value={inspCerts}
                    onChange={(e) => setInspCerts(e.target.value)}
                    placeholder="ISO 45001 Lead Auditor · OSHA 30"
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Profile Bio
                </label>
                <input
                  type="text"
                  value={inspBio}
                  onChange={(e) => setInspBio(e.target.value)}
                  placeholder="Operational specialties & audit scope"
                  className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInspFormOpen(false)}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inspSaving}
                  className="min-h-[38px] rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {inspSaving
                    ? "Saving..."
                    : editingInspId
                    ? "Save Inspector"
                    : "Create Inspector"}
                </button>
              </div>
            </form>
          )}

          {/* Inspectors Workload Table */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((n) => (
                  <div
                    key={n}
                    className="h-12 rounded bg-slate-100 animate-pulse"
                  />
                ))}
              </div>
            ) : filteredInspectors.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <p className="text-sm text-slate-600">
                  No inspectors match the current filter.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInspectorSearch("");
                    setShowArchivedInspectors(false);
                  }}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                      <th className="py-2.5 px-4">Inspector</th>
                      <th className="py-2.5 px-4">Current Inspection Site</th>
                      <th className="py-2.5 px-4 text-right">Assigned</th>
                      <th className="py-2.5 px-4 text-right">Pending</th>
                      <th className="py-2.5 px-4 text-right">Completed</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredInspectors.map((insp) => {
                      const workload = workloadMap.get(insp.id);
                      const isExpanded = expandedInspectorId === insp.id;
                      return (
                        <React.Fragment key={insp.id}>
                          <tr
                            className={`hover:bg-slate-50 transition-colors ${
                              !insp.active ? "bg-slate-50/70 text-slate-500" : ""
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900">
                                {insp.name}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                                <span className="font-mono">{insp.code}</span>
                                <span aria-hidden="true">·</span>
                                <span>{insp.region}</span>
                                {insp.email && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{insp.email}</span>
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {workload?.currentInspectionSite ? (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDetailModalSite(
                                        workload.currentInspectionSite!
                                      )
                                    }
                                    className="text-left font-medium text-slate-900 hover:underline underline-offset-2"
                                  >
                                    {workload.currentInspectionSite.name}
                                  </button>
                                  <div className="text-[11px] text-slate-500">
                                    {workload.currentInspectionSite.city},{" "}
                                    {workload.currentInspectionSite.country}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">
                                  No active queue
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                              {workload?.counts.assigned ?? 0}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-amber-700 tabular-nums">
                              {workload?.counts.pending ?? 0}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                              {workload?.counts.completed ?? 0}
                            </td>
                            <td className="py-3 px-4 font-semibold">
                              {insp.active ? (
                                <span className="text-emerald-700">Active</span>
                              ) : (
                                <span className="text-red-700">Archived</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedInspectorId(
                                      isExpanded ? null : insp.id
                                    )
                                  }
                                  className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900"
                                >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="h-3.5 w-3.5" />
                                      Sites
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="h-3.5 w-3.5" />
                                      Sites
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  disabled={offlineMode}
                                  onClick={() => openEditInspectorForm(insp)}
                                  className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900 disabled:opacity-40"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                  Edit
                                </button>
                                {insp.claimed && (
                                  <button
                                    type="button"
                                    disabled={offlineMode}
                                    onClick={() => handleResetInspectorClaim(insp)}
                                    className="font-medium text-slate-600 hover:text-slate-900 disabled:opacity-40"
                                  >
                                    Reset Login
                                  </button>
                                )}
                                <button
                                  type="button"
                                  disabled={offlineMode}
                                  onClick={() =>
                                    handleToggleInspectorArchive(insp)
                                  }
                                  className={`inline-flex items-center gap-1 font-medium disabled:opacity-40 ${
                                    insp.active
                                      ? "text-amber-700 hover:text-amber-900"
                                      : "text-emerald-700 hover:text-emerald-900"
                                  }`}
                                >
                                  {insp.active ? (
                                    <>
                                      <Archive className="h-3.5 w-3.5" />
                                      Archive
                                    </>
                                  ) : (
                                    <>
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Restore
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && workload && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={7} className="px-4 py-4 space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 text-xs text-slate-600">
                                  <div>
                                    <span className="font-semibold text-slate-800">
                                      Inspector Profile:
                                    </span>{" "}
                                    {insp.bio || "Field operations inspector"}
                                  </div>
                                  <div className="font-mono text-[11px] text-slate-500">
                                    {insp.phone ? `${insp.phone} · ` : ""}
                                    {insp.certifications || "Standard QA Certified"}
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
                                  <div>
                                    <div className="font-semibold text-slate-700 mb-1">
                                      Assigned Sites (
                                      {workload.assignedSites.length})
                                    </div>
                                    {workload.assignedSites.length === 0 ? (
                                      <span className="text-slate-400">
                                        None
                                      </span>
                                    ) : (
                                      <ul className="space-y-0.5 text-slate-600">
                                        {workload.assignedSites.map((s) => (
                                          <li key={s.id}>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDetailModalSite(s)
                                              }
                                              className="text-left text-slate-800 hover:underline underline-offset-2"
                                            >
                                              {s.name} ({s.code})
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-amber-800 mb-1">
                                      Pending Sites (
                                      {workload.pendingSites.length})
                                    </div>
                                    {workload.pendingSites.length === 0 ? (
                                      <span className="text-slate-400">
                                        None
                                      </span>
                                    ) : (
                                      <ul className="space-y-0.5 text-slate-600">
                                        {workload.pendingSites.map((s) => (
                                          <li key={s.id}>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDetailModalSite(s)
                                              }
                                              className="text-left text-slate-800 hover:underline underline-offset-2"
                                            >
                                              {s.name} ({s.code})
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-emerald-800 mb-1">
                                      Completed Sites (
                                      {workload.completedSites.length})
                                    </div>
                                    {workload.completedSites.length === 0 ? (
                                      <span className="text-slate-400">
                                        None
                                      </span>
                                    ) : (
                                      <ul className="space-y-0.5 text-slate-600">
                                        {workload.completedSites.map((s) => (
                                          <li key={s.id}>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setDetailModalSite(s)
                                              }
                                              className="text-left text-slate-800 hover:underline underline-offset-2"
                                            >
                                              {s.name} ({s.code})
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: + NEW INSPECTION */}
      {activeTab === "new" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7">
            <CreateInspectionForm
              sites={sites}
              inspectors={inspectors}
              authToken={authToken}
              onCreated={onRefreshAll}
              onNavigateToExecution={onNavigateToExecution}
            />
          </div>

          <aside className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Recent Dispatch Queue
                </h3>
                <p className="text-xs text-slate-500">
                  Server inspections automatically pulled into IndexedDB
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateToExecution}
                className="text-xs font-semibold text-slate-800 underline underline-offset-2 hover:text-slate-950 whitespace-nowrap"
              >
                Field Execution
              </button>
            </div>

            {serverInspections.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">
                No inspections dispatched yet.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200">
                {serverInspections.slice(0, 6).map((rec) => {
                  const matchedSite =
                    sites.find((s) => s.id === rec.siteId) ??
                    sites.find(
                      (s) => s.name.toLowerCase() === rec.siteName.toLowerCase()
                    ) ??
                    null;
                  const fallbackSite: Site = matchedSite ?? {
                    id: rec.siteId ?? rec.id,
                    name: rec.siteName,
                    code: "SITE",
                    type: rec.siteType,
                    location: rec.location || "Address unavailable",
                    city: "",
                    country: "",
                    overview: rec.siteOverview,
                    latitude: rec.siteLatitude,
                    longitude: rec.siteLongitude,
                    active: true,
                    assignedInspectorIds: rec.inspectorId ? [rec.inspectorId] : [],
                    createdAt: rec.updatedAt,
                    updatedAt: rec.updatedAt,
                  };
                  return (
                    <li key={rec.id} className="py-3 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailModalSite(fallbackSite)}
                          className="text-left text-xs font-semibold text-slate-900 hover:underline underline-offset-2"
                        >
                          {rec.siteName}
                        </button>
                        <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                          {rec.items.length} checks
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{rec.inspectorName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Due {rec.dueDate}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize font-medium text-slate-700">
                          {rec.status}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>
        </div>
      )}

      {/* Inline Site Details Modal (No Tab Switching) */}
      {detailModalSite && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4"
          onClick={() => setDetailModalSite(null)}
        >
          <div
            className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="space-y-0.5">
                <div className="font-mono text-[11px] text-slate-500">
                  {detailModalSite.code} · {detailModalSite.type} ·{" "}
                  {detailModalSite.active ? "Active" : "Archived"}
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {detailModalSite.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalSite(null)}
                aria-label="Close site details"
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Facility Address
                </div>
                <div className="text-slate-800">
                  {detailModalSite.location}
                  {detailModalSite.city ? `, ${detailModalSite.city}` : ""}
                  {detailModalSite.country
                    ? `, ${detailModalSite.country}`
                    : ""}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Locked Coordinates
                </div>
                <div className="font-mono text-slate-800 tabular-nums">
                  {typeof detailModalSite.latitude === "number" &&
                  typeof detailModalSite.longitude === "number"
                    ? `${detailModalSite.latitude.toFixed(6)}, ${detailModalSite.longitude.toFixed(6)}`
                    : "Not specified"}
                </div>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Supervisor Site Overview &amp; Hazard Briefing
              </div>
              <p className="rounded border border-slate-200 bg-slate-50 p-3 text-slate-700 leading-relaxed">
                {detailModalSite.overview ||
                  "No supervisor hazard briefing provided for this site yet."}
              </p>
            </div>

            {(() => {
              const relatedInspections = serverInspections.filter(
                (rec) =>
                  rec.siteId === detailModalSite.id ||
                  rec.siteName.toLowerCase() ===
                    detailModalSite.name.toLowerCase()
              );
              const assigned = detailModalSite.assignedInspectorIds
                .map((id) => inspectors.find((i) => i.id === id))
                .filter((i): i is Inspector => Boolean(i));

              return (
                <div className="space-y-3 border-t border-slate-200 pt-3 text-xs">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Assigned Inspectors ({assigned.length})
                    </div>
                    {assigned.length === 0 ? (
                      <span className="text-slate-400">None assigned</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {assigned.map((insp) => (
                          <span
                            key={insp.id}
                            className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-800"
                          >
                            {insp.name} ({insp.code})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Site Inspection Queue ({relatedInspections.length})
                    </div>
                    {relatedInspections.length === 0 ? (
                      <span className="text-slate-400">
                        No inspections dispatched yet.
                      </span>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {relatedInspections.map((rec) => {
                          const done = rec.items.filter(
                            (it) => it.status !== "pending"
                          ).length;
                          return (
                            <div
                              key={rec.id}
                              className="flex items-center justify-between gap-2 rounded border border-slate-200 px-2.5 py-1.5 text-[11px]"
                            >
                              <div>
                                <span className="font-mono font-semibold text-slate-900">
                                  {rec.id}
                                </span>{" "}
                                <span className="text-slate-600">
                                  · {rec.inspectorName} · Due {rec.dueDate}
                                </span>
                              </div>
                              <span className="font-mono text-slate-700 tabular-nums shrink-0">
                                {done}/{rec.items.length} ({rec.status})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
