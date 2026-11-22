import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, CloudOff } from "lucide-react";
import DirectoryView, { type DirectoryTab } from "./components/DirectoryView.tsx";
import FieldExecutionView, {
  type ResolveConflictOptions,
} from "./components/FieldExecutionView.tsx";
import ProductLandingPage from "./components/ProductLandingPage.tsx";
import ProfileView from "./components/ProfileView.tsx";
import SiteMapView from "./components/SiteMapView.tsx";
import {
  cacheSitesToDb,
  getAllLocalInspections,
  getAllLocalSites,
  markInspectionsConflict,
  markInspectionsSynced,
  pullServerInspectionsToDb,
  saveLocalInspectionEdit,
} from "./lib/db.ts";
import { deriveStatusFromItems } from "./lib/serverStore.ts";
import {
  isArrivalGeoVerified,
  type ArrivalVerification,
  type AuthUser,
  type ChecklistItemStatus,
  type GeoLocationEntry,
  type InspectionPhoto,
  type InspectionRecord,
  type Inspector,
  type Site,
} from "./lib/types.ts";
import { useOnlineStatus } from "./lib/usePWAInstall.ts";

type AppRoute =
  | "execution"
  | "directory"
  | "assigned-sites"
  | "map"
  | "profile";

function parseRouteFromLocation(): {
  route: AppRoute;
  directoryTab: DirectoryTab;
} {
  if (typeof window === "undefined") {
    return { route: "execution", directoryTab: "sites" };
  }
  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const tabParam = params.get("tab");
  const directoryTab: DirectoryTab =
    tabParam === "inspectors" || tabParam === "new" ? tabParam : "sites";

  if (pathname.startsWith("/directory") || pathname.startsWith("/supervisor")) {
    return { route: "directory", directoryTab };
  }
  if (pathname.startsWith("/assigned-sites")) {
    return { route: "assigned-sites", directoryTab: "sites" };
  }
  if (pathname.startsWith("/map")) {
    return { route: "map", directoryTab: "sites" };
  }
  if (pathname.startsWith("/profile")) {
    return { route: "profile", directoryTab: "sites" };
  }
  if (pathname.startsWith("/inspector")) {
    return { route: "execution", directoryTab: "sites" };
  }
  return { route: "execution", directoryTab };
}

function belongsToInspector(rec: InspectionRecord, user: AuthUser): boolean {
  if (user.role !== "inspector") return true;
  if (rec.inspectorId && user.inspectorId && rec.inspectorId === user.inspectorId) {
    return true;
  }
  const raw = (rec.inspectorName || "").trim().toLowerCase();
  const code = (user.code || "").trim().toLowerCase();
  const name = user.name.trim().toLowerCase();
  return Boolean(raw && (raw === name || (code && raw.includes(code))));
}

export default function App() {
  const initial = parseRouteFromLocation();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [route, setRoute] = useState<AppRoute>(initial.route);
  const [directoryTab, setDirectoryTab] = useState<DirectoryTab>(
    initial.directoryTab
  );
  const [selectedInspectionId, setSelectedInspectionId] = useState<
    string | undefined
  >(undefined);
  const [expandedAssignedSiteId, setExpandedAssignedSiteId] = useState<
    string | null
  >(null);

  const [sites, setSites] = useState<Site[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [serverInspections, setServerInspections] = useState<
    InspectionRecord[]
  >([]);
  const [localInspections, setLocalInspections] = useState<InspectionRecord[]>(
    []
  );

  const networkOnline = useOnlineStatus();
  const prevNetworkOnlineRef = useRef<boolean>(networkOnline);
  const syncingLockRef = useRef<boolean>(false);

  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(!networkOnline);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const navigate = useCallback(
    (nextRoute: AppRoute, nextTab?: DirectoryTab) => {
      setRoute(nextRoute);
      if (nextTab) {
        setDirectoryTab(nextTab);
      }
      const targetUrl =
        nextRoute === "directory"
          ? `/directory${nextTab && nextTab !== "sites" ? `?tab=${nextTab}` : ""}`
          : nextRoute === "assigned-sites"
          ? "/assigned-sites"
          : nextRoute === "map"
          ? "/map"
          : nextRoute === "profile"
          ? "/profile"
          : "/inspector";
      if (window.location.pathname + window.location.search !== targetUrl) {
        window.history.pushState({}, "", targetUrl);
      }
    },
    []
  );

  useEffect(() => {
    function handlePopState() {
      const parsed = parseRouteFromLocation();
      setRoute(parsed.route);
      setDirectoryTab(parsed.directoryTab);
    }
    function handleQuotaExceeded() {
      setGmpQuotaExceeded(true);
    }
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("gmp-quota-exceeded", handleQuotaExceeded);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("gmp-quota-exceeded", handleQuotaExceeded);
    };
  }, []);

  const refreshFromServerAndDb = useCallback(async () => {
    if (!authUser || !authToken) return;
    setLoading(true);
    try {
      const [localFirst, cachedSites] = await Promise.all([
        getAllLocalInspections(),
        getAllLocalSites(),
      ]);
      setLocalInspections(localFirst);
      if (cachedSites.length > 0 && offlineMode) {
        const filteredCached =
          authUser.role === "inspector" && authUser.inspectorId
            ? cachedSites.filter(
                (s) =>
                  s.active &&
                  s.assignedInspectorIds.includes(authUser.inspectorId!)
              )
            : cachedSites;
        setSites(filteredCached);
      }

      if (offlineMode) {
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${authToken}` };
      const [sitesRes, inspRes, inspectionsRes] = await Promise.all([
        fetch("/api/sites", { headers }),
        fetch("/api/inspectors", { headers }),
        fetch("/api/inspections", { headers }),
      ]);

      if (
        sitesRes.status === 401 ||
        inspRes.status === 401 ||
        inspectionsRes.status === 401
      ) {
        setAuthUser(null);
        setAuthToken(null);
        return;
      }

      if (sitesRes.ok) {
        const sData = await sitesRes.json();
        const fetchedSites: Site[] = Array.isArray(sData.sites)
          ? sData.sites
          : [];
        setSites(fetchedSites);
        await cacheSitesToDb(fetchedSites);
      }
      if (inspRes.ok) {
        const iData = await inspRes.json();
        setInspectors(Array.isArray(iData.inspectors) ? iData.inspectors : []);
      }
      if (inspectionsRes.ok) {
        const rData = await inspectionsRes.json();
        const remoteList: InspectionRecord[] = Array.isArray(rData.inspections)
          ? rData.inspections
          : [];
        setServerInspections(remoteList);

        const changed = await pullServerInspectionsToDb(remoteList);
        const updatedLocal = await getAllLocalInspections();
        setLocalInspections(updatedLocal);
        if (changed > 0) {
          setSyncNotice(
            `Pulled ${changed} server inspection${changed === 1 ? "" : "s"} into IndexedDB.`
          );
        }
      }
    } catch {
      const [fallbackLocal, fallbackSites] = await Promise.all([
        getAllLocalInspections(),
        getAllLocalSites(),
      ]);
      setLocalInspections(fallbackLocal);
      if (fallbackSites.length > 0) {
        setSites(
          authUser.role === "inspector" && authUser.inspectorId
            ? fallbackSites.filter(
                (s) =>
                  s.active &&
                  s.assignedInspectorIds.includes(authUser.inspectorId!)
              )
            : fallbackSites
        );
      }
    } finally {
      setLoading(false);
    }
  }, [authUser, authToken, offlineMode]);

  useEffect(() => {
    if (authUser && authToken) {
      refreshFromServerAndDb();
    }
  }, [authUser, authToken, refreshFromServerAndDb]);

  function handleAuthenticated(user: AuthUser, token: string) {
    setAuthUser(user);
    setAuthToken(token);
    setSelectedInspectionId(undefined);
    setSyncNotice(null);
    setOfflineMode(false);
    if (user.role === "supervisor") {
      navigate("directory", "sites");
    } else {
      navigate("execution");
    }
  }

  function handleSignOut() {
    setAuthUser(null);
    setAuthToken(null);
    setSites([]);
    setInspectors([]);
    setServerInspections([]);
    setSelectedInspectionId(undefined);
    setSyncNotice(null);
    setOfflineMode(false);
    setRoute("execution");
    if (window.location.pathname !== "/") {
      window.history.pushState({}, "", "/");
    }
  }

  function handleProfileUpdated(updatedUser: AuthUser, nextToken?: string) {
    setAuthUser(updatedUser);
    if (nextToken) {
      setAuthToken(nextToken);
    }
    if (updatedUser.role === "inspector" && updatedUser.inspectorId) {
      setInspectors((prev) =>
        prev.map((insp) =>
          insp.id === updatedUser.inspectorId
            ? {
                ...insp,
                name: updatedUser.name,
                email: updatedUser.email ?? insp.email,
                phone: updatedUser.phone ?? insp.phone,
                region: updatedUser.department || insp.region,
                certifications:
                  updatedUser.certifications ?? insp.certifications,
                bio: updatedUser.bio ?? insp.bio,
              }
            : insp
        )
      );
    }
  }

  function openInspection(inspectionId: string) {
    setSelectedInspectionId(inspectionId);
    navigate("execution");
  }

  const visibleLocalInspections = useMemo(() => {
    if (!authUser) return [];
    if (authUser.role === "supervisor") return localInspections;
    return localInspections.filter((rec) => belongsToInspector(rec, authUser));
  }, [localInspections, authUser]);

  async function handleToggleOffline() {
    if (!networkOnline && offlineMode) {
      setSyncNotice(
        "Device is currently offline — Nirikshan will auto-switch online and sync once internet returns."
      );
      return;
    }
    const next = !offlineMode;
    setOfflineMode(next);
    setSyncNotice(
      next
        ? "Offline Mode enabled — field edits, per-item GPS, photos, signatures, and PDF export stay active locally."
        : "Online — ready to synchronize pending edits."
    );
  }

  const performSync = useCallback(
    async (options?: {
      autoTriggered?: boolean;
      bypassOfflineCheck?: boolean;
    }) => {
      if (!options?.bypassOfflineCheck && offlineMode) {
        setSyncNotice("Cannot sync while Offline Mode is active.");
        return;
      }
      if (!authUser || !authToken || syncingLockRef.current) return;

      syncingLockRef.current = true;
      setSyncing(true);
      if (!options?.autoTriggered) {
        setSyncNotice(null);
      }

      try {
        const currentLocal = await getAllLocalInspections();
        const pending = currentLocal.filter(
          (r) =>
            r.syncStatus === "pending" &&
            (authUser.role === "supervisor" || belongsToInspector(r, authUser))
        );

        const syncRes = await fetch("/api/inspections/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ inspections: pending }),
        });

        if (syncRes.status === 401) {
          setAuthUser(null);
          setAuthToken(null);
          return;
        }

        if (!syncRes.ok) {
          const errData = await syncRes.json().catch(() => ({}));
          throw new Error(errData.error || `Sync failed (${syncRes.status})`);
        }

        const data = await syncRes.json();
        const syncedList: InspectionRecord[] = Array.isArray(data.synced)
          ? data.synced
          : [];
        const conflicts: Array<{ id: string; serverRecord: InspectionRecord }> =
          Array.isArray(data.conflicts) ? data.conflicts : [];
        const remoteAll: InspectionRecord[] = Array.isArray(
          data.serverInspections
        )
          ? data.serverInspections
          : [];

        if (syncedList.length > 0) {
          await markInspectionsSynced(syncedList);
        }
        if (conflicts.length > 0) {
          await markInspectionsConflict(conflicts);
        }

        const pulled = await pullServerInspectionsToDb(remoteAll);
        setServerInspections(remoteAll);
        setLocalInspections(await getAllLocalInspections());

        const prefix = options?.autoTriggered
          ? "Auto-synced on reconnect"
          : "Sync complete";

        if (conflicts.length > 0) {
          setSyncNotice(
            `${prefix}: synced ${syncedList.length}, pulled ${pulled}, and flagged ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"} for Supervisor review.`
          );
        } else {
          setSyncNotice(
            `${prefix}: pushed ${syncedList.length} pending, pulled ${pulled} server update${pulled === 1 ? "" : "s"}.`
          );
        }
      } catch (err) {
        setSyncNotice(err instanceof Error ? err.message : "Sync failed");
      } finally {
        syncingLockRef.current = false;
        setSyncing(false);
      }
    },
    [authUser, authToken, offlineMode]
  );

  const handleSyncNow = useCallback(async () => {
    await performSync();
  }, [performSync]);

  // Automatic Offline Fallback & Auto-Sync on Reconnect
  useEffect(() => {
    const wasOnline = prevNetworkOnlineRef.current;
    prevNetworkOnlineRef.current = networkOnline;

    if (wasOnline && !networkOnline) {
      setOfflineMode(true);
      setSyncNotice(
        "Internet connection lost — switched to Offline Mode (edits saved to IndexedDB, auto-sync queued)."
      );
    } else if (!wasOnline && networkOnline) {
      setOfflineMode(false);
      if (authUser && authToken) {
        void performSync({ autoTriggered: true, bypassOfflineCheck: true });
      }
    }
  }, [networkOnline, authUser, authToken, performSync]);

  async function persistLocalRecord(updated: InspectionRecord) {
    const saved = await saveLocalInspectionEdit(updated);
    setLocalInspections((prev) =>
      prev.map((rec) => (rec.id === saved.id ? saved : rec))
    );
  }

  async function handleUpdateChecklistItem(
    inspectionId: string,
    itemId: string,
    patch: {
      status?: ChecklistItemStatus;
      note?: string;
      geoLocation?: GeoLocationEntry | null;
    }
  ) {
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target || !authUser) return;
    if (
      authUser.role === "inspector" &&
      !isArrivalGeoVerified(target.arrivalVerification)
    ) {
      setSyncNotice(
        "Complete geotagged photo or video arrival verification before inspecting parameters."
      );
      return;
    }

    const now = new Date().toISOString();
    const updatedItems = target.items.map((item) => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        status: patch.status !== undefined ? patch.status : item.status,
        note: patch.note !== undefined ? patch.note : item.note,
        geoLocation:
          "geoLocation" in patch ? patch.geoLocation : item.geoLocation,
        updatedAt: now,
        updatedBy: authUser.code
          ? `${authUser.name} (${authUser.code})`
          : authUser.name,
      };
    });

    const nextStatus =
      target.syncStatus === "conflict"
        ? "conflict"
        : deriveStatusFromItems(updatedItems);

    await persistLocalRecord({
      ...target,
      items: updatedItems,
      status: nextStatus,
    });
  }

  async function handleCaptureGeoLocation(
    inspectionId: string,
    entry: GeoLocationEntry,
    itemId?: string
  ) {
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target || !authUser) return;
    if (
      itemId &&
      authUser.role === "inspector" &&
      !isArrivalGeoVerified(target.arrivalVerification)
    ) {
      setSyncNotice(
        "Complete geotagged photo or video arrival verification before stamping parameter GPS."
      );
      return;
    }
    const prevTrail = Array.isArray(target.geoTrail) ? target.geoTrail : [];
    const now = new Date().toISOString();

    const updatedItems = itemId
      ? target.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                geoLocation: entry,
                updatedAt: now,
                updatedBy: authUser.code
                  ? `${authUser.name} (${authUser.code})`
                  : authUser.name,
              }
            : item
        )
      : target.items;

    await persistLocalRecord({
      ...target,
      items: updatedItems,
      geoLocation: entry,
      geoTrail: [...prevTrail, entry].slice(-40),
    });
  }

  async function handleSaveArrivalVerification(
    inspectionId: string,
    verification: ArrivalVerification | null
  ) {
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target) return;

    let nextGeoLocation = target.geoLocation ?? null;
    let nextGeoTrail = Array.isArray(target.geoTrail) ? target.geoTrail : [];

    if (
      verification &&
      verification.latitude !== null &&
      verification.longitude !== null
    ) {
      const entry: GeoLocationEntry = {
        id: `geo-arrival-${Date.now()}`,
        latitude: verification.latitude,
        longitude: verification.longitude,
        accuracyMeters: verification.accuracyMeters,
        capturedAt: verification.capturedAt,
        offlineCaptured: verification.offlineCaptured,
        source: "gps",
        label:
          verification.mediaType === "video"
            ? "On-Site Arrival Video"
            : "On-Site Arrival Photo",
      };
      nextGeoLocation = entry;
      nextGeoTrail = [...nextGeoTrail, entry].slice(-40);
    }

    await persistLocalRecord({
      ...target,
      arrivalVerification: verification,
      geoLocation: nextGeoLocation,
      geoTrail: nextGeoTrail,
    });
  }

  async function handleAddPhotos(
    inspectionId: string,
    newPhotos: InspectionPhoto[]
  ) {
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target) return;
    if (
      authUser?.role === "inspector" &&
      !isArrivalGeoVerified(target.arrivalVerification)
    ) {
      setSyncNotice(
        "Complete geotagged photo or video arrival verification before attaching evidence photos."
      );
      return;
    }
    const prevPhotos = Array.isArray(target.photos) ? target.photos : [];
    await persistLocalRecord({
      ...target,
      photos: [...prevPhotos, ...newPhotos].slice(0, 24),
    });
  }

  async function handleUpdatePhoto(
    inspectionId: string,
    photoId: string,
    patch: { caption?: string; itemId?: string }
  ) {
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target) return;
    if (
      authUser?.role === "inspector" &&
      !isArrivalGeoVerified(target.arrivalVerification)
    ) {
      return;
    }
    const prevPhotos = Array.isArray(target.photos) ? target.photos : [];
    await persistLocalRecord({
      ...target,
      photos: prevPhotos.map((p) =>
        p.id === photoId
          ? {
              ...p,
              caption: patch.caption !== undefined ? patch.caption : p.caption,
              itemId: "itemId" in patch ? patch.itemId : p.itemId,
            }
          : p
      ),
    });
  }

  async function handleRemovePhoto(inspectionId: string, photoId: string) {
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target) return;
    if (
      authUser?.role === "inspector" &&
      !isArrivalGeoVerified(target.arrivalVerification)
    ) {
      return;
    }
    const prevPhotos = Array.isArray(target.photos) ? target.photos : [];
    await persistLocalRecord({
      ...target,
      photos: prevPhotos.filter((p) => p.id !== photoId),
    });
  }

  async function handleSaveInspectorSignature(
    inspectionId: string,
    dataUrl: string
  ) {
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target || !authUser) return;
    if (
      authUser.role === "inspector" &&
      !isArrivalGeoVerified(target.arrivalVerification)
    ) {
      setSyncNotice(
        "Complete geotagged photo or video arrival verification before signing this inspection."
      );
      return;
    }
    await persistLocalRecord({
      ...target,
      inspectorSignature: {
        dataUrl,
        signerName: target.inspectorName,
        signerRole: "inspector",
        signedAt: new Date().toISOString(),
        latitude: target.geoLocation?.latitude,
        longitude: target.geoLocation?.longitude,
      },
    });
  }

  async function handleClearInspectorSignature(inspectionId: string) {
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target) return;
    if (
      authUser?.role === "inspector" &&
      !isArrivalGeoVerified(target.arrivalVerification)
    ) {
      return;
    }
    await persistLocalRecord({
      ...target,
      inspectorSignature: null,
    });
  }

  async function handleSupervisorValidate(
    inspectionId: string,
    dataUrl: string
  ) {
    if (!authToken || offlineMode) return;
    const target = localInspections.find((r) => r.id === inspectionId);
    const res = await fetch(`/api/inspections/${inspectionId}/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        dataUrl,
        latitude: target?.geoLocation?.latitude,
        longitude: target?.geoLocation?.longitude,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.inspection) {
        await markInspectionsSynced([data.inspection]);
        setLocalInspections(await getAllLocalInspections());
        setSyncNotice(
          `Supervisor QA validation saved for "${data.inspection.siteName}".`
        );
      }
    }
  }

  async function handleSimulateConflict(inspectionId: string) {
    if (offlineMode || !authToken) return;
    const localTarget = localInspections.find((r) => r.id === inspectionId);
    if (!localTarget) return;

    const now = new Date().toISOString();
    const localItems = localTarget.items.map((item, idx) =>
      idx === 0
        ? {
            ...item,
            status: "pass" as const,
            note: "Field Inspector: Verified safe on-site",
            updatedAt: now,
          }
        : item
    );
    await saveLocalInspectionEdit({
      ...localTarget,
      items: localItems,
      status: deriveStatusFromItems(localItems),
    });

    const res = await fetch(
      `/api/inspections/${inspectionId}/simulate-conflict`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      }
    );
    if (res.ok) {
      await handleSyncNow();
    }
  }

  async function handleResolveConflict(
    inspectionId: string,
    options: ResolveConflictOptions
  ) {
    if (authUser?.role !== "supervisor") {
      setSyncNotice("Only Supervisors have authority to resolve conflicts.");
      return;
    }
    const target = localInspections.find((r) => r.id === inspectionId);
    if (!target || !authToken) return;
    if (offlineMode) {
      setSyncNotice("Go online to publish Supervisor conflict resolution.");
      return;
    }

    setSyncing(true);
    try {
      if (options.strategy === "keep-local") {
        const res = await fetch("/api/inspections/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            inspections: [target],
            forceIds: [target.id],
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Failed to force-push local changes");
        }
        const data = await res.json();
        const synced: InspectionRecord[] = Array.isArray(data.synced)
          ? data.synced
          : [];
        if (synced.length > 0) {
          await markInspectionsSynced(synced);
        }
        if (Array.isArray(data.serverInspections)) {
          setServerInspections(data.serverInspections);
        }
        setLocalInspections(await getAllLocalInspections());
        setSyncNotice(
          `Supervisor resolved conflict for "${target.siteName}" using local sheet.`
        );
        return;
      }

      const res = await fetch(
        `/api/inspections/${inspectionId}/resolve-conflict`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            strategy: options.strategy,
            submissionId: options.submissionId,
            items:
              options.strategy === "custom-merge" ? target.items : undefined,
            notes:
              options.strategy === "custom-merge" ? target.notes : undefined,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Supervisor conflict resolution failed");
      }
      const data = await res.json();
      if (data.inspection) {
        await markInspectionsSynced([data.inspection]);
        setLocalInspections(await getAllLocalInspections());
        setServerInspections((prev) =>
          prev.map((r) => (r.id === data.inspection.id ? data.inspection : r))
        );
        const strategyLabel =
          options.strategy === "apply-submission"
            ? "selected conflicting request"
            : options.strategy === "accept-server"
            ? "current server record"
            : "Supervisor custom merge";
        setSyncNotice(
          `Supervisor resolved conflict for "${data.inspection.siteName}" (${strategyLabel}).`
        );
      }
    } catch (err) {
      setSyncNotice(
        err instanceof Error ? err.message : "Conflict resolution failed"
      );
    } finally {
      setSyncing(false);
    }
  }

  const offlineIndicator = !networkOnline ? (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-md print:hidden"
    >
      <CloudOff className="h-3.5 w-3.5 text-amber-700 shrink-0" />
      <span>Offline — edits saved to IndexedDB, auto-sync queued</span>
    </div>
  ) : null;

  // Signed-Out Public Product Page
  if (!authUser || !authToken) {
    return (
      <>
        <ProductLandingPage onAuthenticated={handleAuthenticated} />
        {offlineIndicator}
      </>
    );
  }

  const isSupervisor = authUser.role === "supervisor";
  const effectiveRoute: AppRoute =
    !isSupervisor && route === "directory" ? "execution" : route;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {gmpQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 border-b border-amber-300 bg-amber-50 px-6 py-2.5 text-xs text-amber-950 print:hidden"
        >
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
            <span>
              Notice: Maps quota reached or billing disabled. Interactive map
              tiles may be limited — switch to Offline Schematic mode or check
              your Google Maps API key.{" "}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noreferrer"
                className="font-semibold underline hover:text-amber-900"
              >
                Learn more
              </a>
            </span>
            <button
              type="button"
              onClick={() => setGmpQuotaExceeded(false)}
              className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Strict 3-Zone Top Bar Contract */}
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href={isSupervisor ? "/directory" : "/inspector"}
            onClick={(e) => {
              e.preventDefault();
              navigate(isSupervisor ? "directory" : "execution", "sites");
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Nirikshan
          </a>

          {/* Zone 2: Clean single-line role-appropriate nav links (<= 5) */}
          <nav
            aria-label="Primary navigation"
            className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto"
          >
            {isSupervisor ? (
              <>
                <a
                  href="/directory"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("directory", "sites");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "directory" && directoryTab === "sites"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  Sites
                </a>
                <a
                  href="/directory?tab=inspectors"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("directory", "inspectors");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "directory" &&
                    directoryTab === "inspectors"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  Inspectors
                </a>
                <a
                  href="/map"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("map");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "map"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  Site Map
                </a>
                <a
                  href="/inspector"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("execution");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "execution"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  Field Reports
                </a>
                <a
                  href="/profile"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("profile");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "profile"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  Profile
                </a>
              </>
            ) : (
              <>
                <a
                  href="/inspector"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("execution");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "execution"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  My Inspections
                </a>
                <a
                  href="/assigned-sites"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("assigned-sites");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "assigned-sites"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  Assigned Sites
                </a>
                <a
                  href="/map"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("map");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "map"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  Site Map
                </a>
                <a
                  href="/profile"
                  onClick={(e) => {
                    e.preventDefault();
                    navigate("profile");
                  }}
                  className={`py-1 whitespace-nowrap shrink-0 transition-colors ${
                    effectiveRoute === "profile"
                      ? "text-slate-900 underline decoration-2 underline-offset-8"
                      : "hover:text-slate-900"
                  }`}
                >
                  Profile
                </a>
              </>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-[38px] rounded-md border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-6 print:max-w-none print:px-0 print:py-0">
        {effectiveRoute === "execution" ? (
          <FieldExecutionView
            currentUser={authUser}
            inspections={visibleLocalInspections}
            sites={sites}
            initialSelectedId={selectedInspectionId}
            loading={loading}
            offlineMode={offlineMode}
            syncing={syncing}
            syncNotice={syncNotice}
            onToggleOffline={handleToggleOffline}
            onSyncNow={handleSyncNow}
            onUpdateChecklistItem={handleUpdateChecklistItem}
            onCaptureGeoLocation={handleCaptureGeoLocation}
            onAddPhotos={handleAddPhotos}
            onUpdatePhoto={handleUpdatePhoto}
            onRemovePhoto={handleRemovePhoto}
            onSaveInspectorSignature={handleSaveInspectorSignature}
            onClearInspectorSignature={handleClearInspectorSignature}
            onSupervisorValidate={handleSupervisorValidate}
            onSimulateConflict={handleSimulateConflict}
            onResolveConflict={handleResolveConflict}
            onSaveArrivalVerification={handleSaveArrivalVerification}
            onGoToCreateInspection={
              isSupervisor ? () => navigate("directory", "new") : undefined
            }
          />
        ) : effectiveRoute === "map" ? (
          <SiteMapView
            currentUser={authUser}
            sites={sites}
            inspections={visibleLocalInspections}
            authToken={authToken}
            offlineMode={offlineMode}
            onSiteUpdated={refreshFromServerAndDb}
            onOpenInspection={openInspection}
          />
        ) : effectiveRoute === "profile" ? (
          <ProfileView
            currentUser={authUser}
            authToken={authToken}
            sites={sites}
            inspectors={inspectors}
            inspections={visibleLocalInspections}
            offlineMode={offlineMode}
            onProfileUpdated={handleProfileUpdated}
            onOpenInspection={openInspection}
          />
        ) : effectiveRoute === "assigned-sites" ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  My Assigned Sites
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Locked facility assignments and supervisor site overviews for{" "}
                  {authUser.name} ({authUser.code})
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("map")}
                className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                View on Site Map
              </button>
            </div>
            {sites.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">
                No active sites are currently assigned to your inspector profile.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sites.map((site) => {
                  const linkedInspection = visibleLocalInspections.find(
                    (rec) =>
                      rec.siteId === site.id || rec.siteName === site.name
                  );
                  const isExpanded = expandedAssignedSiteId === site.id;
                  const doneCount = linkedInspection
                    ? linkedInspection.items.filter(
                        (it) => it.status !== "pending"
                      ).length
                    : 0;
                  const arrivalOk = linkedInspection
                    ? isArrivalGeoVerified(linkedInspection.arrivalVerification)
                    : false;

                  return (
                    <div
                      key={site.id}
                      className="flex flex-col justify-between rounded-lg border border-slate-200 bg-white p-5 space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span>{site.type}</span>
                          <span className="font-mono">{site.code}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedAssignedSiteId(
                              isExpanded ? null : site.id
                            )
                          }
                          aria-expanded={isExpanded}
                          className="group flex w-full items-center justify-between gap-2 text-left"
                        >
                          <h2 className="text-base font-semibold text-slate-900 group-hover:underline underline-offset-2">
                            {site.name}
                          </h2>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400 group-hover:text-slate-700 shrink-0" />
                          )}
                        </button>
                        <p className="text-xs text-slate-600">
                          {site.location} · {site.city}, {site.country}
                        </p>
                        {typeof site.latitude === "number" &&
                          typeof site.longitude === "number" && (
                            <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                              Locked Coords: {site.latitude.toFixed(5)},{" "}
                              {site.longitude.toFixed(5)}
                            </p>
                          )}
                        {site.overview && (
                          <p
                            className={`border-t border-slate-100 pt-2 text-xs text-slate-700 leading-relaxed ${
                              isExpanded ? "" : "line-clamp-2"
                            }`}
                          >
                            {site.overview}
                          </p>
                        )}

                        {isExpanded && (
                          <div className="mt-2 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                            <div className="font-semibold text-slate-800">
                              Site &amp; Assignment Details
                            </div>
                            <div className="text-slate-600">
                              Status:{" "}
                              <span className="font-medium text-slate-900">
                                {site.active ? "Active Facility" : "Archived"}
                              </span>
                            </div>
                            {linkedInspection ? (
                              <div className="space-y-1 border-t border-slate-200 pt-2 text-[11px] text-slate-600">
                                <div className="font-mono text-slate-800">
                                  Inspection: {linkedInspection.id} · Due{" "}
                                  {linkedInspection.dueDate}
                                </div>
                                <div className="tabular-nums">
                                  Progress: {doneCount}/
                                  {linkedInspection.items.length} checks ·{" "}
                                  <span className="capitalize">
                                    {linkedInspection.status}
                                  </span>
                                </div>
                                <div>
                                  Arrival Gate:{" "}
                                  <span
                                    className={
                                      arrivalOk
                                        ? "font-semibold text-emerald-700"
                                        : "font-semibold text-amber-700"
                                    }
                                  >
                                    {arrivalOk
                                      ? "Verified On-Site (GeoTagged)"
                                      : "Geotagged Photo / Video Required"}
                                  </span>
                                </div>
                                {linkedInspection.inspectionMode ===
                                  "multi-stage" &&
                                  (linkedInspection.stages?.length ?? 0) >
                                    0 && (
                                    <div className="pt-1">
                                      Stages:{" "}
                                      {linkedInspection.stages!
                                        .map((st) => st.name)
                                        .join(" → ")}
                                    </div>
                                  )}
                              </div>
                            ) : (
                              <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500">
                                No inspection sheet dispatched yet for this
                                site.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {linkedInspection && (
                        <button
                          type="button"
                          onClick={() => openInspection(linkedInspection.id)}
                          className="w-full rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Open Assigned Inspection
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <DirectoryView
            activeTab={directoryTab}
            onTabChange={(tab) => navigate("directory", tab)}
            sites={sites}
            inspectors={inspectors}
            serverInspections={serverInspections}
            authToken={authToken}
            loading={loading}
            offlineMode={offlineMode}
            onRefreshAll={refreshFromServerAndDb}
            onNavigateToExecution={() => navigate("execution")}
            onNavigateToMap={() => navigate("map")}
          />
        )}
      </main>
      {offlineIndicator}
    </div>
  );
}
