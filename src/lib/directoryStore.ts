import type { Inspector, Site, SiteType } from "./types.ts";

export type { Inspector, Site, SiteType };

export interface DirectoryState {
  sites: Record<string, Site>;
  inspectors: Record<string, Inspector>;
}

const nowIso = "2026-11-18T08:30:00.000Z";

const initialSites: Site[] = [
  {
    id: "site-mun-01",
    name: "Bavaria Turbine Assembly Plant",
    code: "MUN-F01",
    type: "Factory",
    location: "Werkstrasse 14, Industrial Park North",
    city: "Munich",
    country: "Germany",
    overview:
      "Primary rotor & high-pressure hydraulic test facility. Mandatory Class-2 PPE inside Bay 3–5; verify lockout/tagout barriers on Manifold Rack B before pressure checks.",
    latitude: 48.1874,
    longitude: 11.6152,
    active: true,
    assignedInspectorIds: ["insp-104", "insp-209"],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: "site-rot-02",
    name: "Rhine Delta Hydroponic Greenhouse",
    code: "RTM-A02",
    type: "Farm",
    location: "Polderweg 88, Sector C",
    city: "Rotterdam",
    country: "Netherlands",
    overview:
      "Controlled-environment glasshouse (14 hectares). Focus checks on automated nutrient dosing skids, pH sensor calibration, and emergency washdown valves.",
    latitude: 51.9225,
    longitude: 4.4792,
    active: true,
    assignedInspectorIds: ["insp-209"],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: "site-aus-03",
    name: "Austin Precision Stamping Works",
    code: "AUS-F03",
    type: "Factory",
    location: "4400 East Parmer Lane",
    city: "Austin",
    country: "USA",
    overview:
      "600-ton servo stamping lines 1–4. Acoustic protection mandatory on press floor; inspect dual palm-button interlocks and hydraulic press light curtains.",
    latitude: 30.3911,
    longitude: -97.6534,
    active: true,
    assignedInspectorIds: ["insp-312"],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: "site-osa-04",
    name: "Kansai Cold-Chain Packaging Hub",
    code: "OSA-F04",
    type: "Factory",
    location: "2-11 Nanko Kita, Suminoe Ward",
    city: "Osaka",
    country: "Japan",
    overview:
      "Sub-zero (-20 C) automated palletizing & ammonia refrigeration hub. Confirm gas detection beacons, insulated door seals, and CO2 suppression canisters.",
    latitude: 34.6295,
    longitude: 135.4182,
    active: true,
    assignedInspectorIds: ["insp-104", "insp-312"],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: "site-fre-05",
    name: "Central Valley Orchard Processing",
    code: "FAT-A05",
    type: "Farm",
    location: "1920 West Manning Ave",
    city: "Fresno",
    country: "USA",
    overview:
      "Post-harvest stone-fruit hydro-cooling and chlorine wash-line packhouse. Verify free-chlorine dosing telemetry, conveyor pinch guards, and wastewater traps.",
    latitude: 36.6052,
    longitude: -119.8321,
    active: true,
    assignedInspectorIds: ["insp-312"],
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: "site-old-06",
    name: "Stuttgart Legacy Foundry Annex",
    code: "STR-F06",
    type: "Factory",
    location: "Alte Giesserei 4",
    city: "Stuttgart",
    country: "Germany",
    overview:
      "Decommissioned casting annex held for environmental baseline monitoring only. Active production shut down Oct 2026.",
    latitude: 48.8012,
    longitude: 9.2114,
    active: false,
    assignedInspectorIds: [],
    createdAt: "2026-06-12T10:00:00.000Z",
    updatedAt: "2026-10-02T15:00:00.000Z",
  },
];

const initialInspectors: Inspector[] = [
  {
    id: "insp-104",
    name: "Elena Rostova",
    code: "INSP-104",
    email: "e.rostova@nirikshan.ops",
    region: "EU-Central",
    phone: "+49 89 5550 1420",
    certifications: "ISO 45001 Lead Auditor · TUV Hydraulic Safety",
    bio: "Senior mechanical & cold-chain compliance inspector covering Bavarian and Osaka industrial hubs.",
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: "insp-209",
    name: "Marcus Vance",
    code: "INSP-209",
    email: "m.vance@nirikshan.ops",
    region: "EU-West",
    phone: "+31 10 555 0198",
    certifications: "GlobalGAP AgTech · IEC 61508 Control Systems",
    bio: "Controlled-environment agriculture and EU manufacturing reliability specialist.",
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: "insp-312",
    name: "Kenji Takahashi",
    code: "INSP-312",
    email: "k.takahashi@nirikshan.ops",
    region: "NA / APAC",
    phone: "+1 512 555 0184",
    certifications: "OSHA 30 · HACCP Food Processing Lead",
    bio: "Cross-regional inspector overseeing North American stamping lines and post-harvest packhouses.",
    active: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  },
  {
    id: "insp-401",
    name: "Clara Lindqvist",
    code: "INSP-401",
    email: "c.lindqvist@nirikshan.ops",
    region: "EU-North",
    phone: "+46 8 555 0133",
    certifications: "ISO 14001 Environmental Auditor",
    bio: "Former Nordic regional auditor (currently archived / inactive).",
    active: false,
    createdAt: "2026-04-10T09:00:00.000Z",
    updatedAt: "2026-09-20T11:30:00.000Z",
  },
];

const globalForDirectory = globalThis as unknown as {
  __fieldInspectDirectory?: DirectoryState;
};

function createInitialDirectoryState(): DirectoryState {
  const sites: Record<string, Site> = {};
  for (const s of initialSites) {
    sites[s.id] = { ...s, assignedInspectorIds: [...s.assignedInspectorIds] };
  }
  const inspectors: Record<string, Inspector> = {};
  for (const i of initialInspectors) {
    inspectors[i.id] = { ...i };
  }
  return { sites, inspectors };
}

export function getDirectoryState(): DirectoryState {
  if (!globalForDirectory.__fieldInspectDirectory) {
    globalForDirectory.__fieldInspectDirectory = createInitialDirectoryState();
  }
  return globalForDirectory.__fieldInspectDirectory;
}

export function listSites(): Site[] {
  return Object.values(getDirectoryState().sites).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

function sanitizeCoord(val: unknown, min: number, max: number): number | undefined {
  if (typeof val !== "number" || !Number.isFinite(val)) return undefined;
  if (val < min || val > max) return undefined;
  return Number(val.toFixed(6));
}

export interface CreateSiteInput {
  name: string;
  code?: string;
  type: SiteType;
  location: string;
  city: string;
  country: string;
  overview?: string;
  latitude?: number;
  longitude?: number;
  assignedInspectorIds?: string[];
}

export function createSite(input: CreateSiteInput): Site {
  const state = getDirectoryState();
  const now = new Date().toISOString();
  const id = `site-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const prefix = input.city.trim().slice(0, 3).toUpperCase() || "SIT";
  const typeChar = input.type === "Farm" ? "A" : "F";
  const count = Object.keys(state.sites).length + 1;
  const code = (
    input.code?.trim() || `${prefix}-${typeChar}${String(count).padStart(2, "0")}`
  ).toUpperCase();

  const validInspectorIds = (input.assignedInspectorIds ?? []).filter(
    (inspId) => Boolean(state.inspectors[inspId])
  );

  const site: Site = {
    id,
    name: input.name.trim(),
    code,
    type: input.type,
    location: input.location.trim(),
    city: input.city.trim(),
    country: input.country.trim(),
    overview: input.overview?.trim() || "",
    latitude: sanitizeCoord(input.latitude, -90, 90),
    longitude: sanitizeCoord(input.longitude, -180, 180),
    active: true,
    assignedInspectorIds: Array.from(new Set(validInspectorIds)),
    createdAt: now,
    updatedAt: now,
  };

  state.sites[site.id] = site;
  return site;
}

export interface UpdateSiteInput {
  name?: string;
  code?: string;
  type?: SiteType;
  location?: string;
  city?: string;
  country?: string;
  overview?: string;
  latitude?: number | null;
  longitude?: number | null;
  active?: boolean;
  assignedInspectorIds?: string[];
}

export function updateSite(id: string, input: UpdateSiteInput): Site | null {
  const state = getDirectoryState();
  const existing = state.sites[id];
  if (!existing) return null;

  const nextLat =
    input.latitude === null
      ? undefined
      : input.latitude !== undefined
      ? sanitizeCoord(input.latitude, -90, 90) ?? existing.latitude
      : existing.latitude;

  const nextLng =
    input.longitude === null
      ? undefined
      : input.longitude !== undefined
      ? sanitizeCoord(input.longitude, -180, 180) ?? existing.longitude
      : existing.longitude;

  const updated: Site = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    code:
      input.code !== undefined
        ? input.code.trim().toUpperCase()
        : existing.code,
    type: input.type !== undefined ? input.type : existing.type,
    location:
      input.location !== undefined ? input.location.trim() : existing.location,
    city: input.city !== undefined ? input.city.trim() : existing.city,
    country:
      input.country !== undefined ? input.country.trim() : existing.country,
    overview:
      input.overview !== undefined ? input.overview.trim() : existing.overview,
    latitude: nextLat,
    longitude: nextLng,
    active: input.active !== undefined ? Boolean(input.active) : existing.active,
    assignedInspectorIds:
      input.assignedInspectorIds !== undefined
        ? Array.from(
            new Set(
              input.assignedInspectorIds.filter((inspId) =>
                Boolean(state.inspectors[inspId])
              )
            )
          )
        : existing.assignedInspectorIds,
    updatedAt: new Date().toISOString(),
  };

  state.sites[id] = updated;
  return updated;
}

export function listInspectors(): Inspector[] {
  return Object.values(getDirectoryState().inspectors).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export interface CreateInspectorInput {
  name: string;
  code: string;
  email?: string;
  region?: string;
  phone?: string;
  certifications?: string;
  bio?: string;
}

export function createInspector(input: CreateInspectorInput): Inspector {
  const state = getDirectoryState();
  const now = new Date().toISOString();
  const id = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const inspector: Inspector = {
    id,
    name: input.name.trim(),
    code: input.code.trim().toUpperCase(),
    email: (input.email ?? "").trim(),
    region: (input.region ?? "Global").trim(),
    phone: (input.phone ?? "").trim(),
    certifications: (input.certifications ?? "").trim(),
    bio: (input.bio ?? "").trim(),
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  state.inspectors[inspector.id] = inspector;
  return inspector;
}

export interface UpdateInspectorInput {
  name?: string;
  code?: string;
  email?: string;
  region?: string;
  phone?: string;
  certifications?: string;
  bio?: string;
  active?: boolean;
}

export function updateInspector(
  id: string,
  input: UpdateInspectorInput
): Inspector | null {
  const state = getDirectoryState();
  const existing = state.inspectors[id];
  if (!existing) return null;

  const updated: Inspector = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    code:
      input.code !== undefined
        ? input.code.trim().toUpperCase()
        : existing.code,
    email: input.email !== undefined ? input.email.trim() : existing.email,
    region: input.region !== undefined ? input.region.trim() : existing.region,
    phone: input.phone !== undefined ? input.phone.trim() : existing.phone,
    certifications:
      input.certifications !== undefined
        ? input.certifications.trim()
        : existing.certifications,
    bio: input.bio !== undefined ? input.bio.trim() : existing.bio,
    active: input.active !== undefined ? Boolean(input.active) : existing.active,
    updatedAt: new Date().toISOString(),
  };

  state.inspectors[id] = updated;
  return updated;
}
