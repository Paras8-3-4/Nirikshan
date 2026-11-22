export type SiteType = "Factory" | "Farm";
export type UserRole = "supervisor" | "inspector";

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  code?: string;
  email?: string;
  inspectorId?: string;
  phone?: string;
  department?: string;
  certifications?: string;
  bio?: string;
}

export interface Site {
  id: string;
  name: string;
  code: string;
  type: SiteType;
  location: string;
  city: string;
  country: string;
  overview?: string;
  latitude?: number;
  longitude?: number;
  active: boolean;
  assignedInspectorIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Inspector {
  id: string;
  name: string;
  code: string;
  email: string;
  region: string;
  phone?: string;
  certifications?: string;
  bio?: string;
  active: boolean;
  claimed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ChecklistItemStatus = "pending" | "pass" | "fail";

export interface GeoLocationEntry {
  id: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  capturedAt: string;
  offlineCaptured: boolean;
  source: "gps" | "manual-offline";
  label?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  target?: string;
  unit?: string;
  stageId?: string;
  stageName?: string;
  status: ChecklistItemStatus;
  note: string;
  updatedAt: string;
  updatedBy: string;
  geoLocation?: GeoLocationEntry | null;
}

export interface InspectionPhoto {
  id: string;
  dataUrl: string;
  caption: string;
  itemId?: string;
  capturedAt: string;
  offlineCaptured: boolean;
  geoTag?: {
    latitude: number;
    longitude: number;
  };
}

export interface ReportSignature {
  dataUrl: string;
  signerName: string;
  signerRole: UserRole;
  signedAt: string;
  latitude?: number;
  longitude?: number;
}

export interface ArrivalVerification {
  mediaType?: "image" | "video";
  photoDataUrl: string;
  capturedAt: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  distanceFromSiteMeters: number | null;
  offlineCaptured: boolean;
  verifiedByName: string;
  note?: string;
}

export function isArrivalGeoVerified(
  verification: ArrivalVerification | null | undefined
): boolean {
  return Boolean(
    verification &&
      typeof verification.photoDataUrl === "string" &&
      verification.photoDataUrl.length > 0 &&
      typeof verification.latitude === "number" &&
      Number.isFinite(verification.latitude) &&
      typeof verification.longitude === "number" &&
      Number.isFinite(verification.longitude)
  );
}

export type InspectionMode = "single-stage" | "multi-stage";

export interface InspectionStage {
  id: string;
  name: string;
  order: number;
  description?: string;
}

export interface ConflictSubmission {
  id: string;
  submittedBy: string;
  submittedByRole: UserRole;
  submittedAt: string;
  baseServerUpdatedAt?: string;
  items: ChecklistItem[];
  notes?: string;
  arrivalVerification?: ArrivalVerification | null;
  photos?: InspectionPhoto[];
  geoLocation?: GeoLocationEntry | null;
}

export type InspectionStatus = "pending" | "in-progress" | "completed" | "conflict";
export type SyncStatus = "synced" | "pending" | "conflict";

export interface InspectionRecord {
  id: string;
  siteId?: string;
  siteName: string;
  siteType: SiteType;
  location?: string;
  siteOverview?: string;
  siteLatitude?: number;
  siteLongitude?: number;
  dueDate: string;
  inspectorId?: string;
  inspectorName: string;
  notes?: string;
  inspectionMode?: InspectionMode;
  stages?: InspectionStage[];
  status: InspectionStatus;
  syncStatus: SyncStatus;
  updatedAt: string;
  serverUpdatedAt?: string;
  serverSnapshot?: InspectionRecord | null;
  conflictQueue?: ConflictSubmission[];
  items: ChecklistItem[];
  geoLocation?: GeoLocationEntry | null;
  geoTrail?: GeoLocationEntry[];
  photos?: InspectionPhoto[];
  arrivalVerification?: ArrivalVerification | null;
  inspectorSignature?: ReportSignature | null;
  supervisorValidation?: ReportSignature | null;
}

export interface CustomParameterInput {
  label: string;
  target?: string;
  unit?: string;
}

export interface CreateStageInput {
  name: string;
  description?: string;
  includeBaselineChecks?: boolean;
  parameters: CustomParameterInput[];
}

export interface CreateInspectionInput {
  siteId?: string;
  siteName: string;
  siteType?: SiteType;
  location?: string;
  siteOverview?: string;
  siteLatitude?: number;
  siteLongitude?: number;
  dueDate: string;
  inspectorId?: string;
  inspectorName: string;
  notes?: string;
  inspectionMode?: InspectionMode;
  stages?: CreateStageInput[];
  customParameters?: CustomParameterInput[];
}
