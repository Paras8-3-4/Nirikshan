import React, { useEffect, useRef, useState } from "react";
import { Check, Eraser, PenTool } from "lucide-react";
import type { ReportSignature, UserRole } from "../lib/types.ts";

interface SignaturePadProps {
  title: string;
  signerName: string;
  signerRole: UserRole;
  existingSignature?: ReportSignature | null;
  disabled?: boolean;
  onSaveSignature: (dataUrl: string) => Promise<void> | void;
  onClearSavedSignature?: () => Promise<void> | void;
}

export default function SignaturePad({
  title,
  signerName,
  signerRole,
  existingSignature,
  disabled = false,
  onSaveSignature,
  onClearSavedSignature,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(!existingSignature);

  useEffect(() => {
    setEditing(!existingSignature);
  }, [existingSignature?.signedAt]);

  useEffect(() => {
    if (!editing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(300, Math.floor(rect.width * dpr));
    canvas.height = Math.max(140, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }
    setHasStroke(false);
  }, [editing]);

  function getPointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || !editing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.setPointerCapture(e.pointerId);
    const { x, y } = getPointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setDrawing(true);
    setHasStroke(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || disabled || !editing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getPointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    setDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasStroke(false);
  }

  async function handleConfirmSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke || disabled) return;
    setSaving(true);
    try {
      const dataUrl = canvas.toDataURL("image/png");
      await onSaveSignature(dataUrl);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          <p className="text-xs text-slate-500">
            Signer: <span className="font-medium text-slate-700">{signerName}</span>{" "}
            <span aria-hidden="true">·</span>{" "}
            <span className="capitalize">{signerRole}</span>
          </p>
        </div>

        {existingSignature && !editing && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" />
              Signed
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={async () => {
                  if (onClearSavedSignature) {
                    await onClearSavedSignature();
                  }
                  setEditing(true);
                }}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-2"
              >
                Re-sign
              </button>
            )}
          </div>
        )}
      </div>

      {existingSignature && !editing ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
          <img
            src={existingSignature.dataUrl}
            alt={`Signature by ${existingSignature.signerName}`}
            className="h-24 w-auto max-w-full bg-white border border-slate-200 rounded px-2 py-1 object-contain"
          />
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-slate-500 tabular-nums">
            <span>
              Signed {new Date(existingSignature.signedAt).toLocaleString()}
            </span>
            {existingSignature.latitude !== undefined &&
              existingSignature.longitude !== undefined && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    GPS: {existingSignature.latitude.toFixed(5)},{" "}
                    {existingSignature.longitude.toFixed(5)}
                  </span>
                </>
              )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="relative rounded-md border border-slate-300 bg-white overflow-hidden">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="block h-36 w-full touch-none cursor-crosshair bg-white"
            />
            {!hasStroke && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-xs text-slate-400">
                <PenTool className="h-3.5 w-3.5" />
                <span>Sign here with mouse, touch, or stylus</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={clearCanvas}
              disabled={disabled || !hasStroke}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-45"
            >
              <Eraser className="h-3.5 w-3.5" />
              Clear Pad
            </button>

            <button
              type="button"
              onClick={handleConfirmSignature}
              disabled={disabled || !hasStroke || saving}
              className="min-h-[36px] inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-45"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Validate & Save Signature"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
