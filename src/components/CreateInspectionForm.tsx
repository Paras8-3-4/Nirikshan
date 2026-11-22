import React, { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Layers, Plus, Trash2 } from "lucide-react";
import type {
  CreateStageInput,
  InspectionMode,
  Inspector,
  Site,
} from "../lib/types.ts";

export interface CustomInspectionParameter {
  label: string;
  target?: string;
  unit?: string;
}

interface StageDraft {
  id: string;
  name: string;
  description: string;
  includeBaselineChecks: boolean;
  parameters: CustomInspectionParameter[];
  draftLabel: string;
  draftTarget: string;
  draftUnit: string;
}

interface CreateInspectionFormProps {
  sites: Site[];
  inspectors: Inspector[];
  authToken: string;
  onCreated?: () => void | Promise<void>;
  onNavigateToExecution?: () => void;
}

function makeDefaultStages(): StageDraft[] {
  return [
    {
      id: "draft-s1",
      name: "Stage 1: Pre-Start & Perimeter",
      description: "",
      includeBaselineChecks: true,
      parameters: [],
      draftLabel: "",
      draftTarget: "",
      draftUnit: "",
    },
    {
      id: "draft-s2",
      name: "Stage 2: Process & Calibration",
      description: "",
      includeBaselineChecks: false,
      parameters: [{ label: "Operating Temp", target: "< 75", unit: "C" }],
      draftLabel: "",
      draftTarget: "",
      draftUnit: "",
    },
  ];
}

export default function CreateInspectionForm({
  sites,
  inspectors,
  authToken,
  onCreated,
  onNavigateToExecution,
}: CreateInspectionFormProps) {
  const activeSites = sites.filter((s) => s.active);
  const activeInspectors = inspectors.filter((i) => i.active);

  const [siteId, setSiteId] = useState<string>("");
  const [inspectorId, setInspectorId] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("2026-11-28");
  const [notes, setNotes] = useState<string>("");

  const [inspectionMode, setInspectionMode] =
    useState<InspectionMode>("single-stage");

  // Single-stage custom parameters
  const [paramLabel, setParamLabel] = useState<string>("");
  const [paramTarget, setParamTarget] = useState<string>("");
  const [paramUnit, setParamUnit] = useState<string>("");
  const [customParameters, setCustomParameters] = useState<
    CustomInspectionParameter[]
  >([]);

  // Multi-stage drafts
  const [stages, setStages] = useState<StageDraft[]>(makeDefaultStages);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId && activeSites.length > 0) {
      setSiteId(activeSites[0].id);
    } else if (siteId && !activeSites.some((s) => s.id === siteId)) {
      setSiteId(activeSites[0]?.id ?? "");
    }
  }, [siteId, activeSites]);

  useEffect(() => {
    if (!inspectorId && activeInspectors.length > 0) {
      setInspectorId(activeInspectors[0].id);
    } else if (
      inspectorId &&
      !activeInspectors.some((i) => i.id === inspectorId)
    ) {
      setInspectorId(activeInspectors[0]?.id ?? "");
    }
  }, [inspectorId, activeInspectors]);

  function addCustomParameter() {
    if (!paramLabel.trim()) return;
    setCustomParameters((prev) => [
      ...prev,
      {
        label: paramLabel.trim(),
        target: paramTarget.trim() || undefined,
        unit: paramUnit.trim() || undefined,
      },
    ]);
    setParamLabel("");
    setParamTarget("");
    setParamUnit("");
  }

  function removeCustomParameter(index: number) {
    setCustomParameters((prev) => prev.filter((_, idx) => idx !== index));
  }

  function addStage() {
    setStages((prev) => [
      ...prev,
      {
        id: `draft-s-${Date.now()}-${prev.length + 1}`,
        name: `Stage ${prev.length + 1}`,
        description: "",
        includeBaselineChecks: false,
        parameters: [],
        draftLabel: "",
        draftTarget: "",
        draftUnit: "",
      },
    ]);
  }

  function removeStage(stageId: string) {
    setStages((prev) =>
      prev.length <= 1 ? prev : prev.filter((s) => s.id !== stageId)
    );
  }

  function updateStage(stageId: string, patch: Partial<StageDraft>) {
    setStages((prev) =>
      prev.map((s) => (s.id === stageId ? { ...s, ...patch } : s))
    );
  }

  function addParameterToStage(stageId: string) {
    setStages((prev) =>
      prev.map((s) => {
        if (s.id !== stageId || !s.draftLabel.trim()) return s;
        return {
          ...s,
          parameters: [
            ...s.parameters,
            {
              label: s.draftLabel.trim(),
              target: s.draftTarget.trim() || undefined,
              unit: s.draftUnit.trim() || undefined,
            },
          ],
          draftLabel: "",
          draftTarget: "",
          draftUnit: "",
        };
      })
    );
  }

  function removeParameterFromStage(stageId: string, paramIndex: number) {
    setStages((prev) =>
      prev.map((s) =>
        s.id === stageId
          ? {
              ...s,
              parameters: s.parameters.filter((_, idx) => idx !== paramIndex),
            }
          : s
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    const selectedSite = activeSites.find((s) => s.id === siteId);
    const selectedInspector = activeInspectors.find(
      (i) => i.id === inspectorId
    );

    if (!selectedSite) {
      setSubmitting(false);
      setError("Please select an active site first (or create one in Sites).");
      return;
    }

    if (!selectedInspector) {
      setSubmitting(false);
      setError(
        "Please select an active inspector first (or create one in Inspectors)."
      );
      return;
    }

    if (!dueDate) {
      setSubmitting(false);
      setError("Please choose a due date.");
      return;
    }

    let preparedStages: CreateStageInput[] = [];
    if (inspectionMode === "multi-stage") {
      preparedStages = stages
        .filter((s) => s.name.trim().length > 0)
        .map((s) => ({
          name: s.name.trim(),
          description: s.description.trim() || undefined,
          includeBaselineChecks: s.includeBaselineChecks,
          parameters: s.parameters,
        }));

      if (preparedStages.length === 0) {
        setSubmitting(false);
        setError("Add at least one named stage for a multi-stage inspection.");
        return;
      }

      const emptyStage = preparedStages.find(
        (s) => !s.includeBaselineChecks && s.parameters.length === 0
      );
      if (emptyStage) {
        setSubmitting(false);
        setError(
          `Stage "${emptyStage.name}" has no parameters. Add at least one parameter or enable baseline safety checks.`
        );
        return;
      }
    }

    try {
      const res = await fetch("/api/inspections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          siteId: selectedSite.id,
          siteName: selectedSite.name,
          siteType: selectedSite.type,
          location: `${selectedSite.location}, ${selectedSite.city}, ${selectedSite.country}`,
          inspectorId: selectedInspector.id,
          inspector: selectedInspector.name,
          inspectorName: `${selectedInspector.name} (${selectedInspector.code})`,
          dueDate,
          notes,
          inspectionMode,
          stages: inspectionMode === "multi-stage" ? preparedStages : undefined,
          customParameters:
            inspectionMode === "single-stage" ? customParameters : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data.error || `Failed to create inspection (${res.status})`
        );
      }

      setSuccessMsg(
        `Created ${
          inspectionMode === "multi-stage"
            ? `${preparedStages.length}-stage`
            : "single-stage"
        } inspection for "${selectedSite.name}" assigned to ${
          selectedInspector.name
        } (${selectedInspector.code}).`
      );
      setNotes("");
      setCustomParameters([]);
      if (inspectionMode === "multi-stage") {
        setStages(makeDefaultStages());
      }

      if (onCreated) {
        await onCreated();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create inspection"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 space-y-5">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Create New Inspection
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Link an active site, assign an inspector, and configure either a
          single-stage checklist or a multi-stage workflow with distinct
          parameters per stage.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-700" />
            <span>{successMsg}</span>
          </div>
          {onNavigateToExecution && (
            <button
              type="button"
              onClick={onNavigateToExecution}
              className="text-xs font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950 whitespace-nowrap shrink-0"
            >
              Open in Field Execution
            </button>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="insp-site"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Target Site *
            </label>
            <select
              id="insp-site"
              required
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="w-full min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <option value="">Select active site...</option>
              {activeSites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city}, {s.country})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="insp-inspector"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Assigned Inspector *
            </label>
            <select
              id="insp-inspector"
              required
              value={inspectorId}
              onChange={(e) => setInspectorId(e.target.value)}
              className="w-full min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
            >
              <option value="">Select active inspector...</option>
              {activeInspectors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="insp-due-date"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Due Date *
            </label>
            <input
              id="insp-due-date"
              type="date"
              required
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
            />
          </div>

          <div>
            <label
              htmlFor="insp-notes"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Scope / Operational Notes
            </label>
            <input
              id="insp-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly pressure & safety perimeter check"
              className="w-full min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-blue-700"
            />
          </div>
        </div>

        {/* Inspection Structure Toggle: Single-Stage vs Multi-Stage */}
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-700" />
              <span className="text-xs font-semibold text-slate-900">
                Inspection Stage Structure
              </span>
            </div>

            <div className="inline-flex rounded-md border border-slate-300 bg-white p-1">
              <button
                type="button"
                onClick={() => setInspectionMode("single-stage")}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  inspectionMode === "single-stage"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Single-Stage
              </button>
              <button
                type="button"
                onClick={() => setInspectionMode("multi-stage")}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  inspectionMode === "multi-stage"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Multi-Stage ({stages.length})
              </button>
            </div>
          </div>

          {inspectionMode === "single-stage" ? (
            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Custom Inspection Parameters
                </span>
                <span className="text-xs text-slate-500">
                  Appended after the 3 standard safety checks
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                <input
                  type="text"
                  value={paramLabel}
                  onChange={(e) => setParamLabel(e.target.value)}
                  placeholder="Parameter label (e.g. Oil Temp)"
                  className="sm:col-span-5 min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
                />
                <input
                  type="text"
                  value={paramTarget}
                  onChange={(e) => setParamTarget(e.target.value)}
                  placeholder="Target (e.g. under 75)"
                  className="sm:col-span-3 min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400"
                />
                <input
                  type="text"
                  value={paramUnit}
                  onChange={(e) => setParamUnit(e.target.value)}
                  placeholder="Unit (C)"
                  className="sm:col-span-2 min-h-[40px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-mono text-slate-900 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={addCustomParameter}
                  className="sm:col-span-2 min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Param
                </button>
              </div>

              {customParameters.length > 0 && (
                <ul className="divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
                  {customParameters.map((param, idx) => (
                    <li
                      key={`${param.label}-${idx}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-slate-700">
                        <span className="font-semibold text-slate-900">
                          {param.label}
                        </span>
                        {param.target && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-mono text-slate-600">
                              Target: {param.target}
                            </span>
                          </>
                        )}
                        {param.unit && (
                          <>
                            <span aria-hidden="true" className="text-slate-300">
                              ·
                            </span>
                            <span className="font-mono text-slate-600">
                              Unit: {param.unit}
                            </span>
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCustomParameter(idx)}
                        aria-label={`Remove ${param.label}`}
                        className="inline-flex items-center gap-1 text-red-700 hover:text-red-900 font-medium whitespace-nowrap shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs text-slate-600">
                  Define sequential plant/farm/site stages, each with its own
                  parameters.
                </span>
                <button
                  type="button"
                  onClick={addStage}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Stage
                </button>
              </div>

              <div className="space-y-3">
                {stages.map((stage, sIdx) => (
                  <div
                    key={stage.id}
                    className="rounded-md border border-slate-200 bg-white p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-slate-500">
                        STAGE {sIdx + 1}
                      </span>
                      {stages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStage(stage.id)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:text-red-900"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove Stage
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <input
                        type="text"
                        required
                        value={stage.name}
                        onChange={(e) =>
                          updateStage(stage.id, { name: e.target.value })
                        }
                        placeholder={`Stage ${sIdx + 1} name (e.g. Raw Intake)`}
                        className="min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900"
                      />
                      <input
                        type="text"
                        value={stage.description}
                        onChange={(e) =>
                          updateStage(stage.id, { description: e.target.value })
                        }
                        placeholder="Stage instructions / zone notes (optional)"
                        className="min-h-[38px] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                      <input
                        type="checkbox"
                        checked={stage.includeBaselineChecks}
                        onChange={(e) =>
                          updateStage(stage.id, {
                            includeBaselineChecks: e.target.checked,
                          })
                        }
                        className="rounded border-slate-300"
                      />
                      <span>
                        Include baseline safety checks (PPE perimeter &amp;
                        equipment guards) in this stage
                      </span>
                    </label>

                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                      <input
                        type="text"
                        value={stage.draftLabel}
                        onChange={(e) =>
                          updateStage(stage.id, { draftLabel: e.target.value })
                        }
                        placeholder="Stage parameter label (e.g. Basin pH)"
                        className="sm:col-span-5 min-h-[36px] rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-900 focus:bg-white"
                      />
                      <input
                        type="text"
                        value={stage.draftTarget}
                        onChange={(e) =>
                          updateStage(stage.id, {
                            draftTarget: e.target.value,
                          })
                        }
                        placeholder="Target"
                        className="sm:col-span-3 min-h-[36px] rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs text-slate-900 focus:bg-white"
                      />
                      <input
                        type="text"
                        value={stage.draftUnit}
                        onChange={(e) =>
                          updateStage(stage.id, { draftUnit: e.target.value })
                        }
                        placeholder="Unit"
                        className="sm:col-span-2 min-h-[36px] rounded-md border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-mono text-slate-900 focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => addParameterToStage(stage.id)}
                        className="sm:col-span-2 min-h-[36px] inline-flex items-center justify-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>

                    {stage.parameters.length > 0 && (
                      <ul className="divide-y divide-slate-200 rounded border border-slate-200 bg-slate-50">
                        {stage.parameters.map((p, pIdx) => (
                          <li
                            key={`${stage.id}-p-${pIdx}`}
                            className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
                          >
                            <span className="text-slate-800">
                              <strong>{p.label}</strong>
                              {p.target ? ` · Target: ${p.target}` : ""}
                              {p.unit ? ` · Unit: ${p.unit}` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                removeParameterFromStage(stage.id, pIdx)
                              }
                              className="text-red-700 hover:text-red-900 font-medium"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[40px] rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            {submitting ? "Creating Inspection..." : "Create Inspection"}
          </button>
        </div>
      </form>
    </section>
  );
}
