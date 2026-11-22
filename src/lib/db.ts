import Dexie, { type Table } from "dexie";
import type { InspectionRecord, Site } from "./types.ts";

export class FieldInspectDatabase extends Dexie {
  inspections!: Table<InspectionRecord, string>;
  sites!: Table<Site, string>;

  constructor() {
    super("FieldInspectDB");
    this.version(1).stores({
      inspections: "id, siteId, inspectorId, status, syncStatus, updatedAt",
    });
    this.version(2).stores({
      inspections: "id, siteId, inspectorId, status, syncStatus, updatedAt",
      sites: "id, code, active",
    });
  }
}

export const db = new FieldInspectDatabase();

export async function cacheSitesToDb(sites: Site[]): Promise<void> {
  await db.transaction("rw", db.sites, async () => {
    await db.sites.clear();
    if (sites.length > 0) {
      await db.sites.bulkPut(sites);
    }
  });
}

export async function getAllLocalSites(): Promise<Site[]> {
  const all = await db.sites.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getAllLocalInspections(): Promise<InspectionRecord[]> {
  const all = await db.inspections.toArray();
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function pullServerInspectionsToDb(
  serverInspections: InspectionRecord[]
): Promise<number> {
  let addedOrUpdated = 0;

  await db.transaction("rw", db.inspections, async () => {
    for (const remote of serverInspections) {
      const local = await db.inspections.get(remote.id);

      if (!local) {
        await db.inspections.put({
          ...remote,
          syncStatus: remote.syncStatus ?? "synced",
          serverUpdatedAt: remote.serverUpdatedAt ?? remote.updatedAt,
          serverSnapshot: null,
        });
        addedOrUpdated++;
        continue;
      }

      const remoteTime = new Date(
        remote.serverUpdatedAt || remote.updatedAt || 0
      ).getTime();
      const localTime = new Date(
        local.serverUpdatedAt || local.updatedAt || 0
      ).getTime();
      const queueChanged =
        (remote.conflictQueue?.length ?? 0) !==
        (local.conflictQueue?.length ?? 0);

      if (
        (local.syncStatus === "synced" &&
          (remoteTime > localTime ||
            queueChanged ||
            remote.syncStatus !== local.syncStatus)) ||
        (local.syncStatus === "conflict" &&
          ((remote.syncStatus === "synced" && remoteTime >= localTime) ||
            (remote.syncStatus === "conflict" && queueChanged)))
      ) {
        await db.inspections.put({
          ...remote,
          syncStatus: remote.syncStatus ?? "synced",
          serverUpdatedAt: remote.serverUpdatedAt ?? remote.updatedAt,
          serverSnapshot:
            remote.syncStatus === "conflict" ? remote : null,
          conflictQueue: remote.conflictQueue ?? [],
        });
        addedOrUpdated++;
      }
    }
  });

  return addedOrUpdated;
}

export async function saveLocalInspectionEdit(
  record: InspectionRecord
): Promise<InspectionRecord> {
  const updated: InspectionRecord = {
    ...record,
    syncStatus: record.syncStatus === "conflict" ? "conflict" : "pending",
    updatedAt: new Date().toISOString(),
  };
  await db.inspections.put(updated);
  return updated;
}

export async function markInspectionsSynced(
  syncedRecords: InspectionRecord[]
): Promise<void> {
  await db.transaction("rw", db.inspections, async () => {
    for (const rec of syncedRecords) {
      await db.inspections.put({
        ...rec,
        syncStatus: "synced",
        serverUpdatedAt: rec.serverUpdatedAt ?? rec.updatedAt,
        serverSnapshot: null,
        conflictQueue: [],
      });
    }
  });
}

export async function markInspectionsConflict(
  conflicts: Array<{ id: string; serverRecord: InspectionRecord }>
): Promise<void> {
  await db.transaction("rw", db.inspections, async () => {
    for (const c of conflicts) {
      const local = await db.inspections.get(c.id);
      if (!local) continue;
      await db.inspections.put({
        ...local,
        status: "conflict",
        syncStatus: "conflict",
        serverSnapshot: c.serverRecord,
        conflictQueue: c.serverRecord.conflictQueue ?? local.conflictQueue ?? [],
      });
    }
  });
}

export async function acceptServerVersion(
  serverRecord: InspectionRecord
): Promise<InspectionRecord> {
  const clean: InspectionRecord = {
    ...serverRecord,
    syncStatus: "synced",
    serverUpdatedAt: serverRecord.serverUpdatedAt ?? serverRecord.updatedAt,
    serverSnapshot: null,
    conflictQueue: [],
  };
  await db.inspections.put(clean);
  return clean;
}
