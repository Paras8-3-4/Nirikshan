"use client";

import React, { useRef } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Eraser, Check } from "lucide-react";

interface SignaturePadProps {
  existingSignature?: string;
  signedAt?: string;
  onSaveSignature: (dataUrl: string) => void;
}

export default function SignaturePad({
  existingSignature,
  signedAt,
  onSaveSignature,
}: SignaturePadProps) {
  const sigRef = useRef<SignatureCanvas | null>(null);

  const handleClear = () => {
    sigRef.current?.clear();
  };

  const handleSave = () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert("Please draw a signature first.");
      return;
    }
    const dataUrl = sigRef.current.getTrimmedCanvas().toDataURL("image/png");
    onSaveSignature(dataUrl);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Inspector Signature</h3>
        {signedAt && (
          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            Signed {new Date(signedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden">
        <SignatureCanvas
          ref={sigRef}
          penColor="#0f172a"
          canvasProps={{
            className: "w-full h-36 touch-none",
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Eraser className="w-4 h-4" />
          Clear
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          <Check className="w-4 h-4" />
          Save Signature
        </button>
      </div>

      {existingSignature && (
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500 mb-1">Saved Signature Preview:</p>
          <img
            src={existingSignature}
            alt="Saved inspector signature"
            className="h-14 w-auto rounded border border-slate-200 bg-white p-1"
          />
        </div>
      )}
    </div>
  );
}