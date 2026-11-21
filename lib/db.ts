import Dexie, { type Table } from "dexie";

export type CheckStatus = "pending" | "pass" | "fail";

export interface GpsCoords {
  lat: number;
  lng: number;
  accuracy?: number;
  capturedAt: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  status: CheckStatus;
  note: string;
  photoDataUrl?: string;
  gps?: GpsCoords;
  updatedAt: string;
  updatedBy: string;
}

export type SyncStatus = "synced" | "pending" | "conflict";

export interface InspectionRecord {
  id: string;
  siteName: string;
  siteType: "Construction" | "Farm" | "Factory";
  dueDate: string;
  inspectorName: string;
  items: ChecklistItem[];
  signatureDataUrl?: string;
  signedAt?: string;
  syncStatus: SyncStatus;
  updatedAt: string;
}

export interface SyncQueueItem {
  id?: number;
  inspectionId: string;
  payload: InspectionRecord;
  queuedAt: string;
}

class FieldInspectDB extends Dexie {
  inspections!: Table<InspectionRecord, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super("FieldInspectOfflineDB");
    this.version(1).stores({
      inspections: "id, siteName, dueDate, syncStatus, updatedAt",
      syncQueue: "++id, inspectionId, queuedAt",
    });
  }
}

export const db = new FieldInspectDB();

export async function seedInitialInspections(): Promise<void> {
  const count = await db.inspections.count();
  if (count > 0) return;

  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000 * 2)
    .toISOString()
    .slice(0, 10);
  const nextWeek = new Date(Date.now() + 86400000 * 5)
    .toISOString()
    .slice(0, 10);

  const initialRecords: InspectionRecord[] = [
    {
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
    },
    {
      id: "insp-farm-02",
      siteName: "Alwar Drip & Solar Pump Sector 4",
      siteType: "Farm",
      dueDate: yesterday,
      inspectorName: "Meera (Inspector B)",
      syncStatus: "pending",
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
    },
  ];

  await db.inspections.bulkPut(initialRecords);
}