import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import {
  AlertTriangle,
  Building2,
  CloudOff,
  Compass,
  Crosshair,
  ExternalLink,
  MapPin,
  Save,
  Sprout,
} from "lucide-react";
import type { AuthUser, InspectionRecord, Site } from "../lib/types.ts";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface SiteMapViewProps {
  currentUser: AuthUser;
  sites: Site[];
  inspections: InspectionRecord[];
  authToken: string;
  offlineMode: boolean;
  onSiteUpdated: () => Promise<void>;
  onOpenInspection: (inspectionId: string) => void;
}

interface SiteMarkerWithInfoProps {
  site: Site;
  isSelected: boolean;
  hasConflict: boolean;
  openInfoId: string | null;
  onSelect: (site: Site) => void;
  onCloseInfo: () => void;
}

function SiteMarkerWithInfo({
  site,
  isSelected,
  hasConflict,
  openInfoId,
  onSelect,
  onCloseInfo,
}: SiteMarkerWithInfoProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  if (typeof site.latitude !== "number" || typeof site.longitude !== "number") {
    return null;
  }

  const position = { lat: site.latitude, lng: site.longitude };
  const pinBackground = hasConflict
    ? "#dc2626"
    : isSelected
    ? "#0f172a"
    : site.type === "Farm"
    ? "#047857"
    : "#1d4ed8";

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={`${site.name} (${site.code})`}
        onClick={() => onSelect(site)}
        zIndex={isSelected ? 1000 : 10}
      >
        <Pin
          background={pinBackground}
          borderColor="#ffffff"
          glyphColor="#ffffff"
          scale={isSelected ? 1.25 : 1.05}
        />
      </AdvancedMarker>

      {openInfoId === site.id && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={290}
          onCloseClick={onCloseInfo}
        >
          <div className="space-y-1.5 text-xs text-slate-800 p-0.5">
            <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-slate-500">
              <span>{site.code}</span>
              <span>{site.type}</span>
            </div>
            <div className="font-semibold text-sm text-slate-900">
              {site.name}
            </div>
            <div className="text-slate-600">
              {site.location} · {site.city}, {site.country}
            </div>
            {site.overview && (
              <p className="text-slate-700 border-t border-slate-200 pt-1.5 leading-relaxed">
                {site.overview}
              </p>
            )}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface InspectionGpsMarkerProps {
  inspection: InspectionRecord;
}

function InspectionGpsMarker({ inspection }: InspectionGpsMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  if (!inspection.geoLocation) return null;

  const position = {
    lat: inspection.geoLocation.latitude,
    lng: inspection.geoLocation.longitude,
  };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={`GPS Check-In: ${inspection.siteName}`}
        onClick={() => setOpen(true)}
        zIndex={50}
      >
        <div className="h-4 w-4 rounded-full border-2 border-white bg-amber-500 shadow-sm" />
      </AdvancedMarker>

      {open && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={240}
          onCloseClick={() => setOpen(false)}
        >
          <div className="space-y-1 text-xs text-slate-800 p-0.5">
            <div className="font-semibold text-slate-900">
              Field GPS Check-In
            </div>
            <div>{inspection.siteName}</div>
            <div className="font-mono text-[11px] text-slate-600 tabular-nums">
              {inspection.geoLocation.latitude.toFixed(5)},{" "}
              {inspection.geoLocation.longitude.toFixed(5)}
            </div>
            <div className="text-[11px] text-slate-500">
              {inspection.inspectorName}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface GoogleMapInnerProps {
  sitesWithCoords: Site[];
  inspectionsWithGps: InspectionRecord[];
  selectedSite: Site | null;
  conflictSiteIds: Record<string, boolean>;
  openInfoId: string | null;
  pickCoordsMode: boolean;
  onSelectSite: (site: Site) => void;
  onCloseInfo: () => void;
  onMapPickCoords: (lat: number, lng: number) => void;
  onApiUnavailable: () => void;
}

function GoogleMapInner({
  sitesWithCoords,
  inspectionsWithGps,
  selectedSite,
  conflictSiteIds,
  openInfoId,
  pickCoordsMode,
  onSelectSite,
  onCloseInfo,
  onMapPickCoords,
  onApiUnavailable,
}: GoogleMapInnerProps) {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (
      status === APILoadingStatus.FAILED ||
      status === APILoadingStatus.AUTH_FAILURE
    ) {
      onApiUnavailable();
    }
  }, [status, onApiUnavailable]);

  const initialCenter = useMemo(() => {
    if (
      selectedSite &&
      typeof selectedSite.latitude === "number" &&
      typeof selectedSite.longitude === "number"
    ) {
      return { lat: selectedSite.latitude, lng: selectedSite.longitude };
    }
    const first = sitesWithCoords[0];
    if (
      first &&
      typeof first.latitude === "number" &&
      typeof first.longitude === "number"
    ) {
      return { lat: first.latitude, lng: first.longitude };
    }
    return { lat: 48.1874, lng: 11.6152 };
  }, [selectedSite, sitesWithCoords]);

  const handleMapClick = useCallback(
    (ev: { detail?: { latLng?: { lat: number; lng: number } | null } }) => {
      if (!pickCoordsMode) return;
      const latLng = ev.detail?.latLng;
      if (!latLng) return;
      onMapPickCoords(
        Number(latLng.lat.toFixed(6)),
        Number(latLng.lng.toFixed(6))
      );
    },
    [pickCoordsMode, onMapPickCoords]
  );

  return (
    <div className="relative h-[480px] w-full">
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={initialCenter}
        center={
          selectedSite &&
          typeof selectedSite.latitude === "number" &&
          typeof selectedSite.longitude === "number"
            ? { lat: selectedSite.latitude, lng: selectedSite.longitude }
            : undefined
        }
        defaultZoom={3}
        zoom={selectedSite && typeof selectedSite.latitude === "number" ? 11 : 3}
        gestureHandling="greedy"
        internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
        onClick={handleMapClick}
        style={{ width: "100%", height: "100%" }}
      >
        {sitesWithCoords.map((site) => (
          <SiteMarkerWithInfo
            key={site.id}
            site={site}
            isSelected={selectedSite?.id === site.id}
            hasConflict={Boolean(conflictSiteIds[site.id])}
            openInfoId={openInfoId}
            onSelect={onSelectSite}
            onCloseInfo={onCloseInfo}
          />
        ))}

        {inspectionsWithGps.map((insp) => (
          <InspectionGpsMarker key={insp.id} inspection={insp} />
        ))}
      </GoogleMap>

      {pickCoordsMode && (
        <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 rounded-md border border-slate-900 bg-slate-900/95 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
          Click anywhere on the map to set coordinates for{" "}
          {selectedSite?.name ?? "selected site"}
        </div>
      )}
    </div>
  );
}

export default function SiteMapView({
  currentUser,
  sites,
  inspections,
  authToken,
  offlineMode,
  onSiteUpdated,
  onOpenInspection,
}: SiteMapViewProps) {
  const isSupervisor = currentUser.role === "supervisor";
  const [selectedSiteId, setSelectedSiteId] = useState<string>(
    sites[0]?.id ?? ""
  );
  const [openInfoId, setOpenInfoId] = useState<string | null>(null);
  const [mapsFailed, setMapsFailed] = useState(false);

  // Supervisor Site Overview & Coordinate Editor state
  const [editOverview, setEditOverview] = useState("");
  const [editLat, setEditLat] = useState("");
  const [editLng, setEditLng] = useState("");
  const [pickCoordsMode, setPickCoordsMode] = useState(false);
  const [savingSite, setSavingSite] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedSite = useMemo(() => {
    return sites.find((s) => s.id === selectedSiteId) ?? sites[0] ?? null;
  }, [sites, selectedSiteId]);

  useEffect(() => {
    if (selectedSite) {
      setEditOverview(selectedSite.overview ?? "");
      setEditLat(
        typeof selectedSite.latitude === "number"
          ? String(selectedSite.latitude)
          : ""
      );
      setEditLng(
        typeof selectedSite.longitude === "number"
          ? String(selectedSite.longitude)
          : ""
      );
      setSaveMessage(null);
      setSaveError(null);
    }
  }, [selectedSite]);

  const sitesWithCoords = useMemo(
    () =>
      sites.filter(
        (s) =>
          typeof s.latitude === "number" &&
          typeof s.longitude === "number" &&
          Number.isFinite(s.latitude) &&
          Number.isFinite(s.longitude)
      ),
    [sites]
  );

  const inspectionsWithGps = useMemo(
    () => inspections.filter((rec) => Boolean(rec.geoLocation)),
    [inspections]
  );

  const conflictSiteIds = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const rec of inspections) {
      if (
        rec.siteId &&
        (rec.syncStatus === "conflict" || rec.status === "conflict")
      ) {
        map[rec.siteId] = true;
      }
    }
    return map;
  }, [inspections]);

  const relatedInspections = useMemo(() => {
    if (!selectedSite) return [];
    return inspections.filter(
      (rec) =>
        rec.siteId === selectedSite.id ||
        rec.siteName.toLowerCase() === selectedSite.name.toLowerCase()
    );
  }, [inspections, selectedSite]);

  function handleSelectSite(site: Site) {
    setSelectedSiteId(site.id);
    setOpenInfoId(site.id);
    setPickCoordsMode(false);
  }

  function handleMapPickCoords(lat: number, lng: number) {
    setEditLat(String(lat));
    setEditLng(String(lng));
    setPickCoordsMode(false);
    setSaveMessage(
      `Picked coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}. Click Save Overview & Coordinates to apply.`
    );
  }

  async function handleSaveSiteOverview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSite || !isSupervisor) return;
    if (offlineMode) {
      setSaveError("Disable Offline Mode before saving site updates.");
      return;
    }
    setSavingSite(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const latNum =
        editLat.trim() === "" ? null : Number.parseFloat(editLat.trim());
      const lngNum =
        editLng.trim() === "" ? null : Number.parseFloat(editLng.trim());

      if (
        latNum !== null &&
        (!Number.isFinite(latNum) || latNum < -90 || latNum > 90)
      ) {
        throw new Error("Latitude must be between -90 and 90.");
      }
      if (
        lngNum !== null &&
        (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180)
      ) {
        throw new Error("Longitude must be between -180 and 180.");
      }

      const res = await fetch(`/api/sites/${selectedSite.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          overview: editOverview,
          latitude: latNum,
          longitude: lngNum,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update site details.");
      }

      await onSiteUpdated();
      setSaveMessage(
        `Saved site overview and coordinates for ${selectedSite.name}.`
      );
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Could not save site details."
      );
    } finally {
      setSavingSite(false);
    }
  }

  const useInteractiveGoogleMap =
    !offlineMode && Boolean(MAPS_API_KEY) && !mapsFailed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inspection Site Map
          </h1>
          <p className="text-xs text-slate-600">
            {isSupervisor
              ? "Interactive map of all facility sites, supervisor site overviews, and field GPS check-ins."
              : "Read-only map of facilities currently assigned to your inspection queue."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-700" />
            Factory
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-700" />
            Farm
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            Field GPS Pin
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            Sync Conflict
          </span>
        </div>
      </div>

      {/* Main Map + Site Overview Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Map Canvas Column */}
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            {useInteractiveGoogleMap ? (
              <APIProvider
                apiKey={MAPS_API_KEY}
                libraries={["marker"]}
                language="en"
                region="US"
              >
                <GoogleMapInner
                  sitesWithCoords={sitesWithCoords}
                  inspectionsWithGps={inspectionsWithGps}
                  selectedSite={selectedSite}
                  conflictSiteIds={conflictSiteIds}
                  openInfoId={openInfoId}
                  pickCoordsMode={pickCoordsMode}
                  onSelectSite={handleSelectSite}
                  onCloseInfo={() => setOpenInfoId(null)}
                  onMapPickCoords={handleMapPickCoords}
                  onApiUnavailable={() => setMapsFailed(true)}
                />
              </APIProvider>
            ) : (
              /* Offline / Fallback Coordinate Schematic Map */
              <div className="bg-slate-900 text-slate-100 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700 pb-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                    <CloudOff className="h-4 w-4" />
                    <span>
                      {offlineMode
                        ? "Offline Coordinate Schematic (IndexedDB Cached Sites)"
                        : "Coordinate Schematic View (Live Maps Tiles Unavailable)"}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {sitesWithCoords.length} mapped sites ·{" "}
                    {inspectionsWithGps.length} GPS stamps
                  </span>
                </div>

                <div className="relative h-[380px] w-full rounded border border-slate-700 bg-slate-950 overflow-hidden">
                  <svg
                    viewBox="0 0 1000 460"
                    className="h-full w-full"
                    role="img"
                    aria-label="Global facility coordinate grid"
                  >
                    {/* Equator & Prime Meridian + Graticule */}
                    {[-60, -30, 0, 30, 60].map((lat) => {
                      const y = ((90 - lat) / 180) * 460;
                      return (
                        <line
                          key={`lat-${lat}`}
                          x1={0}
                          y1={y}
                          x2={1000}
                          y2={y}
                          stroke={lat === 0 ? "#475569" : "#1e293b"}
                          strokeWidth={lat === 0 ? 1.5 : 1}
                          strokeDasharray={lat === 0 ? undefined : "4 4"}
                        />
                      );
                    })}
                    {[-120, -60, 0, 60, 120].map((lng) => {
                      const x = ((lng + 180) / 360) * 1000;
                      return (
                        <line
                          key={`lng-${lng}`}
                          x1={x}
                          y1={0}
                          x2={x}
                          y2={460}
                          stroke={lng === 0 ? "#475569" : "#1e293b"}
                          strokeWidth={lng === 0 ? 1.5 : 1}
                          strokeDasharray={lng === 0 ? undefined : "4 4"}
                        />
                      );
                    })}

                    {/* Site Coordinates Plot */}
                    {sitesWithCoords.map((site) => {
                      const x = (((site.longitude ?? 0) + 180) / 360) * 1000;
                      const y = ((90 - (site.latitude ?? 0)) / 180) * 460;
                      const isSel = selectedSite?.id === site.id;
                      const fill = conflictSiteIds[site.id]
                        ? "#ef4444"
                        : site.type === "Farm"
                        ? "#10b981"
                        : "#3b82f6";
                      return (
                        <g
                          key={site.id}
                          onClick={() => handleSelectSite(site)}
                          className="cursor-pointer"
                        >
                          {isSel && (
                            <circle
                              cx={x}
                              cy={y}
                              r={16}
                              fill="none"
                              stroke="#f8fafc"
                              strokeWidth={2}
                            />
                          )}
                          <circle
                            cx={x}
                            cy={y}
                            r={isSel ? 8 : 6}
                            fill={fill}
                            stroke="#ffffff"
                            strokeWidth={2}
                          />
                          <text
                            x={x + 10}
                            y={y + 4}
                            fill="#e2e8f0"
                            fontSize="11"
                            fontFamily="IBM Plex Mono, monospace"
                          >
                            {site.code}
                          </text>
                        </g>
                      );
                    })}

                    {/* Field GPS Pins */}
                    {inspectionsWithGps.map((rec) => {
                      if (!rec.geoLocation) return null;
                      const x =
                        ((rec.geoLocation.longitude + 180) / 360) * 1000;
                      const y = ((90 - rec.geoLocation.latitude) / 180) * 460;
                      return (
                        <circle
                          key={`gps-${rec.id}`}
                          cx={x}
                          cy={y}
                          r={4}
                          fill="#f59e0b"
                          stroke="#0f172a"
                          strokeWidth={1.5}
                        />
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
          </div>

          {/* Site List Strip */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                {isSupervisor
                  ? `All Inspection Sites (${sites.length})`
                  : `My Assigned Sites (${sites.length})`}
              </h2>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                {sitesWithCoords.length} geolocated
              </span>
            </div>

            {sites.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No sites available in this scope.
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 max-h-[320px] overflow-y-auto">
                {sites.map((site) => {
                  const isSel = selectedSite?.id === site.id;
                  return (
                    <li key={site.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectSite(site)}
                        className={`w-full text-left px-4 py-3 flex items-start justify-between gap-4 transition-colors ${
                          isSel ? "bg-slate-100" : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {site.type === "Farm" ? (
                              <Sprout className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                            ) : (
                              <Building2 className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                            )}
                            <span className="text-sm font-semibold text-slate-900">
                              {site.name}
                            </span>
                            <span className="font-mono text-[11px] text-slate-500">
                              {site.code}
                            </span>
                            {!site.active && (
                              <span className="text-[11px] font-semibold text-red-700">
                                Archived
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600">
                            {site.location} · {site.city}, {site.country}
                          </p>
                          {site.overview && (
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {site.overview}
                            </p>
                          )}
                        </div>
                        <div className="text-right font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                          {typeof site.latitude === "number" &&
                          typeof site.longitude === "number" ? (
                            <span>
                              {site.latitude.toFixed(4)},{" "}
                              {site.longitude.toFixed(4)}
                            </span>
                          ) : (
                            <span className="text-amber-700">No coords</span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right Detail & Supervisor Site Overview Panel */}
        <aside className="lg:col-span-4 rounded-lg border border-slate-200 bg-white p-5 space-y-5">
          {!selectedSite ? (
            <div className="py-8 text-center text-xs text-slate-500">
              Select a site marker or site row to inspect its overview and
              assigned inspections.
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 pb-4 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span>{selectedSite.type}</span>
                  <span className="font-mono">{selectedSite.code}</span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedSite.name}
                </h2>
                <p className="text-xs text-slate-600">
                  {selectedSite.location} · {selectedSite.city},{" "}
                  {selectedSite.country}
                </p>
                <div className="pt-1 flex items-center gap-1.5 font-mono text-[11px] text-slate-600 tabular-nums">
                  <MapPin className="h-3.5 w-3.5 text-slate-500" />
                  {typeof selectedSite.latitude === "number" &&
                  typeof selectedSite.longitude === "number" ? (
                    <span>
                      {selectedSite.latitude.toFixed(6)},{" "}
                      {selectedSite.longitude.toFixed(6)}
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      Coordinates pending supervisor entry
                    </span>
                  )}
                </div>
              </div>

              {/* Site Overview Section */}
              {isSupervisor ? (
                <form onSubmit={handleSaveSiteOverview} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="site-overview-input"
                      className="text-xs font-semibold text-slate-800"
                    >
                      Supervisor Site Overview &amp; Briefing
                    </label>
                    {useInteractiveGoogleMap && (
                      <button
                        type="button"
                        onClick={() => setPickCoordsMode((v) => !v)}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-semibold transition-colors ${
                          pickCoordsMode
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Crosshair className="h-3 w-3" />
                        {pickCoordsMode ? "Cancel Map Pick" : "Pick on Map"}
                      </button>
                    )}
                  </div>

                  <textarea
                    id="site-overview-input"
                    rows={4}
                    value={editOverview}
                    onChange={(e) => setEditOverview(e.target.value)}
                    placeholder="Add hazard notes, PPE requirements, entry gates, and critical inspection guidance for field inspectors..."
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 leading-relaxed placeholder:text-slate-400"
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Latitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editLat}
                        onChange={(e) => setEditLat(e.target.value)}
                        placeholder="48.1874"
                        className="w-full min-h-[36px] rounded-md border border-slate-300 px-2.5 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Longitude
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={editLng}
                        onChange={(e) => setEditLng(e.target.value)}
                        placeholder="11.6152"
                        className="w-full min-h-[36px] rounded-md border border-slate-300 px-2.5 py-1 text-xs font-mono"
                      />
                    </div>
                  </div>

                  {saveError && (
                    <div className="flex items-start gap-1.5 rounded border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>{saveError}</span>
                    </div>
                  )}

                  {saveMessage && (
                    <div className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-900">
                      {saveMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={savingSite || offlineMode}
                    className="w-full min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
                  >
                    <Save className="h-3.5 w-3.5" />
                    <span>
                      {savingSite
                        ? "Saving..."
                        : "Save Site Overview & Coordinates"}
                    </span>
                  </button>
                </form>
              ) : (
                <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                    <Compass className="h-3.5 w-3.5 text-slate-600" />
                    <span>Supervisor Site Overview</span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedSite.overview?.trim()
                      ? selectedSite.overview
                      : "No supervisor site briefing recorded for this facility."}
                  </p>
                </div>
              )}

              {/* Linked Inspections */}
              <div className="border-t border-slate-200 pt-4 space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-800">
                  Site Inspections ({relatedInspections.length})
                </h3>
                {relatedInspections.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No active or historical inspections linked to this site.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {relatedInspections.map((rec) => (
                      <li
                        key={rec.id}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">
                            {rec.inspectorName}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                            Due {rec.dueDate} · {rec.status}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onOpenInspection(rec.id)}
                          className="min-h-[32px] inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 hover:bg-slate-100 shrink-0"
                        >
                          <span>Open</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
