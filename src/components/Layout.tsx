import type { TabKey } from "../types";

export function Header({
  activeTab,
  onTabChange,
  reviewCount,
}: {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  reviewCount: number;
}) {
  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: "check", label: "Check" },
    { key: "dashboard", label: "Dashboard" },
    { key: "review", label: "Review queue", badge: reviewCount || undefined },
    { key: "batch", label: "Batch" },
    { key: "compare", label: "Compare" },
  ];

  return (
    <header className="border-b border-cardborder bg-white">
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
        </div>

        <nav className="flex gap-1 -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`relative inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-600 transition-colors ${
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
    </header>
  );
}

export function Footer() {
  return (
    <footer className="mt-8 border-t border-cardborder bg-white">
      <div className="mx-auto max-w-3xl px-4 py-5 text-center text-xs text-muted sm:px-6">
        <p>Decision support only. A credit officer makes the final call. Version 1.</p>
      </div>
    </footer>
  );
}
