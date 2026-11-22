import type { Inspector, Site } from "./types.ts";

export interface InspectionRecordForWorkload {
  id: string;
  siteId?: string;
  siteName?: string;
  location?: string;
  inspector?: string;
  inspectorName?: string;
  inspectorId?: string;
  status?: "pending" | "in-progress" | "completed" | "conflict" | string;
  syncStatus?: "synced" | "pending" | "conflict" | string;
}

export interface InspectorWorkload {
  inspectorId: string;
  currentInspectionSite: Site | null;
  assignedSites: Site[];
  pendingSites: Site[];
  completedSites: Site[];
  counts: {
    assigned: number;
    pending: number;
    completed: number;
  };
}

function matchesInspector(
  record: InspectionRecordForWorkload,
  inspector: Inspector
): boolean {
  if (record.inspectorId && record.inspectorId === inspector.id) {
    return true;
  }
  const raw = record.inspectorName || record.inspector || "";
  if (!raw) return false;

  const recVal = raw.trim().toLowerCase();
  const fullName = inspector.name.trim().toLowerCase();
  const code = inspector.code.trim().toLowerCase();
  const firstName = fullName.split(/\s+/)[0];

  return (
    recVal === fullName ||
    recVal === code ||
    recVal.includes(code) ||
    (firstName.length > 1 && recVal.includes(firstName))
  );
}

function resolveSite(
  record: InspectionRecordForWorkload,
  sites: Site[]
): Site | undefined {
  if (record.siteId) {
    const byId = sites.find((s) => s.id === record.siteId);
    if (byId) return byId;
  }

  const candidate = (record.siteName || record.location || "")
    .trim()
    .toLowerCase();
  if (!candidate) return undefined;

  return sites.find((s) => {
    const siteName = s.name.toLowerCase();
    const siteLoc = `${s.location}, ${s.city}`.toLowerCase();
    return (
      siteName === candidate ||
      siteName.includes(candidate) ||
      candidate.includes(siteName) ||
      siteLoc.includes(candidate)
    );
  });
}

function isInspectionCompleted(rec: InspectionRecordForWorkload): boolean {
  if (rec.status === "completed") return true;
  if (
    rec.status === "conflict" ||
    rec.status === "pending" ||
    rec.status === "in-progress"
  ) {
    return false;
  }
  return rec.syncStatus === "synced";
}

export function computeInspectorWorkload(
  inspector: Inspector,
  sites: Site[],
  inspections: InspectionRecordForWorkload[]
): InspectorWorkload {
  const activeSites = sites.filter((s) => s.active);

  const assignedSites = activeSites.filter((s) =>
    s.assignedInspectorIds.includes(inspector.id)
  );

  const inspectorInspections = inspections.filter((rec) =>
    matchesInspector(rec, inspector)
  );

  const completedSiteIds = new Set<string>();
  const pendingSiteIds = new Set<string>();
  let currentInspectionSite: Site | null = null;

  for (const rec of inspectorInspections) {
    const matchedSite = resolveSite(rec, activeSites);
    if (!matchedSite) continue;

    if (isInspectionCompleted(rec)) {
      completedSiteIds.add(matchedSite.id);
    } else {
      pendingSiteIds.add(matchedSite.id);
      if (
        !currentInspectionSite &&
        (rec.status === "in-progress" ||
          rec.status === "pending" ||
          rec.status === "conflict")
      ) {
        currentInspectionSite = matchedSite;
      }
    }
  }

  for (const site of assignedSites) {
    if (!completedSiteIds.has(site.id)) {
      pendingSiteIds.add(site.id);
      if (!currentInspectionSite) {
        currentInspectionSite = site;
      }
    }
  }

  const pendingSites = activeSites.filter((s) => pendingSiteIds.has(s.id));
  const completedSites = activeSites.filter((s) => completedSiteIds.has(s.id));

  return {
    inspectorId: inspector.id,
    currentInspectionSite,
    assignedSites,
    pendingSites,
    completedSites,
    counts: {
      assigned: assignedSites.length,
      pending: pendingSites.length,
      completed: completedSites.length,
    },
  };
}
