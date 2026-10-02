import { useState, useEffect } from "react";
import type { Product, ScoreResult } from "../types";
import { getApplication } from "../api";
import { inr } from "../lib/calc";
import { Meter, IconTile, DecisionPill, Icon, type IconName } from "./viz";

const ROTATING_QUESTIONS = [
  "How can I improve my score?",
  "क्या मेरी EMI ज़्यादा है?",
  "Why was I referred?",
];

const WORDS_OF_THE_DAY = [
  {
    term: "FOIR (EMI burden)",
    explanation: "Fixed Obligation to Income Ratio — the share of your monthly income that goes toward EMIs.",
  },
  {
    term: "CIBIL score",
    explanation: "A 3-digit number from 300 to 900 reflecting your repayment history; 750+ gets best interest rates.",
  },
  {
    term: "APR",
    explanation: "Annual Percentage Rate — total yearly cost of a loan including interest rate and all upfront fees.",
  },
  {
    term: "Tenure",
    explanation: "The total duration in months or years over which you agree to repay the loan.",
  },
  {
    term: "Collateral",
    explanation: "An asset (like a house or car) pledged as security for loan approval and lower rates.",
  },
  {
    term: "Pre-approved offer",
    explanation: "An indicative loan offer based on preliminary checks; final approval requires verification.",
  },
];

const PRODUCT_ICONS: Record<string, IconName> = {
  personal: "wallet",
  home: "house",
  consumer: "gadget",
  vehicle: "car",
};

export function HomeTab({
  products,
  onNavigateToCheck,
  onNavigateToTools,
  onSelectProduct,
  onAskQuestion,
  onViewResult,
}: {
  products: Product[];
  onNavigateToCheck: () => void;
  onNavigateToTools: (tool?: string) => void;
  onSelectProduct: (productId: string) => void;
  onAskQuestion: (question: string) => void;
  onViewResult: (id: string) => void;
}) {
  const [lastCheck, setLastCheck] = useState<ScoreResult | null>(null);
  const [loadingCheck, setLoadingCheck] = useState(true);
  const [qIndex, setQIndex] = useState(0);

  // Rotating question every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setQIndex((prev) => (prev + 1) % ROTATING_QUESTIONS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Read the latest saved check from localStorage key "patrata_checks"
  useEffect(() => {
    let cancelled = false;
    async function fetchLastCheck() {
      try {
        const raw = localStorage.getItem("patrata_checks");
        let latestId: string | null = null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const first = parsed[0];
            latestId = typeof first === "string" ? first : first?.id || null;
          }
        }

        if (!latestId) {
          setLoadingCheck(false);
          return;
        }

        const res = await getApplication(latestId);
        if (!cancelled && res && res.id) {
          setLastCheck(res);
        }
      } catch {
        // If 404 or missing, treat as no check
      } finally {
        if (!cancelled) setLoadingCheck(false);
      }
    }

    fetchLastCheck();
    return () => {
      cancelled = true;
    };
  }, []);

  // Daily word of the day
  const dayIndex = Math.floor(Date.now() / 86400000) % WORDS_OF_THE_DAY.length;
  const wordOfDay = WORDS_OF_THE_DAY[dayIndex];

  // Format FOIR guidance text
  const foirVal = lastCheck?.foir != null ? lastCheck.foir : 0;
  const foirPct = Math.round(foirVal * 100);
  let foirGuidance = `Your EMI burden is ${foirPct}%. Lenders are comfortable up to 50%.`;
  if (foirVal > 0.6) {
    foirGuidance = `Your EMI burden is ${foirPct}%. Lenders usually decline or require co-signers above 60%.`;
  } else if (foirVal > 0.5) {
    foirGuidance = `Your EMI burden is ${foirPct}%. Lenders review applications between 50% and 60%.`;
  }

  // Calculate loan amount and months for the subtitle
  const appData = (lastCheck as unknown as { application?: { loan_amount?: number; loan_term?: number } })?.application;
  const loanAmount = appData?.loan_amount;
  const loanMonths = appData?.loan_term ? Math.round(appData.loan_term * 12) : null;

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* 1. Black top band */}
      <div className="bg-ink text-white pt-5 pb-24 px-5 -mx-4 sm:-mx-6 rounded-b-[24px]">
        <div className="max-w-xl mx-auto">
          <p className="text-xs font-500 text-[#A1A1AA] uppercase tracking-wider">Namaste</p>
          <h2 className="font-archivo font-800 text-[22px] leading-tight text-white mt-0.5">Hello</h2>
        </div>
      </div>

      {/* 2. Overlapping "YOUR LAST CHECK" card */}
      <div className="-mt-[76px] rounded-[18px] border border-cardborder bg-white p-5 sm:p-6 shadow-sm relative z-10">
        {loadingCheck ? (
          <div className="py-10 text-center text-sm text-muted">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent mr-2 align-middle" />
            Checking latest activity…
          </div>
        ) : lastCheck ? (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-700 text-muted uppercase tracking-wider">
                YOUR LAST CHECK
              </span>
              <DecisionPill decision={lastCheck.decision} />
            </div>

            {/* Semicircle Meter */}
            <div className="my-2 flex justify-center">
              <Meter
                value={lastCheck.approval_probability}
                width={240}
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
            </div>

            {/* Product and loan summary subtitle */}
            <p className="text-center text-xs font-600 text-ink">
              {[
                lastCheck.product_name,
                loanAmount != null ? inr(loanAmount) : null,
                loanMonths != null ? `${loanMonths} months` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {/* Ruled 3-column strip */}
            <div className="border-y border-cardborder py-3 my-4 grid grid-cols-3 divide-x divide-cardborder text-center">
              <div className="px-1">
                <p className="text-[11px] text-muted font-500">New EMI</p>
                <p className="font-archivo font-700 text-sm text-ink mt-0.5">
                  {lastCheck.emi_estimate != null ? inr(lastCheck.emi_estimate) : "—"}
                  <span className="text-[10px] font-400 text-muted">/mo</span>
                </p>
              </div>
              <div className="px-1">
                <p className="text-[11px] text-muted font-500">EMI burden</p>
                <p className="font-archivo font-700 text-sm text-ink mt-0.5">
                  {lastCheck.foir != null ? `${Math.round(lastCheck.foir * 100)}%` : "—"}
                </p>
              </div>
              <div className="px-1">
                <p className="text-[11px] text-muted font-500">Default risk</p>
                <p className="font-archivo font-700 text-sm text-ink mt-0.5">
                  {lastCheck.repayment_risk?.probability != null
                    ? `${(lastCheck.repayment_risk.probability * 100).toFixed(1)}%`
                    : "—"}
                </p>
                {lastCheck.repayment_risk?.band && (
                  <p className="text-[10px] text-muted">{lastCheck.repayment_risk.band}</p>
                )}
              </div>
            </div>

            {/* Actions: View result & New check */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onViewResult(lastCheck.id)}
                className="min-h-[44px] rounded-btn border border-cardborder bg-white px-4 font-archivo font-700 text-xs text-ink hover:border-brand hover:text-brand transition-colors flex items-center justify-center gap-1.5"
              >
                <span>View result</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToCheck}
                className="min-h-[44px] rounded-btn bg-brand px-4 font-archivo font-700 text-xs text-white hover:bg-brand-600 transition-colors flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>New check</span>
              </button>
            </div>

            {/* Blue-tint guidance strip */}
            <div className="mt-3.5 flex items-start gap-2 rounded-btn bg-[#EEF3FF] p-2.5 text-xs text-[#1E4FD8]">
              <div className="mt-0.5 shrink-0">
                <Icon name="info" size={14} color="#1E4FD8" />
              </div>
              <p className="leading-snug">{foirGuidance}</p>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-2 space-y-3">
            <div className="flex justify-center">
              <Meter value={null} width={220} big="—" label="Not checked yet" />
            </div>
            <div>
              <h3 className="font-archivo font-700 text-base text-ink">No checks yet</h3>
              <p className="mt-1 text-xs text-muted max-w-xs mx-auto">
                Find out in 2 minutes whether a lender is likely to approve your loan.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToCheck}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-btn bg-brand px-5 font-archivo font-700 text-sm text-white hover:bg-brand-600 transition-colors shadow-sm"
            >
              Check my eligibility
            </button>
          </div>
        )}
      </div>

      {/* 3. Quick actions: 2x2 grid */}
      <div className="space-y-2.5">
        <h3 className="font-archivo font-700 text-sm text-ink px-0.5">Quick actions</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Check eligibility */}
          <button
            type="button"
            onClick={onNavigateToCheck}
            className="rounded-card border border-cardborder bg-white p-3.5 text-left hover:border-brand transition-colors flex flex-col justify-between min-h-[110px]"
          >
            <IconTile name="check" tint="blue" size={38} />
            <div className="mt-2.5">
              <p className="font-archivo font-700 text-xs text-ink">Check eligibility</p>
              <p className="text-[11px] text-muted mt-0.5">3 steps, 2 minutes</p>
            </div>
          </button>

          {/* EMI calculator */}
          <button
            type="button"
            onClick={() => onNavigateToTools("emi")}
            className="rounded-card border border-cardborder bg-white p-3.5 text-left hover:border-brand transition-colors flex flex-col justify-between min-h-[110px]"
          >
            <IconTile name="tools" tint="green" size={38} />
            <div className="mt-2.5">
              <p className="font-archivo font-700 text-xs text-ink">EMI calculator</p>
              <p className="text-[11px] text-muted mt-0.5">See EMI and interest</p>
            </div>
          </button>

          {/* How much can I borrow? */}
          <button
            type="button"
            onClick={() => onNavigateToTools("borrow")}
            className="rounded-card border border-cardborder bg-white p-3.5 text-left hover:border-brand transition-colors flex flex-col justify-between min-h-[110px]"
          >
            <IconTile name="wallet" tint="amber" size={38} />
            <div className="mt-2.5">
              <p className="font-archivo font-700 text-xs text-ink">How much can I borrow?</p>
              <p className="text-[11px] text-muted mt-0.5">From your income</p>
            </div>
          </button>

          {/* Improve my CIBIL */}
          <button
            type="button"
            onClick={() => onAskQuestion("How can I improve my CIBIL score?")}
            className="rounded-card border border-cardborder bg-white p-3.5 text-left hover:border-brand transition-colors flex flex-col justify-between min-h-[110px]"
          >
            <IconTile name="trend" tint="rose" size={38} />
            <div className="mt-2.5">
              <p className="font-archivo font-700 text-xs text-ink">Improve my CIBIL</p>
              <p className="text-[11px] text-muted mt-0.5">Steps that work</p>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Loan products: Horizontal scroll of 136px tiles */}
      {products && products.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h3 className="font-archivo font-700 text-sm text-ink">Loan products</h3>
            <span className="text-[11px] text-muted font-500">Tap to start</span>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1.5 -mx-4 px-4 sm:mx-0 sm:px-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {products.map((p) => {
              const iconName = PRODUCT_ICONS[p.id] || "wallet";
              const variants = p.variants || [];
              const hasZeroRate = variants.some((v) => v.annual_rate === 0);
              const minRate =
                variants.length > 0
                  ? Math.min(...variants.map((v) => v.annual_rate))
                  : p.rate_range
                  ? p.rate_range.min
                  : 10;

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectProduct(p.id)}
                  className="min-w-[136px] w-[136px] rounded-card border border-cardborder bg-white p-3.5 flex flex-col justify-between text-left hover:border-brand transition-colors cursor-pointer shrink-0 shadow-sm"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-btn bg-page text-ink">
                    <Icon name={iconName} size={18} />
                  </div>
                  <div className="mt-4">
                    <p className="font-archivo font-700 text-xs text-ink leading-snug">{p.name}</p>
                    <p className="text-[10.5px] text-muted mt-1 leading-tight">
                      {hasZeroRate
                        ? "0% no-cost option"
                        : `${variants.length} types · from ${minRate}%`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Learn in a minute: Word of the Day */}
      <div className="rounded-card border border-cardborder bg-white p-4 sm:p-5 flex items-start gap-4">
        <div className="hidden sm:flex h-16 w-16 rounded-xl bg-[#EEF3FF] items-center justify-center shrink-0 text-[#1E4FD8]">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <line x1="8" y1="16" x2="8" y2="12" />
            <line x1="12" y1="16" x2="12" y2="8" />
            <line x1="16" y1="16" x2="16" y2="10" />
          </svg>
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#EEF3FF] px-2 py-0.5 text-[10px] font-700 text-[#1E4FD8] uppercase">
              WORD OF THE DAY
            </span>
            <span className="font-archivo font-700 text-xs text-ink">{wordOfDay.term}</span>
          </div>
          <p className="text-xs text-muted leading-relaxed pt-0.5">{wordOfDay.explanation}</p>
        </div>
      </div>

      {/* 6. Dashed-border trust note */}
      <div className="rounded-card border border-dashed border-cardborder bg-white/60 p-3.5 flex items-center gap-3">
        <div className="shrink-0 text-muted">
          <Icon name="shield" size={18} />
        </div>
        <p className="text-xs text-muted leading-tight">
          No PAN, Aadhaar or phone number needed. Decision support only: the lender decides.
        </p>
      </div>

      {/* 7. Floating Ask chip above bottom bar */}
      <div className="fixed bottom-[88px] md:bottom-6 right-4 z-40 flex items-center gap-2 no-print">
        <button
          type="button"
          onClick={() => onAskQuestion(ROTATING_QUESTIONS[qIndex])}
          className="bg-white border border-brand text-brand hover:bg-brand-50 rounded-full px-3.5 py-2 shadow-lg text-xs font-700 flex items-center gap-1.5 transition-all max-w-[210px] sm:max-w-xs truncate"
        >
          <span className="truncate">{ROTATING_QUESTIONS[qIndex]}</span>
        </button>
        <button
          type="button"
          onClick={() => onAskQuestion(ROTATING_QUESTIONS[qIndex])}
          aria-label="Ask Patrata Assistant"
          className="h-[52px] w-[52px] rounded-full bg-ink text-white flex items-center justify-center shadow-xl hover:bg-ink/90 transition-transform active:scale-95 shrink-0"
        >
          <Icon name="sparkle" size={22} color="#fff" />
        </button>
      </div>
    </div>
  );
}
