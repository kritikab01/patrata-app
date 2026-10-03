import { useState, useEffect, useMemo, useRef } from "react";
import type { Product, ScoreResult } from "../types";
import { getApplication } from "../api";
import { Icon, IconTile, Meter, DecisionPill, type IconName } from "./viz";
import { inr } from "../lib/calc";
import {
  getSavedName,
  saveName,
  forgetName,
  isNamePromptNeeded,
  skipNamePrompt,
  getSavedWords,
  recordWordOfDay,
  setWordLearned,
  recordStreakDay,
  type SavedWord,
} from "../lib/storage";
import { usePWAInstall } from "./usePWAInstall";

export type WordItem = {
  term: string;
  meaning: string;
  example: string;
};

export const WORDS_OF_THE_DAY: WordItem[] = [
  {
    term: "EMI",
    meaning: "The fixed amount you pay every month.",
    example: "₹5 lakh at 12% for 3 years is about ₹16,607 a month.",
  },
  {
    term: "FOIR (EMI burden)",
    meaning: "The share of monthly income that goes to EMIs; most lenders want it under 50%.",
    example: "₹15,000 of EMIs on ₹60,000 income is 25%.",
  },
  {
    term: "CIBIL score",
    meaning: "A 300–900 score of how you have repaid credit; 750+ is strong.",
    example: "One missed EMI can pull it down for months.",
  },
  {
    term: "APR",
    meaning: "The yearly cost of a loan including fees, so you can compare offers fairly.",
    example: "12% interest plus a 1% fee is about 12.7% APR on a 3-year loan.",
  },
  {
    term: "Tenure",
    meaning: "How long you take to repay.",
    example: "A longer tenure means a smaller EMI but more total interest.",
  },
  {
    term: "Principal",
    meaning: "The amount you borrow, before interest.",
    example: "On a ₹5 lakh loan, the ₹5 lakh is principal and the rest is interest.",
  },
  {
    term: "Processing fee",
    meaning: "A one-time charge by the lender, often 1–2% of the loan.",
    example: "A 1.5% fee on a ₹5 lakh loan is ₹7,500 deducted upfront.",
  },
  {
    term: "Prepayment",
    meaning: "Paying part of the loan early to save interest.",
    example: "Interest is highest in the first year, so early prepayment saves the most.",
  },
  {
    term: "Collateral",
    meaning: "An asset pledged as security, like a house or car, which usually lowers the rate.",
    example: "Pledging property for a loan usually lowers the interest rate.",
  },
  {
    term: "Loan-to-value (LTV)",
    meaning: "The loan as a share of the asset's value; RBI caps it for home loans.",
    example: "An ₹80 lakh loan on a ₹1 crore home has an 80% LTV.",
  },
  {
    term: "Co-applicant",
    meaning: "A second person whose income is counted, which can raise the amount you qualify for.",
    example: "Applying with your spouse combines incomes to qualify for a larger loan.",
  },
  {
    term: "Credit utilisation",
    meaning: "How much of your card limit you use; keeping it under 30% helps your score.",
    example: "Using ₹30,000 of a ₹1,00,000 credit limit is 30% utilisation.",
  },
  {
    term: "Hard enquiry",
    meaning: "A lender checking your report when you apply; many in a short time can lower your score.",
    example: "Applying for 5 loans in one week creates 5 hard enquiries.",
  },
  {
    term: "Pre-approved offer",
    meaning: "An offer based on data a lender already has; it still needs final checks.",
    example: "An offer based on salary records that still needs final checks.",
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
  } catch {
    /* ignore */
  }
  return null;
}

export function BorrowerHome({
  products,
  lang = "en",
  onGoCheck,
  onGoTools,
  onSelectProduct,
  onViewResult,
  onAskQuestion,
  onSwitchToDesk,
  onOpenAbout,
}: {
  products: Product[];
  lang?: "en" | "hi";
  onGoCheck: () => void;
  onGoTools: (focus?: "emi" | "power") => void;
  onSelectProduct: (productId: string) => void;
  onViewResult: (id: string) => void;
  onAskQuestion: (q: string) => void;
  onSwitchToDesk?: () => void;
  onOpenAbout?: () => void;
}) {
  const [latestId] = useState<string | null>(getLatestSavedCheckId);
  const [lastCheck, setLastCheck] = useState<ScoreResult | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkNotFound, setCheckNotFound] = useState(false);

  // Time & date tracking (updates every minute)
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // User name state
  const [userName, setUserName] = useState<string>(getSavedName);
  const [nameSheetOpen, setNameSheetOpen] = useState(false);
  const [inputName, setInputName] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { isInstallable, install } = usePWAInstall();

  // Listen for name changes across components
  useEffect(() => {
    const handleNameChanged = () => {
      setUserName(getSavedName());
    };
    window.addEventListener("patrata_name_changed", handleNameChanged);
    return () => window.removeEventListener("patrata_name_changed", handleNameChanged);
  }, []);

  // First visit check for name prompt
  useEffect(() => {
    if (isNamePromptNeeded()) {
      setNameSheetOpen(true);
      setInputName("");
    }
  }, []);

  // Handle clicking outside profile menu
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    if (profileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [profileMenuOpen]);

  // Greeting computation
  const hour = now.getHours();
  const timeGreeting = useMemo(() => {
    if (lang === "hi") {
      if (hour >= 5 && hour < 12) return "सुप्रभात";
      if (hour >= 12 && hour < 17) return "नमस्कार";
      return "शुभ संध्या";
    }
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    return "Good evening";
  }, [hour, lang]);

  const bigGreetingLine = useMemo(() => {
    if (userName) {
      return `${timeGreeting}, ${userName}`;
    }
    return timeGreeting;
  }, [timeGreeting, userName]);

  const smallDateLine = useMemo(() => {
    if (lang === "hi") {
      const d = now.toLocaleDateString("hi-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
      return `नमस्ते · ${d}`;
    }
    const d = now.toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return `नमस्ते · ${d}`;
  }, [now, lang]);

  // Word of the Day calculation (days since 1 Jan 2026 mod list length)
  const todayDateKey = useMemo(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }, [now]);

  const todayShortDate = useMemo(() => {
    return now.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  }, [now]);

  const wordOfTheDay = useMemo(() => {
    const d2026 = new Date(2026, 0, 1).getTime();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const daysSince2026 = Math.max(0, Math.floor((startOfDay - d2026) / (1000 * 60 * 60 * 24)));
    return WORDS_OF_THE_DAY[daysSince2026 % WORDS_OF_THE_DAY.length];
  }, [now]);

  // Words History & Streak
  const [wordsHistory, setWordsHistory] = useState<SavedWord[]>(getSavedWords);
  const [wordExpanded, setWordExpanded] = useState(false);
  const [learnedModalOpen, setLearnedModalOpen] = useState(false);
  const [expandedLearnedIdx, setExpandedLearnedIdx] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const updated = recordWordOfDay(wordOfTheDay, todayShortDate, todayDateKey);
    setWordsHistory(updated);
    const s = recordStreakDay(todayDateKey);
    setStreak(s);
  }, [wordOfTheDay, todayShortDate, todayDateKey]);

  const isTodayWordLearned = useMemo(() => {
    return wordsHistory.some((w) => w.term === wordOfTheDay.term && w.learned);
  }, [wordsHistory, wordOfTheDay.term]);

  const learnedCount = useMemo(() => {
    return wordsHistory.filter((w) => w.learned).length;
  }, [wordsHistory]);

  const handleMarkLearned = (term: string) => {
    const updated = setWordLearned(term, true);
    setWordsHistory(updated);
  };

  // Name handlers
  const handleOpenNameChange = () => {
    setInputName(userName);
    setProfileMenuOpen(false);
    setNameSheetOpen(true);
  };

  const handleSaveName = () => {
    const clean = inputName.trim();
    if (clean) {
      saveName(clean);
      setUserName(clean);
    } else {
      skipNamePrompt();
    }
    setNameSheetOpen(false);
  };

  const handleSkipName = () => {
    skipNamePrompt();
    setNameSheetOpen(false);
  };

  const handleForgetName = () => {
    forgetName();
    setUserName("");
    setProfileMenuOpen(false);
  };

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
      let lowestRate: number | null = null;
      if (Array.isArray(crit?.rate_range) && crit.rate_range.length > 0) {
        const val = Number(crit.rate_range[0]);
        if (!isNaN(val)) lowestRate = val;
      } else if (typeof crit?.annual_rate === "number") {
        lowestRate = crit.annual_rate;
      }
      if (lowestRate === 0) hasZeroRate = true;
      if (lowestRate != null) {
        if (minRate == null || lowestRate < minRate) minRate = lowestRate;
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
      {/* 1. TOP SECTION: Greeting Card and Last Check Card
             On screens > 900px: side by side in a 1fr / 2fr grid.
             On mobile: stacked vertically with 16px gap. */}
      <div className="grid grid-cols-1 min-[900px]:grid-cols-[1fr_2fr] gap-4 mb-4 items-stretch">
        {/* COMPACT GREETING CARD (Height ~88px, Black bg, White text, 16px radius) */}
        <div className="bg-[#0A0A0A] text-white rounded-[16px] px-5 py-4 min-h-[88px] flex items-center justify-between shadow-xs relative">
          {/* Left side: two lines */}
          <div className="min-w-0 pr-3">
            <p className="text-[13px] text-[#A1A1AA] font-500 truncate leading-snug">
              {smallDateLine}
            </p>
            <h2 className="font-archivo font-bold text-[20px] text-white tracking-tight leading-tight mt-0.5 truncate">
              {bigGreetingLine}
            </h2>
          </div>

          {/* Right side: 44px round white-outline button with user icon */}
          <div className="relative shrink-0" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((v) => !v)}
              aria-label="User profile and options"
              aria-expanded={profileMenuOpen}
              className="h-[44px] w-[44px] rounded-full border border-white/40 flex items-center justify-center text-white hover:border-white hover:bg-white/10 transition-colors"
            >
              <Icon name="user" size={20} strokeWidth={2} />
            </button>

            {/* Profile Dropdown Menu */}
            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-card border border-cardborder bg-white p-2 shadow-xl z-50 text-ink animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-cardborder mb-1">
                  <p className="text-xs font-700 text-ink">
                    {userName ? `Namaste, ${userName}` : "Patrata Account"}
                  </p>
                  <p className="text-[11px] text-muted">Borrower Mode active</p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenNameChange}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-600 text-ink hover:bg-page transition-colors"
                >
                  <Icon name="user" size={16} />
                  <span>{userName ? "Change name" : "Set your name"}</span>
                </button>

                {userName && (
                  <button
                    type="button"
                    onClick={handleForgetName}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-600 text-[#B42318] hover:bg-page transition-colors"
                  >
                    <Icon name="cross" size={16} color="#B42318" />
                    <span>Forget my name</span>
                  </button>
                )}

                {onSwitchToDesk && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSwitchToDesk();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-700 text-ink hover:bg-page transition-colors"
                  >
                    <Icon name="dashboard" size={16} color="#1E4FD8" />
                    <span>Switch to lender desk</span>
                  </button>
                )}

                {onOpenAbout && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onOpenAbout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-600 text-ink hover:bg-page transition-colors"
                  >
                    <Icon name="info" size={16} />
                    <span>About Patrata and your data</span>
                  </button>
                )}

                {isInstallable && (
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
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

        {/* YOUR LAST CHECK CARD
            Compact when empty (height ~140px, one row with small Meter width 96 on left,
            text + blue button on right).
            Rich display when last check exists. */}
        <div className="rounded-[18px] border border-[#E4E4E7] bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-[#E4E4E7] pb-2 mb-2">
            <h3 className="text-[11px] font-bold tracking-wider text-muted uppercase">
              {lang === "hi" ? "आपकी पिछली जाँच" : "YOUR LAST CHECK"}
            </h3>
            {lastCheck && <DecisionPill decision={lastCheck.decision} />}
          </div>

          {checkLoading ? (
            <div className="py-6 flex flex-col items-center justify-center text-muted">
              <Icon name="clock" size={20} color="#1E4FD8" />
              <p className="mt-1 text-xs font-600">Loading your latest check…</p>
            </div>
          ) : lastCheck && !checkNotFound ? (
            /* Populated State */
            <div>
              <div className="flex flex-col items-center justify-center my-1">
                <Meter
                  width={200}
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
                <p className="mt-2 text-xs text-muted font-600 text-center">
                  {lastCheck.product_name} · {inr(lastCheck.loan_amount ?? 500000)} ·{" "}
                  {lastCheck.tenure_months ?? 36} months
                </p>
              </div>

              {/* Ruled 3-column strip */}
              <div className="grid grid-cols-3 divide-x divide-[#E4E4E7] border-y border-[#E4E4E7] py-2.5 text-center my-3">
                <div className="px-2">
                  <p className="text-[11px] text-muted">Estimated EMI</p>
                  <p className="font-archivo font-bold text-xs sm:text-sm text-ink mt-0.5">
                    {inr(lastCheck.emi_estimate)}
                  </p>
                </div>
                <div className="px-2">
                  <p className="text-[11px] text-muted">EMI burden</p>
                  <p className="font-archivo font-bold text-xs sm:text-sm text-ink mt-0.5">
                    {lastCheck.foir != null ? `${(lastCheck.foir * 100).toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="px-2">
                  <p className="text-[11px] text-muted">Default risk</p>
                  <p className="font-archivo font-bold text-xs sm:text-sm text-ink mt-0.5 truncate">
                    {lastCheck.repayment_risk
                      ? `${(lastCheck.repayment_risk.probability * 100).toFixed(1)}%`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2.5 mt-3">
                <button
                  type="button"
                  onClick={() => onViewResult(lastCheck.id)}
                  className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-btn border border-[#E4E4E7] bg-white px-3 text-xs font-archivo font-bold text-ink hover:bg-page transition-colors"
                >
                  <span>View result</span>
                  <Icon name="arrow" size={13} />
                </button>
                <button
                  type="button"
                  onClick={onGoCheck}
                  className="flex-1 min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-btn bg-[#1E4FD8] px-3 text-xs font-archivo font-bold text-white hover:bg-[#1A44BD] transition-colors shadow-sm"
                >
                  <span>New check</span>
                  <Icon name="check" size={13} color="#fff" />
                </button>
              </div>

              {renderFoirInfoStrip(lastCheck.foir)}
            </div>
          ) : (
            /* COMPACT EMPTY STATE (Height ~140px, One row: Meter width 96 on left, text + blue button on right) */
            <div className="flex items-center gap-4 py-1.5">
              <div className="shrink-0 flex items-center justify-center">
                <Meter value={null} width={96} big="—" label="" showKnob={false} />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-archivo font-bold text-sm sm:text-base text-ink leading-tight">
                  No checks yet
                </h4>
                <p className="text-[13px] text-muted leading-snug mt-1">
                  Find out in 2 minutes whether a lender is likely to approve your loan.
                </p>
                <button
                  type="button"
                  onClick={onGoCheck}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-btn bg-[#1E4FD8] px-4 py-2 text-xs font-archivo font-bold text-white hover:bg-[#1A44BD] transition-colors shadow-xs"
                >
                  <span>Check my eligibility</span>
                  <Icon name="arrow" size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. QUICK ACTIONS: 2×2 grid of white tiles */}
      <div>
        <h3 className="font-archivo font-bold text-base text-ink mb-3">
          {lang === "hi" ? "त्वरित विकल्प" : "Quick actions"}
        </h3>
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

      {/* 3. LOAN PRODUCTS: Horizontal scroll */}
      <div>
        <h3 className="font-archivo font-bold text-base text-ink mb-3">
          {lang === "hi" ? "लोन प्रकार" : "Loan products"}
        </h3>
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

      {/* 4. WORD OF THE DAY (with History and Learning Streak) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-archivo font-bold text-base text-ink">
            {lang === "hi" ? "एक मिनट में सीखें" : "Learn in a minute"}
          </h3>
          {streak > 0 && (
            <span className="text-xs font-semibold text-[#1E4FD8] bg-[#EEF3FF] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-[#F97316]"
                aria-hidden="true"
              >
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
              </svg>
              <span>{streak}-day learning streak</span>
            </span>
          )}
        </div>

        {/* Word of the Day Card */}
        <div
          onClick={() => setWordExpanded((v) => !v)}
          className="rounded-card border border-[#E4E4E7] bg-white overflow-hidden shadow-xs cursor-pointer hover:border-[#1E4FD8] transition-all"
        >
          <div className="flex flex-col sm:flex-row">
            {/* Blue-tint left decorative panel */}
            <div className="w-full sm:w-36 bg-[#EEF3FF] p-4 flex flex-col items-center justify-center shrink-0 border-b sm:border-b-0 sm:border-r border-[#E4E4E7]">
              <svg width="56" height="56" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                <rect x="8" y="36" width="10" height="20" rx="2" fill="#1E4FD8" fillOpacity="0.25" />
                <rect x="22" y="24" width="10" height="32" rx="2" fill="#1E4FD8" fillOpacity="0.5" />
                <rect x="36" y="14" width="10" height="42" rx="2" fill="#1E4FD8" />
                <path d="M50 16v38" stroke="#1E4FD8" strokeWidth="2" strokeDasharray="3 3" />
                <circle cx="50" cy="14" r="3" fill="#1E4FD8" />
              </svg>
              <span className="text-[10px] font-bold text-[#1E4FD8] uppercase tracking-wider mt-1.5">
                Financial Note
              </span>
            </div>

            {/* Right content panel */}
            <div className="p-5 flex-1 flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#1E4FD8]">
                  WORD OF THE DAY
                </span>
                <span className="text-xs text-muted flex items-center gap-1 font-500">
                  <span>{wordExpanded ? "Tap to collapse" : "Tap to expand"}</span>
                  <Icon name={wordExpanded ? "chevronUp" : "chevronDown"} size={14} />
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <h4 className="font-archivo font-bold text-base text-ink">
                  {wordOfTheDay.term}
                </h4>
                {isTodayWordLearned && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#047857] bg-[#E8F5EE] px-2 py-0.5 rounded-full">
                    <Icon name="tick" size={11} color="#047857" strokeWidth={2.5} />
                    <span>Learned</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-muted mt-1 leading-relaxed">
                {wordOfTheDay.meaning}
              </p>

              {/* Expanded details */}
              {wordExpanded && (
                <div className="mt-3 pt-3 border-t border-[#E4E4E7] space-y-3 animate-in fade-in duration-150">
                  <div className="bg-page p-3 rounded-lg border border-[#E4E4E7] text-xs text-muted leading-relaxed">
                    <strong className="text-ink font-semibold">Example: </strong>
                    {wordOfTheDay.example}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAskQuestion(`Explain ${wordOfTheDay.term} with an example`);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-btn bg-[#EEF3FF] text-[#1E4FD8] px-3.5 py-1.5 text-xs font-archivo font-bold hover:bg-[#DCE7FD] transition-colors"
                    >
                      <Icon name="sparkle" size={13} color="#1E4FD8" />
                      <span>Ask Patrata about this</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkLearned(wordOfTheDay.term);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-btn px-3.5 py-1.5 text-xs font-archivo font-bold transition-colors ${
                        isTodayWordLearned
                          ? "bg-[#E8F5EE] text-[#047857]"
                          : "bg-ink text-white hover:bg-ink/90"
                      }`}
                    >
                      <Icon
                        name="tick"
                        size={13}
                        color={isTodayWordLearned ? "#047857" : "#FFFFFF"}
                        strokeWidth={2.5}
                      />
                      <span>{isTodayWordLearned ? "Got it ✓" : "Got it"}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Link under card: Words you've learned ({n}) */}
        <div className="mt-2.5 flex items-center justify-between px-1 text-xs">
          <button
            type="button"
            onClick={() => setLearnedModalOpen(true)}
            className="font-bold text-[#1E4FD8] hover:underline flex items-center gap-1"
          >
            <span>Words you've learned ({learnedCount})</span>
            <Icon name="arrow" size={12} color="#1E4FD8" />
          </button>
        </div>
      </div>

      {/* 5. TRUST NOTE */}
      <div className="border border-dashed border-[#A1A1AA] bg-page rounded-card p-3.5 flex items-center gap-3">
        <div className="shrink-0 text-muted">
          <Icon name="shield" size={20} color="#52525B" strokeWidth={1.8} />
        </div>
        <p className="text-xs text-muted font-500 leading-snug">
          No PAN, Aadhaar or phone number needed. Decision support only: the lender decides.
        </p>
      </div>

      {/* 6. FLOATING ASK CHIP */}
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

      {/* MODAL 1: WHAT SHOULD WE CALL YOU? (Welcome Bottom Sheet) */}
      {nameSheetOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-t-[20px] sm:rounded-[20px] border border-cardborder bg-white p-6 pb-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-cardborder pb-3">
              <div>
                <h3 className="font-archivo font-bold text-lg text-ink">Welcome to Patrata</h3>
                <p className="text-xs text-muted mt-0.5">Let's personalise your screening dashboard</p>
              </div>
              <button
                type="button"
                onClick={handleSkipName}
                className="flex h-8 w-8 items-center justify-center rounded-btn text-muted hover:text-ink hover:bg-page transition-colors"
              >
                <Icon name="cross" size={16} />
              </button>
            </div>

            <div>
              <label htmlFor="borrower-name-input" className="block text-sm font-semibold text-ink">
                What should we call you?
              </label>
              <input
                id="borrower-name-input"
                type="text"
                maxLength={30}
                value={inputName}
                onChange={(e) => {
                  const filtered = e.target.value
                    .replace(/[^A-Za-z\s\u0900-\u097F]/g, "")
                    .slice(0, 30);
                  setInputName(filtered);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                }}
                placeholder="e.g. Rahul or Priya"
                className="mt-2 w-full rounded-btn border border-cardborder px-3.5 py-2.5 text-sm font-500 text-ink focus:border-[#1E4FD8] focus:ring-1 focus:ring-[#1E4FD8] transition-colors"
                autoFocus
              />
              <p className="text-xs text-muted mt-2 leading-relaxed">
                Your name stays on this phone. It is never sent to Patrata's engine.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveName}
                className="flex-1 h-11 rounded-btn bg-[#1E4FD8] text-white font-archivo font-bold text-sm hover:bg-[#1A44BD] transition-colors shadow-sm"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={handleSkipName}
                className="px-4 h-11 text-xs font-semibold text-muted hover:text-ink transition-colors"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: WORDS YOU'VE LEARNED SHEET */}
      {learnedModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-t-[20px] sm:rounded-[20px] border border-cardborder bg-white p-6 shadow-2xl max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-cardborder pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-btn bg-[#EEF3FF] text-[#1E4FD8]">
                  <Icon name="book" size={16} color="#1E4FD8" />
                </div>
                <h3 className="font-archivo font-bold text-lg text-ink">
                  Words you've learned ({learnedCount})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setLearnedModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-btn text-muted hover:text-ink hover:bg-page transition-colors"
              >
                <Icon name="cross" size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[#E4E4E7] pr-1">
              {wordsHistory.length === 0 ? (
                <div className="py-8 text-center text-muted text-xs">
                  No words recorded yet. Check back every day to learn new loan concepts.
                </div>
              ) : (
                wordsHistory.map((item, idx) => {
                  const isExpanded = expandedLearnedIdx === idx;
                  return (
                    <div key={idx} className="py-3">
                      <div
                        onClick={() => setExpandedLearnedIdx(isExpanded ? null : idx)}
                        className="flex items-center justify-between cursor-pointer py-1 select-none"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <span className="text-xs text-muted font-500 w-14 shrink-0">
                            {item.date}
                          </span>
                          <span className="font-archivo font-bold text-sm text-ink truncate">
                            {item.term}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {item.learned ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#047857] bg-[#E8F5EE] px-2 py-0.5 rounded-full">
                              <Icon name="tick" size={11} color="#047857" strokeWidth={2.5} />
                              <span>Learned</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkLearned(item.term);
                              }}
                              className="text-[11px] font-bold text-muted hover:text-ink px-2 py-0.5 border border-[#E4E4E7] rounded-full hover:bg-page transition-colors"
                            >
                              Mark learned
                            </button>
                          )}
                          <Icon
                            name={isExpanded ? "chevronUp" : "chevronDown"}
                            size={14}
                            color="#71717A"
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="mt-2 pl-14 text-xs text-muted space-y-2 pb-1 animate-in fade-in duration-150">
                          <p className="leading-relaxed text-ink">{item.meaning}</p>
                          {item.example && (
                            <div className="bg-page p-2.5 rounded border border-[#E4E4E7] text-[11px] leading-relaxed">
                              <strong className="text-ink">Example: </strong>
                              {item.example}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 flex justify-end border-t border-cardborder">
              <button
                type="button"
                onClick={() => setLearnedModalOpen(false)}
                className="h-10 px-5 rounded-btn bg-ink text-xs font-700 text-white hover:bg-ink/90 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
