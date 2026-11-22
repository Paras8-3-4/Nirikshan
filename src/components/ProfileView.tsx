import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  User,
} from "lucide-react";
import type {
  AuthUser,
  InspectionRecord,
  Inspector,
  Site,
} from "../lib/types.ts";

interface ProfileViewProps {
  currentUser: AuthUser;
  authToken: string;
  sites: Site[];
  inspectors: Inspector[];
  inspections: InspectionRecord[];
  offlineMode: boolean;
  onProfileUpdated: (user: AuthUser, nextToken?: string) => void;
  onOpenInspection: (inspectionId: string) => void;
}

export default function ProfileView({
  currentUser,
  authToken,
  sites,
  inspectors,
  inspections,
  offlineMode,
  onProfileUpdated,
  onOpenInspection,
}: ProfileViewProps) {
  const isSupervisor = currentUser.role === "supervisor";

  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email ?? "");
  const [phone, setPhone] = useState(currentUser.phone ?? "");
  const [department, setDepartment] = useState(currentUser.department ?? "");
  const [certifications, setCertifications] = useState(
    currentUser.certifications ?? ""
  );
  const [bio, setBio] = useState(currentUser.bio ?? "");
  const [envPasscodeManaged, setEnvPasscodeManaged] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (offlineMode) return;
      try {
        const res = await fetch("/api/profile", {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!active || !data.profile) return;
        const p = data.profile as AuthUser;
        setName(p.name ?? "");
        setEmail(p.email ?? "");
        setPhone(p.phone ?? "");
        setDepartment(p.department ?? "");
        setCertifications(p.certifications ?? "");
        setBio(p.bio ?? "");
        setEnvPasscodeManaged(Boolean(data.envPasscodeManaged));
        onProfileUpdated(p);
      } catch {
        // Retain in-memory profile state if offline
      }
    }
    loadProfile();
    return () => {
      active = false;
    };
  }, [authToken, offlineMode]);

  const roleStats = useMemo(() => {
    const completed = inspections.filter((r) => r.status === "completed").length;
    const pending = inspections.filter((r) => r.status !== "completed").length;
    const conflicts = inspections.filter(
      (r) => r.syncStatus === "conflict" || r.status === "conflict"
    ).length;
    const unsynced = inspections.filter(
      (r) => r.syncStatus === "pending"
    ).length;
    const awaitingQa = inspections.filter(
      (r) => r.status === "completed" && !r.supervisorValidation
    ).length;

    return {
      totalInspections: inspections.length,
      completed,
      pending,
      conflicts,
      unsynced,
      awaitingQa,
      activeSites: sites.filter((s) => s.active).length,
      activeInspectors: inspectors.filter((i) => i.active).length,
    };
  }, [inspections, sites, inspectors]);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (offlineMode) {
      setProfileErr("Go online to save profile updates to the server.");
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    setProfileErr(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          department,
          certifications,
          bio,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile.");
      }
      if (data.profile) {
        onProfileUpdated(data.profile, data.token);
      }
      setProfileMsg("Profile details updated.");
    } catch (err) {
      setProfileErr(
        err instanceof Error ? err.message : "Could not save profile."
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (offlineMode) {
      setPasswordErr("Go online to update account credentials.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordErr("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr("New password and confirmation do not match.");
      return;
    }

    setSavingPassword(true);
    setPasswordMsg(null);
    setPasswordErr(null);

    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Could not update password.");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg("Password updated securely.");
    } catch (err) {
      setPasswordErr(
        err instanceof Error ? err.message : "Could not update password."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500">
            <span>{isSupervisor ? "SUPERVISOR PROFILE" : "INSPECTOR PROFILE"}</span>
            {currentUser.code && (
              <>
                <span aria-hidden="true">·</span>
                <span>{currentUser.code}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {name || currentUser.name}
          </h1>
          <p className="text-xs text-slate-600">
            {department || (isSupervisor ? "Operations Oversight" : "Field Execution")}
            {email ? ` · ${email}` : ""}
            {phone ? ` · ${phone}` : ""}
          </p>
        </div>

        <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
          {isSupervisor ? (
            <>
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <span>Supervisor Authority · QA &amp; Conflict Override</span>
            </>
          ) : (
            <>
              <User className="h-4 w-4 text-blue-700" />
              <span>Field Inspector · Assigned Sites Locked</span>
            </>
          )}
        </div>
      </div>

      {/* Role Metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {isSupervisor ? "Active Sites" : "Assigned Sites"}
          </div>
          <div className="mt-1 text-2xl font-mono font-bold text-slate-900 tabular-nums">
            {roleStats.activeSites}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {isSupervisor ? "Open / Pending Reports" : "Pending Queue"}
          </div>
          <div className="mt-1 text-2xl font-mono font-bold text-amber-700 tabular-nums">
            {roleStats.pending}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Completed Reports</div>
          <div className="mt-1 text-2xl font-mono font-bold text-emerald-700 tabular-nums">
            {roleStats.completed}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">
            {isSupervisor ? "Awaiting QA / Conflicts" : "Local Unsynced"}
          </div>
          <div className="mt-1 text-2xl font-mono font-bold text-slate-900 tabular-nums">
            {isSupervisor
              ? `${roleStats.awaitingQa} / ${roleStats.conflicts}`
              : roleStats.unsynced}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* Editable Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-6 space-y-4"
        >
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Account &amp; Operational Credentials
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Details appear on compliance reports, validation signatures, and
              operations directory records.
            </p>
          </div>

          {profileErr && (
            <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{profileErr}</span>
            </div>
          )}

          {profileMsg && (
            <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              <span>{profileMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isSupervisor ? "Department / Scope" : "Assigned Region"}
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder={isSupervisor ? "Global QA Operations" : "EU-Central"}
                className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="inline-flex items-center gap-1">
                  <Mail className="h-3 w-3 text-slate-500" />
                  Email
                </span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@nirikshan.ops"
                className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                <span className="inline-flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-500" />
                  Phone / Radio Contact
                </span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+49 89 5550 1420"
                className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Safety &amp; Audit Certifications
            </label>
            <input
              type="text"
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              placeholder="e.g. ISO 45001 Lead Auditor · OSHA 30"
              className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operational Bio / Role Responsibilities
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingProfile || offlineMode}
              className="min-h-[38px] inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{savingProfile ? "Saving..." : "Save Profile"}</span>
            </button>
          </div>
        </form>

        {/* Password & Assigned Scope Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handleChangePassword}
            className="rounded-lg border border-slate-200 bg-white p-6 space-y-4"
          >
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <KeyRound className="h-4 w-4 text-slate-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Change Password
              </h2>
            </div>

            {envPasscodeManaged ? (
              <p className="text-xs text-slate-600">
                Supervisor login is currently governed by an environment
                passcode (`SUPERVISOR_PASSCODE`). Update it in your deployment
                secrets panel.
              </p>
            ) : (
              <>
                {passwordErr && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    {passwordErr}
                  </div>
                )}
                {passwordMsg && (
                  <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    {passwordMsg}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password (min 6 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full min-h-[38px] rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingPassword || offlineMode}
                  className="w-full min-h-[38px] rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-45"
                >
                  {savingPassword ? "Updating..." : "Update Password"}
                </button>
              </>
            )}
          </form>

          {/* Role Scope List */}
          <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-3">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
              <Building2 className="h-4 w-4 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                {isSupervisor
                  ? `Active Network Sites (${roleStats.activeSites})`
                  : `My Assigned Sites (${sites.length})`}
              </h2>
            </div>

            {sites.length === 0 ? (
              <p className="text-xs text-slate-500">
                No active sites assigned.
              </p>
            ) : (
              <ul className="divide-y divide-slate-200 max-h-[260px] overflow-y-auto">
                {sites
                  .filter((s) => (isSupervisor ? s.active : true))
                  .map((site) => {
                    const siteInsp = inspections.find(
                      (r) => r.siteId === site.id
                    );
                    return (
                      <li
                        key={site.id}
                        className="py-2.5 flex items-start justify-between gap-2 text-xs"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900">
                            {site.name}{" "}
                            <span className="font-mono text-[11px] text-slate-500">
                              ({site.code})
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span>
                              {site.city}, {site.country}
                            </span>
                          </div>
                        </div>
                        {siteInsp && (
                          <button
                            type="button"
                            onClick={() => onOpenInspection(siteInsp.id)}
                            className="text-[11px] font-semibold text-slate-800 underline underline-offset-2 hover:text-slate-950 shrink-0"
                          >
                            Open Queue
                          </button>
                        )}
                      </li>
                    );
                  })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
