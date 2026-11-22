import crypto from "crypto";
import type { AuthUser, UserRole } from "./types.ts";

interface SupervisorCredentialRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  certifications: string;
  bio: string;
  passwordHash: string;
  claimedAt: string;
}

interface AuthStoreState {
  signingSecret: string;
  supervisor: SupervisorCredentialRecord | null;
  envSupervisorProfile: {
    name: string;
    email: string;
    phone: string;
    department: string;
    certifications: string;
    bio: string;
  };
  inspectorHashes: Record<string, string>;
}

const globalForAuth = globalThis as unknown as {
  __fieldInspectAuth?: AuthStoreState;
};

function getAuthState(): AuthStoreState {
  if (!globalForAuth.__fieldInspectAuth) {
    const envSecret = process.env.SESSION_SECRET?.trim();
    globalForAuth.__fieldInspectAuth = {
      signingSecret: envSecret || crypto.randomBytes(32).toString("hex"),
      supervisor: null,
      envSupervisorProfile: {
        name: "Operations Supervisor",
        email: "supervisor@nirikshan.ops",
        phone: "",
        department: "Global QA & Field Operations",
        certifications: "ISO 9001 / 45001 Operations Director",
        bio: "Oversees multi-site facility dispatch, conflict resolution, and compliance sign-off.",
      },
      inspectorHashes: {},
    };
  }
  return globalForAuth.__fieldInspectAuth;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(":");
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, "hex");
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function isEnvSupervisorPasscodeConfigured(): boolean {
  return Boolean(process.env.SUPERVISOR_PASSCODE?.trim());
}

export function isSupervisorClaimed(): boolean {
  return Boolean(getAuthState().supervisor) || isEnvSupervisorPasscodeConfigured();
}

export function isInspectorClaimed(inspectorId: string): boolean {
  return Boolean(getAuthState().inspectorHashes[inspectorId]);
}

function toSupervisorAuthUser(
  id: string,
  profile: {
    name: string;
    email: string;
    phone: string;
    department: string;
    certifications: string;
    bio: string;
  }
): AuthUser {
  return {
    id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    department: profile.department,
    certifications: profile.certifications,
    bio: profile.bio,
    role: "supervisor",
    code: "SUP-001",
  };
}

export function claimSupervisorAccount(input: {
  name: string;
  email: string;
  password: string;
}): AuthUser {
  const state = getAuthState();
  if (state.supervisor || isEnvSupervisorPasscodeConfigured()) {
    throw new Error("Supervisor account has already been claimed.");
  }
  const id = "sup-001";
  state.supervisor = {
    id,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: "",
    department: "Global QA & Field Operations",
    certifications: "Operations QA Supervisor",
    bio: "Site oversight, inspection dispatch, and compliance verification lead.",
    passwordHash: hashPassword(input.password),
    claimedAt: new Date().toISOString(),
  };

  return toSupervisorAuthUser(id, state.supervisor);
}

export function loginSupervisor(password: string): AuthUser | null {
  const state = getAuthState();
  const envPasscode = process.env.SUPERVISOR_PASSCODE?.trim();
  if (envPasscode) {
    const a = Buffer.from(password);
    const b = Buffer.from(envPasscode);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }
    return toSupervisorAuthUser("sup-env", state.envSupervisorProfile);
  }

  const sup = state.supervisor;
  if (!sup) return null;
  if (!verifyPassword(password, sup.passwordHash)) return null;

  return toSupervisorAuthUser(sup.id, sup);
}

export function getSupervisorAuthUser(userId: string): AuthUser | null {
  const state = getAuthState();
  if (isEnvSupervisorPasscodeConfigured() && userId === "sup-env") {
    return toSupervisorAuthUser("sup-env", state.envSupervisorProfile);
  }
  if (state.supervisor && state.supervisor.id === userId) {
    return toSupervisorAuthUser(state.supervisor.id, state.supervisor);
  }
  return null;
}

export function updateSupervisorProfile(
  userId: string,
  input: {
    name?: string;
    email?: string;
    phone?: string;
    department?: string;
    certifications?: string;
    bio?: string;
  }
): AuthUser | null {
  const state = getAuthState();
  if (isEnvSupervisorPasscodeConfigured() && userId === "sup-env") {
    const p = state.envSupervisorProfile;
    state.envSupervisorProfile = {
      name: input.name !== undefined && input.name.trim() ? input.name.trim() : p.name,
      email: input.email !== undefined ? input.email.trim() : p.email,
      phone: input.phone !== undefined ? input.phone.trim() : p.phone,
      department: input.department !== undefined ? input.department.trim() : p.department,
      certifications:
        input.certifications !== undefined
          ? input.certifications.trim()
          : p.certifications,
      bio: input.bio !== undefined ? input.bio.trim() : p.bio,
    };
    return toSupervisorAuthUser("sup-env", state.envSupervisorProfile);
  }

  const sup = state.supervisor;
  if (!sup || sup.id !== userId) return null;
  sup.name = input.name !== undefined && input.name.trim() ? input.name.trim() : sup.name;
  sup.email = input.email !== undefined ? input.email.trim() : sup.email;
  sup.phone = input.phone !== undefined ? input.phone.trim() : sup.phone;
  sup.department =
    input.department !== undefined ? input.department.trim() : sup.department;
  sup.certifications =
    input.certifications !== undefined
      ? input.certifications.trim()
      : sup.certifications;
  sup.bio = input.bio !== undefined ? input.bio.trim() : sup.bio;
  return toSupervisorAuthUser(sup.id, sup);
}

export function changeSupervisorPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): { ok: boolean; error?: string } {
  if (isEnvSupervisorPasscodeConfigured()) {
    return {
      ok: false,
      error: "Supervisor passcode is managed via environment configuration.",
    };
  }
  const sup = getAuthState().supervisor;
  if (!sup || sup.id !== userId) {
    return { ok: false, error: "Supervisor record not found." };
  }
  if (!verifyPassword(currentPassword, sup.passwordHash)) {
    return { ok: false, error: "Current password is incorrect." };
  }
  sup.passwordHash = hashPassword(newPassword);
  return { ok: true };
}

export function claimInspectorPassword(
  inspectorId: string,
  password: string
): boolean {
  const state = getAuthState();
  if (state.inspectorHashes[inspectorId]) {
    return false;
  }
  state.inspectorHashes[inspectorId] = hashPassword(password);
  return true;
}

export function verifyInspectorPassword(
  inspectorId: string,
  password: string
): boolean {
  const stored = getAuthState().inspectorHashes[inspectorId];
  if (!stored) return false;
  return verifyPassword(password, stored);
}

export function changeInspectorPassword(
  inspectorId: string,
  currentPassword: string,
  newPassword: string
): { ok: boolean; error?: string } {
  const state = getAuthState();
  const stored = state.inspectorHashes[inspectorId];
  if (!stored) {
    return { ok: false, error: "Inspector credentials are not claimed yet." };
  }
  if (!verifyPassword(currentPassword, stored)) {
    return { ok: false, error: "Current password is incorrect." };
  }
  state.inspectorHashes[inspectorId] = hashPassword(newPassword);
  return { ok: true };
}

export function resetInspectorPasswordClaim(inspectorId: string): void {
  const state = getAuthState();
  delete state.inspectorHashes[inspectorId];
}

interface TokenPayload {
  sub: string;
  name: string;
  role: UserRole;
  code?: string;
  email?: string;
  inspectorId?: string;
  exp: number;
}

export function signAuthToken(user: AuthUser): string {
  const secret = getAuthState().signingSecret;
  const payload: TokenPayload = {
    sub: user.id,
    name: user.name,
    role: user.role,
    code: user.code,
    email: user.email,
    inspectorId: user.inspectorId,
    exp: Date.now() + 1000 * 60 * 60 * 12,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function verifyAuthToken(token: string): AuthUser | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const secret = getAuthState().signingSecret;
  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as TokenPayload;
    if (!parsed || typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      return null;
    }
    if (parsed.role !== "supervisor" && parsed.role !== "inspector") {
      return null;
    }
    return {
      id: parsed.sub,
      name: parsed.name,
      role: parsed.role,
      code: parsed.code,
      email: parsed.email,
      inspectorId: parsed.inspectorId,
    };
  } catch {
    return null;
  }
}
