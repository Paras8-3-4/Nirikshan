"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type {
  Inspector,
  InspectorSex,
  Site,
  SiteType,
} from "@/lib/directoryStore";

const SITE_TYPES: SiteType[] = [
  "Factory",
  "Solar",
  "Warehouse",
  "Substation",
  "Other",
];

const SEX_OPTIONS: InspectorSex[] = [
  "Male",
  "Female",
  "Other",
  "Prefer not to say",
];

interface SiteFormState {
  name: string;
  type: SiteType;
  location: string;
  city: string;
  state: string;
  country: string;
  gpsLat: string;
  gpsLng: string;
  assignedInspectorIds: string[];
}

interface InspectorFormState {
  name: string;
  code: string;
  designation: string;
  age: string;
  sex: InspectorSex | "";
  address: string;
  city: string;
  state: string;
  country: string;
}

const emptySiteForm: SiteFormState = {
  name: "",
  type: "Factory",
  location: "",
  city: "",
  state: "",
  country: "",
  gpsLat: "",
  gpsLng: "",
  assignedInspectorIds: [],
};

const emptyInspectorForm: InspectorFormState = {
  name: "",
  code: "",
  designation: "",
  age: "",
  sex: "",
  address: "",
  city: "",
  state: "",
  country: "",
};

export default function DirectoryPage() {
  const [activeTab, setActiveTab] = useState<"sites" | "inspectors">("sites");

  // Directory data
  const [sites, setSites] = useState<Site[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [includeInactive, setIncludeInactive] = useState(false);

  // Loading & feedback
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Site form & edit state
  const [siteForm, setSiteForm] = useState<SiteFormState>(emptySiteForm);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);

  // Inspector form & edit state
  const [inspectorForm, setInspectorForm] =
    useState<InspectorFormState>(emptyInspectorForm);
  const [editingInspectorId, setEditingInspectorId] = useState<string | null>(
    null
  );

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = includeInactive ? "?includeInactive=true" : "";
      const [sitesRes, inspectorsRes] = await Promise.all([
        fetch(`/api/sites${q}`, { cache: "no-store" }),
        fetch(`/api/inspectors${q}`, { cache: "no-store" }),
      ]);

      if (!sitesRes.ok) {
        throw new Error(`Failed to load sites (${sitesRes.status})`);
      }
      if (!inspectorsRes.ok) {
        throw new Error(`Failed to load inspectors (${inspectorsRes.status})`);
      }

      const sitesJson = await sitesRes.json();
      const inspectorsJson = await inspectorsRes.json();

      setSites(Array.isArray(sitesJson.sites) ? sitesJson.sites : []);
      setInspectors(
        Array.isArray(inspectorsJson.inspectors) ? inspectorsJson.inspectors : []
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load directory data"
      );
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  function resetSiteForm() {
    setSiteForm(emptySiteForm);
    setEditingSiteId(null);
  }

  function resetInspectorForm() {
    setInspectorForm(emptyInspectorForm);
    setEditingInspectorId(null);
  }

  function startEditSite(site: Site) {
    setActiveTab("sites");
    setEditingSiteId(site.id);
    setNotice(null);
    setError(null);
    setSiteForm({
      name: site.name,
      type: site.type,
      location: site.location,
      city: site.city,
      state: site.state ?? "",
      country: site.country,
      gpsLat: site.gpsLat !== undefined ? String(site.gpsLat) : "",
      gpsLng: site.gpsLng !== undefined ? String(site.gpsLng) : "",
      assignedInspectorIds: site.assignedInspectorIds ?? [],
    });
  }

  function startEditInspector(inspector: Inspector) {
    setActiveTab("inspectors");
    setEditingInspectorId(inspector.id);
    setNotice(null);
    setError(null);
    setInspectorForm({
      name: inspector.name,
      code: inspector.code,
      designation: inspector.designation,
      age: inspector.age !== undefined ? String(inspector.age) : "",
      sex: inspector.sex ?? "",
      address: inspector.address,
      city: inspector.city ?? "",
      state: inspector.state ?? "",
      country: inspector.country ?? "",
    });
  }

  function toggleAssignedInspector(inspectorId: string) {
    setSiteForm((prev) => {
      const exists = prev.assignedInspectorIds.includes(inspectorId);
      return {
        ...prev,
        assignedInspectorIds: exists
          ? prev.assignedInspectorIds.filter((id) => id !== inspectorId)
          : [...prev.assignedInspectorIds, inspectorId],
      };
    });
  }

  async function handleSiteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const parsedLat =
      siteForm.gpsLat.trim() !== "" ? Number(siteForm.gpsLat) : undefined;
    const parsedLng =
      siteForm.gpsLng.trim() !== "" ? Number(siteForm.gpsLng) : undefined;

    if (
      (parsedLat !== undefined && Number.isNaN(parsedLat)) ||
      (parsedLng !== undefined && Number.isNaN(parsedLng))
    ) {
      setSaving(false);
      setError("GPS latitude and longitude must be valid numbers.");
      return;
    }

    const payload = {
      name: siteForm.name.trim(),
      type: siteForm.type,
      location: siteForm.location.trim(),
      city: siteForm.city.trim(),
      state: siteForm.state.trim(),
      country: siteForm.country.trim(),
      gpsLat: parsedLat,
      gpsLng: parsedLng,
      assignedInspectorIds: siteForm.assignedInspectorIds,
    };

    try {
      const url = editingSiteId ? `/api/sites/${editingSiteId}` : "/api/sites";
      const method = editingSiteId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setNotice(
        editingSiteId ? `Updated site "${payload.name}".` : `Added site "${payload.name}".`
      );
      resetSiteForm();
      await loadDirectory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save site");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveSite(site: Site) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/sites/${site.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to archive site (${res.status})`);
      }
      if (editingSiteId === site.id) resetSiteForm();
      setNotice(`Archived site "${site.name}".`);
      await loadDirectory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive site");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreSite(site: Site) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Failed to restore site (${res.status})`);
      }
      setNotice(`Restored site "${site.name}".`);
      await loadDirectory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore site");
    } finally {
      setSaving(false);
    }
  }

  async function handleInspectorSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);

    const parsedAge =
      inspectorForm.age.trim() !== "" ? Number(inspectorForm.age) : undefined;
    if (parsedAge !== undefined && (Number.isNaN(parsedAge) || parsedAge < 16)) {
      setSaving(false);
      setError("Please enter a valid inspector age.");
      return;
    }

    const payload = {
      name: inspectorForm.name.trim(),
      code: inspectorForm.code.trim(),
      designation: inspectorForm.designation.trim(),
      age: parsedAge,
      sex: inspectorForm.sex || undefined,
      address: inspectorForm.address.trim(),
      city: inspectorForm.city.trim() || undefined,
      state: inspectorForm.state.trim() || undefined,
      country: inspectorForm.country.trim() || undefined,
    };

    try {
      const url = editingInspectorId
        ? `/api/inspectors/${editingInspectorId}`
        : "/api/inspectors";
      const method = editingInspectorId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      setNotice(
        editingInspectorId
          ? `Updated inspector "${payload.name}".`
          : `Added inspector "${payload.name}".`
      );
      resetInspectorForm();
      await loadDirectory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save inspector");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchiveInspector(inspector: Inspector) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/inspectors/${inspector.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || `Failed to deactivate inspector (${res.status})`
        );
      }
      if (editingInspectorId === inspector.id) resetInspectorForm();
      setNotice(`Deactivated inspector "${inspector.name}".`);
      await loadDirectory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to deactivate inspector"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRestoreInspector(inspector: Inspector) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/inspectors/${inspector.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || `Failed to reactivate inspector (${res.status})`
        );
      }
      setNotice(`Reactivated inspector "${inspector.name}".`);
      await loadDirectory();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reactivate inspector"
      );
    } finally {
      setSaving(false);
    }
  }

  const inspectorNameMap = new Map(
    inspectors.map((insp) => [insp.id, `${insp.name} (${insp.code})`])
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            FieldInspect Directory
          </h1>
          <p className="text-sm text-slate-600">
            Manage sites, assigned inspectors, and field inspector profiles.
          </p>
        </div>

        <nav className="flex items-center gap-3 text-sm">
          <Link
            href="/"
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Home
          </Link>
          <Link
            href="/supervisor"
            className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Supervisor
          </Link>
        </nav>
      </header>

      {/* Top Controls: Tab Switcher + Show Archived Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("sites")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              activeTab === "sites"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Sites ({sites.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("inspectors")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              activeTab === "inspectors"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Inspectors ({inspectors.length})
          </button>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Show archived / inactive
        </label>
      </div>

      {/* Status Banners */}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      {activeTab === "sites" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Site Form */}
          <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingSiteId ? "Edit Site" : "Add New Site"}
              </h2>
              {editingSiteId && (
                <button
                  type="button"
                  onClick={resetSiteForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={handleSiteSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Site Name *
                </label>
                <input
                  type="text"
                  required
                  value={siteForm.name}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, name: e.target.value })
                  }
                  placeholder="e.g. Jaipur Steel & Press — Bay 3"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Type
                  </label>
                  <select
                    value={siteForm.type}
                    onChange={(e) =>
                      setSiteForm({
                        ...siteForm,
                        type: e.target.value as SiteType,
                      })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {SITE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.country}
                    onChange={(e) =>
                      setSiteForm({ ...siteForm, country: e.target.value })
                    }
                    placeholder="India"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={siteForm.city}
                    onChange={(e) =>
                      setSiteForm({ ...siteForm, city: e.target.value })
                    }
                    placeholder="Jaipur"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    State / Region
                  </label>
                  <input
                    type="text"
                    value={siteForm.state}
                    onChange={(e) =>
                      setSiteForm({ ...siteForm, state: e.target.value })
                    }
                    placeholder="Rajasthan"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Street / Industrial Location *
                </label>
                <input
                  type="text"
                  required
                  value={siteForm.location}
                  onChange={(e) =>
                    setSiteForm({ ...siteForm, location: e.target.value })
                  }
                  placeholder="Plot 44, VKI Industrial Area"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    GPS Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={siteForm.gpsLat}
                    onChange={(e) =>
                      setSiteForm({ ...siteForm, gpsLat: e.target.value })
                    }
                    placeholder="26.9124"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    GPS Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={siteForm.gpsLng}
                    onChange={(e) =>
                      setSiteForm({ ...siteForm, gpsLng: e.target.value })
                    }
                    placeholder="75.7873"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {inspectors.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Assigned Inspectors
                  </label>
                  <div className="max-h-32 overflow-y-auto rounded-md border border-slate-200 p-2 space-y-1.5">
                    {inspectors.map((insp) => (
                      <label
                        key={insp.id}
                        className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={siteForm.assignedInspectorIds.includes(
                            insp.id
                          )}
                          onChange={() => toggleAssignedInspector(insp.id)}
                          className="h-3.5 w-3.5 rounded border-slate-300"
                        />
                        <span>
                          {insp.name}{" "}
                          <span className="text-slate-400">({insp.code})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingSiteId
                    ? "Save Site Changes"
                    : "Create Site"}
              </button>
            </form>
          </section>

          {/* Site List */}
          <section className="lg:col-span-7 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Sites Directory
            </h2>

            {loading ? (
              <p className="text-sm text-slate-500">Loading sites...</p>
            ) : sites.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No sites found. Add one using the form.
              </div>
            ) : (
              <div className="space-y-3">
                {sites.map((site) => (
                  <article
                    key={site.id}
                    className={`rounded-xl border p-4 shadow-sm transition ${
                      site.active
                        ? "border-slate-200 bg-white"
                        : "border-slate-200 bg-slate-50 opacity-75"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {site.name}
                          </h3>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {site.type}
                          </span>
                          {!site.active && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-600">
                          {site.location} — {site.city}
                          {site.state ? `, ${site.state}` : ""}, {site.country}
                        </p>
                        {(site.gpsLat !== undefined ||
                          site.gpsLng !== undefined) && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            GPS: {site.gpsLat ?? "?"}, {site.gpsLng ?? "?"}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditSite(site)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        {site.active ? (
                          <button
                            type="button"
                            onClick={() => handleArchiveSite(site)}
                            disabled={saving}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Archive
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestoreSite(site)}
                            disabled={saving}
                            className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {site.assignedInspectorIds.length === 0 ? (
                        <span className="text-xs text-slate-400">
                          No inspectors assigned
                        </span>
                      ) : (
                        site.assignedInspectorIds.map((inspId) => (
                          <span
                            key={inspId}
                            className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-800"
                          >
                            {inspectorNameMap.get(inspId) ?? inspId}
                          </span>
                        ))
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Inspector Form */}
          <section className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingInspectorId ? "Edit Inspector" : "Add New Inspector"}
              </h2>
              {editingInspectorId && (
                <button
                  type="button"
                  onClick={resetInspectorForm}
                  className="text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={handleInspectorSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={inspectorForm.name}
                  onChange={(e) =>
                    setInspectorForm({ ...inspectorForm, name: e.target.value })
                  }
                  placeholder="e.g. Aarav Sharma"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Inspector Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={inspectorForm.code}
                    onChange={(e) =>
                      setInspectorForm({ ...inspectorForm, code: e.target.value })
                    }
                    placeholder="e.g. Inspector C"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Designation *
                  </label>
                  <input
                    type="text"
                    required
                    value={inspectorForm.designation}
                    onChange={(e) =>
                      setInspectorForm({
                        ...inspectorForm,
                        designation: e.target.value,
                      })
                    }
                    placeholder="e.g. Field Engineer"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    min={16}
                    max={100}
                    value={inspectorForm.age}
                    onChange={(e) =>
                      setInspectorForm({ ...inspectorForm, age: e.target.value })
                    }
                    placeholder="29"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sex
                  </label>
                  <select
                    value={inspectorForm.sex}
                    onChange={(e) =>
                      setInspectorForm({
                        ...inspectorForm,
                        sex: e.target.value as InspectorSex | "",
                      })
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Select...</option>
                    {SEX_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  value={inspectorForm.address}
                  onChange={(e) =>
                    setInspectorForm({
                      ...inspectorForm,
                      address: e.target.value,
                    })
                  }
                  placeholder="MI Road, C-Scheme"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={inspectorForm.city}
                    onChange={(e) =>
                      setInspectorForm({ ...inspectorForm, city: e.target.value })
                    }
                    placeholder="Jaipur"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    State
                  </label>
                  <input
                    type="text"
                    value={inspectorForm.state}
                    onChange={(e) =>
                      setInspectorForm({
                        ...inspectorForm,
                        state: e.target.value,
                      })
                    }
                    placeholder="Rajasthan"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    value={inspectorForm.country}
                    onChange={(e) =>
                      setInspectorForm({
                        ...inspectorForm,
                        country: e.target.value,
                      })
                    }
                    placeholder="India"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingInspectorId
                    ? "Save Inspector Changes"
                    : "Create Inspector"}
              </button>
            </form>
          </section>

          {/* Inspector List */}
          <section className="lg:col-span-7 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900">
              Inspectors Directory
            </h2>

            {loading ? (
              <p className="text-sm text-slate-500">Loading inspectors...</p>
            ) : inspectors.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                No inspectors found. Add one using the form.
              </div>
            ) : (
              <div className="space-y-3">
                {inspectors.map((insp) => (
                  <article
                    key={insp.id}
                    className={`rounded-xl border p-4 shadow-sm transition ${
                      insp.active
                        ? "border-slate-200 bg-white"
                        : "border-slate-200 bg-slate-50 opacity-75"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">
                            {insp.name}
                          </h3>
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {insp.code}
                          </span>
                          {!insp.active && (
                            <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-slate-700">
                          {insp.designation}
                        </p>
                        <p className="mt-1 text-xs text-slate-600">
                          {insp.address}
                          {insp.city ? `, ${insp.city}` : ""}
                          {insp.state ? `, ${insp.state}` : ""}
                          {insp.country ? `, ${insp.country}` : ""}
                        </p>
                        {(insp.age !== undefined || insp.sex) && (
                          <p className="mt-0.5 text-xs text-slate-400">
                            {insp.age !== undefined ? `Age: ${insp.age}` : ""}
                            {insp.age !== undefined && insp.sex ? " · " : ""}
                            {insp.sex ? `Sex: ${insp.sex}` : ""}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEditInspector(insp)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        {insp.active ? (
                          <button
                            type="button"
                            onClick={() => handleArchiveInspector(insp)}
                            disabled={saving}
                            className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestoreInspector(insp)}
                            disabled={saving}
                            className="rounded-md border border-emerald-200 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}