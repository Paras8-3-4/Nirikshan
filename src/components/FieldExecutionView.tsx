import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudOff,
  Compass,
  Film,
  GitCompare,
  Layers,
  Lock,
  MapPin,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Square,
  Trash2,
  UserCheck,
  Video,
  Wifi,
  X,
} from "lucide-react";
import {
  isArrivalGeoVerified,
  type ArrivalVerification,
  type AuthUser,
  type ChecklistItem,
  type ChecklistItemStatus,
  type GeoLocationEntry,
  type InspectionPhoto,
  type InspectionRecord,
  type Site,
} from "../lib/types.ts";
import PWAInstallButton from "./PWAInstallButton.tsx";
import SignaturePad from "./SignaturePad.tsx";

export interface ResolveConflictOptions {
  strategy: "accept-server" | "apply-submission" | "keep-local" | "custom-merge";
  submissionId?: string;
}

interface FieldExecutionViewProps {
  currentUser: AuthUser;
  inspections: InspectionRecord[];
  sites: Site[];
  initialSelectedId?: string;
  loading: boolean;
  offlineMode: boolean;
  syncing: boolean;
  syncNotice: string | null;
  onToggleOffline: () => void;
  onSyncNow: () => Promise<void>;
  onUpdateChecklistItem: (
    inspectionId: string,
    itemId: string,
    patch: {
      status?: ChecklistItemStatus;
      note?: string;
      geoLocation?: GeoLocationEntry | null;
    }
  ) => Promise<void>;
  onCaptureGeoLocation: (
    inspectionId: string,
    entry: GeoLocationEntry,
    itemId?: string
  ) => Promise<void>;
  onAddPhotos: (
    inspectionId: string,
    photos: InspectionPhoto[]
  ) => Promise<void>;
  onUpdatePhoto: (
    inspectionId: string,
    photoId: string,
    patch: { caption?: string; itemId?: string }
  ) => Promise<void>;
  onRemovePhoto: (inspectionId: string, photoId: string) => Promise<void>;
  onSaveInspectorSignature: (
    inspectionId: string,
    dataUrl: string
  ) => Promise<void>;
  onClearInspectorSignature: (inspectionId: string) => Promise<void>;
  onSupervisorValidate: (
    inspectionId: string,
    dataUrl: string
  ) => Promise<void>;
  onSimulateConflict: (inspectionId: string) => Promise<void>;
  onResolveConflict: (
    inspectionId: string,
    options: ResolveConflictOptions
  ) => Promise<void>;
  onSaveArrivalVerification: (
    inspectionId: string,
    verification: ArrivalVerification | null
  ) => Promise<void>;
  onGoToCreateInspection?: () => void;
}

type QueueFilter = "all" | "active" | "completed" | "unsynced" | "conflicts";

function formatShortTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSyncLabel(record: InspectionRecord): {
  text: string;
  colorClass: string;
  icon: React.ReactNode;
} {
  if (record.syncStatus === "conflict" || record.status === "conflict") {
    return {
      text: "Conflict",
      colorClass: "text-red-700",
      icon: <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />,
    };
  }
  if (record.syncStatus === "pending") {
    return {
      text: "Pending Sync",
      colorClass: "text-amber-700",
      icon: <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0" />,
    };
  }
  if (record.status === "completed") {
    return {
      text: "Completed · Synced",
      colorClass: "text-emerald-700",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />,
    };
  }
  return {
    text: "Synced",
    colorClass: "text-slate-600",
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />,
  };
}

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image format"));
      img.onload = () => {
        const maxDim = 1024;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function isVideoMedia(
  dataUrl?: string | null,
  mediaType?: "image" | "video"
): boolean {
  return mediaType === "video" || Boolean(dataUrl?.startsWith("data:video/"));
}

async function readArrivalVideoFile(file: File): Promise<string> {
  if (file.size > 3_500_000) {
    throw new Error(
      "Video clip must be 3.5 MB or smaller. Record a shorter clip (up to 10s) or compress before uploading."
    );
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read video file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      if (!result.startsWith("data:video/")) {
        reject(new Error("Unsupported video format."));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

function calcDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function formatDistanceLabel(meters: number | null): string | null {
  if (meters === null || !Number.isFinite(meters)) return null;
  if (meters < 1000) return `${meters} m from locked site`;
  return `${(meters / 1000).toFixed(2)} km from locked site`;
}

export default function FieldExecutionView({
  currentUser,
  inspections,
  sites,
  initialSelectedId,
  loading,
  offlineMode,
  syncing,
  syncNotice,
  onToggleOffline,
  onSyncNow,
  onUpdateChecklistItem,
  onCaptureGeoLocation,
  onAddPhotos,
  onUpdatePhoto,
  onRemovePhoto,
  onSaveInspectorSignature,
  onClearInspectorSignature,
  onSupervisorValidate,
  onSimulateConflict,
  onResolveConflict,
  onSaveArrivalVerification,
  onGoToCreateInspection,
}: FieldExecutionViewProps) {
  const [selectedId, setSelectedId] = useState<string>(initialSelectedId ?? "");
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState<string>("");
  const [activeStageFilter, setActiveStageFilter] = useState<string>("all");
  const [previewSourceId, setPreviewSourceId] = useState<string>("local");

  useEffect(() => {
    if (initialSelectedId) {
      setSelectedId(initialSelectedId);
    }
  }, [initialSelectedId]);

  // GeoLocation UI State
  const [capturingGeo, setCapturingGeo] = useState(false);
  const [capturingItemGeoId, setCapturingItemGeoId] = useState<string | null>(
    null
  );
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [itemGeoMessages, setItemGeoMessages] = useState<
    Record<string, string>
  >({});
  const [manualGeoOpen, setManualGeoOpen] = useState(false);
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [showGeoTrail, setShowGeoTrail] = useState(false);

  // Photo Evidence UI State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [addingPhotos, setAddingPhotos] = useState(false);
  const [addingItemPhotoId, setAddingItemPhotoId] = useState<string | null>(
    null
  );
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<InspectionPhoto | null>(
    null
  );

  // On-Site Arrival Photo / Video Verification UI State
  const [arrivalBusy, setArrivalBusy] = useState(false);
  const [arrivalNotice, setArrivalNotice] = useState<string | null>(null);
  const [arrivalNoteInput, setArrivalNoteInput] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [arrivalCaptureMode, setArrivalCaptureMode] = useState<"photo" | "video">(
    "photo"
  );
  const [cameraFacing, setCameraFacing] = useState<"user" | "environment">(
    "user"
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [siteDetailsExpanded, setSiteDetailsExpanded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const arrivalFileInputRef = useRef<HTMLInputElement | null>(null);

  const isSupervisor = currentUser.role === "supervisor";

  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let unsynced = 0;
    let conflicts = 0;
    for (const rec of inspections) {
      if (rec.status === "completed") completed++;
      else active++;
      if (rec.syncStatus === "pending") unsynced++;
      if (rec.syncStatus === "conflict" || rec.status === "conflict") conflicts++;
    }
    return {
      all: inspections.length,
      active,
      completed,
      unsynced,
      conflicts,
    };
  }, [inspections]);

  const filteredInspections = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inspections.filter((rec) => {
      if (filter === "active" && rec.status === "completed") return false;
      if (filter === "completed" && rec.status !== "completed") return false;
      if (filter === "unsynced" && rec.syncStatus !== "pending") return false;
      if (
        filter === "conflicts" &&
        rec.syncStatus !== "conflict" &&
        rec.status !== "conflict"
      ) {
        return false;
      }
      if (!q) return true;
      return (
        rec.siteName.toLowerCase().includes(q) ||
        rec.inspectorName.toLowerCase().includes(q) ||
        (rec.location ?? "").toLowerCase().includes(q)
      );
    });
  }, [inspections, filter, search]);

  const selectedInspection = useMemo(() => {
    if (selectedId) {
      const exact =
        filteredInspections.find((r) => r.id === selectedId) ??
        inspections.find((r) => r.id === selectedId);
      if (exact) return exact;
    }
    return filteredInspections[0] ?? inspections[0] ?? null;
  }, [selectedId, filteredInspections, inspections]);

  const selectedInspectionKey = selectedInspection?.id ?? "";
  const firstConflictSubmissionId =
    selectedInspection?.conflictQueue?.[0]?.id ?? "";

  useEffect(() => {
    setActiveStageFilter("all");
    setPreviewSourceId(firstConflictSubmissionId || "local");
    setSiteDetailsExpanded(false);
  }, [selectedInspectionKey, firstConflictSubmissionId]);

  const linkedSite = useMemo(() => {
    if (!selectedInspection) return null;
    return (
      sites.find((s) => s.id === selectedInspection.siteId) ??
      sites.find(
        (s) =>
          s.name.toLowerCase() === selectedInspection.siteName.toLowerCase()
      ) ??
      null
    );
  }, [selectedInspection, sites]);

  const effectiveSiteOverview =
    linkedSite?.overview || selectedInspection?.siteOverview || "";
  const effectiveSiteLat =
    linkedSite?.latitude ?? selectedInspection?.siteLatitude;
  const effectiveSiteLng =
    linkedSite?.longitude ?? selectedInspection?.siteLongitude;

  const arrivalGeoVerified = isArrivalGeoVerified(
    selectedInspection?.arrivalVerification
  );
  const inspectionLockedForInspector = !isSupervisor && !arrivalGeoVerified;

  const checkedCount = selectedInspection
    ? selectedInspection.items.filter((i) => i.status !== "pending").length
    : 0;
  const totalCount = selectedInspection ? selectedInspection.items.length : 0;
  const progressPct =
    totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const passCount = selectedInspection
    ? selectedInspection.items.filter((i) => i.status === "pass").length
    : 0;
  const failCount = selectedInspection
    ? selectedInspection.items.filter((i) => i.status === "fail").length
    : 0;
  const pendingItemCount = selectedInspection
    ? selectedInspection.items.filter((i) => i.status === "pending").length
    : 0;

  function handlePrintReport() {
    if (!selectedInspection) return;
    window.print();
  }

  function requestHardwareGps(label: string): Promise<GeoLocationEntry> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        reject(new Error("Browser Geolocation API unavailable."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            id: `geo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            latitude: Number(pos.coords.latitude.toFixed(6)),
            longitude: Number(pos.coords.longitude.toFixed(6)),
            accuracyMeters: Number.isFinite(pos.coords.accuracy)
              ? Math.round(pos.coords.accuracy)
              : null,
            capturedAt: new Date().toISOString(),
            offlineCaptured: offlineMode,
            source: "gps",
            label,
          });
        },
        (err) => {
          reject(new Error(err.message || "GPS sensor denied or timed out."));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
      );
    });
  }

  async function handleRequestGeoCapture() {
    if (!selectedInspection) return;
    setGeoMessage(null);
    setCapturingGeo(true);
    try {
      const entry = await requestHardwareGps(
        offlineMode ? "Offline GPS Check-In" : "Device GPS Check-In"
      );
      await onCaptureGeoLocation(selectedInspection.id, entry);
      setGeoMessage(
        `Captured ${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}${
          entry.accuracyMeters ? ` (±${entry.accuracyMeters}m)` : ""
        } ${offlineMode ? "offline" : "online"}.`
      );
      setManualGeoOpen(false);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "GPS sensor unavailable.";
      if (isSupervisor) {
        setGeoMessage(
          `GPS sensor unavailable (${msg}). Supervisor may enter verified coordinates below.`
        );
        setManualGeoOpen(true);
      } else {
        setGeoMessage(
          `Device GPS unavailable (${msg}). Enable browser/device location access—inspectors cannot manually override site coordinates.`
        );
      }
    } finally {
      setCapturingGeo(false);
    }
  }

  async function handleStampParameterGeo(
    itemId: string,
    itemLabel: string,
    silentIfUnavailable = false
  ): Promise<GeoLocationEntry | null> {
    if (!selectedInspection || inspectionLockedForInspector) return null;
    setCapturingItemGeoId(itemId);
    try {
      const entry = await requestHardwareGps(`Param: ${itemLabel}`);
      await onCaptureGeoLocation(selectedInspection.id, entry, itemId);
      setItemGeoMessages((prev) => ({
        ...prev,
        [itemId]: `Stamped ${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}`,
      }));
      return entry;
    } catch (err) {
      const fallbackExisting = selectedInspection.geoLocation;
      if (silentIfUnavailable && fallbackExisting) {
        // Carry forward last verified hardware GPS fix in this session if already captured
        const carried: GeoLocationEntry = {
          ...fallbackExisting,
          id: `geo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          capturedAt: new Date().toISOString(),
          offlineCaptured: offlineMode,
          label: `Param: ${itemLabel}`,
        };
        await onCaptureGeoLocation(selectedInspection.id, carried, itemId);
        return carried;
      }
      if (!silentIfUnavailable) {
        setItemGeoMessages((prev) => ({
          ...prev,
          [itemId]: `GPS unavailable (${
            err instanceof Error ? err.message : "sensor blocked"
          }).`,
        }));
      }
      return null;
    } finally {
      setCapturingItemGeoId(null);
    }
  }

  async function handleParameterStatusChange(
    itemId: string,
    itemLabel: string,
    nextStatus: ChecklistItemStatus
  ) {
    if (!selectedInspection || inspectionLockedForInspector) return;
    await onUpdateChecklistItem(selectedInspection.id, itemId, {
      status: nextStatus,
    });
    if (nextStatus !== "pending") {
      // Automatically record per-parameter GeoLocation telemetry
      await handleStampParameterGeo(itemId, itemLabel, true);
    }
  }

  async function handleSaveManualGeo(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInspection || !isSupervisor) return;
    const lat = Number.parseFloat(manualLat);
    const lng = Number.parseFloat(manualLng);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      setGeoMessage(
        "Enter valid coordinates (Latitude -90..90, Longitude -180..180)."
      );
      return;
    }

    const entry: GeoLocationEntry = {
      id: `geo-${Date.now()}`,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      accuracyMeters: null,
      capturedAt: new Date().toISOString(),
      offlineCaptured: offlineMode,
      source: "manual-offline",
      label: manualLabel.trim() || "Supervisor Coordinate Override",
    };

    await onCaptureGeoLocation(selectedInspection.id, entry);
    setManualGeoOpen(false);
    setManualLat("");
    setManualLng("");
    setManualLabel("");
    setGeoMessage(
      `Saved supervisor override coordinates ${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}.`
    );
  }

  async function handlePhotoFilesSelected(
    e: React.ChangeEvent<HTMLInputElement>,
    linkedItemId?: string,
    linkedItemLabel?: string
  ) {
    const files = e.target.files;
    if (
      !files ||
      files.length === 0 ||
      !selectedInspection ||
      inspectionLockedForInspector
    ) {
      e.target.value = "";
      return;
    }

    if (linkedItemId) setAddingItemPhotoId(linkedItemId);
    else setAddingPhotos(true);
    setPhotoError(null);

    try {
      const existingCount = selectedInspection.photos?.length ?? 0;
      if (existingCount + files.length > 24) {
        throw new Error("Maximum 24 evidence photos per inspection.");
      }

      let geoForPhoto: GeoLocationEntry | null = null;
      if (linkedItemId && linkedItemLabel) {
        const targetItem = selectedInspection.items.find(
          (it) => it.id === linkedItemId
        );
        geoForPhoto =
          targetItem?.geoLocation ??
          (await handleStampParameterGeo(linkedItemId, linkedItemLabel, true));
      } else {
        geoForPhoto = selectedInspection.geoLocation ?? null;
      }

      const nextPhotos: InspectionPhoto[] = [];
      for (const file of Array.from(files)) {
        const dataUrl = await compressImageFile(file);
        nextPhotos.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          dataUrl,
          caption: linkedItemLabel
            ? `${linkedItemLabel} — ${file.name.replace(/\.[^/.]+$/, "").slice(0, 50)}`
            : file.name.replace(/\.[^/.]+$/, "").slice(0, 80),
          itemId: linkedItemId,
          capturedAt: new Date().toISOString(),
          offlineCaptured: offlineMode,
          geoTag: geoForPhoto
            ? {
                latitude: geoForPhoto.latitude,
                longitude: geoForPhoto.longitude,
              }
            : undefined,
        });
      }

      await onAddPhotos(selectedInspection.id, nextPhotos);
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Could not attach photo."
      );
    } finally {
      setAddingPhotos(false);
      setAddingItemPhotoId(null);
      e.target.value = "";
    }
  }

  function clearRecordingTimer() {
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }

  function stopCameraStream() {
    clearRecordingTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      try {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.stop();
      } catch {
        // Ignore recorder teardown errors
      }
    }
    mediaRecorderRef.current = null;
    recordedChunksRef.current = [];
    setRecordingVideo(false);
    setRecordingSeconds(0);

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }

  useEffect(() => {
    if (!cameraOpen) {
      stopCameraStream();
      return;
    }
    let cancelled = false;
    setCameraError(null);
    setCameraReady(false);

    async function startStream() {
      if (
        typeof navigator === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        setCameraError(
          "Live camera API unavailable in this browser. Use Upload / Device Camera instead."
        );
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
          audio: false,
        });
        if (cancelled) {
          for (const t of stream.getTracks()) t.stop();
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setCameraReady(true);
        }
      } catch (err) {
        setCameraError(
          err instanceof Error
            ? `Camera permission denied or unavailable (${err.message}). Use Upload / Device Camera instead.`
            : "Camera unavailable. Use Upload / Device Camera instead."
        );
      }
    }

    startStream();
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [cameraOpen, cameraFacing]);

  async function finalizeArrivalVerification(
    photoDataUrl: string,
    noteText?: string,
    explicitMediaType?: "image" | "video"
  ) {
    if (!selectedInspection) return;
    setArrivalBusy(true);
    setArrivalNotice(null);

    try {
      const mediaType: "image" | "video" =
        explicitMediaType ??
        (photoDataUrl.startsWith("data:video/") ? "video" : "image");
      let geo: GeoLocationEntry | null = null;
      let gpsErrMsg: string | null = null;

      try {
        geo = await requestHardwareGps(
          mediaType === "video"
            ? "On-Site Arrival Video Verification"
            : "On-Site Arrival Photo Verification"
        );
      } catch (err) {
        gpsErrMsg =
          err instanceof Error
            ? err.message
            : "Location permission denied or unavailable.";
      }

      const distanceFromSiteMeters =
        geo &&
        typeof effectiveSiteLat === "number" &&
        typeof effectiveSiteLng === "number"
          ? calcDistanceMeters(
              geo.latitude,
              geo.longitude,
              effectiveSiteLat,
              effectiveSiteLng
            )
          : null;

      const actorLabel = currentUser.code
        ? `${currentUser.name} (${currentUser.code})`
        : currentUser.name;

      const verification: ArrivalVerification = {
        mediaType,
        photoDataUrl,
        capturedAt: geo?.capturedAt ?? new Date().toISOString(),
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        accuracyMeters: geo?.accuracyMeters ?? null,
        distanceFromSiteMeters,
        offlineCaptured: offlineMode,
        verifiedByName: actorLabel,
        note: noteText?.trim() || undefined,
      };

      await onSaveArrivalVerification(selectedInspection.id, verification);
      if (geo) {
        setArrivalNotice(
          `On-site ${mediaType} & GPS geotag stamped (${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)})${
            distanceFromSiteMeters !== null
              ? ` · ${formatDistanceLabel(distanceFromSiteMeters)}`
              : ""
          }. Checklist inspection is now unlocked.`
        );
      } else {
        setArrivalNotice(
          `On-site ${mediaType} & timestamp saved, but hardware GPS failed (${gpsErrMsg}). Inspection remains locked until you enable location access and click "Retry GeoTag".`
        );
      }
      setArrivalNoteInput("");
      setCameraOpen(false);
    } finally {
      setArrivalBusy(false);
    }
  }

  async function handleCaptureLiveSelfie() {
    if (!videoRef.current || !cameraReady) return;
    const video = videoRef.current;
    const srcW = video.videoWidth || 640;
    const srcH = video.videoHeight || 480;
    const maxDim = 960;
    let w = srcW;
    let h = srcH;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    await finalizeArrivalVerification(dataUrl, arrivalNoteInput, "image");
  }

  function startVideoRecording() {
    if (!streamRef.current || !cameraReady || recordingVideo) return;
    if (typeof MediaRecorder === "undefined") {
      setCameraError(
        "Live video recording is unavailable in this browser. Switch to Photo Capture or Upload a video clip."
      );
      return;
    }

    const candidates = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType = candidates.find((type) =>
      MediaRecorder.isTypeSupported(type)
    );

    try {
      recordedChunksRef.current = [];
      const recorder = mimeType
        ? new MediaRecorder(streamRef.current, {
            mimeType,
            videoBitsPerSecond: 650_000,
          })
        : new MediaRecorder(streamRef.current);

      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) {
          recordedChunksRef.current.push(evt.data);
        }
      };

      recorder.onstop = async () => {
        clearRecordingTimer();
        setRecordingVideo(false);
        setRecordingSeconds(0);
        const chunks = recordedChunksRef.current;
        recordedChunksRef.current = [];
        if (chunks.length === 0) return;

        const blob = new Blob(chunks, {
          type: recorder.mimeType || "video/webm",
        });
        if (blob.size > 3_500_000) {
          setCameraError(
            "Recorded video exceeded 3.5 MB. Record a shorter clip (3–6 seconds)."
          );
          return;
        }
        setArrivalBusy(true);
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () =>
              reject(new Error("Failed to encode recorded video."));
            reader.onload = () => resolve(String(reader.result || ""));
            reader.readAsDataURL(blob);
          });
          await finalizeArrivalVerification(dataUrl, arrivalNoteInput, "video");
        } catch (err) {
          setCameraError(
            err instanceof Error ? err.message : "Could not save recorded video."
          );
          setArrivalBusy(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecordingVideo(true);
      setRecordingSeconds(0);
      setCameraError(null);

      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          if (next >= 10 && mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setCameraError(
        err instanceof Error ? err.message : "Unable to start video recording."
      );
    }
  }

  function stopVideoRecording() {
    clearRecordingTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }

  async function handleArrivalFileSelected(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArrivalBusy(true);
    setArrivalNotice(null);
    try {
      if (file.type.startsWith("video/")) {
        const dataUrl = await readArrivalVideoFile(file);
        await finalizeArrivalVerification(dataUrl, arrivalNoteInput, "video");
      } else {
        const dataUrl = await compressImageFile(file);
        await finalizeArrivalVerification(dataUrl, arrivalNoteInput, "image");
      }
    } catch (err) {
      setArrivalNotice(
        err instanceof Error
          ? err.message
          : "Could not process arrival photo or video."
      );
      setArrivalBusy(false);
    } finally {
      e.target.value = "";
    }
  }

  async function handleRetryArrivalGeoTag() {
    if (!selectedInspection?.arrivalVerification) return;
    setArrivalBusy(true);
    setArrivalNotice(null);
    try {
      const geo = await requestHardwareGps(
        "On-Site Arrival Selfie GeoTag Refresh"
      );
      const distanceFromSiteMeters =
        typeof effectiveSiteLat === "number" &&
        typeof effectiveSiteLng === "number"
          ? calcDistanceMeters(
              geo.latitude,
              geo.longitude,
              effectiveSiteLat,
              effectiveSiteLng
            )
          : null;

      await onSaveArrivalVerification(selectedInspection.id, {
        ...selectedInspection.arrivalVerification,
        latitude: geo.latitude,
        longitude: geo.longitude,
        accuracyMeters: geo.accuracyMeters,
        distanceFromSiteMeters,
        offlineCaptured: offlineMode,
      });
      setArrivalNotice(
        `Updated arrival geotag: ${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}${
          distanceFromSiteMeters !== null
            ? ` · ${formatDistanceLabel(distanceFromSiteMeters)}`
            : ""
        }.`
      );
    } catch (err) {
      setArrivalNotice(
        `Hardware GPS unavailable (${
          err instanceof Error ? err.message : "permission denied"
        }).`
      );
    } finally {
      setArrivalBusy(false);
    }
  }

  const photos = selectedInspection?.photos ?? [];
  const generalPhotos = photos.filter((p) => !p.itemId);
  const geoTrail = selectedInspection?.geoTrail ?? [];

  return (
    <div className="space-y-5">
      {/* Workspace Operations Toolbar */}
      <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-xs font-medium text-slate-600 pr-2 border-r border-slate-200">
            <span className="font-semibold text-slate-900">
              {currentUser.name}
            </span>{" "}
            <span aria-hidden="true">·</span>{" "}
            <span className="capitalize">{currentUser.role}</span>
            {currentUser.code && (
              <>
                {" "}
                <span aria-hidden="true">·</span>{" "}
                <span className="font-mono">{currentUser.code}</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleOffline}
            aria-pressed={offlineMode}
            className={`min-h-[40px] inline-flex items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              offlineMode
                ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
            }`}
          >
            {offlineMode ? (
              <CloudOff className="h-4 w-4 text-amber-700" />
            ) : (
              <Wifi className="h-4 w-4 text-emerald-700" />
            )}
            <span>
              {offlineMode ? "Offline Mode: Active" : "Connection: Online"}
            </span>
          </button>

          <button
            type="button"
            onClick={onSyncNow}
            disabled={offlineMode || syncing}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            <span className="tabular-nums">
              {syncing
                ? "Syncing..."
                : `Sync with Server (${counts.unsynced} pending)`}
            </span>
          </button>

          <PWAInstallButton compact />

          {syncNotice && (
            <span className="text-xs font-medium text-slate-600">
              {syncNotice}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 tabular-nums">
          <span>
            {isSupervisor ? "All Reports:" : "Assigned:"}{" "}
            <strong className="text-slate-900">{counts.all}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            Unsynced:{" "}
            <strong
              className={
                counts.unsynced > 0 ? "text-amber-700" : "text-slate-900"
              }
            >
              {counts.unsynced}
            </strong>
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span>
            Conflicts:{" "}
            <strong
              className={
                counts.conflicts > 0 ? "text-red-700" : "text-slate-900"
              }
            >
              {counts.conflicts}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Split Execution Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start print:hidden">
        {/* Left Queue Pane */}
        <aside className="lg:col-span-4 rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                {isSupervisor ? "All Field Inspections" : "My Assigned Queue"}
              </h2>
              <span className="text-xs font-mono text-slate-500 tabular-nums">
                IndexedDB
              </span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by site or inspector..."
                className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-blue-700"
              />
            </div>

            <div className="flex flex-wrap gap-1 rounded-md bg-slate-100 p-1">
              {(
                [
                  { id: "all", label: `All (${counts.all})` },
                  { id: "active", label: `Active (${counts.active})` },
                  { id: "unsynced", label: `Unsynced (${counts.unsynced})` },
                  { id: "conflicts", label: `Conflicts (${counts.conflicts})` },
                  { id: "completed", label: `Done (${counts.completed})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                    filter === tab.id
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-16 rounded border border-slate-100 bg-slate-50 animate-pulse"
                />
              ))}
            </div>
          ) : filteredInspections.length === 0 ? (
            <div className="p-6 text-center space-y-3">
              <p className="text-sm text-slate-600">
                No inspections match the current filter.
              </p>
              {isSupervisor && onGoToCreateInspection && (
                <button
                  type="button"
                  onClick={onGoToCreateInspection}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  Create New Inspection
                </button>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-slate-200 max-h-[820px] overflow-y-auto">
              {filteredInspections.map((rec) => {
                const isSelected = selectedInspection?.id === rec.id;
                const syncMeta = getSyncLabel(rec);
                const done = rec.items.filter(
                  (i) => i.status !== "pending"
                ).length;
                return (
                  <li key={rec.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(rec.id);
                        setGeoMessage(null);
                        setItemGeoMessages({});
                        setPhotoError(null);
                      }}
                      className={`w-full text-left px-4 py-3.5 transition-colors ${
                        isSelected
                          ? "bg-slate-100"
                          : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900 leading-snug">
                          {rec.siteName}
                        </span>
                        <span className="text-xs font-mono text-slate-500 tabular-nums shrink-0">
                          {done}/{rec.items.length}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                        <span>{rec.siteType}</span>
                        {rec.inspectionMode === "multi-stage" &&
                          (rec.stages?.length ?? 0) > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-medium text-slate-700">
                                {rec.stages!.length} stages
                              </span>
                            </>
                          )}
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Due {rec.dueDate}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate max-w-[160px]">
                          {rec.inspectorName}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
                        <div className="flex items-center gap-1.5">
                          {syncMeta.icon}
                          <span className={syncMeta.colorClass}>
                            {syncMeta.text}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 tabular-nums">
                          {isArrivalGeoVerified(rec.arrivalVerification) ? (
                            <span className="text-emerald-700 font-semibold">
                              On-Site
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold">
                              Arrival Req.
                            </span>
                          )}
                          {rec.geoLocation && <span>GPS</span>}
                          {(rec.photos?.length ?? 0) > 0 && (
                            <span>{rec.photos?.length} img</span>
                          )}
                          {rec.supervisorValidation ? (
                            <span className="text-emerald-700 font-semibold">
                              QA Validated
                            </span>
                          ) : rec.inspectorSignature ? (
                            <span className="text-slate-700 font-semibold">
                              Signed
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Right Checklist Execution Sheet */}
        <section className="lg:col-span-8 rounded-lg border border-slate-200 bg-white">
          {!selectedInspection ? (
            <div className="p-10 text-center space-y-3">
              <h3 className="text-base font-semibold text-slate-900">
                No Inspection Selected
              </h3>
              <p className="text-sm text-slate-600 max-w-md mx-auto">
                {isSupervisor
                  ? "Select an inspection from the left queue or dispatch a new inspection from the Supervisor Directory."
                  : "You have no inspections matching this filter. Switch filters or sync with the server to pull new assignments."}
              </p>
              {isSupervisor && onGoToCreateInspection && (
                <button
                  type="button"
                  onClick={onGoToCreateInspection}
                  className="min-h-[40px] rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Create Inspection
                </button>
              )}
            </div>
          ) : (
            <div>
              {/* Sheet Header */}
              <div className="border-b border-slate-200 p-6 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{selectedInspection.siteType}</span>
                      {selectedInspection.inspectionMode === "multi-stage" &&
                        (selectedInspection.stages?.length ?? 0) > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <Layers className="h-3.5 w-3.5" />
                              Multi-Stage ({selectedInspection.stages!.length}{" "}
                              stages)
                            </span>
                          </>
                        )}
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        ID: {selectedInspection.id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Due {selectedInspection.dueDate}
                      </span>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setSiteDetailsExpanded((prev) => !prev)}
                        aria-expanded={siteDetailsExpanded}
                        className="group inline-flex items-center gap-2 text-left rounded-md -ml-1.5 px-1.5 py-0.5 hover:bg-slate-100 transition-colors"
                      >
                        <h2 className="text-xl font-bold text-slate-900 group-hover:underline underline-offset-4">
                          {selectedInspection.siteName}
                        </h2>
                        {siteDetailsExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                        )}
                        <span className="text-[11px] font-medium text-slate-500">
                          {siteDetailsExpanded ? "Hide details" : "Site details"}
                        </span>
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>{selectedInspection.inspectorName}</span>
                      {selectedInspection.location && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{selectedInspection.location}</span>
                        </>
                      )}
                    </div>
                    {selectedInspection.notes && (
                      <p className="text-sm text-slate-600 pt-1">
                        {selectedInspection.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                    {(() => {
                      const syncMeta = getSyncLabel(selectedInspection);
                      return (
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          {syncMeta.icon}
                          <span className={syncMeta.colorClass}>
                            {syncMeta.text}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePrintReport}
                        className="min-h-[36px] inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        <Printer className="h-3.5 w-3.5 text-slate-700" />
                        <span>
                          {offlineMode
                            ? "Export Offline PDF"
                            : "Print / PDF Report"}
                        </span>
                      </button>

                      {isSupervisor && (
                        <button
                          type="button"
                          disabled={
                            offlineMode ||
                            selectedInspection.syncStatus === "conflict"
                          }
                          onClick={() =>
                            onSimulateConflict(selectedInspection.id)
                          }
                          className="min-h-[36px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 transition-colors whitespace-nowrap shrink-0"
                        >
                          Simulate Server Conflict
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Inline Site Details Panel (Triggered by Clicking Site Heading) */}
                {siteDetailsExpanded && (
                  <div className="rounded-md border border-slate-300 bg-white p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                      <div className="font-semibold text-slate-900">
                        Site Specification &amp; Operational Briefing
                      </div>
                      {linkedSite && (
                        <span className="font-mono text-[11px] text-slate-600">
                          {linkedSite.code} · {linkedSite.type} ·{" "}
                          {linkedSite.active ? "Active Facility" : "Archived"}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Address &amp; Location
                        </div>
                        <div className="text-slate-800">
                          {linkedSite
                            ? `${linkedSite.location}, ${linkedSite.city}, ${linkedSite.country}`
                            : selectedInspection.location || "Address unavailable"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Locked Geo Coordinates
                        </div>
                        <div className="font-mono text-slate-800 tabular-nums">
                          {typeof effectiveSiteLat === "number" &&
                          typeof effectiveSiteLng === "number"
                            ? `${effectiveSiteLat.toFixed(6)}, ${effectiveSiteLng.toFixed(6)}`
                            : "No site coordinates locked"}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Inspection Workflow
                        </div>
                        <div className="text-slate-800">
                          {selectedInspection.inspectionMode === "multi-stage" &&
                          (selectedInspection.stages?.length ?? 0) > 0
                            ? `Multi-Stage (${selectedInspection.stages!.length} stages)`
                            : "Single-Stage"}{" "}
                          · {totalCount} parameters ·{" "}
                          {arrivalGeoVerified
                            ? "Arrival GeoTagged"
                            : "Arrival Verification Pending"}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-200 pt-2.5 space-y-1">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Supervisor Hazard Overview &amp; Entry Instructions
                      </div>
                      <p className="text-slate-700 leading-relaxed">
                        {effectiveSiteOverview ||
                          "No supervisor hazard briefing provided for this site yet."}
                      </p>
                    </div>

                    {selectedInspection.inspectionMode === "multi-stage" &&
                      (selectedInspection.stages?.length ?? 0) > 0 && (
                        <div className="border-t border-slate-200 pt-2.5 space-y-1">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Stage Sequence
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {selectedInspection.stages!.map((st) => (
                              <span
                                key={st.id}
                                className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-700"
                              >
                                {st.order}. {st.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}

                {/* Locked Site Location & Supervisor Overview Box */}
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-slate-800">
                      <Lock className="h-3.5 w-3.5 text-slate-600" />
                      <span>
                        Assigned Site Location
                        {!isSupervisor ? " (Locked by Supervisor)" : ""}
                      </span>
                    </span>
                    {typeof effectiveSiteLat === "number" &&
                      typeof effectiveSiteLng === "number" && (
                        <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                          Site Coords: {effectiveSiteLat.toFixed(5)},{" "}
                          {effectiveSiteLng.toFixed(5)}
                        </span>
                      )}
                  </div>
                  {effectiveSiteOverview && (
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong className="text-slate-800">Site Overview: </strong>
                      {effectiveSiteOverview}
                    </p>
                  )}
                </div>

                {/* Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                    <span>Checklist Completion</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {checkedCount} / {totalCount} items ({progressPct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-slate-900 transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Conflict Resolution Banner & Supervisor Request Selector */}
              {(selectedInspection.syncStatus === "conflict" ||
                selectedInspection.status === "conflict") && (() => {
                const conflictQueue = selectedInspection.conflictQueue ?? [];
                const serverBaseline =
                  selectedInspection.serverSnapshot ?? selectedInspection;
                const activeSubmission =
                  conflictQueue.find((s) => s.id === previewSourceId) ?? null;
                const candidateItems = activeSubmission
                  ? activeSubmission.items
                  : selectedInspection.items;
                const candidateTitle = activeSubmission
                  ? `Queued Submission: ${activeSubmission.submittedBy}`
                  : "Local Field Sheet";

                return (
                  <div className="border-b border-red-200 bg-red-50/70 p-5 space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-2.5">
                        <AlertTriangle className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="text-sm font-semibold text-red-900">
                            {isSupervisor
                              ? "Supervisor Conflict Authority & Request Selector"
                              : "Sync Conflict — Awaiting Supervisor Resolution"}
                          </h3>
                          <p className="text-xs text-red-800 mt-0.5">
                            {isSupervisor
                              ? "Select any conflicting inspector request below, accept the current server record, or edit the checklist directly and save a Supervisor custom merge."
                              : "This inspection was modified concurrently while offline. Your offline changes have been queued on the server for Supervisor review—only Supervisors hold authority to select or override conflicting submissions."}
                          </p>
                        </div>
                      </div>

                      {isSupervisor && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            disabled={offlineMode || syncing}
                            onClick={() =>
                              onResolveConflict(selectedInspection.id, {
                                strategy: "custom-merge",
                              })
                            }
                            className="min-h-[38px] rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                          >
                            Save Supervisor Custom Merge &amp; Resolve
                          </button>
                          <button
                            type="button"
                            disabled={offlineMode || syncing}
                            onClick={() =>
                              onResolveConflict(selectedInspection.id, {
                                strategy: "accept-server",
                              })
                            }
                            className="min-h-[38px] rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                          >
                            Accept Server Record
                          </button>
                          <button
                            type="button"
                            disabled={offlineMode || syncing}
                            onClick={() =>
                              onResolveConflict(selectedInspection.id, {
                                strategy: "keep-local",
                              })
                            }
                            className="min-h-[38px] rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50 whitespace-nowrap shrink-0"
                          >
                            Force Push Local Sheet
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Queued Conflicting Requests Selector (Supervisor Interactive / Inspector Read-Only) */}
                    {conflictQueue.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
                          <GitCompare className="h-3.5 w-3.5" />
                          <span>
                            Queued Conflicting Submissions ({conflictQueue.length})
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                          {conflictQueue.map((sub) => {
                            const diffCount = sub.items.filter((it) => {
                              const srv = serverBaseline.items.find(
                                (s) => s.id === it.id
                              );
                              return (
                                !srv ||
                                srv.status !== it.status ||
                                srv.note !== it.note
                              );
                            }).length;
                            const isPreviewed = previewSourceId === sub.id;

                            return (
                              <div
                                key={sub.id}
                                className={`rounded-md border bg-white p-3 space-y-2 ${
                                  isPreviewed
                                    ? "border-slate-900 ring-1 ring-slate-900/15"
                                    : "border-red-200"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 text-xs">
                                  <div>
                                    <div className="font-semibold text-slate-900">
                                      {sub.submittedBy}
                                    </div>
                                    <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                                      Submitted {formatShortTime(sub.submittedAt)} ·{" "}
                                      {diffCount} item{diffCount === 1 ? "" : "s"}{" "}
                                      differ from server
                                    </div>
                                  </div>
                                  <span className="capitalize rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                                    {sub.submittedByRole}
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setPreviewSourceId(sub.id)}
                                    className={`min-h-[30px] rounded border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                                      isPreviewed
                                        ? "border-slate-900 bg-slate-900 text-white"
                                        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    {isPreviewed ? "Comparing Below" : "Compare Diff"}
                                  </button>

                                  {isSupervisor && (
                                    <button
                                      type="button"
                                      disabled={offlineMode || syncing}
                                      onClick={() =>
                                        onResolveConflict(selectedInspection.id, {
                                          strategy: "apply-submission",
                                          submissionId: sub.id,
                                        })
                                      }
                                      className="min-h-[30px] rounded bg-emerald-700 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                                    >
                                      Select &amp; Apply Request
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Diff Comparison Table */}
                    {(selectedInspection.serverSnapshot ||
                      conflictQueue.length > 0) && (
                      <div className="rounded-md border border-red-200 bg-white overflow-hidden">
                        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                          <span className="font-semibold text-slate-700">
                            Diff Comparison: {candidateTitle} vs. Current Server
                          </span>
                          {conflictQueue.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setPreviewSourceId("local")}
                              className={`text-[11px] font-medium underline ${
                                previewSourceId === "local"
                                  ? "text-slate-900 font-semibold"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              Compare Local Sheet
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50/70 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                          <span>Checklist Item</span>
                          <span>{candidateTitle}</span>
                          <span>Server Record</span>
                        </div>
                        <div className="divide-y divide-slate-200">
                          {candidateItems.map((candItem) => {
                            const remoteItem = serverBaseline.items.find(
                              (r) => r.id === candItem.id
                            );
                            const differs =
                              !remoteItem ||
                              remoteItem.status !== candItem.status ||
                              remoteItem.note !== candItem.note;
                            return (
                              <div
                                key={candItem.id}
                                className={`grid grid-cols-3 gap-3 px-3 py-2 text-xs ${
                                  differs ? "bg-amber-50/60" : ""
                                }`}
                              >
                                <span className="font-medium text-slate-900">
                                  {candItem.label}
                                </span>
                                <div className="text-slate-700">
                                  <span className="font-mono uppercase font-semibold">
                                    {candItem.status}
                                  </span>
                                  {candItem.note && (
                                    <p className="text-slate-500 mt-0.5 truncate">
                                      {candItem.note}
                                    </p>
                                  )}
                                </div>
                                <div className="text-slate-700">
                                  <span className="font-mono uppercase font-semibold">
                                    {remoteItem?.status ?? "—"}
                                  </span>
                                  {remoteItem?.note && (
                                    <p className="text-slate-500 mt-0.5 truncate">
                                      {remoteItem.note}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Offline GeoLocation Tracking Bar */}
              <div className="border-b border-slate-200 bg-slate-50/70 p-5 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <MapPin className="h-4 w-4 text-slate-700" />
                      <span>Offline GeoLocation Verification</span>
                    </div>
                    {selectedInspection.geoLocation ? (
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-700 tabular-nums">
                        <span className="font-semibold text-slate-900">
                          {selectedInspection.geoLocation.latitude.toFixed(6)},{" "}
                          {selectedInspection.geoLocation.longitude.toFixed(6)}
                        </span>
                        {selectedInspection.geoLocation.accuracyMeters !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              ±{selectedInspection.geoLocation.accuracyMeters}m
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <span>
                          {selectedInspection.geoLocation.offlineCaptured
                            ? "Captured Offline"
                            : "Captured Online"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {formatShortTime(
                            selectedInspection.geoLocation.capturedAt
                          )}
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">
                        {isSupervisor
                          ? "No GPS stamp recorded yet. Capture device GPS or enter supervisor override coordinates."
                          : "No device GPS stamp recorded yet. Capture your hardware GPS below or evaluate a parameter to log location."}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleRequestGeoCapture}
                      disabled={capturingGeo}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Compass className="h-3.5 w-3.5" />
                      <span>
                        {capturingGeo
                          ? "Acquiring GPS..."
                          : offlineMode
                          ? "Capture Offline GPS"
                          : "Capture GPS Coordinates"}
                      </span>
                    </button>
                    {isSupervisor && (
                      <button
                        type="button"
                        onClick={() => setManualGeoOpen((v) => !v)}
                        className="min-h-[36px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                      >
                        Supervisor Coords
                      </button>
                    )}
                    {geoTrail.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowGeoTrail((v) => !v)}
                        className="min-h-[36px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono text-slate-700 hover:bg-slate-50 whitespace-nowrap tabular-nums"
                      >
                        Trail ({geoTrail.length})
                      </button>
                    )}
                  </div>
                </div>

                {geoMessage && (
                  <p className="text-xs font-medium text-slate-700">
                    {geoMessage}
                  </p>
                )}

                {isSupervisor && manualGeoOpen && (
                  <form
                    onSubmit={handleSaveManualGeo}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-12 pt-1"
                  >
                    <input
                      type="number"
                      step="any"
                      required
                      value={manualLat}
                      onChange={(e) => setManualLat(e.target.value)}
                      placeholder="Latitude (e.g. 48.1874)"
                      className="sm:col-span-3 min-h-[36px] rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono"
                    />
                    <input
                      type="number"
                      step="any"
                      required
                      value={manualLng}
                      onChange={(e) => setManualLng(e.target.value)}
                      placeholder="Longitude (e.g. 11.6152)"
                      className="sm:col-span-3 min-h-[36px] rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono"
                    />
                    <input
                      type="text"
                      value={manualLabel}
                      onChange={(e) => setManualLabel(e.target.value)}
                      placeholder="Supervisor gate / zone label"
                      className="sm:col-span-4 min-h-[36px] rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs"
                    />
                    <button
                      type="submit"
                      className="sm:col-span-2 min-h-[36px] rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                    >
                      Stamp
                    </button>
                  </form>
                )}

                {showGeoTrail && geoTrail.length > 0 && (
                  <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white text-[11px] font-mono tabular-nums">
                    {geoTrail.map((g) => (
                      <li
                        key={g.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 text-slate-700"
                      >
                        <span>
                          {g.latitude.toFixed(6)}, {g.longitude.toFixed(6)}
                          {g.accuracyMeters !== null
                            ? ` (±${g.accuracyMeters}m)`
                            : ""}
                        </span>
                        <span className="text-slate-500">
                          {g.label || g.source} ·{" "}
                          {g.offlineCaptured ? "Offline" : "Online"} ·{" "}
                          {formatShortTime(g.capturedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Inspector On-Site Arrival Photo / Video Verification (GeoTag + Timing) */}
              <div className="border-b border-slate-200 bg-white p-5 space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserCheck className="h-4 w-4 text-slate-700" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        On-Site Inspector Verification (Geotagged Photo or Video)
                      </h3>
                      {arrivalGeoVerified ? (
                        <span className="inline-flex items-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          Verified On-Site (GeoTagged)
                        </span>
                      ) : selectedInspection.arrivalVerification ? (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          <Lock className="h-3 w-3" />
                          GeoTag Pending — Retry GPS to Unlock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                          <Lock className="h-3 w-3" />
                          Required Before Inspecting
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      Capture a live on-site photo or short video clip (or
                      upload media) stamped with hardware GPS geotag and timing.{" "}
                      {!isSupervisor &&
                        "Checklist inspection stays locked until geotagged arrival verification is completed."}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={arrivalBusy}
                      onClick={() => {
                        setArrivalCaptureMode("photo");
                        setCameraFacing("user");
                        setCameraOpen(true);
                      }}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>Photo Cam</span>
                    </button>

                    <button
                      type="button"
                      disabled={arrivalBusy}
                      onClick={() => {
                        setArrivalCaptureMode("video");
                        setCameraFacing("user");
                        setCameraOpen(true);
                      }}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                    >
                      <Video className="h-3.5 w-3.5 text-slate-700" />
                      <span>Video Cam</span>
                    </button>

                    <input
                      ref={arrivalFileInputRef}
                      id={`arrival-selfie-file-${selectedInspection.id}`}
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleArrivalFileSelected}
                      className="sr-only"
                    />
                    <label
                      htmlFor={`arrival-selfie-file-${selectedInspection.id}`}
                      className="min-h-[36px] inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap"
                    >
                      <Film className="h-3.5 w-3.5 text-slate-700" />
                      <span>
                        {arrivalBusy ? "Stamping..." : "Upload Photo / Video"}
                      </span>
                    </label>
                  </div>
                </div>

                {arrivalNotice && (
                  <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800">
                    {arrivalNotice}
                  </p>
                )}

                {selectedInspection.arrivalVerification ? (
                  <div className="flex flex-col gap-4 rounded-md border border-slate-200 bg-slate-50/80 p-3.5 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxPhoto({
                          id: "arrival-verification",
                          dataUrl:
                            selectedInspection.arrivalVerification!
                              .photoDataUrl,
                          caption: `On-Site Arrival ${
                            isVideoMedia(
                              selectedInspection.arrivalVerification!
                                .photoDataUrl,
                              selectedInspection.arrivalVerification!.mediaType
                            )
                              ? "Video"
                              : "Photo"
                          } Verification — ${
                            selectedInspection.arrivalVerification!
                              .verifiedByName
                          }`,
                          capturedAt:
                            selectedInspection.arrivalVerification!.capturedAt,
                          offlineCaptured:
                            selectedInspection.arrivalVerification!
                              .offlineCaptured,
                          geoTag:
                            selectedInspection.arrivalVerification!.latitude !==
                              null &&
                            selectedInspection.arrivalVerification!
                              .longitude !== null
                              ? {
                                  latitude:
                                    selectedInspection.arrivalVerification!
                                      .latitude,
                                  longitude:
                                    selectedInspection.arrivalVerification!
                                      .longitude,
                                }
                              : undefined,
                        })
                      }
                      className="relative shrink-0 overflow-hidden rounded-md border border-slate-300 bg-slate-950 hover:opacity-95"
                    >
                      {isVideoMedia(
                        selectedInspection.arrivalVerification.photoDataUrl,
                        selectedInspection.arrivalVerification.mediaType
                      ) ? (
                        <>
                          <video
                            src={
                              selectedInspection.arrivalVerification
                                .photoDataUrl
                            }
                            muted
                            playsInline
                            className="h-28 w-36 object-cover"
                          />
                          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            <Film className="h-3 w-3" />
                            Video
                          </span>
                        </>
                      ) : (
                        <img
                          src={
                            selectedInspection.arrivalVerification.photoDataUrl
                          }
                          alt={`Arrival verification by ${selectedInspection.arrivalVerification.verifiedByName}`}
                          className="h-28 w-36 object-cover bg-white"
                        />
                      )}
                    </button>

                    <div className="flex-1 space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900">
                          {selectedInspection.arrivalVerification.verifiedByName}{" "}
                          <span className="font-normal text-slate-500">
                            (
                            {isVideoMedia(
                              selectedInspection.arrivalVerification
                                .photoDataUrl,
                              selectedInspection.arrivalVerification.mediaType
                            )
                              ? "Video Check-In"
                              : "Photo Check-In"}
                            )
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                          Checked in:{" "}
                          {formatShortTime(
                            selectedInspection.arrivalVerification.capturedAt
                          )}{" "}
                          (
                          {selectedInspection.arrivalVerification
                            .offlineCaptured
                            ? "Offline"
                            : "Online"}
                          )
                        </span>
                      </div>

                      <div className="font-mono text-[11px] text-slate-700 tabular-nums flex flex-wrap items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                        {selectedInspection.arrivalVerification.latitude !==
                          null &&
                        selectedInspection.arrivalVerification.longitude !==
                          null ? (
                          <span>
                            GeoTag:{" "}
                            {selectedInspection.arrivalVerification.latitude.toFixed(
                              6
                            )}
                            ,{" "}
                            {selectedInspection.arrivalVerification.longitude.toFixed(
                              6
                            )}
                            {selectedInspection.arrivalVerification
                              .accuracyMeters !== null
                              ? ` (±${selectedInspection.arrivalVerification.accuracyMeters}m)`
                              : ""}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold">
                            GeoTag missing — hardware GPS required to unlock
                            checklist
                          </span>
                        )}
                        {selectedInspection.arrivalVerification
                          .distanceFromSiteMeters !== null && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span
                              className={
                                selectedInspection.arrivalVerification
                                  .distanceFromSiteMeters <= 500
                                  ? "font-semibold text-emerald-700"
                                  : "font-semibold text-amber-700"
                              }
                            >
                              {formatDistanceLabel(
                                selectedInspection.arrivalVerification
                                  .distanceFromSiteMeters
                              )}
                            </span>
                          </>
                        )}
                      </div>

                      {selectedInspection.arrivalVerification.note && (
                        <p className="text-slate-600">
                          Note: {selectedInspection.arrivalVerification.note}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {selectedInspection.arrivalVerification.latitude ===
                          null && (
                          <button
                            type="button"
                            disabled={arrivalBusy}
                            onClick={handleRetryArrivalGeoTag}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 underline hover:text-slate-900"
                          >
                            <Compass className="h-3 w-3" />
                            Retry GeoTag
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            onSaveArrivalVerification(
                              selectedInspection.id,
                              null
                            )
                          }
                          className="text-xs font-medium text-red-700 hover:text-red-900"
                        >
                          Clear Verification
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      type="text"
                      value={arrivalNoteInput}
                      onChange={(e) => setArrivalNoteInput(e.target.value)}
                      placeholder="Optional arrival check-in note (e.g. Gate B security check-in)..."
                      className="flex-1 min-h-[36px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400"
                    />
                  </div>
                )}
              </div>

              {inspectionLockedForInspector && (
                <div className="border-b border-amber-200 bg-amber-50/90 px-5 py-3.5 flex items-start gap-3">
                  <Lock className="h-4 w-4 text-amber-800 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-xs">
                    <div className="font-semibold text-amber-950">
                      Checklist Locked — Complete Geotagged Photo or Video
                      Verification First
                    </div>
                    <p className="text-amber-900">
                      {selectedInspection.arrivalVerification
                        ? 'Your arrival media is saved, but GPS coordinates are missing. Click "Retry GeoTag" above with device location enabled to unlock inspection parameters and sign-off.'
                        : "Use Photo Cam, Video Cam, or Upload Photo / Video above with device location enabled to stamp your arrival geotag and unlock inspection controls."}
                    </p>
                  </div>
                </div>
              )}

              {/* Multi-Stage Tabs & Checklist Items with Per-Parameter Photo & GeoLocation */}
              {selectedInspection.inspectionMode === "multi-stage" &&
                (selectedInspection.stages?.length ?? 0) > 0 && (
                  <div className="border-b border-slate-200 bg-slate-50/80 px-5 py-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Layers className="h-3.5 w-3.5 text-slate-600" />
                        <span>
                          Inspection Stages ({selectedInspection.stages!.length})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Filter or complete stages sequentially
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setActiveStageFilter("all")}
                        className={`min-h-[32px] rounded-md border px-3 py-1 text-xs font-semibold transition-colors tabular-nums ${
                          activeStageFilter === "all"
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        All Stages ({checkedCount}/{totalCount})
                      </button>

                      {selectedInspection.stages!.map((stage) => {
                        const stageItems = selectedInspection.items.filter(
                          (it) => it.stageId === stage.id
                        );
                        const stageDone = stageItems.filter(
                          (it) => it.status !== "pending"
                        ).length;
                        const active = activeStageFilter === stage.id;
                        return (
                          <button
                            key={stage.id}
                            type="button"
                            onClick={() => setActiveStageFilter(stage.id)}
                            className={`min-h-[32px] rounded-md border px-3 py-1 text-xs font-medium transition-colors tabular-nums ${
                              active
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {stage.order}. {stage.name} ({stageDone}/
                            {stageItems.length})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              {(() => {
                const isMultiStage =
                  selectedInspection.inspectionMode === "multi-stage" &&
                  (selectedInspection.stages?.length ?? 0) > 0;
                const stagesList = selectedInspection.stages ?? [];

                const renderChecklistItemRow = (
                  item: ChecklistItem,
                  globalIndex: number
                ) => {
                  const itemPhotos = photos.filter((p) => p.itemId === item.id);
                  const inputId = `param-photo-${selectedInspection.id}-${item.id}`;
                  return (
                    <li key={item.id} className="p-5 space-y-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-slate-400 tabular-nums">
                              {String(globalIndex + 1).padStart(2, "0")}.
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {item.label}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            {item.target && (
                              <span className="font-mono text-slate-700">
                                Target: {item.target}
                              </span>
                            )}
                            {item.unit && (
                              <>
                                {item.target && <span aria-hidden="true">·</span>}
                                <span className="font-mono text-slate-700">
                                  Unit: {item.unit}
                                </span>
                              </>
                            )}
                            {(item.target || item.unit) && (
                              <span aria-hidden="true">·</span>
                            )}
                            <span>
                              Updated {formatShortTime(item.updatedAt)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{item.updatedBy}</span>
                          </div>

                          {/* Per-Parameter GeoLocation Status */}
                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] font-mono tabular-nums">
                            <MapPin className="h-3 w-3 text-slate-500 shrink-0" />
                            {item.geoLocation ? (
                              <span className="text-slate-700">
                                {item.geoLocation.latitude.toFixed(5)},{" "}
                                {item.geoLocation.longitude.toFixed(5)}
                                {item.geoLocation.accuracyMeters !== null
                                  ? ` (±${item.geoLocation.accuracyMeters}m)`
                                  : ""}{" "}
                                ·{" "}
                                {item.geoLocation.offlineCaptured
                                  ? "Offline GPS"
                                  : "GPS"}{" "}
                                · {formatShortTime(item.geoLocation.capturedAt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                Parameter GPS not stamped yet
                              </span>
                            )}
                            {itemGeoMessages[item.id] && (
                              <span className="text-slate-600 font-sans">
                                ({itemGeoMessages[item.id]})
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Pass / Fail / Pending + Per-Parameter Photo & GPS Actions */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <div
                            role="group"
                            aria-label={`Status for ${item.label}`}
                            className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-1"
                          >
                            <button
                              type="button"
                              disabled={inspectionLockedForInspector}
                              onClick={() =>
                                handleParameterStatusChange(
                                  item.id,
                                  item.label,
                                  "pass"
                                )
                              }
                              className={`min-h-[34px] inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                                item.status === "pass"
                                  ? "bg-emerald-600 text-white"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" />
                              Pass
                            </button>
                            <button
                              type="button"
                              disabled={inspectionLockedForInspector}
                              onClick={() =>
                                handleParameterStatusChange(
                                  item.id,
                                  item.label,
                                  "fail"
                                )
                              }
                              className={`min-h-[34px] inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                                item.status === "fail"
                                  ? "bg-red-600 text-white"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              <X className="h-3.5 w-3.5" />
                              Fail
                            </button>
                            <button
                              type="button"
                              disabled={inspectionLockedForInspector}
                              onClick={() =>
                                handleParameterStatusChange(
                                  item.id,
                                  item.label,
                                  "pending"
                                )
                              }
                              className={`min-h-[34px] inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap disabled:opacity-45 disabled:cursor-not-allowed ${
                                item.status === "pending"
                                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                                  : "text-slate-600 hover:text-slate-900"
                              }`}
                            >
                              Pending
                            </button>
                          </div>

                          <button
                            type="button"
                            disabled={
                              inspectionLockedForInspector ||
                              capturingItemGeoId === item.id
                            }
                            onClick={() =>
                              handleStampParameterGeo(item.id, item.label)
                            }
                            title="Stamp hardware GPS coordinates on this parameter"
                            className="min-h-[36px] inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            <Compass className="h-3.5 w-3.5 text-slate-600" />
                            <span>
                              {capturingItemGeoId === item.id
                                ? "Locating..."
                                : "Stamp GPS"}
                            </span>
                          </button>

                          <div>
                            <input
                              id={inputId}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              multiple
                              disabled={inspectionLockedForInspector}
                              onChange={(e) =>
                                handlePhotoFilesSelected(e, item.id, item.label)
                              }
                              className="sr-only"
                            />
                            <label
                              htmlFor={inputId}
                              className={`min-h-[36px] inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 whitespace-nowrap ${
                                inspectionLockedForInspector
                                  ? "opacity-45 pointer-events-none cursor-not-allowed"
                                  : "hover:bg-slate-50 cursor-pointer"
                              }`}
                            >
                              <Camera className="h-3.5 w-3.5 text-slate-600" />
                              <span>
                                {addingItemPhotoId === item.id
                                  ? "Saving..."
                                  : `Photo (${itemPhotos.length})`}
                              </span>
                            </label>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor={`note-${selectedInspection.id}-${item.id}`}
                          className="sr-only"
                        >
                          Field note for {item.label}
                        </label>
                        <input
                          id={`note-${selectedInspection.id}-${item.id}`}
                          type="text"
                          disabled={inspectionLockedForInspector}
                          value={item.note}
                          onChange={(e) =>
                            onUpdateChecklistItem(
                              selectedInspection.id,
                              item.id,
                              {
                                note: e.target.value,
                              }
                            )
                          }
                          placeholder={
                            inspectionLockedForInspector
                              ? "Complete geotagged arrival verification above to unlock observations..."
                              : "Add field observation, meter reading, or corrective note..."
                          }
                          className="w-full min-h-[38px] rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-slate-400 focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-55 disabled:cursor-not-allowed"
                        />
                      </div>

                      {/* Linked Parameter Photo Strip */}
                      {itemPhotos.length > 0 && (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
                          {itemPhotos.map((photo) => (
                            <div
                              key={photo.id}
                              className="rounded border border-slate-200 bg-slate-50 p-2 space-y-1.5"
                            >
                              <button
                                type="button"
                                onClick={() => setLightboxPhoto(photo)}
                                className="block w-full overflow-hidden rounded border border-slate-200 bg-white"
                              >
                                <img
                                  src={photo.dataUrl}
                                  alt={photo.caption || item.label}
                                  className="h-24 w-full object-cover"
                                />
                              </button>
                              <input
                                type="text"
                                disabled={inspectionLockedForInspector}
                                value={photo.caption}
                                onChange={(e) =>
                                  onUpdatePhoto(
                                    selectedInspection.id,
                                    photo.id,
                                    { caption: e.target.value }
                                  )
                                }
                                className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-900 disabled:opacity-55"
                              />
                              <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 tabular-nums">
                                <span>
                                  {photo.geoTag
                                    ? `${photo.geoTag.latitude.toFixed(4)}, ${photo.geoTag.longitude.toFixed(4)}`
                                    : formatShortTime(photo.capturedAt)}
                                </span>
                                <button
                                  type="button"
                                  disabled={inspectionLockedForInspector}
                                  onClick={() =>
                                    onRemovePhoto(
                                      selectedInspection.id,
                                      photo.id
                                    )
                                  }
                                  className="text-red-700 hover:text-red-900 font-sans font-medium disabled:opacity-45"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                };

                if (!isMultiStage) {
                  return (
                    <ul className="divide-y divide-slate-200">
                      {selectedInspection.items.map((item, idx) =>
                        renderChecklistItemRow(item, idx)
                      )}
                    </ul>
                  );
                }

                const visibleStages =
                  activeStageFilter === "all"
                    ? stagesList
                    : stagesList.filter((st) => st.id === activeStageFilter);
                const ungroupedItems =
                  activeStageFilter === "all"
                    ? selectedInspection.items.filter(
                        (it) =>
                          !it.stageId ||
                          !stagesList.some((st) => st.id === it.stageId)
                      )
                    : [];

                return (
                  <div className="divide-y divide-slate-200">
                    {visibleStages.map((stage) => {
                      const stageItems = selectedInspection.items.filter(
                        (it) => it.stageId === stage.id
                      );
                      const stageDone = stageItems.filter(
                        (it) => it.status !== "pending"
                      ).length;

                      return (
                        <div key={stage.id}>
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100/75 px-5 py-2.5">
                            <div>
                              <div className="text-xs font-bold uppercase tracking-wide text-slate-800">
                                Stage {stage.order}: {stage.name}
                              </div>
                              {stage.description && (
                                <p className="text-xs text-slate-600 mt-0.5">
                                  {stage.description}
                                </p>
                              )}
                            </div>
                            <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums">
                              {stageDone}/{stageItems.length} verified
                            </span>
                          </div>
                          <ul className="divide-y divide-slate-200">
                            {stageItems.map((item) => {
                              const globalIdx = selectedInspection.items.findIndex(
                                (x) => x.id === item.id
                              );
                              return renderChecklistItemRow(
                                item,
                                globalIdx >= 0 ? globalIdx : 0
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}

                    {ungroupedItems.length > 0 && (
                      <div>
                        <div className="border-b border-slate-200 bg-slate-100/75 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-800">
                          Additional Checklist Parameters
                        </div>
                        <ul className="divide-y divide-slate-200">
                          {ungroupedItems.map((item) => {
                            const globalIdx = selectedInspection.items.findIndex(
                              (x) => x.id === item.id
                            );
                            return renderChecklistItemRow(
                              item,
                              globalIdx >= 0 ? globalIdx : 0
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Offline General Photo Evidence Section */}
              <div className="border-t border-slate-200 p-6 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">
                      General &amp; Parameter Photo Evidence ({photos.length}/24)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Attach general facility photos here or parameter-specific
                      photos directly on each checklist row above.
                    </p>
                  </div>

                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      disabled={inspectionLockedForInspector}
                      onChange={(e) => handlePhotoFilesSelected(e)}
                      className="sr-only"
                      id="inspection-photo-input"
                    />
                    <label
                      htmlFor="inspection-photo-input"
                      className={`min-h-[38px] inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 whitespace-nowrap ${
                        inspectionLockedForInspector
                          ? "opacity-45 pointer-events-none cursor-not-allowed"
                          : "hover:bg-slate-50 cursor-pointer"
                      }`}
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>
                        {addingPhotos
                          ? "Compressing..."
                          : "Add General Site Photo"}
                      </span>
                    </label>
                  </div>
                </div>

                {photoError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {photoError}
                  </div>
                )}

                {generalPhotos.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-xs text-slate-500">
                    {photos.length === 0
                      ? "No photo evidence attached yet. Attach photos per checklist parameter above or add general site photos here."
                      : `${photos.length} parameter-linked photo${
                          photos.length === 1 ? "" : "s"
                        } attached above.`}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {generalPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2.5"
                      >
                        <button
                          type="button"
                          onClick={() => setLightboxPhoto(photo)}
                          className="block w-full overflow-hidden rounded border border-slate-200 bg-white"
                        >
                          <img
                            src={photo.dataUrl}
                            alt={photo.caption || "Inspection evidence"}
                            className="h-40 w-full object-cover"
                          />
                        </button>

                        <input
                          type="text"
                          disabled={inspectionLockedForInspector}
                          value={photo.caption}
                          onChange={(e) =>
                            onUpdatePhoto(selectedInspection.id, photo.id, {
                              caption: e.target.value,
                            })
                          }
                          placeholder="Photo caption / finding reference..."
                          className="w-full min-h-[34px] rounded border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 disabled:opacity-55"
                        />

                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <select
                            aria-label="Link photo to checklist item"
                            disabled={inspectionLockedForInspector}
                            value={photo.itemId ?? ""}
                            onChange={(e) =>
                              onUpdatePhoto(selectedInspection.id, photo.id, {
                                itemId: e.target.value || undefined,
                              })
                            }
                            className="max-w-[180px] rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 disabled:opacity-55"
                          >
                            <option value="">General Site Photo</option>
                            {selectedInspection.items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            disabled={inspectionLockedForInspector}
                            onClick={() =>
                              onRemovePhoto(selectedInspection.id, photo.id)
                            }
                            className="inline-flex items-center gap-1 text-red-700 hover:text-red-900 font-medium disabled:opacity-45"
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-500 tabular-nums">
                          <span>{formatShortTime(photo.capturedAt)}</span>
                          <span>·</span>
                          <span>
                            {photo.offlineCaptured ? "Offline" : "Online"}
                          </span>
                          {photo.geoTag && (
                            <>
                              <span>·</span>
                              <span>
                                {photo.geoTag.latitude.toFixed(4)},{" "}
                                {photo.geoTag.longitude.toFixed(4)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Report Validation & Signature Section */}
              <div className="border-t border-slate-200 bg-slate-50/50 p-6 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Report Validation &amp; Signatures
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sign below to attest checklist findings before exporting PDF
                    (online or offline) or submitting for Supervisor QA review.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <SignaturePad
                    title="Field Inspector Validation"
                    signerName={selectedInspection.inspectorName}
                    signerRole="inspector"
                    existingSignature={selectedInspection.inspectorSignature}
                    disabled={inspectionLockedForInspector}
                    onSaveSignature={(dataUrl) =>
                      onSaveInspectorSignature(selectedInspection.id, dataUrl)
                    }
                    onClearSavedSignature={() =>
                      onClearInspectorSignature(selectedInspection.id)
                    }
                  />

                  {isSupervisor ? (
                    <SignaturePad
                      title="Supervisor QA Sign-Off"
                      signerName={currentUser.name}
                      signerRole="supervisor"
                      existingSignature={selectedInspection.supervisorValidation}
                      disabled={offlineMode}
                      onSaveSignature={(dataUrl) =>
                        onSupervisorValidate(selectedInspection.id, dataUrl)
                      }
                    />
                  ) : (
                    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-slate-900">
                          Supervisor QA Review
                        </h4>
                        {selectedInspection.supervisorValidation ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Validated
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-amber-700">
                            Awaiting Supervisor Sign-Off
                          </span>
                        )}
                      </div>
                      {selectedInspection.supervisorValidation ? (
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5">
                          <img
                            src={selectedInspection.supervisorValidation.dataUrl}
                            alt={`Supervisor signature by ${selectedInspection.supervisorValidation.signerName}`}
                            className="h-20 w-auto bg-white border border-slate-200 rounded px-2 py-1 object-contain"
                          />
                          <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                            {selectedInspection.supervisorValidation.signerName} ·{" "}
                            {formatShortTime(
                              selectedInspection.supervisorValidation.signedAt
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 pt-2">
                          Once you sync your signed inspection report, a
                          Supervisor can review your findings and attach QA
                          validation.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Live Camera On-Site Photo / Video Verification Modal */}
      {cameraOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 print:hidden"
          onClick={() => setCameraOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  On-Site Arrival Camera (Photo / Video)
                </h3>
                <p className="text-xs text-slate-500">
                  Captures geotagged image or up to 10s video with timestamp
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCameraOpen(false)}
                className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                disabled={recordingVideo}
                onClick={() => setArrivalCaptureMode("photo")}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  arrivalCaptureMode === "photo"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Camera className="h-3.5 w-3.5" />
                Photo Capture
              </button>
              <button
                type="button"
                disabled={recordingVideo}
                onClick={() => setArrivalCaptureMode("video")}
                className={`inline-flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  arrivalCaptureMode === "video"
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Video className="h-3.5 w-3.5" />
                Video Clip (max 10s)
              </button>
            </div>

            <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-950 aspect-[4/3] flex items-center justify-center">
              {cameraError ? (
                <div className="p-6 text-center text-xs text-slate-200 space-y-2">
                  <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto" />
                  <p>{cameraError}</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute bottom-2 left-2 rounded bg-slate-900/75 px-2 py-1 font-mono text-[10px] text-white tabular-nums">
                {new Date().toLocaleTimeString()} ·{" "}
                {cameraFacing === "user" ? "Front Cam" : "Rear Cam"} ·{" "}
                {offlineMode ? "Offline Stamp" : "Live GPS"}
                {recordingVideo ? ` · REC ${recordingSeconds}s / 10s` : ""}
              </div>
            </div>

            <input
              type="text"
              value={arrivalNoteInput}
              onChange={(e) => setArrivalNoteInput(e.target.value)}
              placeholder="Optional check-in note (e.g. Arrived at main gate)..."
              className="w-full min-h-[38px] rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 focus:bg-white"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={recordingVideo}
                onClick={() =>
                  setCameraFacing((prev) =>
                    prev === "user" ? "environment" : "user"
                  )
                }
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Flip Camera
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCameraOpen(false)}
                  className="min-h-[38px] rounded-md border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                {arrivalCaptureMode === "photo" ? (
                  <button
                    type="button"
                    disabled={!cameraReady || Boolean(cameraError) || arrivalBusy}
                    onClick={handleCaptureLiveSelfie}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    {arrivalBusy ? "Saving..." : "Capture Photo + GeoTag"}
                  </button>
                ) : recordingVideo ? (
                  <button
                    type="button"
                    onClick={stopVideoRecording}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    <Square className="h-3.5 w-3.5" />
                    Stop &amp; Save Video ({recordingSeconds}s)
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!cameraReady || Boolean(cameraError) || arrivalBusy}
                    onClick={startVideoRecording}
                    className="min-h-[38px] inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
                  >
                    <Video className="h-3.5 w-3.5" />
                    {arrivalBusy ? "Saving..." : "Record Video + GeoTag"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Photo / Video Lightbox */}
      {lightboxPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 print:hidden"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="max-w-3xl w-full rounded-lg bg-white p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-900">
                {lightboxPhoto.caption || "Evidence Preview"}
              </span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {isVideoMedia(lightboxPhoto.dataUrl) ? (
              <video
                src={lightboxPhoto.dataUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[75vh] w-full rounded bg-slate-950"
              />
            ) : (
              <img
                src={lightboxPhoto.dataUrl}
                alt={lightboxPhoto.caption || "Evidence preview"}
                className="max-h-[75vh] w-full object-contain rounded bg-slate-100"
              />
            )}
          </div>
        </div>
      )}

      {/* Print-Only Formal PDF Inspection Report (Works Both Online & Offline) */}
      {selectedInspection && (
        <article className="hidden print:block text-slate-900 space-y-5">
          {/* Report Header */}
          <header className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Nirikshan Operational Compliance Record (
                {offlineMode ? "Offline Export" : "Online Export"})
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Site Inspection &amp; Findings Report
              </h1>
              <p className="text-sm text-slate-700">
                {selectedInspection.siteName}
              </p>
            </div>
            <div className="text-right text-xs space-y-1 tabular-nums">
              <div className="font-mono font-semibold text-slate-900">
                Report ID: {selectedInspection.id}
              </div>
              <div className="text-slate-600">
                Exported by: {currentUser.name} ({currentUser.role})
              </div>
              <div className="text-slate-600">
                Generated: {formatShortTime(new Date().toISOString())}
              </div>
              <div className="font-semibold text-slate-800">
                Status: {selectedInspection.status.toUpperCase()} (
                {selectedInspection.syncStatus})
              </div>
            </div>
          </header>

          {/* Site, Overview & GPS Metadata Grid */}
          <section className="grid grid-cols-2 gap-4 rounded-md border border-slate-300 bg-slate-50 p-4 text-xs">
            <div className="space-y-1">
              <div className="text-slate-500 font-semibold">Facility / Site</div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedInspection.siteName} ({selectedInspection.siteType})
              </div>
              <div className="text-slate-600">
                {selectedInspection.location || "Location not specified"}
              </div>
              {typeof effectiveSiteLat === "number" &&
                typeof effectiveSiteLng === "number" && (
                  <div className="font-mono text-[11px] text-slate-600 tabular-nums">
                    Authorized Site Coords: {effectiveSiteLat.toFixed(6)},{" "}
                    {effectiveSiteLng.toFixed(6)}
                  </div>
                )}
            </div>
            <div className="space-y-1">
              <div className="text-slate-500 font-semibold">
                Assigned Inspector &amp; Schedule
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {selectedInspection.inspectorName}
              </div>
              <div className="text-slate-600 font-mono tabular-nums">
                Due Date: {selectedInspection.dueDate} · Workflow:{" "}
                {selectedInspection.inspectionMode === "multi-stage" &&
                (selectedInspection.stages?.length ?? 0) > 0
                  ? `Multi-Stage (${selectedInspection.stages!.length} stages)`
                  : "Single-Stage"}{" "}
                · Updated {formatShortTime(selectedInspection.updatedAt)}
              </div>
              {selectedInspection.notes && (
                <div className="text-slate-700 pt-0.5">
                  Scope: {selectedInspection.notes}
                </div>
              )}
            </div>

            {effectiveSiteOverview && (
              <div className="col-span-2 border-t border-slate-200 pt-2 text-slate-700">
                <span className="font-semibold text-slate-800">
                  Supervisor Site Overview:{" "}
                </span>
                {effectiveSiteOverview}
              </div>
            )}

            <div className="col-span-2 border-t border-slate-200 pt-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-semibold text-slate-600">
                  Primary Field GPS Stamp:{" "}
                </span>
                {selectedInspection.geoLocation ? (
                  <span className="font-mono text-slate-900 tabular-nums">
                    {selectedInspection.geoLocation.latitude.toFixed(6)},{" "}
                    {selectedInspection.geoLocation.longitude.toFixed(6)}
                    {selectedInspection.geoLocation.accuracyMeters !== null
                      ? ` (±${selectedInspection.geoLocation.accuracyMeters}m)`
                      : ""}{" "}
                    ·{" "}
                    {selectedInspection.geoLocation.offlineCaptured
                      ? "Offline Capture"
                      : "Online Capture"}
                  </span>
                ) : (
                  <span className="text-slate-500">Not captured</span>
                )}
              </div>
              <div className="font-mono text-slate-600 tabular-nums">
                GPS Trail Logs: {geoTrail.length} · Total Photos: {photos.length}
              </div>
            </div>
          </section>

          {/* Printed On-Site Inspector Arrival Selfie Verification */}
          <section className="rounded-md border border-slate-300 p-3.5 text-xs break-inside-avoid">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-900">
                On-Site Inspector Arrival Verification
              </span>
              <span className="font-mono text-[11px] font-semibold text-slate-700">
                {selectedInspection.arrivalVerification
                  ? "VERIFIED ON-SITE"
                  : "NOT RECORDED"}
              </span>
            </div>
            {selectedInspection.arrivalVerification ? (
              <div className="mt-2.5 flex items-start gap-4">
                {isVideoMedia(
                  selectedInspection.arrivalVerification.photoDataUrl,
                  selectedInspection.arrivalVerification.mediaType
                ) ? (
                  <div className="flex h-24 w-32 shrink-0 flex-col items-center justify-center gap-1 rounded border border-slate-300 bg-slate-100 px-2 text-center">
                    <Film className="h-5 w-5 text-slate-700" />
                    <span className="text-[10px] font-semibold text-slate-800 leading-tight">
                      Geotagged Arrival Video Verified
                    </span>
                  </div>
                ) : (
                  <img
                    src={selectedInspection.arrivalVerification.photoDataUrl}
                    alt="Inspector on-site arrival verification"
                    className="h-24 w-32 rounded border border-slate-300 object-cover shrink-0"
                  />
                )}
                <div className="space-y-1 text-slate-700">
                  <div className="font-semibold text-slate-900">
                    {selectedInspection.arrivalVerification.verifiedByName}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums">
                    Check-In Time:{" "}
                    {formatShortTime(
                      selectedInspection.arrivalVerification.capturedAt
                    )}{" "}
                    ({selectedInspection.arrivalVerification.capturedAt}) ·{" "}
                    {selectedInspection.arrivalVerification.offlineCaptured
                      ? "Offline"
                      : "Online"}
                  </div>
                  <div className="font-mono text-[11px] tabular-nums">
                    GeoTag:{" "}
                    {selectedInspection.arrivalVerification.latitude !== null &&
                    selectedInspection.arrivalVerification.longitude !== null
                      ? `${selectedInspection.arrivalVerification.latitude.toFixed(
                          6
                        )}, ${selectedInspection.arrivalVerification.longitude.toFixed(
                          6
                        )}${
                          selectedInspection.arrivalVerification
                            .accuracyMeters !== null
                            ? ` (±${selectedInspection.arrivalVerification.accuracyMeters}m)`
                            : ""
                        }`
                      : "Unavailable"}
                    {selectedInspection.arrivalVerification
                      .distanceFromSiteMeters !== null
                      ? ` · ${formatDistanceLabel(
                          selectedInspection.arrivalVerification
                            .distanceFromSiteMeters
                        )}`
                      : ""}
                  </div>
                  {selectedInspection.arrivalVerification.note && (
                    <div>
                      Note: {selectedInspection.arrivalVerification.note}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-slate-500">
                No arrival selfie or on-site verification photo attached yet.
              </p>
            )}
          </section>

          {/* Findings Summary Bar */}
          <section className="grid grid-cols-5 border border-slate-300 divide-x divide-slate-300 rounded-md text-center text-xs tabular-nums">
            <div className="p-2.5">
              <div className="text-slate-500">Total Checks</div>
              <div className="mt-0.5 text-base font-mono font-bold text-slate-900">
                {totalCount}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-emerald-700 font-medium">Passed</div>
              <div className="mt-0.5 text-base font-mono font-bold text-emerald-800">
                {passCount}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-red-700 font-medium">Failed</div>
              <div className="mt-0.5 text-base font-mono font-bold text-red-800">
                {failCount}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-amber-700 font-medium">Pending</div>
              <div className="mt-0.5 text-base font-mono font-bold text-amber-800">
                {pendingItemCount}
              </div>
            </div>
            <div className="p-2.5">
              <div className="text-slate-500">Completion</div>
              <div className="mt-0.5 text-base font-mono font-bold text-slate-900">
                {progressPct}%
              </div>
            </div>
          </section>

          {/* Checklist Findings Table with Per-Parameter GPS & Inline Linked Photos */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              Checklist Parameters, Per-Parameter GPS &amp; Linked Evidence
            </h2>
            <table className="w-full border-collapse border border-slate-300 text-left text-xs">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 font-semibold">
                  <th className="py-2 px-3 border-r border-slate-300 w-9">#</th>
                  <th className="py-2 px-3 border-r border-slate-300">
                    Parameter &amp; Parameter GPS
                  </th>
                  <th className="py-2 px-3 border-r border-slate-300 w-20">
                    Finding
                  </th>
                  <th className="py-2 px-3 border-r border-slate-300">
                    Observations &amp; Parameter Photos
                  </th>
                  <th className="py-2 px-3 w-36">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {selectedInspection.items.map((item, idx) => {
                  const linkedPhotos = photos.filter(
                    (p) => p.itemId === item.id
                  );
                  return (
                    <tr key={item.id} className="break-inside-avoid align-top">
                      <td className="py-2.5 px-3 border-r border-slate-300 font-mono tabular-nums text-slate-600">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-300 space-y-1">
                        {item.stageName && (
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            {item.stageName}
                          </div>
                        )}
                        <div className="font-semibold text-slate-900">
                          {item.label}
                        </div>
                        {(item.target || item.unit) && (
                          <div className="font-mono text-[10px] text-slate-600">
                            {item.target ? `Target: ${item.target}` : ""}
                            {item.target && item.unit ? " · " : ""}
                            {item.unit ? `Unit: ${item.unit}` : ""}
                          </div>
                        )}
                        <div className="font-mono text-[10px] text-slate-600 tabular-nums">
                          GPS:{" "}
                          {item.geoLocation
                            ? `${item.geoLocation.latitude.toFixed(5)}, ${item.geoLocation.longitude.toFixed(5)} (${
                                item.geoLocation.offlineCaptured
                                  ? "Offline"
                                  : "Online"
                              })`
                            : "Not stamped"}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-300 font-mono font-bold uppercase">
                        {item.status === "pass" && (
                          <span className="text-emerald-800">PASS</span>
                        )}
                        {item.status === "fail" && (
                          <span className="text-red-800">FAIL</span>
                        )}
                        {item.status === "pending" && (
                          <span className="text-amber-800">PENDING</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-300 text-slate-700 space-y-2">
                        <div>
                          {item.note.trim() ? item.note : "No additional notes"}
                        </div>
                        {linkedPhotos.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            {linkedPhotos.map((lp) => (
                              <div
                                key={lp.id}
                                className="rounded border border-slate-200 p-1 space-y-0.5"
                              >
                                <img
                                  src={lp.dataUrl}
                                  alt={lp.caption || item.label}
                                  className="h-20 w-full object-cover rounded"
                                />
                                <div className="text-[9px] text-slate-600 truncate">
                                  {lp.caption || item.label}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600">
                        <div>{item.updatedBy}</div>
                        <div className="font-mono tabular-nums text-slate-500">
                          {formatShortTime(item.updatedAt)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* General Site Photographic Evidence Print Section */}
          {generalPhotos.length > 0 && (
            <section className="space-y-2 break-inside-avoid">
              <h2 className="text-sm font-bold text-slate-900">
                General Site Photographic Evidence ({generalPhotos.length})
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {generalPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="rounded border border-slate-300 p-2 space-y-1.5 break-inside-avoid"
                  >
                    <img
                      src={photo.dataUrl}
                      alt={photo.caption || "Evidence"}
                      className="h-32 w-full object-cover rounded border border-slate-200"
                    />
                    <div className="text-xs font-semibold text-slate-900">
                      {photo.caption || "Site Photo"}
                    </div>
                    <div className="text-[10px] font-mono text-slate-600 tabular-nums">
                      {formatShortTime(photo.capturedAt)}
                      {photo.geoTag
                        ? ` · ${photo.geoTag.latitude.toFixed(4)}, ${photo.geoTag.longitude.toFixed(4)}`
                        : ""}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Embedded Digital Sign-Off Footer */}
          <footer className="grid grid-cols-2 gap-8 pt-4 text-xs break-inside-avoid">
            <div className="rounded border border-slate-300 p-3 space-y-2">
              <div className="font-semibold text-slate-900">
                Field Inspector Validation
              </div>
              {selectedInspection.inspectorSignature ? (
                <>
                  <img
                    src={selectedInspection.inspectorSignature.dataUrl}
                    alt="Inspector signature"
                    className="h-16 w-auto bg-white object-contain"
                  />
                  <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                    {selectedInspection.inspectorSignature.signerName} ·{" "}
                    {formatShortTime(
                      selectedInspection.inspectorSignature.signedAt
                    )}
                    {selectedInspection.inspectorSignature.latitude !== undefined &&
                    selectedInspection.inspectorSignature.longitude !== undefined
                      ? ` · ${selectedInspection.inspectorSignature.latitude.toFixed(4)}, ${selectedInspection.inspectorSignature.longitude.toFixed(4)}`
                      : ""}
                  </div>
                </>
              ) : (
                <div className="h-16 flex items-end border-b border-slate-300 pb-1 text-slate-400">
                  Signature pending
                </div>
              )}
            </div>

            <div className="rounded border border-slate-300 p-3 space-y-2">
              <div className="font-semibold text-slate-900">
                Supervisor QA Validation
              </div>
              {selectedInspection.supervisorValidation ? (
                <>
                  <img
                    src={selectedInspection.supervisorValidation.dataUrl}
                    alt="Supervisor QA signature"
                    className="h-16 w-auto bg-white object-contain"
                  />
                  <div className="text-[11px] font-mono text-slate-600 tabular-nums">
                    {selectedInspection.supervisorValidation.signerName} ·{" "}
                    {formatShortTime(
                      selectedInspection.supervisorValidation.signedAt
                    )}
                  </div>
                </>
              ) : (
                <div className="h-16 flex items-end border-b border-slate-300 pb-1 text-slate-400">
                  Pending QA co-signature
                </div>
              )}
            </div>
          </footer>
        </article>
      )}
    </div>
  );
}
