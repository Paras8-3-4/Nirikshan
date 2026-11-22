import type {
  ArrivalVerification,
  ChecklistItem,
  ChecklistItemStatus,
  ConflictSubmission,
  CreateInspectionInput,
  CreateStageInput,
  CustomParameterInput,
  GeoLocationEntry,
  InspectionMode,
  InspectionPhoto,
  InspectionRecord,
  InspectionStage,
  InspectionStatus,
  Inspector,
  ReportSignature,
  UserRole,
} from "./types.ts";

export type { CreateInspectionInput, CreateStageInput, CustomParameterInput };

export interface ServerState {
  inspections: Record<string, InspectionRecord>;
}

const seedInspections: InspectionRecord[] = [
  {
    id: "insp-mun-2026-01",
    siteId: "site-mun-01",
    siteName: "Bavaria Turbine Assembly Plant",
    siteType: "Factory",
    location: "Werkstrasse 14, Industrial Park North, Munich, Germany",
    siteOverview:
      "Primary rotor & high-pressure hydraulic test facility. Mandatory Class-2 PPE inside Bay 3–5; verify lockout/tagout barriers on Manifold Rack B before pressure checks.",
    siteLatitude: 48.1874,
    siteLongitude: 11.6152,
    dueDate: "2026-11-24",
    inspectorId: "insp-104",
    inspectorName: "Elena Rostova (INSP-104)",
    notes: "Quarterly turbine bay safety & hydraulic line inspection",
    status: "in-progress",
    syncStatus: "synced",
    updatedAt: "2026-11-21T09:15:00.000Z",
    serverUpdatedAt: "2026-11-21T09:15:00.000Z",
    items: [
      {
        id: "item-1",
        label: "PPE & safety perimeter verified",
        status: "pass",
        note: "High-vis & lockout barriers verified at Bay 3",
        updatedAt: "2026-11-21T09:10:00.000Z",
        updatedBy: "Elena Rostova (INSP-104)",
        geoLocation: {
          id: "geo-seed-1",
          latitude: 48.18742,
          longitude: 11.61518,
          accuracyMeters: 12,
          capturedAt: "2026-11-21T09:10:00.000Z",
          offlineCaptured: false,
          source: "gps",
          label: "Param: PPE & safety perimeter verified",
        },
      },
      {
        id: "item-2",
        label: "Primary equipment & safety guards intact",
        status: "pass",
        note: "Optical light curtains tested cleanly",
        updatedAt: "2026-11-21T09:12:00.000Z",
        updatedBy: "Elena Rostova (INSP-104)",
        geoLocation: {
          id: "geo-seed-2",
          latitude: 48.18749,
          longitude: 11.61526,
          accuracyMeters: 14,
          capturedAt: "2026-11-21T09:12:00.000Z",
          offlineCaptured: false,
          source: "gps",
          label: "Param: Primary equipment & safety guards intact",
        },
      },
      {
        id: "item-3",
        label: "Emergency stop & fire extinguisher check",
        status: "pending",
        note: "",
        updatedAt: "2026-11-21T09:15:00.000Z",
        updatedBy: "Elena Rostova (INSP-104)",
        geoLocation: null,
      },
      {
        id: "item-custom-1",
        label: "Hydraulic Manifold Pressure",
        target: "180 - 210",
        unit: "bar",
        status: "pending",
        note: "Target: 180 - 210 | Unit: bar",
        updatedAt: "2026-11-21T09:15:00.000Z",
        updatedBy: "Elena Rostova (INSP-104)",
        geoLocation: null,
      },
    ],
  },
  {
    id: "insp-osa-2026-02",
    siteId: "site-osa-04",
    siteName: "Kansai Cold-Chain Packaging Hub",
    siteType: "Factory",
    location: "2-11 Nanko Kita, Suminoe Ward, Osaka, Japan",
    siteOverview:
      "Sub-zero (-20 C) automated palletizing & ammonia refrigeration hub. Confirm gas detection beacons, insulated door seals, and CO2 suppression canisters.",
    siteLatitude: 34.6295,
    siteLongitude: 135.4182,
    dueDate: "2026-11-20",
    inspectorId: "insp-104",
    inspectorName: "Elena Rostova (INSP-104)",
    notes: "Cold-chain ammonia seal & thermal calibration audit",
    status: "completed",
    syncStatus: "synced",
    updatedAt: "2026-11-20T16:40:00.000Z",
    serverUpdatedAt: "2026-11-20T16:40:00.000Z",
    items: [
      {
        id: "item-1",
        label: "PPE & safety perimeter verified",
        status: "pass",
        note: "Thermal suits & respirator seal verified",
        updatedAt: "2026-11-20T16:15:00.000Z",
        updatedBy: "Elena Rostova (INSP-104)",
        geoLocation: null,
      },
      {
        id: "item-2",
        label: "Primary equipment & safety guards intact",
        status: "pass",
        note: "Compressor housing interlocks intact",
        updatedAt: "2026-11-20T16:28:00.000Z",
        updatedBy: "Elena Rostova (INSP-104)",
        geoLocation: null,
      },
      {
        id: "item-3",
        label: "Emergency stop & fire extinguisher check",
        status: "pass",
        note: "All 6 CO2 canisters tagged Nov 2026",
        updatedAt: "2026-11-20T16:35:00.000Z",
        updatedBy: "Elena Rostova (INSP-104)",
        geoLocation: null,
      },
      {
        id: "item-custom-1",
        label: "Cold Vault Core Temp",
        target: "< -18",
        unit: "C",
        status: "pass",
        note: "Measured -19.4 C across bays A-D",
        updatedAt: "2026-11-20T16:40:00.000Z",
        updatedBy: "Elena Rostova (INSP-104)",
        geoLocation: null,
      },
    ],
  },
  {
    id: "insp-rot-2026-03",
    siteId: "site-rot-02",
    siteName: "Rhine Delta Hydroponic Greenhouse",
    siteType: "Farm",
    location: "Polderweg 88, Sector C, Rotterdam, Netherlands",
    siteOverview:
      "Controlled-environment glasshouse (14 hectares). Focus checks on automated nutrient dosing skids, pH sensor calibration, and emergency washdown valves.",
    siteLatitude: 51.9225,
    siteLongitude: 4.4792,
    dueDate: "2026-11-25",
    inspectorId: "insp-209",
    inspectorName: "Marcus Vance (INSP-209)",
    notes: "Nutrient dosing & irrigation EC validation",
    status: "pending",
    syncStatus: "synced",
    updatedAt: "2026-11-21T07:00:00.000Z",
    serverUpdatedAt: "2026-11-21T07:00:00.000Z",
    items: [
      {
        id: "item-1",
        label: "PPE & safety perimeter verified",
        status: "pending",
        note: "",
        updatedAt: "2026-11-21T07:00:00.000Z",
        updatedBy: "Marcus Vance (INSP-209)",
        geoLocation: null,
      },
      {
        id: "item-2",
        label: "Primary equipment & safety guards intact",
        status: "pending",
        note: "",
        updatedAt: "2026-11-21T07:00:00.000Z",
        updatedBy: "Marcus Vance (INSP-209)",
        geoLocation: null,
      },
      {
        id: "item-3",
        label: "Emergency stop & fire extinguisher check",
        status: "pending",
        note: "",
        updatedAt: "2026-11-21T07:00:00.000Z",
        updatedBy: "Marcus Vance (INSP-209)",
        geoLocation: null,
      },
      {
        id: "item-custom-1",
        label: "Nutrient Solution pH",
        target: "5.8 - 6.2",
        unit: "pH",
        status: "pending",
        note: "Target: 5.8 - 6.2 | Unit: pH",
        updatedAt: "2026-11-21T07:00:00.000Z",
        updatedBy: "Marcus Vance (INSP-209)",
        geoLocation: null,
      },
    ],
  },
  {
    id: "insp-aus-2026-04",
    siteId: "site-aus-03",
    siteName: "Austin Precision Stamping Works",
    siteType: "Factory",
    location: "4400 East Parmer Lane, Austin, USA",
    siteOverview:
      "600-ton servo stamping lines 1–4. Acoustic protection mandatory on press floor; inspect dual palm-button interlocks and hydraulic press light curtains.",
    siteLatitude: 30.3911,
    siteLongitude: -97.6534,
    dueDate: "2026-11-19",
    inspectorId: "insp-312",
    inspectorName: "Kenji Takahashi (INSP-312)",
    notes: "Press line 2 vibration & guard check",
    status: "completed",
    syncStatus: "synced",
    updatedAt: "2026-11-19T18:20:00.000Z",
    serverUpdatedAt: "2026-11-19T18:20:00.000Z",
    items: [
      {
        id: "item-1",
        label: "PPE & safety perimeter verified",
        status: "pass",
        note: "Hearing protection signage enforced",
        updatedAt: "2026-11-19T18:00:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
      {
        id: "item-2",
        label: "Primary equipment & safety guards intact",
        status: "pass",
        note: "Two-hand palm controls verified",
        updatedAt: "2026-11-19T18:10:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
      {
        id: "item-3",
        label: "Emergency stop & fire extinguisher check",
        status: "pass",
        note: "Passed",
        updatedAt: "2026-11-19T18:20:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
    ],
  },
  {
    id: "insp-fre-2026-05",
    siteId: "site-fre-05",
    siteName: "Central Valley Orchard Processing",
    siteType: "Farm",
    location: "1920 West Manning Ave, Fresno, USA",
    siteOverview:
      "Post-harvest stone-fruit hydro-cooling and chlorine wash-line packhouse. Verify free-chlorine dosing telemetry, conveyor pinch guards, and wastewater traps.",
    siteLatitude: 36.6052,
    siteLongitude: -119.8321,
    dueDate: "2026-11-27",
    inspectorId: "insp-312",
    inspectorName: "Kenji Takahashi (INSP-312)",
    notes: "Multi-stage packhouse hydro-cooler, chlorine dosing & pinch-guard verification",
    inspectionMode: "multi-stage",
    stages: [
      {
        id: "stage-1",
        name: "Stage 1: Receiving & Hydro-Cooling",
        order: 1,
        description: "Verify intake bin sanitization and hydro-cooler water chill temperature.",
      },
      {
        id: "stage-2",
        name: "Stage 2: Chlorine Wash-Line Dosing",
        order: 2,
        description: "Confirm free-chlorine concentration, ORP sensors, and pH balance.",
      },
      {
        id: "stage-3",
        name: "Stage 3: Conveyor Guards & Wastewater",
        order: 3,
        description: "Inspect optical pinch guards, E-stops, and discharge sediment traps.",
      },
    ],
    status: "pending",
    syncStatus: "synced",
    updatedAt: "2026-11-21T08:00:00.000Z",
    serverUpdatedAt: "2026-11-21T08:00:00.000Z",
    items: [
      {
        id: "item-s1-1",
        stageId: "stage-1",
        stageName: "Stage 1: Receiving & Hydro-Cooling",
        label: "PPE & safety perimeter verified",
        status: "pending",
        note: "",
        updatedAt: "2026-11-21T08:00:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
      {
        id: "item-s1-2",
        stageId: "stage-1",
        stageName: "Stage 1: Receiving & Hydro-Cooling",
        label: "Hydro-Cooler Sump Water Temp",
        target: "1 - 4",
        unit: "C",
        status: "pending",
        note: "Target: 1 - 4 | Unit: C",
        updatedAt: "2026-11-21T08:00:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
      {
        id: "item-s2-1",
        stageId: "stage-2",
        stageName: "Stage 2: Chlorine Wash-Line Dosing",
        label: "Wash Basin Free Chlorine",
        target: "50 - 100",
        unit: "ppm",
        status: "pending",
        note: "Target: 50 - 100 | Unit: ppm",
        updatedAt: "2026-11-21T08:00:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
      {
        id: "item-s2-2",
        stageId: "stage-2",
        stageName: "Stage 2: Chlorine Wash-Line Dosing",
        label: "Wash Solution pH Balance",
        target: "6.5 - 7.5",
        unit: "pH",
        status: "pending",
        note: "Target: 6.5 - 7.5 | Unit: pH",
        updatedAt: "2026-11-21T08:00:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
      {
        id: "item-s3-1",
        stageId: "stage-3",
        stageName: "Stage 3: Conveyor Guards & Wastewater",
        label: "Conveyor pinch guards & E-stops intact",
        status: "pending",
        note: "",
        updatedAt: "2026-11-21T08:00:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
      {
        id: "item-s3-2",
        stageId: "stage-3",
        stageName: "Stage 3: Conveyor Guards & Wastewater",
        label: "Wastewater trap turbidity",
        target: "< 25",
        unit: "NTU",
        status: "pending",
        note: "Target: < 25 | Unit: NTU",
        updatedAt: "2026-11-21T08:00:00.000Z",
        updatedBy: "Kenji Takahashi (INSP-312)",
        geoLocation: null,
      },
    ],
  },
];

const globalForServer = globalThis as unknown as {
  __fieldInspectServer?: ServerState;
};

export function getServerState(): ServerState {
  if (!globalForServer.__fieldInspectServer) {
    const inspections: Record<string, InspectionRecord> = {};
    for (const rec of seedInspections) {
      inspections[rec.id] = structuredClone(rec);
    }
    globalForServer.__fieldInspectServer = { inspections };
  }
  return globalForServer.__fieldInspectServer;
}

export function deriveStatusFromItems(items: ChecklistItem[]): InspectionStatus {
  if (items.length === 0) return "pending";
  const allChecked = items.every((item) => item.status !== "pending");
  if (allChecked) return "completed";
  const anyChecked = items.some(
    (item) => item.status !== "pending" || item.note.trim().length > 0
  );
  return anyChecked ? "in-progress" : "pending";
}

export function listInspections(): InspectionRecord[] {
  return Object.values(getServerState().inspections).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt)
  );
}

export function createInspection(
  input: CreateInspectionInput
): InspectionRecord {
  const state = getServerState();
  const now = new Date().toISOString();
  const id = `insp-${Date.now()}`;

  const validStagesInput = (input.stages ?? []).filter(
    (s) =>
      s.name.trim().length > 0 &&
      (s.includeBaselineChecks ||
        (s.parameters ?? []).some((p) => p.label.trim().length > 0))
  );

  const inspectionMode: InspectionMode =
    input.inspectionMode === "multi-stage" && validStagesInput.length > 0
      ? "multi-stage"
      : "single-stage";

  let stages: InspectionStage[] | undefined = undefined;
  let builtItems: ChecklistItem[] = [];

  if (inspectionMode === "multi-stage") {
    stages = validStagesInput.map((st, idx) => ({
      id: `stage-${idx + 1}`,
      name: st.name.trim().slice(0, 120),
      order: idx + 1,
      description: st.description?.trim().slice(0, 300) || undefined,
    }));

    validStagesInput.forEach((st, sIdx) => {
      const stageId = `stage-${sIdx + 1}`;
      const stageName = st.name.trim().slice(0, 120);

      if (st.includeBaselineChecks) {
        builtItems.push(
          {
            id: `item-s${sIdx + 1}-base-1`,
            stageId,
            stageName,
            label: "PPE & safety perimeter verified",
            status: "pending",
            note: "",
            updatedAt: now,
            updatedBy: input.inspectorName,
            geoLocation: null,
          },
          {
            id: `item-s${sIdx + 1}-base-2`,
            stageId,
            stageName,
            label: "Primary equipment & safety guards intact",
            status: "pending",
            note: "",
            updatedAt: now,
            updatedBy: input.inspectorName,
            geoLocation: null,
          }
        );
      }

      const stageParams = (st.parameters ?? []).filter(
        (p) => p.label.trim().length > 0
      );
      stageParams.forEach((param, pIdx) => {
        const target = param.target?.trim() || undefined;
        const unit = param.unit?.trim() || undefined;
        const noteParts = [
          target ? `Target: ${target}` : "",
          unit ? `Unit: ${unit}` : "",
        ].filter(Boolean);

        builtItems.push({
          id: `item-s${sIdx + 1}-p${pIdx + 1}`,
          stageId,
          stageName,
          label: param.label.trim(),
          target,
          unit,
          status: "pending",
          note: noteParts.join(" | "),
          updatedAt: now,
          updatedBy: input.inspectorName,
          geoLocation: null,
        });
      });
    });
  } else {
    const defaultItems: ChecklistItem[] = [
      {
        id: "item-1",
        label: "PPE & safety perimeter verified",
        status: "pending",
        note: "",
        updatedAt: now,
        updatedBy: input.inspectorName,
        geoLocation: null,
      },
      {
        id: "item-2",
        label: "Primary equipment & safety guards intact",
        status: "pending",
        note: "",
        updatedAt: now,
        updatedBy: input.inspectorName,
        geoLocation: null,
      },
      {
        id: "item-3",
        label: "Emergency stop & fire extinguisher check",
        status: "pending",
        note: "",
        updatedAt: now,
        updatedBy: input.inspectorName,
        geoLocation: null,
      },
    ];

    const customItems: ChecklistItem[] = (input.customParameters ?? [])
      .filter((p) => p.label.trim().length > 0)
      .map((param, idx) => {
        const target = param.target?.trim() || undefined;
        const unit = param.unit?.trim() || undefined;
        const noteParts = [
          target ? `Target: ${target}` : "",
          unit ? `Unit: ${unit}` : "",
        ].filter(Boolean);

        return {
          id: `item-custom-${idx + 1}`,
          label: param.label.trim(),
          target,
          unit,
          status: "pending",
          note: noteParts.join(" | "),
          updatedAt: now,
          updatedBy: input.inspectorName,
          geoLocation: null,
        };
      });

    builtItems = [...defaultItems, ...customItems];
  }

  const record: InspectionRecord = {
    id,
    siteId: input.siteId,
    siteName: input.siteName.trim(),
    siteType: input.siteType ?? "Factory",
    location: input.location?.trim() || undefined,
    siteOverview: input.siteOverview?.trim() || undefined,
    siteLatitude: input.siteLatitude,
    siteLongitude: input.siteLongitude,
    dueDate: input.dueDate.trim(),
    inspectorId: input.inspectorId,
    inspectorName: input.inspectorName.trim(),
    notes: input.notes?.trim() || undefined,
    inspectionMode,
    stages,
    status: "pending",
    syncStatus: "synced",
    updatedAt: now,
    serverUpdatedAt: now,
    conflictQueue: [],
    items: builtItems,
    geoLocation: null,
    geoTrail: [],
    photos: [],
    arrivalVerification: null,
    inspectorSignature: null,
    supervisorValidation: null,
  };

  state.inspections[record.id] = record;
  return record;
}

export function updateInspectionOnServer(
  id: string,
  patch: Partial<InspectionRecord>
): InspectionRecord | null {
  const state = getServerState();
  const existing = state.inspections[id];
  if (!existing) return null;

  const now = new Date().toISOString();
  const nextItems = Array.isArray(patch.items) ? patch.items : existing.items;
  const nextStatus = patch.status ?? deriveStatusFromItems(nextItems);

  const updated: InspectionRecord = {
    ...existing,
    ...patch,
    id: existing.id,
    items: nextItems,
    status: nextStatus,
    syncStatus: "synced",
    updatedAt: now,
    serverUpdatedAt: now,
    serverSnapshot: null,
  };

  state.inspections[id] = updated;
  return updated;
}

export function resolveConflictBySupervisor(
  id: string,
  options: {
    supervisorName: string;
    strategy?: "accept-server" | "apply-submission" | "custom-merge";
    submissionId?: string;
    items?: ChecklistItem[];
    notes?: string;
  }
): InspectionRecord | null {
  const state = getServerState();
  const existing = state.inspections[id];
  if (!existing) return null;

  const now = new Date().toISOString();
  const queue = existing.conflictQueue ?? [];
  const selectedSubmission = options.submissionId
    ? queue.find((s) => s.id === options.submissionId)
    : undefined;

  let resolvedItems = existing.items;
  let resolvedNotes =
    options.notes !== undefined ? options.notes.trim() : existing.notes;
  let resolvedArrival = existing.arrivalVerification ?? null;
  let resolvedPhotos = existing.photos ?? [];
  let resolvedGeo = existing.geoLocation ?? null;

  if (options.strategy === "apply-submission" && selectedSubmission) {
    resolvedItems = sanitizeChecklistItems(
      selectedSubmission.items,
      existing.items,
      options.supervisorName
    );
    if (selectedSubmission.notes !== undefined) {
      resolvedNotes = selectedSubmission.notes;
    }
    if (selectedSubmission.arrivalVerification) {
      resolvedArrival = selectedSubmission.arrivalVerification;
    }
    if (
      Array.isArray(selectedSubmission.photos) &&
      selectedSubmission.photos.length > 0
    ) {
      resolvedPhotos = selectedSubmission.photos;
    }
    if (selectedSubmission.geoLocation) {
      resolvedGeo = selectedSubmission.geoLocation;
    }
  } else if (options.strategy !== "accept-server" && Array.isArray(options.items)) {
    resolvedItems = sanitizeChecklistItems(
      options.items,
      existing.items,
      options.supervisorName
    );
  }

  const updated: InspectionRecord = {
    ...existing,
    items: resolvedItems,
    notes: resolvedNotes,
    arrivalVerification: resolvedArrival,
    photos: resolvedPhotos,
    geoLocation: resolvedGeo,
    status: deriveStatusFromItems(resolvedItems),
    syncStatus: "synced",
    updatedAt: now,
    serverUpdatedAt: now,
    serverSnapshot: null,
    conflictQueue: [],
  };
  state.inspections[id] = updated;
  return updated;
}

export interface SyncInspectionResult {
  synced: InspectionRecord[];
  conflicts: Array<{
    id: string;
    serverRecord: InspectionRecord;
  }>;
}

export function syncInspectionsFromClient(
  clientRecords: InspectionRecord[],
  forceIds: string[] = [],
  actor?: { name: string; role: UserRole }
): SyncInspectionResult {
  const state = getServerState();
  const synced: InspectionRecord[] = [];
  const conflicts: Array<{ id: string; serverRecord: InspectionRecord }> = [];
  const forceSet = new Set(forceIds);

  for (const clientRec of clientRecords) {
    const existing = state.inspections[clientRec.id];
    const now = new Date().toISOString();

    if (!existing) {
      const normalized: InspectionRecord = {
        ...clientRec,
        status: deriveStatusFromItems(clientRec.items),
        syncStatus: "synced",
        updatedAt: now,
        serverUpdatedAt: now,
        serverSnapshot: null,
        conflictQueue: [],
      };
      state.inspections[normalized.id] = normalized;
      synced.push(normalized);
      continue;
    }

    const clientBaseTime = new Date(
      clientRec.serverUpdatedAt || existing.serverUpdatedAt || 0
    ).getTime();
    const serverTime = new Date(
      existing.serverUpdatedAt || existing.updatedAt
    ).getTime();

    const alreadyConflictedOnServer =
      existing.syncStatus === "conflict" || existing.status === "conflict";

    if (
      !forceSet.has(clientRec.id) &&
      (serverTime > clientBaseTime || alreadyConflictedOnServer)
    ) {
      const submitter = actor?.name || clientRec.inspectorName;
      const submitterRole: UserRole = actor?.role ?? "inspector";
      const submission: ConflictSubmission = {
        id: `csub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        submittedBy: submitter,
        submittedByRole: submitterRole,
        submittedAt: now,
        baseServerUpdatedAt: clientRec.serverUpdatedAt,
        items: structuredClone(clientRec.items),
        notes: clientRec.notes,
        arrivalVerification: clientRec.arrivalVerification ?? null,
        photos: Array.isArray(clientRec.photos) ? clientRec.photos : [],
        geoLocation: clientRec.geoLocation ?? null,
      };

      const prevQueue = Array.isArray(existing.conflictQueue)
        ? existing.conflictQueue.filter((c) => c.submittedBy !== submitter)
        : [];
      const nextServerRecord: InspectionRecord = {
        ...existing,
        status: "conflict",
        syncStatus: "conflict",
        updatedAt: now,
        conflictQueue: [...prevQueue, submission].slice(-10),
      };
      state.inspections[existing.id] = nextServerRecord;

      conflicts.push({
        id: clientRec.id,
        serverRecord: structuredClone(nextServerRecord),
      });
      continue;
    }

    const updated: InspectionRecord = {
      ...existing,
      ...clientRec,
      id: existing.id,
      siteId: existing.siteId,
      siteName: existing.siteName,
      siteType: existing.siteType,
      location: existing.location,
      siteOverview: existing.siteOverview,
      siteLatitude: existing.siteLatitude,
      siteLongitude: existing.siteLongitude,
      inspectionMode: existing.inspectionMode,
      stages: existing.stages,
      inspectorId: existing.inspectorId,
      inspectorName: existing.inspectorName,
      status: deriveStatusFromItems(clientRec.items),
      syncStatus: "synced",
      updatedAt: now,
      serverUpdatedAt: now,
      serverSnapshot: null,
      conflictQueue: [],
      geoLocation: clientRec.geoLocation ?? existing.geoLocation ?? null,
      geoTrail: Array.isArray(clientRec.geoTrail)
        ? clientRec.geoTrail
        : existing.geoTrail ?? [],
      photos: Array.isArray(clientRec.photos)
        ? clientRec.photos
        : existing.photos ?? [],
      arrivalVerification:
        clientRec.arrivalVerification !== undefined
          ? clientRec.arrivalVerification
          : existing.arrivalVerification ?? null,
      inspectorSignature:
        clientRec.inspectorSignature !== undefined
          ? clientRec.inspectorSignature
          : existing.inspectorSignature ?? null,
      supervisorValidation: existing.supervisorValidation ?? null,
    };
    state.inspections[existing.id] = updated;
    synced.push(updated);
  }

  return { synced, conflicts };
}

export function validateInspectionBySupervisor(
  id: string,
  signature: ReportSignature
): InspectionRecord | null {
  const state = getServerState();
  const existing = state.inspections[id];
  if (!existing) return null;

  const now = new Date().toISOString();
  const updated: InspectionRecord = {
    ...existing,
    supervisorValidation: signature,
    updatedAt: now,
    serverUpdatedAt: now,
    syncStatus: "synced",
    serverSnapshot: null,
  };
  state.inspections[id] = updated;
  return updated;
}

export function isInspectionAssignedToInspector(
  record: InspectionRecord,
  inspector: Pick<Inspector, "id" | "name" | "code">
): boolean {
  if (record.inspectorId && record.inspectorId === inspector.id) {
    return true;
  }
  const raw = (record.inspectorName || "").trim().toLowerCase();
  if (!raw) return false;
  const fullName = inspector.name.trim().toLowerCase();
  const code = inspector.code.trim().toLowerCase();
  return raw === fullName || raw === code || raw.includes(code);
}

export function sanitizeChecklistItems(
  rawItems: unknown,
  fallbackItems: ChecklistItem[],
  fallbackUpdatedBy: string
): ChecklistItem[] {
  if (!Array.isArray(rawItems)) return fallbackItems;
  const allowedStatus = new Set<ChecklistItemStatus>([
    "pending",
    "pass",
    "fail",
  ]);
  const cleaned: ChecklistItem[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<ChecklistItem>;
    const id = typeof item.id === "string" ? item.id.trim().slice(0, 80) : "";
    const label =
      typeof item.label === "string" ? item.label.trim().slice(0, 200) : "";
    if (!id || !label) continue;
    const status: ChecklistItemStatus =
      item.status && allowedStatus.has(item.status) ? item.status : "pending";
    const geoLocation = item.geoLocation
      ? sanitizeGeoEntry(item.geoLocation)
      : null;

    cleaned.push({
      id,
      label,
      target:
        typeof item.target === "string"
          ? item.target.trim().slice(0, 80) || undefined
          : undefined,
      unit:
        typeof item.unit === "string"
          ? item.unit.trim().slice(0, 40) || undefined
          : undefined,
      stageId:
        typeof item.stageId === "string"
          ? item.stageId.trim().slice(0, 60) || undefined
          : undefined,
      stageName:
        typeof item.stageName === "string"
          ? item.stageName.trim().slice(0, 120) || undefined
          : undefined,
      status,
      note:
        typeof item.note === "string" ? item.note.slice(0, 1000) : "",
      updatedAt:
        typeof item.updatedAt === "string"
          ? item.updatedAt
          : new Date().toISOString(),
      updatedBy:
        typeof item.updatedBy === "string"
          ? item.updatedBy.trim().slice(0, 120)
          : fallbackUpdatedBy,
      geoLocation,
    });
  }
  return cleaned.length > 0 ? cleaned : fallbackItems;
}

export function sanitizeGeoEntry(
  entry: GeoLocationEntry
): GeoLocationEntry | null {
  if (
    typeof entry.latitude !== "number" ||
    typeof entry.longitude !== "number" ||
    !Number.isFinite(entry.latitude) ||
    !Number.isFinite(entry.longitude) ||
    entry.latitude < -90 ||
    entry.latitude > 90 ||
    entry.longitude < -180 ||
    entry.longitude > 180
  ) {
    return null;
  }
  return {
    id: String(entry.id || `geo-${Date.now()}`),
    latitude: Number(entry.latitude.toFixed(6)),
    longitude: Number(entry.longitude.toFixed(6)),
    accuracyMeters:
      typeof entry.accuracyMeters === "number" &&
      Number.isFinite(entry.accuracyMeters)
        ? Math.round(entry.accuracyMeters)
        : null,
    capturedAt: String(entry.capturedAt || new Date().toISOString()),
    offlineCaptured: Boolean(entry.offlineCaptured),
    source: entry.source === "manual-offline" ? "manual-offline" : "gps",
    label:
      typeof entry.label === "string"
        ? entry.label.trim().slice(0, 120)
        : undefined,
  };
}

export function sanitizePhotoEntry(
  photo: InspectionPhoto
): InspectionPhoto | null {
  if (typeof photo.dataUrl !== "string") return null;
  const validPrefix =
    photo.dataUrl.startsWith("data:image/jpeg;base64,") ||
    photo.dataUrl.startsWith("data:image/png;base64,") ||
    photo.dataUrl.startsWith("data:image/webp;base64,");
  if (!validPrefix || photo.dataUrl.length > 2_000_000) return null;

  return {
    id: String(photo.id || `photo-${Date.now()}`),
    dataUrl: photo.dataUrl,
    caption:
      typeof photo.caption === "string"
        ? photo.caption.trim().slice(0, 200)
        : "",
    itemId: typeof photo.itemId === "string" ? photo.itemId : undefined,
    capturedAt: String(photo.capturedAt || new Date().toISOString()),
    offlineCaptured: Boolean(photo.offlineCaptured),
    geoTag:
      photo.geoTag &&
      typeof photo.geoTag.latitude === "number" &&
      typeof photo.geoTag.longitude === "number" &&
      Number.isFinite(photo.geoTag.latitude) &&
      Number.isFinite(photo.geoTag.longitude)
        ? {
            latitude: Number(photo.geoTag.latitude.toFixed(6)),
            longitude: Number(photo.geoTag.longitude.toFixed(6)),
          }
        : undefined,
  };
}

export function sanitizeSignature(
  sig: ReportSignature | null | undefined
): ReportSignature | null {
  if (!sig || typeof sig.dataUrl !== "string") return null;
  if (
    !sig.dataUrl.startsWith("data:image/png;base64,") ||
    sig.dataUrl.length > 600_000
  ) {
    return null;
  }
  return {
    dataUrl: sig.dataUrl,
    signerName: String(sig.signerName || "").trim().slice(0, 120),
    signerRole: sig.signerRole === "supervisor" ? "supervisor" : "inspector",
    signedAt: String(sig.signedAt || new Date().toISOString()),
    latitude:
      typeof sig.latitude === "number" && Number.isFinite(sig.latitude)
        ? Number(sig.latitude.toFixed(6))
        : undefined,
    longitude:
      typeof sig.longitude === "number" && Number.isFinite(sig.longitude)
        ? Number(sig.longitude.toFixed(6))
        : undefined,
  };
}

export function computeDistanceMeters(
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

export function sanitizeArrivalVerification(
  raw: ArrivalVerification | null | undefined,
  fallbackActorName: string,
  siteLat?: number,
  siteLng?: number
): ArrivalVerification | null {
  if (!raw || typeof raw !== "object" || typeof raw.photoDataUrl !== "string") {
    return null;
  }
  const isImage =
    raw.photoDataUrl.startsWith("data:image/jpeg;base64,") ||
    raw.photoDataUrl.startsWith("data:image/png;base64,") ||
    raw.photoDataUrl.startsWith("data:image/webp;base64,");
  const isVideo =
    raw.photoDataUrl.startsWith("data:video/webm;") ||
    raw.photoDataUrl.startsWith("data:video/mp4;") ||
    raw.photoDataUrl.startsWith("data:video/quicktime;");

  if ((!isImage && !isVideo) || raw.photoDataUrl.length > 5_000_000) {
    return null;
  }

  const hasValidCoords =
    typeof raw.latitude === "number" &&
    typeof raw.longitude === "number" &&
    Number.isFinite(raw.latitude) &&
    Number.isFinite(raw.longitude) &&
    raw.latitude >= -90 &&
    raw.latitude <= 90 &&
    raw.longitude >= -180 &&
    raw.longitude <= 180;

  const latitude = hasValidCoords ? Number(raw.latitude!.toFixed(6)) : null;
  const longitude = hasValidCoords ? Number(raw.longitude!.toFixed(6)) : null;

  const distanceFromSiteMeters =
    latitude !== null &&
    longitude !== null &&
    typeof siteLat === "number" &&
    typeof siteLng === "number" &&
    Number.isFinite(siteLat) &&
    Number.isFinite(siteLng)
      ? computeDistanceMeters(latitude, longitude, siteLat, siteLng)
      : null;

  const parsedDate =
    typeof raw.capturedAt === "string" && !Number.isNaN(Date.parse(raw.capturedAt))
      ? new Date(raw.capturedAt).toISOString()
      : new Date().toISOString();

  return {
    mediaType: isVideo ? "video" : "image",
    photoDataUrl: raw.photoDataUrl,
    capturedAt: parsedDate,
    latitude,
    longitude,
    accuracyMeters:
      typeof raw.accuracyMeters === "number" &&
      Number.isFinite(raw.accuracyMeters)
        ? Math.max(0, Math.round(raw.accuracyMeters))
        : null,
    distanceFromSiteMeters,
    offlineCaptured: Boolean(raw.offlineCaptured),
    verifiedByName:
      typeof raw.verifiedByName === "string" && raw.verifiedByName.trim()
        ? raw.verifiedByName.trim().slice(0, 120)
        : fallbackActorName,
    note:
      typeof raw.note === "string" && raw.note.trim()
        ? raw.note.trim().slice(0, 200)
        : undefined,
  };
}

export function simulateServerConflict(id: string): InspectionRecord | null {
  const state = getServerState();
  const existing = state.inspections[id];
  if (!existing) return null;

  const now = new Date(Date.now() + 2000).toISOString();
  const updatedItems = existing.items.map((item, idx) => {
    if (idx === 0) {
      return {
        ...item,
        status: item.status === "fail" ? ("pass" as const) : ("fail" as const),
        note: "Central QA Override: Recheck required after remote telemetry flag",
        updatedAt: now,
        updatedBy: "Central Dispatch QA",
      };
    }
    return item;
  });

  const updated: InspectionRecord = {
    ...existing,
    items: updatedItems,
    status: deriveStatusFromItems(updatedItems),
    syncStatus: "synced",
    updatedAt: now,
    serverUpdatedAt: now,
    serverSnapshot: null,
  };

  state.inspections[id] = updated;
  return updated;
}
