import React, { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "../lib/usePWAInstall.ts";

interface PWAInstallButtonProps {
  compact?: boolean;
}

export default function PWAInstallButton({
  compact = false,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 ${
          compact ? "min-h-[36px] px-3 py-1.5 text-xs" : "min-h-[40px] px-3.5 py-2 text-xs"
        }`}
      >
        <Download className="h-3.5 w-3.5 text-slate-700" />
        <span>Install App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 ${
            compact ? "min-h-[36px] px-3 py-1.5 text-xs" : "min-h-[40px] px-3.5 py-2 text-xs"
          }`}
        >
          <Smartphone className="h-3.5 w-3.5 text-slate-700" />
          <span>Install on iOS</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 space-y-3 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Install Nirikshan on iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="list-decimal pl-4 space-y-1.5 text-xs text-slate-600">
                <li>
                  Tap the <strong>Share</strong> icon in Safari&apos;s toolbar.
                </li>
                <li>
                  Scroll down and tap <strong>Add to Home Screen</strong>.
                </li>
                <li>
                  Launch Nirikshan offline anytime from your home screen.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[38px] rounded-md bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
