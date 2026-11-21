export type SiteType =
  | "Factory"
  | "Solar"
  | "Warehouse"
  | "Substation"
  | "Other";

export type InspectorSex = "Male" | "Female" | "Other" | "Prefer not to say";

export interface Site {
  id: string;
  name: string;
  type: SiteType;
  location: string;
  city: string;
  state: string;
  country: string;
  gpsLat?: number;
  gpsLng?: number;
  assignedInspectorIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Inspector {
  id: string;
  name: string;
  code: string;
  designation: string;
  age?: number;
  sex?: InspectorSex;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DirectoryState {
  sites: Site[];
  inspectors: Inspector[];
}

export interface SiteFilter {
  city?: string;
  country?: string;
  type?: string;
  inspectorId?: string;
  includeInactive?: boolean;
}

export interface CreateSiteInput {
  name: string;
  type?: SiteType;
  location: string;
  city: string;
  state?: string;
  country: string;
  gpsLat?: number;
  gpsLng?: number;
  assignedInspectorIds?: string[];
  active?: boolean;
}

export interface CreateInspectorInput {
  name: string;
  code: string;
  designation: string;
  age?: number;
  sex?: InspectorSex;
  address: string;
  city?: string;
  state?: string;
  country?: string;
  active?: boolean;
}

const globalForDirectory = globalThis as unknown as {
  __fieldInspectDirectoryStore?: DirectoryState;
};

function createInitialDirectoryState(): DirectoryState {
  const now = new Date().toISOString();
  return {
    inspectors: [
      {
        id: "insp-aarav",
        name: "Aarav Sharma",
        code: "Inspector A",
        designation: "Senior Field Inspector",
        age: 31,
        sex: "Male",
        address: "MI Road, C-Scheme",
        city: "Jaipur",
        state: "Rajasthan",
        country: "India",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "insp-meera",
        name: "Meera Nair",
        code: "Inspector B",
        designation: "Safety & Compliance Engineer",
        age: 28,
        sex: "Female",
        address: "Civil Lines, Sector 2",
        city: "Alwar",
        state: "Rajasthan",
        country: "India",
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
    sites: [
      {
        id: "site-jaipur-press",
        name: "Jaipur Steel & Press — Bay 2",
        type: "Factory",
        location: "Plot 44, VKI Industrial Area",
        city: "Jaipur",
        state: "Rajasthan",
        country: "India",
        gpsLat: 26.9124,
        gpsLng: 75.7873,
        assignedInspectorIds: ["insp-aarav", "insp-meera"],
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "site-alwar-solar",
        name: "Alwar Drip & Solar Pump Sector 4",
        type: "Solar",
        location: "NH-248A Solar Corridor, Block 4",
        city: "Alwar",
        state: "Rajasthan",
        country: "India",
        gpsLat: 27.553,
        gpsLng: 76.6346,
        assignedInspectorIds: ["insp-meera"],
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  };
}

export function getDirectoryState(): DirectoryState {
  if (!globalForDirectory.__fieldInspectDirectoryStore) {
    globalForDirectory.__fieldInspectDirectoryStore =
      createInitialDirectoryState();
  }
  return globalForDirectory.__fieldInspectDirectoryStore;
}

// --- Sites CRUD ---
export function getSites(filters?: SiteFilter): Site[] {
  const { sites } = getDirectoryState();
  return sites.filter((site) => {
    if (!filters?.includeInactive && !site.active) return false;
    if (
      filters?.city &&
      filters.city.trim() !== "" &&
      site.city.toLowerCase() !== filters.city.trim().toLowerCase()
    ) {
      return false;
    }
    if (
      filters?.country &&
      filters.country.trim() !== "" &&
      site.country.toLowerCase() !== filters.country.trim().toLowerCase()
    ) {
      return false;
    }
    if (
      filters?.type &&
      filters.type !== "ALL" &&
      site.type.toLowerCase() !== filters.type.toLowerCase()
    ) {
      return false;
    }
    if (
      filters?.inspectorId &&
      filters.inspectorId.trim() !== "" &&
      !site.assignedInspectorIds.includes(filters.inspectorId.trim())
    ) {
      return false;
    }
    return true;
  });
}

export function getSiteById(id: string): Site | null {
  const { sites } = getDirectoryState();
  return sites.find((s) => s.id === id) ?? null;
}

export function createSite(input: CreateSiteInput): Site {
  const state = getDirectoryState();
  const now = new Date().toISOString();
  const site: Site = {
    id: `site-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    type: input.type ?? "Other",
    location: input.location.trim(),
    city: input.city.trim(),
    state: input.state?.trim() ?? "",
    country: input.country.trim(),
    gpsLat: input.gpsLat,
    gpsLng: input.gpsLng,
    assignedInspectorIds: Array.from(new Set(input.assignedInspectorIds ?? [])),
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  state.sites.unshift(site);
  return site;
}

export function updateSite(
  id: string,
  patch: Partial<Omit<Site, "id" | "createdAt">>
): Site | null {
  const state = getDirectoryState();
  const idx = state.sites.findIndex((s) => s.id === id);
  if (idx === -1) return null;

  const updated: Site = {
    ...state.sites[idx],
    ...patch,
    assignedInspectorIds: patch.assignedInspectorIds
      ? Array.from(new Set(patch.assignedInspectorIds))
      : state.sites[idx].assignedInspectorIds,
    updatedAt: new Date().toISOString(),
  };
  state.sites[idx] = updated;
  return updated;
}

export function deleteOrArchiveSite(id: string, hardDelete = false): boolean {
  const state = getDirectoryState();
  const idx = state.sites.findIndex((s) => s.id === id);
  if (idx === -1) return false;

  if (hardDelete) {
    state.sites.splice(idx, 1);
    return true;
  }

  state.sites[idx] = {
    ...state.sites[idx],
    active: false,
    updatedAt: new Date().toISOString(),
  };
  return true;
}

// --- Inspectors CRUD ---
export function getInspectors(options?: {
  includeInactive?: boolean;
}): Inspector[] {
  const { inspectors } = getDirectoryState();
  if (options?.includeInactive) return inspectors;
  return inspectors.filter((i) => i.active);
}

export function getInspectorById(id: string): Inspector | null {
  const { inspectors } = getDirectoryState();
  return inspectors.find((i) => i.id === id) ?? null;
}

export function createInspector(input: CreateInspectorInput): Inspector {
  const state = getDirectoryState();
  const now = new Date().toISOString();
  const inspector: Inspector = {
    id: `insp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: input.name.trim(),
    code: input.code.trim(),
    designation: input.designation.trim(),
    age: input.age,
    sex: input.sex,
    address: input.address.trim(),
    city: input.city?.trim(),
    state: input.state?.trim(),
    country: input.country?.trim(),
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  state.inspectors.unshift(inspector);
  return inspector;
}

export function updateInspector(
  id: string,
  patch: Partial<Omit<Inspector, "id" | "createdAt">>
): Inspector | null {
  const state = getDirectoryState();
  const idx = state.inspectors.findIndex((i) => i.id === id);
  if (idx === -1) return null;

  const updated: Inspector = {
    ...state.inspectors[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  state.inspectors[idx] = updated;
  return updated;
}

export function deleteOrArchiveInspector(
  id: string,
  hardDelete = false
): boolean {
  const state = getDirectoryState();
  const idx = state.inspectors.findIndex((i) => i.id === id);
  if (idx === -1) return false;

  if (hardDelete) {
    state.inspectors.splice(idx, 1);
    return true;
  }

  state.inspectors[idx] = {
    ...state.inspectors[idx],
    active: false,
    updatedAt: new Date().toISOString(),
  };
  return true;
}