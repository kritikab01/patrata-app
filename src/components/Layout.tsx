import { useState } from "react";
import type { TabKey } from "../types";
import { usePWAInstall } from "./usePWAInstall";

export function Header({
  activeTab,
  onTabChange,
  reviewCount,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  reviewCount: number;
}) {
  const { isInstallable, install, isIOS } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "check", label: "Check" },
    { key: "dashboard", label: "Dashboard" },
    { key: "review", label: "Review queue", badge: reviewCount || undefined },
    { key: "batch", label: "Batch" },
    { key: "compare", label: "Compare" },
    { key: "assistant", label: "Assistant" },
    { key: "model", label: "Model" },
  ];

  return (
    <header className="border-b border-cardborder bg-white w-full">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-ink">
              <span className="font-archivo font-800 text-lg text-white">प</span>
            </div>
            <div>
              <h1 className="font-archivo font-800 text-xl leading-none text-ink">Patrata</h1>
              <p className="mt-0.5 text-xs text-muted">Explainable loan pre-screening</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isInstallable && (
              <button
                type="button"
                onClick={install}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-btn bg-ink px-3 text-xs font-700 text-white hover:bg-ink/90 transition-colors shadow-sm"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Install App
              </button>
            )}

            {isIOS && !isInstallable && (
              <button
                type="button"
                onClick={() => setShowIOSModal(true)}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-btn border border-cardborder bg-page px-2.5 text-xs font-600 text-ink hover:border-brand hover:text-brand transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 16v1a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Install
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <nav className="flex gap-1 -mb-px whitespace-nowrap min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`relative inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-600 transition-colors ${
                  activeTab === tab.key
                    ? "border-ink text-ink"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                {tab.label}
                {tab.badge != null && tab.badge > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-refer px-1.5 text-xs font-700 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-card bg-white p-6 shadow-xl space-y-4">
            <h3 className="font-archivo font-700 text-lg text-ink">Install Patrata on iOS</h3>
            <p className="text-sm text-muted leading-relaxed">
              1. Tap the <strong className="text-ink">Share</strong> icon at the bottom of Safari.<br />
              2. Scroll down and select <strong className="text-ink">Add to Home Screen</strong>.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full h-11 rounded-btn bg-ink text-sm font-700 text-white hover:bg-ink/90 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

export function AboutSection({ modelVersion }: { modelVersion?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-8 about-section">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-card border border-cardborder bg-white p-4 text-left transition-colors hover:bg-page"
      >
        <span className="font-archivo font-700 text-sm text-ink">
          About Patrata and your data
        </span>
        <span className="text-xs font-600 text-brand">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-4 rounded-card border border-cardborder bg-white p-5 text-sm text-ink sm:p-6">
          <div>
            <h4 className="font-archivo font-700 text-sm text-ink">How it works</h4>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Policy rules check eligibility. Two machine-learning models estimate approval likelihood and default risk. An AI language model writes the plain-language explanation and answers questions, but it never makes or changes a decision. A credit officer makes the final call.
            </p>
            {modelVersion && (
              <p className="mt-1.5 text-xs text-muted">
                <span className="font-600 text-ink">Model version:</span> {modelVersion}
              </p>
            )}
          </div>

          <div className="border-t border-cardborder pt-4">
            <h4 className="font-archivo font-700 text-sm text-ink">Your data</h4>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Patrata does not ask for your name, PAN, Aadhaar or phone number. The numbers you enter are sent to the Patrata engine to score the application. For explanations and answers, the application details and your question are sent to a third-party AI model provider. This is a demo: please don't enter real personal data.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="mt-8 border-t border-cardborder bg-white">
      <div className="mx-auto max-w-3xl px-4 py-5 text-center text-xs text-muted sm:px-6">
        <p>Decision support only. A credit officer makes the final call. Version 3.</p>
      </div>
    </footer>
  );
}
