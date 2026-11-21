import type { ChecklistItem, InspectionRecord } from "./db";

export interface ItemConflict {
  conflictId: string;
  inspectionId: string;
  siteName: string;
  itemId: string;
  itemLabel: string;
  serverItem: ChecklistItem;
  incomingItem: ChecklistItem;
  detectedAt: string;
  resolved: boolean;
}

interface ServerState {
  inspections: Record<string, InspectionRecord>;
  conflicts: ItemConflict[];
}

const globalForStore = globalThis as unknown as {
  __fieldInspectServerState?: ServerState;
};

function createSeedState(): ServerState {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000 * 2)
    .toISOString()
    .slice(0, 10);
  const nextWeek = new Date(Date.now() + 86400000 * 5)
    .toISOString()
    .slice(0, 10);

  const r1: InspectionRecord = {
    id: "insp-factory-01",
    siteName: "Jaipur Steel & Press — Bay 2",
    siteType: "Factory",
    dueDate: nextWeek,
    inspectorName: "Aarav (Inspector A)",
    syncStatus: "synced",
    updatedAt: now,
    items: [
      {
        id: "item-1",
        label: "Emergency stop buttons accessible and unobstructed",
        status: "pass",
        note: "Tested on main press line",
        updatedAt: now,
        updatedBy: "Aarav (Inspector A)",
      },
      {
        id: "item-2",
        label: "Machine safety guards bolted and intact",
        status: "pending",
        note: "",
        updatedAt: now,
        updatedBy: "Aarav (Inspector A)",
      },
      {
        id: "item-3",
        label: "Fire extinguisher pressure gauge in green zone",
        status: "pending",
        note: "",
        updatedAt: now,
        updatedBy: "Aarav (Inspector A)",
      },
    ],
  };

  const r2: InspectionRecord = {
    id: "insp-farm-02",
    siteName: "Alwar Drip & Solar Pump Sector 4",
    siteType: "Farm",
    dueDate: yesterday,
    inspectorName: "Meera (Inspector B)",
    syncStatus: "synced",
    updatedAt: now,
    items: [
      {
        id: "item-1",
        label: "Solar inverter junction box sealed against dust/moisture",
        status: "fail",
        note: "Rubber gasket slightly loose on unit #3",
        updatedAt: now,
        updatedBy: "Meera (Inspector B)",
      },
      {
        id: "item-2",
        label: "Main irrigation valve pressure within 1.5–2.5 bar",
        status: "pending",
        note: "",
        updatedAt: now,
        updatedBy: "Meera (Inspector B)",
      },
    ],
  };

  return {
    inspections: {
      [r1.id]: r1,
      [r2.id]: r2,
    },
    conflicts: [],
  };
}

export function getServerState(): ServerState {
  if (!globalForStore.__fieldInspectServerState) {
    globalForStore.__fieldInspectServerState = createSeedState();
  }
  return globalForStore.__fieldInspectServerState;
}

function itemsDifferMeaningfully(a: ChecklistItem, b: ChecklistItem): boolean {
  return (
    a.status !== b.status ||
    a.note.trim() !== b.note.trim() ||
    (a.photoDataUrl || "") !== (b.photoDataUrl || "")
  );
}

export function mergeInspectionSync(incoming: InspectionRecord): {
  record: InspectionRecord;
  newConflicts: ItemConflict[];
} {
  const state = getServerState();
  const existing = state.inspections[incoming.id];
  const newConflicts: ItemConflict[] = [];

  if (!existing) {
    const cleanRecord: InspectionRecord = {
      ...incoming,
      syncStatus: "synced",
      updatedAt: new Date().toISOString(),
    };
    state.inspections[incoming.id] = cleanRecord;
    return { record: cleanRecord, newConflicts };
  }

  const existingMap = new Map<string, ChecklistItem>(
    existing.items.map((item) => [item.id, item])
  );

  const mergedItems: ChecklistItem[] = incoming.items.map((incItem) => {
    const srvItem = existingMap.get(incItem.id);
    if (!srvItem) return incItem;

    const differentContent = itemsDifferMeaningfully(srvItem, incItem);
    const differentInspector =
      srvItem.updatedBy &&
      incItem.updatedBy &&
      srvItem.updatedBy !== incItem.updatedBy;

    const srvWasAlreadyModified =
      srvItem.status !== "pending" || Boolean(srvItem.note);

    if (differentContent && differentInspector && srvWasAlreadyModified) {
      const existingOpenConflict = state.conflicts.find(
        (c) =>
          !c.resolved &&
          c.inspectionId === incoming.id &&
          c.itemId === incItem.id
      );

      if (existingOpenConflict) {
        existingOpenConflict.incomingItem = incItem;
        existingOpenConflict.detectedAt = new Date().toISOString();
      } else {
        const conflict: ItemConflict = {
          conflictId: `${incoming.id}-${incItem.id}-${Date.now()}`,
          inspectionId: incoming.id,
          siteName: incoming.siteName,
          itemId: incItem.id,
          itemLabel: incItem.label,
          serverItem: srvItem,
          incomingItem: incItem,
          detectedAt: new Date().toISOString(),
          resolved: false,
        };
        newConflicts.push(conflict);
        state.conflicts.unshift(conflict);
      }
      return srvItem;
    }

    const incTime = new Date(incItem.updatedAt || 0).getTime();
    const srvTime = new Date(srvItem.updatedAt || 0).getTime();
    return incTime >= srvTime ? incItem : srvItem;
  });

  const hasOpenConflict = state.conflicts.some(
    (c) => c.inspectionId === incoming.id && !c.resolved
  );

  const mergedRecord: InspectionRecord = {
    ...existing,
    ...incoming,
    items: mergedItems,
    signatureDataUrl: incoming.signatureDataUrl || existing.signatureDataUrl,
    signedAt: incoming.signedAt || existing.signedAt,
    syncStatus: hasOpenConflict ? "conflict" : "synced",
    updatedAt: new Date().toISOString(),
  };

  state.inspections[incoming.id] = mergedRecord;
  return { record: mergedRecord, newConflicts };
}

export function resolveItemConflict(
  conflictId: string,
  choice: "server" | "incoming"
): InspectionRecord | null {
  const state = getServerState();
  const conflict = state.conflicts.find((c) => c.conflictId === conflictId);
  if (!conflict) return null;

  const record = state.inspections[conflict.inspectionId];
  if (!record) return null;

  const winningItem =
    choice === "incoming" ? conflict.incomingItem : conflict.serverItem;

  record.items = record.items.map((item) =>
    item.id === conflict.itemId
      ? {
          ...winningItem,
          updatedAt: new Date().toISOString(),
        }
      : item
  );

  conflict.resolved = true;

  const stillHasConflicts = state.conflicts.some(
    (c) => c.inspectionId === record.id && !c.resolved
  );
  record.syncStatus = stillHasConflicts ? "conflict" : "synced";
  record.updatedAt = new Date().toISOString();

  state.inspections[record.id] = record;
  return record;
}