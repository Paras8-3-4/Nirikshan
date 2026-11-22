import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import {
  changeInspectorPassword,
  changeSupervisorPassword,
  claimInspectorPassword,
  claimSupervisorAccount,
  getSupervisorAuthUser,
  isEnvSupervisorPasscodeConfigured,
  isInspectorClaimed,
  isSupervisorClaimed,
  loginSupervisor,
  resetInspectorPasswordClaim,
  signAuthToken,
  updateSupervisorProfile,
  verifyAuthToken,
  verifyInspectorPassword,
} from "./src/lib/authStore.ts";
import {
  createInspector,
  createSite,
  getDirectoryState,
  listInspectors,
  listSites,
  updateInspector,
  updateSite,
} from "./src/lib/directoryStore.ts";
import {
  createInspection,
  getServerState,
  isInspectionAssignedToInspector,
  listInspections,
  resolveConflictBySupervisor,
  sanitizeArrivalVerification,
  sanitizeChecklistItems,
  sanitizeGeoEntry,
  sanitizePhotoEntry,
  sanitizeSignature,
  simulateServerConflict,
  syncInspectionsFromClient,
  updateInspectionOnServer,
  validateInspectionBySupervisor,
} from "./src/lib/serverStore.ts";
import {
  isArrivalGeoVerified,
  type AuthUser,
  type CreateStageInput,
  type CustomParameterInput,
  type GeoLocationEntry,
  type InspectionMode,
  type InspectionPhoto,
  type InspectionRecord,
  type SiteType,
} from "./src/lib/types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

interface AuthenticatedRequest extends Request {
  authUser?: AuthUser;
}

function mapSiteType(type?: unknown): SiteType {
  return type === "Farm" ? "Farm" : "Factory";
}

function asTrimmedString(val: unknown): string {
  return typeof val === "string" ? val.trim() : "";
}

function asOptionalNumber(val: unknown): number | undefined {
  if (typeof val === "number" && Number.isFinite(val)) return val;
  if (typeof val === "string" && val.trim() !== "") {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function extractBearerUser(req: Request): AuthUser | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  return verifyAuthToken(token);
}

function buildFullProfile(user: AuthUser): AuthUser {
  if (user.role === "supervisor") {
    return getSupervisorAuthUser(user.id) ?? user;
  }
  const insp = getDirectoryState().inspectors[user.inspectorId ?? user.id];
  if (!insp) return user;
  return {
    id: insp.id,
    name: insp.name,
    role: "inspector",
    code: insp.code,
    email: insp.email,
    inspectorId: insp.id,
    department: insp.region,
    phone: insp.phone,
    certifications: insp.certifications,
    bio: insp.bio,
  };
}

function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  req.authUser = user;
  next();
}

function requireSupervisor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const user = req.authUser ?? extractBearerUser(req);
  if (!user) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }
  if (user.role !== "supervisor") {
    res.status(403).json({ error: "Supervisor permissions required." });
    return;
  }
  req.authUser = user;
  next();
}

function sanitizeClientInspection(
  rec: InspectionRecord,
  existing: InspectionRecord | undefined,
  isInspector: boolean,
  actorLabel: string
): InspectionRecord {
  const rawTrail = Array.isArray(rec.geoTrail) ? rec.geoTrail : [];
  const cleanTrail = rawTrail
    .map((g) => sanitizeGeoEntry(g))
    .filter((g): g is GeoLocationEntry => Boolean(g))
    .slice(-40);

  const cleanGeo = rec.geoLocation ? sanitizeGeoEntry(rec.geoLocation) : null;
  const rawPhotos = Array.isArray(rec.photos) ? rec.photos : [];
  const cleanPhotos = rawPhotos
    .map((p) => sanitizePhotoEntry(p))
    .filter((p): p is InspectionPhoto => Boolean(p))
    .slice(0, 24);

  const cleanInspSig = sanitizeSignature(rec.inspectorSignature);
  const cleanArrival =
    rec.arrivalVerification !== undefined
      ? sanitizeArrivalVerification(
          rec.arrivalVerification,
          actorLabel,
          existing?.siteLatitude ?? rec.siteLatitude,
          existing?.siteLongitude ?? rec.siteLongitude
        )
      : existing?.arrivalVerification ?? null;
  const cleanItems = sanitizeChecklistItems(
    rec.items,
    existing?.items ?? [],
    actorLabel
  );

  // Inspectors may never alter locked site location, overview, assignee, or supervisor validation
  if (isInspector && existing) {
    return {
      ...rec,
      id: existing.id,
      siteId: existing.siteId,
      siteName: existing.siteName,
      siteType: existing.siteType,
      location: existing.location,
      siteOverview: existing.siteOverview,
      siteLatitude: existing.siteLatitude,
      siteLongitude: existing.siteLongitude,
      dueDate: existing.dueDate,
      inspectionMode: existing.inspectionMode,
      stages: existing.stages,
      conflictQueue: existing.conflictQueue,
      inspectorId: existing.inspectorId,
      inspectorName: existing.inspectorName,
      items: cleanItems,
      geoLocation: cleanGeo,
      geoTrail: cleanTrail,
      photos: cleanPhotos,
      arrivalVerification: cleanArrival,
      inspectorSignature: cleanInspSig,
      supervisorValidation: existing.supervisorValidation ?? null,
    };
  }

  return {
    ...rec,
    inspectionMode: existing?.inspectionMode ?? rec.inspectionMode,
    stages: existing?.stages ?? rec.stages,
    conflictQueue: existing?.conflictQueue ?? rec.conflictQueue,
    items: cleanItems,
    geoLocation: cleanGeo,
    geoTrail: cleanTrail,
    photos: cleanPhotos,
    arrivalVerification: cleanArrival,
    inspectorSignature: cleanInspSig,
    supervisorValidation:
      rec.supervisorValidation !== undefined
        ? sanitizeSignature(rec.supervisorValidation)
        : existing?.supervisorValidation ?? null,
  };
}

function inspectorAttemptedInspectionWithoutArrival(
  sanitized: InspectionRecord,
  existing: InspectionRecord
): boolean {
  if (isArrivalGeoVerified(sanitized.arrivalVerification)) {
    return false;
  }
  const itemsModified = sanitized.items.some((it) => {
    const prev = existing.items.find((e) => e.id === it.id);
    if (!prev) return it.status !== "pending" || it.note.trim().length > 0;
    return (
      it.status !== prev.status ||
      it.note !== prev.note ||
      Boolean(it.geoLocation && !prev.geoLocation)
    );
  });
  const addedPhotos =
    (sanitized.photos?.length ?? 0) > (existing.photos?.length ?? 0);
  const addedSignature =
    Boolean(sanitized.inspectorSignature) && !existing.inspectorSignature;
  return itemsModified || addedPhotos || addedSignature;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "18mb" }));

  // --- Auth & Bootstrap Routes ---
  app.get("/api/auth/bootstrap-status", (_req, res) => {
    const activeInspectors = listInspectors()
      .filter((i) => i.active)
      .map((i) => ({
        id: i.id,
        name: i.name,
        code: i.code,
        region: i.region,
        claimed: isInspectorClaimed(i.id),
      }));

    res.json({
      supervisorClaimed: isSupervisorClaimed(),
      envPasscodeConfigured: isEnvSupervisorPasscodeConfigured(),
      inspectors: activeInspectors,
    });
  });

  app.post("/api/auth/supervisor/claim", (req, res) => {
    const body = req.body ?? {};
    const name = asTrimmedString(body.name);
    const email = asTrimmedString(body.email);
    const password = typeof body.password === "string" ? body.password : "";

    if (!name) {
      res.status(400).json({ error: "Supervisor name is required." });
      return;
    }
    if (password.length < 6) {
      res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
      return;
    }

    try {
      const user = claimSupervisorAccount({ name, email, password });
      const token = signAuthToken(user);
      res.status(201).json({ user, token });
    } catch (err) {
      res.status(409).json({
        error:
          err instanceof Error
            ? err.message
            : "Supervisor account already claimed.",
      });
    }
  });

  app.post("/api/auth/supervisor/login", (req, res) => {
    const body = req.body ?? {};
    const password = typeof body.password === "string" ? body.password : "";
    if (!password) {
      res.status(400).json({ error: "Password is required." });
      return;
    }
    if (!isSupervisorClaimed()) {
      res.status(409).json({
        error: "Supervisor workspace has not been claimed yet.",
      });
      return;
    }
    const user = loginSupervisor(password);
    if (!user) {
      res.status(401).json({ error: "Invalid supervisor password." });
      return;
    }
    const token = signAuthToken(user);
    res.json({ user, token });
  });

  app.post("/api/auth/inspector/claim", (req, res) => {
    const body = req.body ?? {};
    const inspectorId = asTrimmedString(body.inspectorId);
    const password = typeof body.password === "string" ? body.password : "";

    if (!inspectorId) {
      res.status(400).json({ error: "Inspector selection is required." });
      return;
    }
    if (password.length < 6) {
      res
        .status(400)
        .json({ error: "Password must be at least 6 characters." });
      return;
    }

    const inspector = getDirectoryState().inspectors[inspectorId];
    if (!inspector || !inspector.active) {
      res.status(404).json({ error: "Active inspector account not found." });
      return;
    }

    if (isInspectorClaimed(inspector.id)) {
      res.status(409).json({
        error:
          "This inspector account is already activated. Please sign in with your password.",
      });
      return;
    }

    claimInspectorPassword(inspector.id, password);
    const user: AuthUser = buildFullProfile({
      id: inspector.id,
      name: inspector.name,
      role: "inspector",
      code: inspector.code,
      email: inspector.email,
      inspectorId: inspector.id,
    });
    const token = signAuthToken(user);
    res.status(201).json({ user, token });
  });

  app.post("/api/auth/inspector/login", (req, res) => {
    const body = req.body ?? {};
    const inspectorId = asTrimmedString(body.inspectorId);
    const password = typeof body.password === "string" ? body.password : "";

    if (!inspectorId || !password) {
      res
        .status(400)
        .json({ error: "Inspector selection and password are required." });
      return;
    }

    const inspector = getDirectoryState().inspectors[inspectorId];
    if (!inspector || !inspector.active) {
      res.status(404).json({ error: "Active inspector account not found." });
      return;
    }

    if (!isInspectorClaimed(inspector.id)) {
      res.status(409).json({
        error: "Inspector account is not activated yet. Set a password first.",
      });
      return;
    }

    if (!verifyInspectorPassword(inspector.id, password)) {
      res.status(401).json({ error: "Invalid inspector password." });
      return;
    }

    const user: AuthUser = buildFullProfile({
      id: inspector.id,
      name: inspector.name,
      role: "inspector",
      code: inspector.code,
      email: inspector.email,
      inspectorId: inspector.id,
    });
    const token = signAuthToken(user);
    res.json({ user, token });
  });

  app.get("/api/auth/me", requireAuth, (req: AuthenticatedRequest, res) => {
    res.json({ user: buildFullProfile(req.authUser!) });
  });

  // --- Profile Routes (Both Roles) ---
  app.get("/api/profile", requireAuth, (req: AuthenticatedRequest, res) => {
    const profile = buildFullProfile(req.authUser!);
    res.json({
      profile,
      envPasscodeManaged:
        req.authUser?.role === "supervisor" && isEnvSupervisorPasscodeConfigured(),
    });
  });

  app.patch("/api/profile", requireAuth, (req: AuthenticatedRequest, res) => {
    const user = req.authUser!;
    const body = req.body ?? {};
    const name = body.name !== undefined ? asTrimmedString(body.name) : undefined;
    if (name !== undefined && !name) {
      res.status(400).json({ error: "Display name cannot be empty." });
      return;
    }

    if (user.role === "supervisor") {
      const updated = updateSupervisorProfile(user.id, {
        name,
        email: body.email !== undefined ? asTrimmedString(body.email) : undefined,
        phone: body.phone !== undefined ? asTrimmedString(body.phone) : undefined,
        department:
          body.department !== undefined
            ? asTrimmedString(body.department)
            : undefined,
        certifications:
          body.certifications !== undefined
            ? asTrimmedString(body.certifications)
            : undefined,
        bio: body.bio !== undefined ? asTrimmedString(body.bio) : undefined,
      });
      if (!updated) {
        res.status(404).json({ error: "Supervisor profile not found." });
        return;
      }
      const token = signAuthToken(updated);
      res.json({ profile: updated, token });
      return;
    }

    const inspId = user.inspectorId ?? user.id;
    const updatedInsp = updateInspector(inspId, {
      name,
      email: body.email !== undefined ? asTrimmedString(body.email) : undefined,
      region:
        body.department !== undefined
          ? asTrimmedString(body.department)
          : undefined,
      phone: body.phone !== undefined ? asTrimmedString(body.phone) : undefined,
      certifications:
        body.certifications !== undefined
          ? asTrimmedString(body.certifications)
          : undefined,
      bio: body.bio !== undefined ? asTrimmedString(body.bio) : undefined,
    });

    if (!updatedInsp) {
      res.status(404).json({ error: "Inspector profile not found." });
      return;
    }

    const nextUser = buildFullProfile({
      id: updatedInsp.id,
      name: updatedInsp.name,
      role: "inspector",
      code: updatedInsp.code,
      email: updatedInsp.email,
      inspectorId: updatedInsp.id,
    });
    const token = signAuthToken(nextUser);
    res.json({ profile: nextUser, token });
  });

  app.post(
    "/api/profile/password",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const user = req.authUser!;
      const body = req.body ?? {};
      const currentPassword =
        typeof body.currentPassword === "string" ? body.currentPassword : "";
      const newPassword =
        typeof body.newPassword === "string" ? body.newPassword : "";

      if (!currentPassword || newPassword.length < 6) {
        res.status(400).json({
          error:
            "Current password is required and new password must be at least 6 characters.",
        });
        return;
      }

      const result =
        user.role === "supervisor"
          ? changeSupervisorPassword(user.id, currentPassword, newPassword)
          : changeInspectorPassword(
              user.inspectorId ?? user.id,
              currentPassword,
              newPassword
            );

      if (!result.ok) {
        res.status(400).json({ error: result.error || "Password update failed." });
        return;
      }
      res.json({ ok: true });
    }
  );

  // --- Sites API ---
  app.get("/api/sites", requireAuth, (req: AuthenticatedRequest, res) => {
    const allSites = listSites();
    if (req.authUser?.role === "inspector" && req.authUser.inspectorId) {
      const inspId = req.authUser.inspectorId;
      res.json({
        sites: allSites.filter(
          (s) => s.active && s.assignedInspectorIds.includes(inspId)
        ),
      });
      return;
    }
    res.json({ sites: allSites });
  });

  app.post("/api/sites", requireAuth, requireSupervisor, (req, res) => {
    const body = req.body ?? {};
    const name = asTrimmedString(body.name);
    const city = asTrimmedString(body.city);
    const country = asTrimmedString(body.country);
    const location = asTrimmedString(body.location);

    if (!name) {
      res.status(400).json({ error: "Site name is required." });
      return;
    }
    if (!city || !country) {
      res.status(400).json({ error: "City and country are required." });
      return;
    }
    if (!location) {
      res.status(400).json({ error: "Street/site location is required." });
      return;
    }

    const lat = asOptionalNumber(body.latitude);
    const lng = asOptionalNumber(body.longitude);
    if (lat !== undefined && (lat < -90 || lat > 90)) {
      res.status(400).json({ error: "Latitude must be between -90 and 90." });
      return;
    }
    if (lng !== undefined && (lng < -180 || lng > 180)) {
      res.status(400).json({ error: "Longitude must be between -180 and 180." });
      return;
    }

    const site = createSite({
      name,
      code: asTrimmedString(body.code) || undefined,
      type: mapSiteType(body.type),
      location,
      city,
      country,
      overview: asTrimmedString(body.overview),
      latitude: lat,
      longitude: lng,
      assignedInspectorIds: Array.isArray(body.assignedInspectorIds)
        ? body.assignedInspectorIds.filter(
            (id: unknown): id is string => typeof id === "string"
          )
        : [],
    });

    res.status(201).json({ site });
  });

  app.patch("/api/sites/:id", requireAuth, requireSupervisor, (req, res) => {
    const { id } = req.params;
    const body = req.body ?? {};
    if (body.name !== undefined && !asTrimmedString(body.name)) {
      res.status(400).json({ error: "Site name cannot be empty." });
      return;
    }

    const lat = body.latitude === null ? null : asOptionalNumber(body.latitude);
    const lng =
      body.longitude === null ? null : asOptionalNumber(body.longitude);
    if (typeof lat === "number" && (lat < -90 || lat > 90)) {
      res.status(400).json({ error: "Latitude must be between -90 and 90." });
      return;
    }
    if (typeof lng === "number" && (lng < -180 || lng > 180)) {
      res.status(400).json({ error: "Longitude must be between -180 and 180." });
      return;
    }

    const updated = updateSite(id, {
      name: body.name !== undefined ? asTrimmedString(body.name) : undefined,
      code: body.code !== undefined ? asTrimmedString(body.code) : undefined,
      type: body.type !== undefined ? mapSiteType(body.type) : undefined,
      location:
        body.location !== undefined ? asTrimmedString(body.location) : undefined,
      city: body.city !== undefined ? asTrimmedString(body.city) : undefined,
      country:
        body.country !== undefined ? asTrimmedString(body.country) : undefined,
      overview:
        body.overview !== undefined ? asTrimmedString(body.overview) : undefined,
      latitude: body.latitude !== undefined ? lat : undefined,
      longitude: body.longitude !== undefined ? lng : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
      assignedInspectorIds: Array.isArray(body.assignedInspectorIds)
        ? body.assignedInspectorIds.filter(
            (item: unknown): item is string => typeof item === "string"
          )
        : undefined,
    });

    if (!updated) {
      res.status(404).json({ error: "Site not found." });
      return;
    }

    // Keep linked open/synced inspections' site overview & site coordinates fresh
    const inspState = getServerState().inspections;
    for (const rec of Object.values(inspState)) {
      if (rec.siteId === updated.id) {
        rec.siteName = updated.name;
        rec.siteType = updated.type;
        rec.location = `${updated.location}, ${updated.city}, ${updated.country}`;
        rec.siteOverview = updated.overview;
        rec.siteLatitude = updated.latitude;
        rec.siteLongitude = updated.longitude;
      }
    }

    res.json({ site: updated });
  });

  // --- Inspectors API ---
  app.get("/api/inspectors", requireAuth, (req: AuthenticatedRequest, res) => {
    const all = listInspectors().map((i) => ({
      ...i,
      claimed: isInspectorClaimed(i.id),
    }));
    if (req.authUser?.role === "inspector" && req.authUser.inspectorId) {
      res.json({
        inspectors: all.filter((i) => i.id === req.authUser?.inspectorId),
      });
      return;
    }
    res.json({ inspectors: all });
  });

  app.post("/api/inspectors", requireAuth, requireSupervisor, (req, res) => {
    const body = req.body ?? {};
    const name = asTrimmedString(body.name);
    const code = asTrimmedString(body.code);

    if (!name) {
      res.status(400).json({ error: "Inspector name is required." });
      return;
    }
    if (!code) {
      res.status(400).json({ error: "Inspector code is required." });
      return;
    }

    const inspector = createInspector({
      name,
      code,
      email: asTrimmedString(body.email),
      region: asTrimmedString(body.region) || "Global",
      phone: asTrimmedString(body.phone),
      certifications: asTrimmedString(body.certifications),
      bio: asTrimmedString(body.bio),
    });
    res.status(201).json({ inspector: { ...inspector, claimed: false } });
  });

  app.patch(
    "/api/inspectors/:id",
    requireAuth,
    requireSupervisor,
    (req, res) => {
      const { id } = req.params;
      const body = req.body ?? {};

      if (body.name !== undefined && !asTrimmedString(body.name)) {
        res.status(400).json({ error: "Inspector name cannot be empty." });
        return;
      }

      const updated = updateInspector(id, {
        name: body.name !== undefined ? asTrimmedString(body.name) : undefined,
        code: body.code !== undefined ? asTrimmedString(body.code) : undefined,
        email:
          body.email !== undefined ? asTrimmedString(body.email) : undefined,
        region:
          body.region !== undefined ? asTrimmedString(body.region) : undefined,
        phone:
          body.phone !== undefined ? asTrimmedString(body.phone) : undefined,
        certifications:
          body.certifications !== undefined
            ? asTrimmedString(body.certifications)
            : undefined,
        bio: body.bio !== undefined ? asTrimmedString(body.bio) : undefined,
        active: typeof body.active === "boolean" ? body.active : undefined,
      });

      if (!updated) {
        res.status(404).json({ error: "Inspector not found." });
        return;
      }
      res.json({
        inspector: { ...updated, claimed: isInspectorClaimed(updated.id) },
      });
    }
  );

  app.post(
    "/api/inspectors/:id/reset-credentials",
    requireAuth,
    requireSupervisor,
    (req, res) => {
      const { id } = req.params;
      const inspector = getDirectoryState().inspectors[id];
      if (!inspector) {
        res.status(404).json({ error: "Inspector not found." });
        return;
      }
      resetInspectorPasswordClaim(id);
      res.json({ ok: true, id });
    }
  );

  // --- Inspections API ---
  app.get("/api/inspections", requireAuth, (req: AuthenticatedRequest, res) => {
    const all = listInspections();
    if (req.authUser?.role === "inspector") {
      const inspProfile = getDirectoryState().inspectors[req.authUser.id];
      const scoped = inspProfile
        ? all.filter((rec) => isInspectionAssignedToInspector(rec, inspProfile))
        : [];
      res.json({ inspections: scoped });
      return;
    }
    res.json({ inspections: all });
  });

  app.post("/api/inspections", requireAuth, requireSupervisor, (req, res) => {
    try {
      const body = req.body ?? {};
      const directory = getDirectoryState();
      const sites = Object.values(directory.sites);
      const inspectors = Object.values(directory.inspectors);

      const matchedSite = body.siteId
        ? sites.find((s) => s.id === body.siteId)
        : undefined;
      const matchedInspector = body.inspectorId
        ? inspectors.find((i) => i.id === body.inspectorId)
        : undefined;

      const siteName = (matchedSite?.name ?? asTrimmedString(body.siteName)).trim();
      const inspectorName = matchedInspector
        ? `${matchedInspector.name} (${matchedInspector.code})`
        : asTrimmedString(body.inspector ?? body.inspectorName);
      const dueDate = asTrimmedString(body.dueDate);

      if (!siteName) {
        res.status(400).json({ error: "Site is required." });
        return;
      }
      if (!inspectorName) {
        res.status(400).json({ error: "Inspector is required." });
        return;
      }
      if (!dueDate) {
        res.status(400).json({ error: "Due date is required." });
        return;
      }

      const customParameters: CustomParameterInput[] = Array.isArray(
        body.customParameters
      )
        ? body.customParameters
            .filter(
              (p: unknown): p is CustomParameterInput =>
                typeof p === "object" &&
                p !== null &&
                typeof (p as CustomParameterInput).label === "string"
            )
            .map((p: CustomParameterInput) => ({
              label: p.label,
              target: typeof p.target === "string" ? p.target : undefined,
              unit: typeof p.unit === "string" ? p.unit : undefined,
            }))
        : [];

      const inspectionMode: InspectionMode =
        body.inspectionMode === "multi-stage" ? "multi-stage" : "single-stage";

      const stages: CreateStageInput[] = Array.isArray(body.stages)
        ? body.stages
            .filter(
              (s: unknown): s is Record<string, unknown> =>
                typeof s === "object" && s !== null
            )
            .slice(0, 12)
            .map((s: Record<string, unknown>) => ({
              name: asTrimmedString(s.name),
              description: asTrimmedString(s.description) || undefined,
              includeBaselineChecks: Boolean(s.includeBaselineChecks),
              parameters: Array.isArray(s.parameters)
                ? s.parameters
                    .filter(
                      (p: unknown): p is CustomParameterInput =>
                        typeof p === "object" &&
                        p !== null &&
                        typeof (p as CustomParameterInput).label === "string"
                    )
                    .map((p: CustomParameterInput) => ({
                      label: p.label,
                      target:
                        typeof p.target === "string" ? p.target : undefined,
                      unit: typeof p.unit === "string" ? p.unit : undefined,
                    }))
                : [],
            }))
        : [];

      const created = createInspection({
        siteId:
          matchedSite?.id ??
          (typeof body.siteId === "string" ? body.siteId : undefined),
        siteName,
        siteType: mapSiteType(matchedSite?.type ?? body.siteType),
        location: matchedSite
          ? `${matchedSite.location}, ${matchedSite.city}, ${matchedSite.country}`
          : asTrimmedString(body.location) || undefined,
        siteOverview: matchedSite?.overview || undefined,
        siteLatitude: matchedSite?.latitude,
        siteLongitude: matchedSite?.longitude,
        dueDate,
        inspectorId:
          matchedInspector?.id ??
          (typeof body.inspectorId === "string" ? body.inspectorId : undefined),
        inspectorName,
        notes: asTrimmedString(body.notes) || undefined,
        inspectionMode,
        stages,
        customParameters,
      });

      res.status(201).json({ inspection: created });
    } catch (err) {
      res.status(500).json({
        error:
          err instanceof Error ? err.message : "Failed to create inspection",
      });
    }
  });

  app.patch(
    "/api/inspections/:id",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const existing = getServerState().inspections[id];
      if (!existing) {
        res.status(404).json({ error: "Inspection not found." });
        return;
      }

      const user = req.authUser!;
      const isInspector = user.role === "inspector";
      if (isInspector) {
        const inspProfile = getDirectoryState().inspectors[user.id];
        if (
          !inspProfile ||
          !isInspectionAssignedToInspector(existing, inspProfile)
        ) {
          res.status(403).json({
            error: "You may only update inspections assigned to you.",
          });
          return;
        }
      }

      const actorLabel = user.code ? `${user.name} (${user.code})` : user.name;
      const sanitized = sanitizeClientInspection(
        {
          ...existing,
          ...(req.body ?? {}),
          id: existing.id,
        },
        existing,
        isInspector,
        actorLabel
      );
      if (
        isInspector &&
        inspectorAttemptedInspectionWithoutArrival(sanitized, existing)
      ) {
        res.status(403).json({
          error:
            "On-site geotagged image or video arrival verification is required before inspecting checklist parameters.",
        });
        return;
      }
      const updated = updateInspectionOnServer(id, sanitized);
      res.json({ inspection: updated });
    }
  );

  app.post(
    "/api/inspections/sync",
    requireAuth,
    (req: AuthenticatedRequest, res) => {
      const body = req.body ?? {};
      const pendingList: InspectionRecord[] = Array.isArray(body.inspections)
        ? body.inspections
        : [];
      const forceIds: string[] = Array.isArray(body.forceIds)
        ? body.forceIds.filter(
            (x: unknown): x is string => typeof x === "string"
          )
        : [];

      const user = req.authUser!;
      const isInspector = user.role === "inspector";
      const actorLabel = user.code ? `${user.name} (${user.code})` : user.name;
      const inspProfile = isInspector
        ? getDirectoryState().inspectors[user.id]
        : undefined;

      const authorizedPending: InspectionRecord[] = [];
      for (const rec of pendingList) {
        const existing = getServerState().inspections[rec.id];
        if (isInspector) {
          if (
            !inspProfile ||
            !existing ||
            !isInspectionAssignedToInspector(existing, inspProfile)
          ) {
            res.status(403).json({
              error: `Forbidden sync attempt on unassigned inspection ${rec.id}.`,
            });
            return;
          }
        }
        const sanitized = sanitizeClientInspection(
          rec,
          existing,
          isInspector,
          actorLabel
        );
        if (
          isInspector &&
          existing &&
          inspectorAttemptedInspectionWithoutArrival(sanitized, existing)
        ) {
          res.status(403).json({
            error: `On-site geotagged image or video arrival verification is required before submitting inspection edits for ${existing.siteName}.`,
          });
          return;
        }
        authorizedPending.push(sanitized);
      }

      // Only supervisors have authority to force-overwrite conflicts
      const effectiveForceIds = isInspector ? [] : forceIds;
      const result = syncInspectionsFromClient(
        authorizedPending,
        effectiveForceIds,
        { name: actorLabel, role: user.role }
      );
      const allServer = listInspections();
      const visibleServer =
        isInspector && inspProfile
          ? allServer.filter((r) =>
              isInspectionAssignedToInspector(r, inspProfile)
            )
          : allServer;

      res.json({
        synced: result.synced,
        conflicts: result.conflicts,
        serverInspections: visibleServer,
      });
    }
  );

  app.post(
    "/api/inspections/:id/resolve-conflict",
    requireAuth,
    requireSupervisor,
    (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const body = req.body ?? {};
      const existing = getServerState().inspections[id];
      if (!existing) {
        res.status(404).json({ error: "Inspection not found." });
        return;
      }

      const supervisorLabel = req.authUser!.code
        ? `${req.authUser!.name} (${req.authUser!.code})`
        : req.authUser!.name;

      const strategy =
        body.strategy === "accept-server" ||
        body.strategy === "apply-submission" ||
        body.strategy === "custom-merge"
          ? body.strategy
          : "custom-merge";

      const updated = resolveConflictBySupervisor(id, {
        supervisorName: supervisorLabel,
        strategy,
        submissionId:
          typeof body.submissionId === "string" ? body.submissionId : undefined,
        items: Array.isArray(body.items) ? body.items : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
      });
      if (!updated) {
        res.status(404).json({ error: "Inspection not found." });
        return;
      }
      res.json({ inspection: updated });
    }
  );

  app.post(
    "/api/inspections/:id/validate",
    requireAuth,
    requireSupervisor,
    (req: AuthenticatedRequest, res) => {
      const { id } = req.params;
      const body = req.body ?? {};
      const cleanSig = sanitizeSignature({
        dataUrl: body.dataUrl,
        signerName: req.authUser!.name,
        signerRole: "supervisor",
        signedAt: new Date().toISOString(),
        latitude:
          typeof body.latitude === "number" ? body.latitude : undefined,
        longitude:
          typeof body.longitude === "number" ? body.longitude : undefined,
      });

      if (!cleanSig) {
        res.status(400).json({ error: "Valid PNG signature image required." });
        return;
      }

      const updated = validateInspectionBySupervisor(id, cleanSig);
      if (!updated) {
        res.status(404).json({ error: "Inspection not found." });
        return;
      }
      res.json({ inspection: updated });
    }
  );

  app.post(
    "/api/inspections/:id/simulate-conflict",
    requireAuth,
    requireSupervisor,
    (req, res) => {
      const { id } = req.params;
      const state = getServerState();
      if (!state.inspections[id]) {
        res.status(404).json({ error: "Inspection not found on server." });
        return;
      }
      const updated = simulateServerConflict(id);
      res.json({ inspection: updated });
    }
  );

  // --- Frontend Serving (Vite Dev Middleware / Static Prod Build) ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== "true",
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("/{*path}", (_req, res) => {
      const indexFile = path.join(distDir, "index.html");
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send("Build output not found. Run npm run build.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nirikshan server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Nirikshan server:", err);
  process.exit(1);
});
