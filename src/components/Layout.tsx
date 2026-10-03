import { useState, useRef, useEffect } from "react";
import type { BorrowerTabKey, DeskTabKey } from "../types";
import { Icon, type IconName } from "./viz";
import { usePWAInstall } from "./usePWAInstall";

/* ---------- BORROWER HEADER & TOP BAR ---------- */
export function BorrowerHeader({
  activeTab,
  onTabChange,
  lang,
  onLangToggle,
  onSwitchToDesk,
  onOpenAbout,
  userName,
  onOpenNameSheet,
  onForgetName,
}: {
  activeTab: BorrowerTabKey;
  onTabChange: (tab: BorrowerTabKey) => void;
  lang: "en" | "hi";
  onLangToggle: () => void;
  onSwitchToDesk: () => void;
  onOpenAbout: () => void;
  userName?: string;
  onOpenNameSheet?: () => void;
  onForgetName?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { isInstallable, install } = usePWAInstall();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [menuOpen]);

  const tabs: { key: BorrowerTabKey; label: string; icon: IconName }[] = [
    { key: "home", label: lang === "hi" ? "होम" : "Home", icon: "home" },
    { key: "check", label: lang === "hi" ? "पात्रता जाँच" : "Check", icon: "check" },
    { key: "tools", label: lang === "hi" ? "उपकरण" : "Tools", icon: "tools" },
    { key: "checks", label: lang === "hi" ? "मेरी जाँचें" : "My checks", icon: "receipt" },
    { key: "help", label: lang === "hi" ? "सहायता" : "Help", icon: "help" },
  ];

  return (
    <header className="border-b border-cardborder bg-white w-full sticky top-0 z-40">
      {/* Top Header Row */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          {/* Logo & Title */}
          <div
            className="flex items-center gap-3 cursor-pointer select-none"
            onClick={() => onTabChange("home")}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-ink text-white font-archivo font-800 text-lg shadow-sm">
              <span>प</span>
            </div>
            <div>
              <h1 className="font-archivo font-800 text-xl leading-none text-ink">Patrata</h1>
              <p className="mt-0.5 text-xs text-muted">Explainable loan pre-screening</p>
            </div>
          </div>

          {/* Right Controls: EN / हिं toggle + Profile button */}
          <div className="flex items-center gap-2.5">
            {/* Language Toggle */}
            <div className="flex items-center rounded-btn border border-cardborder p-0.5 bg-page text-xs font-700">
              <button
                type="button"
                onClick={onLangToggle}
                className={`rounded-[7px] px-2.5 py-1 transition-colors ${
                  lang === "en" ? "bg-ink text-white shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={onLangToggle}
                className={`rounded-[7px] px-2.5 py-1 font-deva transition-colors ${
                  lang === "hi" ? "bg-ink text-white shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                हिं
              </button>
            </div>

            {/* Profile Button with Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="User profile and options"
                aria-expanded={menuOpen}
                className="flex h-9 w-9 items-center justify-center rounded-btn border border-cardborder bg-white text-ink hover:border-brand hover:text-brand transition-colors"
              >
                <Icon name="user" size={18} strokeWidth={2} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-card border border-cardborder bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-cardborder mb-1">
                    <p className="text-xs font-700 text-ink">
                      {userName ? `Namaste, ${userName}` : "Patrata Account"}
                    </p>
                    <p className="text-[11px] text-muted">Borrower Mode active</p>
                  </div>

                  {onOpenNameSheet && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenNameSheet();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-600 text-ink hover:bg-page transition-colors"
                    >
                      <Icon name="user" size={16} />
                      <span>{userName ? "Change name" : "Set your name"}</span>
                    </button>
                  )}

                  {userName && onForgetName && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onForgetName();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-600 text-[#B42318] hover:bg-page transition-colors"
                    >
                      <Icon name="cross" size={16} color="#B42318" />
                      <span>Forget my name</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onSwitchToDesk();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-700 text-ink hover:bg-page transition-colors"
                  >
                    <Icon name="dashboard" size={16} color="#1E4FD8" />
                    <span>Switch to lender desk</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onOpenAbout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-600 text-ink hover:bg-page transition-colors"
                  >
                    <Icon name="info" size={16} />
                    <span>About Patrata and your data</span>
                  </button>

                  {isInstallable && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        install();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-600 text-ink hover:bg-page transition-colors border-t border-cardborder mt-1 pt-2"
                    >
                      <Icon name="download" size={16} />
                      <span>Install App</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Laptop Top Tab Bar (≥768px) */}
        <div className="hidden md:flex items-center gap-1 border-t border-cardborder/60 pt-1 pb-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-700 transition-colors rounded-btn ${
                  isActive
                    ? "bg-ink text-white shadow-xs"
                    : "text-muted hover:text-ink hover:bg-page"
                }`}
              >
                <Icon name={tab.icon} size={17} color={isActive ? "#fff" : "currentColor"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

/* ---------- BORROWER PHONE FIXED BOTTOM BAR (<768px) ---------- */
export function BorrowerBottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: BorrowerTabKey;
  onTabChange: (tab: BorrowerTabKey) => void;
}) {
  const tabs: { key: BorrowerTabKey; label: string; icon: IconName }[] = [
    { key: "home", label: "Home", icon: "home" },
    { key: "check", label: "Check", icon: "check" },
    { key: "tools", label: "Tools", icon: "tools" },
    { key: "checks", label: "My checks", icon: "receipt" },
    { key: "help", label: "Help", icon: "help" },
  ];

  return (
    <nav
      aria-label="Mobile Navigation Bar"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[76px] bg-white border-t border-cardborder shadow-lg flex items-center justify-around px-2"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange(tab.key)}
            className="flex flex-1 items-center justify-center h-full focus:outline-none"
          >
            {isActive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-white font-archivo font-700 text-xs shadow-sm">
                <Icon name={tab.icon} size={16} color="#FFFFFF" strokeWidth={2.4} />
                <span>{tab.label}</span>
              </span>
            ) : (
              <span className="flex flex-col items-center gap-1 text-muted hover:text-ink transition-colors">
                <Icon name={tab.icon} size={20} strokeWidth={1.8} />
                <span className="text-[11px] font-500 leading-none">{tab.label}</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- LENDER DESK HEADER & SIDEBAR ---------- */
export function LenderDeskHeader({
  onSwitchToBorrower,
  onOpenAbout,
  onNewApplication,
}: {
  onSwitchToBorrower: () => void;
  onOpenAbout: () => void;
  onNewApplication: () => void;
}) {
  return (
    <header className="border-b border-cardborder bg-white w-full sticky top-0 z-40">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-ink text-white font-archivo font-800 text-lg shadow-sm">
              <span>प</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-archivo font-800 text-xl leading-none text-ink">Patrata</h1>
                <span className="rounded-full bg-[#1E4FD8] px-2 py-0.5 text-[10px] font-800 text-white uppercase tracking-wider">
                  Lender Desk
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">Underwriting & Portfolio Risk Console</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onNewApplication}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-btn bg-[#1E4FD8] px-3.5 font-archivo font-700 text-xs text-white hover:bg-[#1A44BD] transition-colors shadow-sm"
            >
              <Icon name="check" size={14} color="#fff" />
              <span>New application</span>
            </button>

            <button
              type="button"
              onClick={onSwitchToBorrower}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-btn border border-cardborder bg-white px-3 font-archivo font-700 text-xs text-ink hover:bg-page transition-colors"
            >
              <Icon name="user" size={14} />
              <span className="hidden sm:inline">Borrower App</span>
            </button>

            <button
              type="button"
              onClick={onOpenAbout}
              aria-label="About Patrata"
              className="flex h-9 w-9 items-center justify-center rounded-btn border border-cardborder bg-white text-muted hover:text-ink transition-colors"
            >
              <Icon name="info" size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function LenderDeskSidebar({
  activeTab,
  onTabChange,
  onNewApplication,
  onSwitchToBorrower,
  reviewCount,
}: {
  activeTab: DeskTabKey;
  onTabChange: (tab: DeskTabKey) => void;
  onNewApplication: () => void;
  onSwitchToBorrower: () => void;
  reviewCount: number;
}) {
  const items: { key: DeskTabKey; label: string; icon: IconName; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "review", label: "Review queue", icon: "clock", badge: reviewCount || undefined },
    { key: "batch", label: "Batch screening", icon: "layers" },
    { key: "compare", label: "Compare", icon: "compare" },
    { key: "model", label: "Model and governance", icon: "shield" },
  ];

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-cardborder p-4 flex flex-col justify-between min-h-[calc(100vh-65px)]">
      <div className="space-y-4">
        {/* Blue New application button */}
        <button
          type="button"
          onClick={onNewApplication}
          className="w-full h-11 min-h-[44px] rounded-btn bg-[#1E4FD8] font-archivo font-700 text-sm text-white hover:bg-[#1A44BD] transition-colors flex items-center justify-center gap-2 shadow-sm"
        >
          <Icon name="check" size={17} color="#fff" />
          <span>New application</span>
        </button>

        {/* 44px Rows */}
        <nav className="space-y-1">
          {items.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTabChange(item.key)}
                className={`w-full h-11 min-h-[44px] px-3 rounded-btn flex items-center justify-between text-sm font-600 transition-colors ${
                  isActive
                    ? "bg-ink text-white font-700 shadow-xs"
                    : "text-muted hover:text-ink hover:bg-page"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon
                    name={item.icon}
                    size={18}
                    color={isActive ? "#FFFFFF" : "currentColor"}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge != null && item.badge > 0 && (
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-700 ${
                      isActive ? "bg-white text-ink" : "bg-refer text-white"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="pt-4 border-t border-cardborder space-y-3">
        <button
          type="button"
          onClick={onSwitchToBorrower}
          className="w-full flex items-center gap-2 text-xs font-700 text-ink hover:text-brand transition-colors p-2 rounded-btn hover:bg-page"
        >
          <Icon name="user" size={16} />
          <span>Switch to borrower app</span>
        </button>

        <div className="flex items-center gap-2 px-2 text-xs font-600 text-muted">
          <span className="h-2 w-2 rounded-full bg-[#047857]" />
          <span>Engine online, AI on</span>
        </div>
      </div>
    </aside>
  );
}

/* Phone Top Scrollable Nav for Lender Desk (<768px) */
export function LenderDeskMobileNav({
  activeTab,
  onTabChange,
  onNewApplication,
  reviewCount,
}: {
  activeTab: DeskTabKey;
  onTabChange: (tab: DeskTabKey) => void;
  onNewApplication: () => void;
  reviewCount: number;
}) {
  const items: { key: DeskTabKey; label: string; icon: IconName; badge?: number }[] = [
    { key: "dashboard", label: "Dashboard", icon: "dashboard" },
    { key: "review", label: "Review queue", icon: "clock", badge: reviewCount || undefined },
    { key: "batch", label: "Batch", icon: "layers" },
    { key: "compare", label: "Compare", icon: "compare" },
    { key: "model", label: "Model", icon: "shield" },
  ];

  return (
    <div className="md:hidden border-b border-cardborder bg-white px-3 py-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex items-center gap-2 min-w-max">
        <button
          type="button"
          onClick={onNewApplication}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-btn bg-[#1E4FD8] px-3 font-archivo font-700 text-xs text-white shadow-sm shrink-0"
        >
          <Icon name="check" size={14} color="#fff" />
          <span>New check</span>
        </button>

        {items.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onTabChange(item.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-700 transition-colors shrink-0 ${
                isActive
                  ? "bg-ink text-white"
                  : "bg-page border border-cardborder text-muted hover:text-ink"
              }`}
            >
              <Icon name={item.icon} size={14} color={isActive ? "#fff" : "currentColor"} />
              <span>{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="rounded-full bg-refer px-1 text-[10px] text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- SHARED FOOTER & ABOUT SECTION ---------- */
export function Footer() {
  return (
    <footer className="mt-auto border-t border-cardborder bg-white">
      <div className="mx-auto max-w-[1100px] px-4 py-5 text-center text-xs text-muted sm:px-6">
        <p>Decision support only. A credit officer makes the final call.</p>
      </div>
    </footer>
  );
}

export function AboutModal({
  isOpen,
  onClose,
  modelVersion,
}: {
  isOpen: boolean;
  onClose: () => void;
  modelVersion?: string | null;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-card border border-cardborder bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-cardborder pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-btn bg-ink text-white font-archivo font-800 text-sm">
              प
            </div>
            <h3 className="font-archivo font-700 text-lg text-ink">
              About Patrata and your data
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-btn text-muted hover:text-ink hover:bg-page transition-colors"
          >
            <Icon name="cross" size={18} />
          </button>
        </div>

        <div className="space-y-4 text-sm text-ink max-h-[70vh] overflow-y-auto pr-1">
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

          <div className="border-t border-cardborder pt-3">
            <h4 className="font-archivo font-700 text-sm text-ink">Your data</h4>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Patrata does not ask for your name, PAN, Aadhaar or phone number. Your name stays on this phone. It is never sent to Patrata's engine. The numbers you enter are sent to the Patrata engine to score the application. For explanations and answers, the application details and your question are sent to an explainability model. This is a demo: please don't enter real personal data.
            </p>
          </div>

          <div className="border-t border-cardborder pt-3">
            <h4 className="font-archivo font-700 text-sm text-ink">Ethical AI & Explainability</h4>
            <p className="mt-1 text-sm text-muted leading-relaxed">
              Decisions are backed by transparent policy checks, feature impact bars (Shapley drivers), and counterfactual alternatives showing what loan amount or tenure would qualify.
            </p>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-btn bg-ink text-xs font-700 text-white hover:bg-ink/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
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
              Patrata does not ask for your name, PAN, Aadhaar or phone number. Your name stays on this phone. It is never sent to Patrata's engine. The numbers you enter are sent to the Patrata engine to score the application. For explanations and answers, the application details and your question are sent to a third-party AI model provider. This is a demo: please don't enter real personal data.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
