import { useState, useEffect, useMemo } from "react";
import type { Product, ScoreResult } from "../types";
import { getApplication } from "../api";
import { Icon, IconTile, Meter, DecisionPill, type IconName } from "./viz";
import { inr } from "../lib/calc";

const TERMS = [
  {
    term: "FOIR (EMI burden)",
    def: "The percentage of your monthly income that goes toward paying loan EMIs; lenders prefer keeping it below 50%.",
  },
  {
    term: "CIBIL score",
    def: "A three-digit credit score between 300 and 900 summarizing your repayment track record; 750+ qualifies for prime rates.",
  },
  {
    term: "APR",
    def: "Annual Percentage Rate reflects the total yearly cost of a loan, including interest rate and processing charges.",
  },
  {
    term: "Tenure",
    def: "The total repayment period in months or years; longer tenure lowers your EMI but increases total interest paid.",
  },
  {
    term: "Collateral",
    def: "An asset such as property, gold, or a vehicle pledged as security against loan default in secured loans.",
  },
  {
    term: "Pre-approved offer",
    def: "A preliminary loan offer extended by lenders based on past income records, subject to final identity verification.",
  },
];

const FLOATING_QUESTIONS = [
  "How can I improve my score?",
  "क्या मेरी EMI ज़्यादा है?",
  "Why was I referred?",
];

function getLatestSavedCheckId(): string | null {
  try {
    const raw = localStorage.getItem("patrata_checks");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (typeof first === "string" && first.trim()) return first.trim();
        if (typeof first === "object" && first && typeof first.id === "string") return first.id;
      }
    }
    const single = localStorage.getItem("patrata_request_id");
    if (single && single.trim()) return single.trim();
  } catch {
    /* ignore */
  }
  return null;
}

export function BorrowerHome({
  products,
  onGoCheck,
  onGoTools,
  onSelectProduct,
  onViewResult,
  onAskQuestion,
}: {
  products: Product[];
  onGoCheck: () => void;
  onGoTools: (focus?: "emi" | "power") => void;
  onSelectProduct: (productId: string) => void;
  onViewResult: (id: string) => void;
  onAskQuestion: (q: string) => void;
}) {
  const [latestId] = useState<string | null>(getLatestSavedCheckId);
  const [lastCheck, setLastCheck] = useState<ScoreResult | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkNotFound, setCheckNotFound] = useState(false);

  // Rotating Word of the Day (daily)
  const wordOfTheDay = useMemo(() => {
    const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return TERMS[day % TERMS.length];
  }, []);

  // Rotating question for floating ask chip (every 4s)
  const [qIndex, setQIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setQIndex((prev) => (prev + 1) % FLOATING_QUESTIONS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const currentFloatingQuestion = FLOATING_QUESTIONS[qIndex];

  // Fetch last check details if an ID exists
  useEffect(() => {
    const id = latestId;
    if (!id) {
      setLastCheck(null);
      return;
    }

    let cancelled = false;
    setCheckLoading(true);
    setCheckNotFound(false);

    getApplication(id)
      .then((data) => {
        if (!cancelled) {
          setLastCheck(data);
          setCheckNotFound(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const status = (err as { status?: number })?.status;
          if (status === 404) {
            setCheckNotFound(true);
            setLastCheck(null);
          } else {
            setCheckNotFound(true);
            setLastCheck(null);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setCheckLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latestId]);

  // Product icon mapper
  const getProductIcon = (id: string): IconName => {
    const lk = id.toLowerCase();
    if (lk.includes("home") || lk.includes("house") || lk.includes("property")) return "house";
    if (lk.includes("car") || lk.includes("vehicle") || lk.includes("auto")) return "car";
    if (lk.includes("consumer") || lk.includes("gadget") || lk.includes("phone")) return "gadget";
    return "wallet";
  };

  // Lowest rate calculator for a product
  const getProductRateText = (p: Product): string => {
    const variants = p.variants || [];
    let hasZeroRate = false;
    let minRate: number | null = null;

    for (const v of variants) {
      const crit = v.criteria as Record<string, unknown> | undefined;
      const rate = typeof crit?.annual_rate === "number" ? crit.annual_rate : null;
      if (rate === 0) hasZeroRate = true;
      if (rate != null) {
        if (minRate == null || rate < minRate) minRate = rate;
      }
    }

    if (hasZeroRate) return "0% no-cost option";
    const typeCount = variants.length || 1;
    const rateDisplay = minRate != null ? `${minRate}%` : "9.5%";
    return `${typeCount} ${typeCount === 1 ? "type" : "types"} · from ${rateDisplay}`;
  };

  // FOIR Burden Text helper
  const renderFoirInfoStrip = (foirVal?: number | null) => {
    if (foirVal == null) return null;
    const pct = (foirVal * 100).toFixed(1);
    let message = `Your EMI burden is ${pct}%. Lenders are comfortable up to 50%.`;
    if (foirVal > 0.6) {
      message = `Your EMI burden is ${pct}%. High burden over 60% may lead to rejection or lower amount.`;
    } else if (foirVal > 0.5) {
      message = `Your EMI burden is ${pct}%. Lenders review applications between 50% and 60%.`;
    }

    return (
      <div className="rounded-btn bg-[#EEF3FF] p-3 text-xs text-[#1E4FD8] flex items-center gap-2 mt-4 font-500">
        <Icon name="info" size={16} color="#1E4FD8" strokeWidth={2} />
        <span>{message}</span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Black top band with Namaste and Hello */}
      <div className="-mx-4 sm:-mx-6 -mt-6 sm:-mt-8">
        <div className="bg-[#0A0A0A] text-white pt-6 pb-28 px-4 sm:px-6">
          <div className="max-w-[1100px] mx-auto">
            <p className="text-xs text-[#A1A1AA] font-500 mb-0.5">Namaste</p>
            <h2 className="font-archivo font-bold text-[20px] text-white tracking-tight">Hello</h2>
          </div>
        </div>
      </div>

      {/* 2. "YOUR LAST CHECK" card overlapping by 76px */}
      <div className="-mt-[76px] relative z-10 rounded-[18px] border border-[#E4E4E7] bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-3 mb-4">
          <h3 className="text-[11px] font-bold tracking-wider text-muted uppercase">
            YOUR LAST CHECK
          </h3>
          {lastCheck && <DecisionPill decision={lastCheck.decision} />}
        </div>

        {checkLoading ? (
          <div className="py-12 flex flex-col items-center justify-center text-muted">
            <Icon name="clock" size={24} color="#1E4FD8" />
            <p className="mt-2 text-xs font-600">Loading your latest check…</p>
          </div>
        ) : lastCheck && !checkNotFound ? (
          <div>
            {/* Meter */}
            <div className="flex flex-col items-center justify-center my-2">
              <Meter
                width={240}
                value={lastCheck.approval_probability}
                big={
                  lastCheck.approval_probability != null
                    ? `${Math.round(lastCheck.approval_probability * 100)}%`
                    : "—"
                }
                label={
                  lastCheck.approval_probability != null
                    ? "Approval likelihood"
                    : "Approval model not used for this product"
                }
              />
              <p className="mt-3 text-xs text-muted font-600 text-center">
                {lastCheck.product_name} · {inr(lastCheck.loan_amount ?? 500000)} ·{" "}
                {lastCheck.tenure_months ?? 36} months
              </p>
            </div>

            {/* Ruled 3-column strip */}
            <div className="grid grid-cols-3 divide-x divide-[#E4E4E7] border-y border-[#E4E4E7] py-3 text-center my-4">
              <div className="px-2">
                <p className="text-[11px] text-muted">Estimated EMI</p>
                <p className="font-archivo font-bold text-sm text-ink mt-0.5">
                  {inr(lastCheck.emi_estimate)}
                </p>
              </div>
              <div className="px-2">
                <p className="text-[11px] text-muted">EMI burden</p>
                <p className="font-archivo font-bold text-sm text-ink mt-0.5">
                  {lastCheck.foir != null ? `${(lastCheck.foir * 100).toFixed(1)}%` : "—"}
                </p>
              </div>
              <div className="px-2">
                <p className="text-[11px] text-muted">Default risk</p>
                <p className="font-archivo font-bold text-sm text-ink mt-0.5">
                  {lastCheck.repayment_risk
                    ? `${(lastCheck.repayment_risk.probability * 100).toFixed(1)}% · ${lastCheck.repayment_risk.band}`
                    : "—"}
                </p>
              </div>
            </div>

            {/* Buttons: View result (outline) and New check (blue) */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => onViewResult(lastCheck.id)}
                className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-btn border border-[#E4E4E7] bg-white px-4 text-xs font-archivo font-bold text-ink hover:bg-page transition-colors"
              >
                <span>View result</span>
                <Icon name="arrow" size={14} />
              </button>
              <button
                type="button"
                onClick={onGoCheck}
                className="flex-1 min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-btn bg-[#1E4FD8] px-4 text-xs font-archivo font-bold text-white hover:bg-[#1A44BD] transition-colors shadow-sm"
              >
                <span>New check</span>
                <Icon name="check" size={14} color="#fff" />
              </button>
            </div>

            {/* Blue-tint info strip */}
            {renderFoirInfoStrip(lastCheck.foir)}
          </div>
        ) : (
          /* Empty state */
          <div className="py-6 text-center flex flex-col items-center">
            <Meter
              value={null}
              width={240}
              big="—"
              label="Not scored yet"
              showKnob={false}
            />
            <h4 className="font-archivo font-bold text-lg text-ink mt-3">No checks yet</h4>
            <p className="text-sm text-muted max-w-sm mx-auto mt-1 leading-relaxed">
              Find out in 2 minutes whether a lender is likely to approve your loan.
            </p>
            <button
              type="button"
              onClick={onGoCheck}
              className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-[#1E4FD8] px-6 text-sm font-archivo font-bold text-white hover:bg-[#1A44BD] transition-colors shadow-sm"
            >
              <span>Check my eligibility</span>
              <Icon name="arrow" size={16} />
            </button>
          </div>
        )}
      </div>

      {/* 3. Quick actions: 2×2 grid of white tiles */}
      <div>
        <h3 className="font-archivo font-bold text-base text-ink mb-3">Quick actions</h3>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {/* Tile 1: Check eligibility */}
          <div
            onClick={onGoCheck}
            className="rounded-card border border-[#E4E4E7] bg-white p-4 sm:p-5 flex flex-col justify-between hover:border-[#1E4FD8] transition-colors cursor-pointer text-left group"
          >
            <div>
              <IconTile name="check" tint="blue" size={42} />
              <h4 className="font-archivo font-bold text-sm sm:text-base text-ink mt-3 group-hover:text-[#1E4FD8] transition-colors">
                Check eligibility
              </h4>
              <p className="text-xs text-muted mt-0.5">3 steps, 2 minutes</p>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-[#1E4FD8] gap-1">
              <span>Start</span>
              <Icon name="arrow" size={12} />
            </div>
          </div>

          {/* Tile 2: EMI calculator */}
          <div
            onClick={() => onGoTools("emi")}
            className="rounded-card border border-[#E4E4E7] bg-white p-4 sm:p-5 flex flex-col justify-between hover:border-[#1E4FD8] transition-colors cursor-pointer text-left group"
          >
            <div>
              <IconTile name="tools" tint="green" size={42} />
              <h4 className="font-archivo font-bold text-sm sm:text-base text-ink mt-3 group-hover:text-[#1E4FD8] transition-colors">
                EMI calculator
              </h4>
              <p className="text-xs text-muted mt-0.5">See EMI and interest</p>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-[#047857] gap-1">
              <span>Calculate</span>
              <Icon name="arrow" size={12} />
            </div>
          </div>

          {/* Tile 3: How much can I borrow? */}
          <div
            onClick={() => onGoTools("power")}
            className="rounded-card border border-[#E4E4E7] bg-white p-4 sm:p-5 flex flex-col justify-between hover:border-[#1E4FD8] transition-colors cursor-pointer text-left group"
          >
            <div>
              <IconTile name="wallet" tint="amber" size={42} />
              <h4 className="font-archivo font-bold text-sm sm:text-base text-ink mt-3 group-hover:text-[#1E4FD8] transition-colors">
                How much can I borrow?
              </h4>
              <p className="text-xs text-muted mt-0.5">From your income</p>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-[#B45309] gap-1">
              <span>Estimate</span>
              <Icon name="arrow" size={12} />
            </div>
          </div>

          {/* Tile 4: Improve my CIBIL */}
          <div
            onClick={() => onAskQuestion("How can I improve my CIBIL score?")}
            className="rounded-card border border-[#E4E4E7] bg-white p-4 sm:p-5 flex flex-col justify-between hover:border-[#1E4FD8] transition-colors cursor-pointer text-left group"
          >
            <div>
              <IconTile name="trend" tint="rose" size={42} />
              <h4 className="font-archivo font-bold text-sm sm:text-base text-ink mt-3 group-hover:text-[#1E4FD8] transition-colors">
                Improve my CIBIL
              </h4>
              <p className="text-xs text-muted mt-0.5">Steps that work</p>
            </div>
            <div className="mt-4 flex items-center text-xs font-bold text-[#B42318] gap-1">
              <span>Ask AI</span>
              <Icon name="arrow" size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. Loan products: horizontal scroll of 136px tiles */}
      <div>
        <h3 className="font-archivo font-bold text-base text-ink mb-3">Loan products</h3>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {products.map((p) => {
            const iconName = getProductIcon(p.id);
            const rateText = getProductRateText(p);

            return (
              <div
                key={p.id}
                onClick={() => onSelectProduct(p.id)}
                className="min-w-[136px] w-[136px] shrink-0 rounded-card border border-[#E4E4E7] bg-white p-3.5 flex flex-col justify-between hover:border-[#1E4FD8] transition-colors cursor-pointer text-left"
              >
                <div>
                  <div className="h-9 w-9 rounded-lg bg-page flex items-center justify-center text-ink mb-3">
                    <Icon name={iconName} size={18} strokeWidth={2} />
                  </div>
                  <h4 className="font-archivo font-bold text-sm text-ink line-clamp-1">
                    {p.name}
                  </h4>
                  <p className="text-[11px] text-muted mt-1 leading-snug line-clamp-2">
                    {rateText}
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#1E4FD8]">
                  <span>Check</span>
                  <Icon name="arrow" size={11} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Learn in a minute: card with blue-tint left panel */}
      <div>
        <h3 className="font-archivo font-bold text-base text-ink mb-3">Learn in a minute</h3>
        <div className="rounded-card border border-[#E4E4E7] bg-white overflow-hidden flex flex-col sm:flex-row shadow-xs">
          {/* Blue-tint left panel with SVG bar illustration */}
          <div className="w-full sm:w-36 bg-[#EEF3FF] p-5 flex flex-col items-center justify-center shrink-0 border-b sm:border-b-0 sm:border-r border-[#E4E4E7]">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
              <rect x="8" y="36" width="10" height="20" rx="2" fill="#1E4FD8" fillOpacity="0.25" />
              <rect x="22" y="24" width="10" height="32" rx="2" fill="#1E4FD8" fillOpacity="0.5" />
              <rect x="36" y="14" width="10" height="42" rx="2" fill="#1E4FD8" />
              <path d="M50 16v38" stroke="#1E4FD8" strokeWidth="2" strokeDasharray="3 3" />
              <circle cx="50" cy="14" r="3" fill="#1E4FD8" />
            </svg>
            <span className="text-[10px] font-bold text-[#1E4FD8] uppercase tracking-wider mt-2">
              Financial Note
            </span>
          </div>

          {/* Right explanation panel */}
          <div className="p-5 flex-1 flex flex-col justify-center">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1E4FD8]">
              WORD OF THE DAY
            </span>
            <h4 className="font-archivo font-bold text-base text-ink mt-0.5">
              {wordOfTheDay.term}
            </h4>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              {wordOfTheDay.def}
            </p>
          </div>
        </div>
      </div>

      {/* 6. Dashed-border trust note */}
      <div className="border border-dashed border-[#A1A1AA] bg-page rounded-card p-3.5 flex items-center gap-3">
        <div className="shrink-0 text-muted">
          <Icon name="shield" size={20} color="#52525B" strokeWidth={1.8} />
        </div>
        <p className="text-xs text-muted font-500 leading-snug">
          No PAN, Aadhaar or phone number needed. Decision support only: the lender decides.
        </p>
      </div>

      {/* 7. Floating Ask chip above the bottom bar */}
      <div className="fixed bottom-[90px] md:bottom-6 right-4 md:right-6 z-40 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onAskQuestion(currentFloatingQuestion)}
          aria-label={`Ask AI: ${currentFloatingQuestion}`}
          className="border border-[#1E4FD8] bg-white text-ink text-xs font-600 px-3.5 py-2 rounded-full shadow-lg flex items-center gap-1.5 hover:bg-page transition-all animate-in fade-in"
        >
          <Icon name="sparkle" size={13} color="#1E4FD8" strokeWidth={2} />
          <span className="max-w-[200px] truncate">{currentFloatingQuestion}</span>
        </button>

        <button
          type="button"
          onClick={() => onAskQuestion(currentFloatingQuestion)}
          aria-label="Open AI Assistant"
          className="h-[52px] w-[52px] rounded-full bg-[#0A0A0A] text-white flex items-center justify-center shadow-xl hover:bg-black transition-transform active:scale-95 cursor-pointer shrink-0"
        >
          <Icon name="sparkle" size={22} color="#FFFFFF" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
