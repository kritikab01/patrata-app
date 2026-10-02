import { useState, useEffect, useRef } from "react";
import type { BorrowerTabKey, DeskTabKey } from "../types";
import { Icon, type IconName } from "./viz";
import { usePWAInstall } from "./usePWAInstall";

/* ---------- Borrower Navigation Items ---------- */
export const BORROWER_TABS: { key: BorrowerTabKey; label: string; icon: IconName }[] = [
  { key: "home", label: "Home", icon: "home" },
  { key: "check", label: "Check", icon: "check" },
  { key: "tools", label: "Tools", icon: "tools" },
  { key: "checks", label: "My checks", icon: "receipt" },
  { key: "help", label: "Help", icon: "help" },
];

/* ---------- Desk Navigation Items ---------- */
export const DESK_TABS: { key: DeskTabKey; label: string; icon: IconName }[] = [
  { key: "dashboard", label: "Dashboard", icon: "dashboard" },
  { key: "review", label: "Review queue", icon: "clock" },
  { key: "batch", label: "Batch screening", icon: "layers" },
  { key: "compare", label: "Compare", icon: "compare" },
  { key: "model", label: "Model and governance", icon: "shield" },
];

/* =========================================================================
   BORROWER HEADER & TOP BAR (Laptop)
   ========================================================================= */
export function BorrowerHeader({
  activeTab,
  onTabChange,
  onSwitchToDesk,
  onOpenAbout,
  lang,
  onToggleLang,
}: {
  activeTab: BorrowerTabKey;
  onTabChange: (tab: BorrowerTabKey) => void;
  onSwitchToDesk: () => void;
  onOpenAbout: () => void;
  lang: "en" | "hi";
  onToggleLang: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isInstallable, install, isIOS } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileOpen]);

  return (
    <header className="border-b border-cardborder bg-white w-full no-print">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between py-3.5">
          {/* Logo & title */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-ink text-white font-archivo font-800 text-lg">
              प
            </div>
            <div>
              <h1 className="font-archivo font-800 text-xl leading-none text-ink">Patrata</h1>
              <p className="mt-0.5 text-xs text-muted">Explainable loan pre-screening</p>
            </div>
          </div>

          {/* Right controls: Install, Lang toggle, Profile button */}
          <div className="flex items-center gap-2.5">
            {isInstallable && (
              <button
                type="button"
                onClick={install}
                className="hidden sm:inline-flex min-h-[34px] items-center gap-1.5 rounded-btn bg-ink px-3 text-xs font-700 text-white hover:bg-ink/90 transition-colors shadow-sm"
              >
                <Icon name="download" size={14} />
                Install
              </button>
            )}

            {isIOS && !isInstallable && (
              <button
                type="button"
                onClick={() => setShowIOSModal(true)}
                className="hidden sm:inline-flex min-h-[34px] items-center gap-1.5 rounded-btn border border-cardborder bg-page px-2.5 text-xs font-600 text-ink hover:border-brand hover:text-brand transition-colors"
              >
                <Icon name="download" size={14} />
                Install
              </button>
            )}

            {/* EN / हिं toggle */}
            <button
              type="button"
              onClick={onToggleLang}
              className="inline-flex min-h-[34px] items-center rounded-btn border border-cardborder bg-page px-2.5 text-xs font-700 text-ink hover:border-ink transition-colors"
            >
              {lang === "en" ? "हिं" : "EN"}
            </button>

            {/* Profile menu button */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-label="User menu"
                aria-expanded={profileOpen}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-cardborder bg-page text-ink hover:border-ink transition-colors"
              >
                <Icon name="user" size={18} />
              </button>

              {/* Dropdown menu */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-card border border-cardborder bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onSwitchToDesk();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-btn px-3 py-2 text-left text-xs font-700 text-ink hover:bg-page transition-colors"
                  >
                    <Icon name="dashboard" size={16} color="#1E4FD8" />
                    <span>Switch to lender desk</span>
                  </button>

                  <div className="my-1 border-t border-cardborder" />

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      onOpenAbout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-btn px-3 py-2 text-left text-xs font-600 text-muted hover:bg-page hover:text-ink transition-colors"
                  >
                    <Icon name="info" size={16} />
                    <span>About Patrata and your data</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Laptop Top Tab Bar (hidden on phone, visible md and up) */}
        <div className="hidden md:block overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <nav className="flex gap-1 -mb-px whitespace-nowrap min-w-max">
            {BORROWER_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  className={`relative inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-600 transition-colors ${
                    active ? "border-ink text-ink font-700" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  <Icon name={tab.icon} size={17} color={active ? "#0A0A0A" : "#52525B"} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
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

/* =========================================================================
   BORROWER BOTTOM TAB BAR (Phone <768px)
   ========================================================================= */
export function BorrowerBottomBar({
  activeTab,
  onTabChange,
}: {
  activeTab: BorrowerTabKey;
  onTabChange: (tab: BorrowerTabKey) => void;
}) {
  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 h-[76px] bg-white border-t border-cardborder z-40 px-2 flex items-center justify-around shadow-sm no-print"
      aria-label="Bottom Navigation"
    >
      {BORROWER_TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className="flex flex-col items-center justify-center min-w-[56px] py-1 transition-all"
          >
            {active ? (
              <div className="flex items-center gap-1.5 bg-ink text-white rounded-full px-3 py-1.5 shadow-sm">
                <Icon name={tab.icon} size={16} color="#FFFFFF" strokeWidth={2.4} />
                <span className="text-xs font-700 leading-none">{tab.label}</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-muted hover:text-ink">
                <Icon name={tab.icon} size={20} color="#52525B" />
                <span className="text-[11px] font-500 leading-none">{tab.label}</span>
              </div>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* =========================================================================
   LENDER DESK SIDEBAR (Laptop >=768px)
   ========================================================================= */
export function DeskSidebar({
  activeTab,
  onTabChange,
  reviewCount,
  onNewApplication,
  onSwitchToBorrower,
}: {
  activeTab: DeskTabKey;
  onTabChange: (tab: DeskTabKey) => void;
  reviewCount: number;
  onNewApplication: () => void;
  onSwitchToBorrower: () => void;
}) {
  return (
    <aside className="hidden md:flex w-64 lg:w-72 bg-white border-r border-cardborder min-h-screen p-5 flex-col justify-between shrink-0 no-print">
      {/* Top section */}
      <div>
        {/* Brand */}
        <div className="flex items-center gap-2.5 pb-5 border-b border-cardborder">
          <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-ink text-white font-archivo font-800 text-lg shrink-0">
            प
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-archivo font-800 text-lg leading-none text-ink">Patrata</h1>
              <span className="rounded bg-page px-1.5 py-0.5 text-[10px] font-700 text-muted uppercase">Desk</span>
            </div>
            <p className="mt-0.5 text-xs text-muted">Lender workspace</p>
          </div>
        </div>

        {/* New Application Button */}
        <button
          type="button"
          onClick={onNewApplication}
          className="mt-4 w-full h-11 rounded-btn bg-brand px-4 font-archivo font-700 text-sm text-white hover:bg-brand-600 transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Icon name="check" size={18} color="#fff" />
          <span>New application</span>
        </button>

        {/* Navigation Rows (44px height) */}
        <nav className="mt-6 space-y-1.5" aria-label="Lender Desk Navigation">
          {DESK_TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`w-full h-[44px] px-3.5 rounded-btn flex items-center justify-between text-sm transition-colors text-left ${
                  active
                    ? "bg-ink text-white font-700 shadow-sm"
                    : "text-ink hover:bg-page font-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon name={tab.icon} size={18} color={active ? "#FFFFFF" : "#0A0A0A"} />
                  <span>{tab.label}</span>
                </div>
                {tab.key === "review" && reviewCount > 0 && (
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-700 ${
                      active ? "bg-white text-ink" : "bg-refer text-white"
                    }`}
                  >
                    {reviewCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="pt-6 border-t border-cardborder space-y-3">
        {/* Switch to borrower app */}
        <button
          type="button"
          onClick={onSwitchToBorrower}
          className="w-full flex items-center gap-2 rounded-btn px-3 py-2 text-xs font-700 text-brand hover:bg-brand-50 transition-colors"
        >
          <Icon name="back" size={15} color="#1E4FD8" />
          <span>Switch to borrower app</span>
        </button>

        {/* Engine status */}
        <div className="flex items-center gap-2 px-3 py-1 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-approve animate-pulse" />
          <span className="font-500">Engine online, AI on</span>
        </div>
      </div>
    </aside>
  );
}

/* =========================================================================
   LENDER DESK MOBILE HEADER & SCROLLABLE TAB ROW (Phone <768px)
   ========================================================================= */
export function DeskMobileHeader({
  activeTab,
  onTabChange,
  reviewCount,
  onNewApplication,
  onSwitchToBorrower,
}: {
  activeTab: DeskTabKey;
  onTabChange: (tab: DeskTabKey) => void;
  reviewCount: number;
  onNewApplication: () => void;
  onSwitchToBorrower: () => void;
}) {
  return (
    <header className="md:hidden border-b border-cardborder bg-white w-full no-print">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-btn bg-ink text-white font-archivo font-800 text-base">
              प
            </div>
            <div>
              <h1 className="font-archivo font-800 text-base leading-none text-ink">Patrata Desk</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNewApplication}
              className="h-8 rounded-btn bg-brand px-3 text-xs font-700 text-white hover:bg-brand-600 transition-colors flex items-center gap-1"
            >
              <span>+ New</span>
            </button>
            <button
              type="button"
              onClick={onSwitchToBorrower}
              className="h-8 rounded-btn border border-cardborder bg-page px-2.5 text-xs font-600 text-ink hover:border-brand hover:text-brand transition-colors"
            >
              Borrower
            </button>
          </div>
        </div>

        {/* Scrollable Desk Tab Row */}
        <div className="overflow-x-auto mt-3 -mx-4 px-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <nav className="flex gap-1 -mb-px whitespace-nowrap min-w-max">
            {DESK_TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange(tab.key)}
                  className={`relative inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-600 transition-colors ${
                    active ? "border-ink text-ink font-700" : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  <Icon name={tab.icon} size={15} color={active ? "#0A0A0A" : "#52525B"} />
                  <span>{tab.label}</span>
                  {tab.key === "review" && reviewCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-refer px-1 text-[10px] font-700 text-white">
                      {reviewCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
}

/* =========================================================================
   ABOUT PATRATA MODAL / SECTION
   ========================================================================= */
export function AboutModal({
  open,
  onClose,
  modelVersion,
}: {
  open: boolean;
  onClose: () => void;
  modelVersion?: string | null;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 no-print" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="About Patrata and your data"
        className="w-full max-w-lg rounded-card bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-cardborder pb-3">
          <h3 className="font-archivo font-700 text-lg text-ink">About Patrata and your data</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted hover:bg-page hover:text-ink"
          >
            <Icon name="cross" size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm text-ink leading-relaxed">
          <div>
            <h4 className="font-archivo font-700 text-sm text-ink">How it works</h4>
            <p className="mt-1 text-muted">
              Policy rules check eligibility. Two machine-learning models estimate approval likelihood and default risk. An AI language model writes the plain-language explanation and answers questions, but it never makes or changes a decision. A credit officer makes the final call.
            </p>
            {modelVersion && (
              <p className="mt-2 text-xs text-muted">
                <span className="font-600 text-ink">Model version:</span> {modelVersion}
              </p>
            )}
          </div>

          <div className="border-t border-cardborder pt-3">
            <h4 className="font-archivo font-700 text-sm text-ink">Your data & privacy</h4>
            <p className="mt-1 text-muted">
              Patrata does not ask for your name, PAN, Aadhaar or phone number. The numbers you enter are sent to the Patrata engine to score the application. For explanations and answers, the application details and your question are sent to a third-party AI model provider. This is a demo: please don't enter real personal data.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-11 rounded-btn bg-ink font-archivo font-700 text-sm text-white hover:bg-ink/90 transition-colors mt-2"
        >
          Close
        </button>
      </div>
    </div>
  );
}

/* =========================================================================
   FOOTER
   ========================================================================= */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-cardborder bg-white no-print">
      <div className="mx-auto max-w-3xl px-4 py-5 text-center text-xs text-muted sm:px-6">
        <p>Decision support only. A credit officer makes the final call.</p>
      </div>
    </footer>
  );
}
