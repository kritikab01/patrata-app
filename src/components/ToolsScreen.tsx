import { useState, useMemo } from "react";
import { Icon, Donut, ZoneBar, Meter, FOIR_ZONES, type DonutSegment } from "./viz";
import {
  emiSummary,
  borrowPower,
  prepaymentSavings,
  yearlySplit,
  foir,
  inr,
  inWords,
  computeApr,
  type YearSplit,
} from "../lib/calc";

export type ToolKey = "emi" | "power" | "prepayment" | "burden" | "compare";

const TOOLS: { key: ToolKey; label: string }[] = [
  { key: "emi", label: "EMI" },
  { key: "power", label: "Borrow power" },
  { key: "prepayment", label: "Prepayment" },
  { key: "burden", label: "EMI burden" },
  { key: "compare", label: "Compare loans" },
];

type LoanType = "personal" | "home" | "vehicle" | "gadget";

const LOAN_TYPES: {
  id: LoanType;
  label: string;
  icon: "wallet" | "house" | "car" | "gadget";
  defaultRate: number;
  defaultAmount: number;
  minAmount: number;
  maxAmount: number;
  defaultMonths: number;
  isHome?: boolean;
}[] = [
  {
    id: "personal",
    label: "Personal",
    icon: "wallet",
    defaultRate: 12,
    defaultAmount: 500000,
    minAmount: 50000,
    maxAmount: 2500000,
    defaultMonths: 36,
  },
  {
    id: "home",
    label: "Home",
    icon: "house",
    defaultRate: 8.5,
    defaultAmount: 4000000,
    minAmount: 500000,
    maxAmount: 20000000,
    defaultMonths: 240,
    isHome: true,
  },
  {
    id: "vehicle",
    label: "Vehicle",
    icon: "car",
    defaultRate: 9,
    defaultAmount: 800000,
    minAmount: 100000,
    maxAmount: 4000000,
    defaultMonths: 60,
  },
  {
    id: "gadget",
    label: "Gadget",
    icon: "gadget",
    defaultRate: 14,
    defaultAmount: 100000,
    minAmount: 10000,
    maxAmount: 500000,
    defaultMonths: 12,
  },
];

export function ToolsScreen({
  onStartCheckWith,
}: {
  onStartCheckWith?: (params: {
    product: string;
    amount: number;
    tenureMonths: number;
    rate: number;
  }) => void;
}) {
  // Read ?tool= from URL
  const [activeTool, setActiveTool] = useState<ToolKey>(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("tool");
      if (p === "power" || p === "borrow-power") return "power";
      if (p === "prepayment") return "prepayment";
      if (p === "burden" || p === "foir") return "burden";
      if (p === "compare") return "compare";
    }
    return "emi";
  });

  // Sync activeTool to URL ?tool=
  function switchTool(key: ToolKey) {
    setActiveTool(key);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tool", key);
      window.history.replaceState({}, "", url.toString());
    }
  }

  // ================= 1. EMI CALCULATOR STATE =================
  const [loanType, setLoanType] = useState<LoanType>("personal");
  const [emiAmount, setEmiAmount] = useState(500000);
  const [emiRate, setEmiRate] = useState(12);
  const [emiMonths, setEmiMonths] = useState(36);
  const [donutHovered, setDonutHovered] = useState<DonutSegment | null>(null);
  const [hoveredYear, setHoveredYear] = useState<YearSplit | null>(null);

  const activeLoanConfig = useMemo(
    () => LOAN_TYPES.find((t) => t.id === loanType) || LOAN_TYPES[0],
    [loanType]
  );

  function handleSelectLoanType(t: LoanType) {
    setLoanType(t);
    const cfg = LOAN_TYPES.find((x) => x.id === t);
    if (cfg) {
      setEmiRate(cfg.defaultRate);
      setEmiAmount(cfg.defaultAmount);
      setEmiMonths(cfg.defaultMonths);
    }
  }

  const emiRes = useMemo(
    () => emiSummary(emiAmount, emiRate, emiMonths),
    [emiAmount, emiRate, emiMonths]
  );

  const yearlyData = useMemo(
    () => yearlySplit(emiAmount, emiRate, emiMonths),
    [emiAmount, emiRate, emiMonths]
  );

  const processingFee = useMemo(() => emiAmount * 0.01, [emiAmount]);
  const realApr = useMemo(
    () => computeApr(emiAmount, processingFee, emiRes.emi, emiMonths),
    [emiAmount, processingFee, emiRes.emi, emiMonths]
  );

  const donutSegments: DonutSegment[] = useMemo(
    () => [
      { label: "Principal", value: emiAmount, color: "#3B6BF0" },
      { label: "Interest", value: emiRes.totalInterest, color: "#E0A33A" },
    ],
    [emiAmount, emiRes.totalInterest]
  );

  const maxYearTotal = useMemo(() => {
    return Math.max(...yearlyData.map((y) => y.principal + y.interest), 1);
  }, [yearlyData]);

  // ================= 2. BORROW POWER STATE =================
  const [bpIncome, setBpIncome] = useState(75000);
  const [bpExistingEmi, setBpExistingEmi] = useState(12000);
  const [bpRate, setBpRate] = useState(10.5);
  const [bpTenure, setBpTenure] = useState(60);
  const [bpLimitPct, setBpLimitPct] = useState(50); // 40, 50, 60

  const borrowPowerRes = useMemo(() => {
    return borrowPower(bpIncome, bpExistingEmi, bpRate, bpTenure, bpLimitPct / 100);
  }, [bpIncome, bpExistingEmi, bpRate, bpTenure, bpLimitPct]);

  const allowableTotalEmi = useMemo(() => {
    return bpIncome * (bpLimitPct / 100);
  }, [bpIncome, bpLimitPct]);

  const debtCapacityUsedRatio = useMemo(() => {
    if (allowableTotalEmi <= 0) return 1;
    return Math.min(bpExistingEmi / allowableTotalEmi, 1);
  }, [bpExistingEmi, allowableTotalEmi]);

  // ================= 3. PREPAYMENT STATE =================
  const [ppAmount, setPpAmount] = useState(1000000);
  const [ppRate, setPpRate] = useState(9.5);
  const [ppTenure, setPpTenure] = useState(120);
  const [ppPrepayAmount, setPpPrepayAmount] = useState(150000);
  const [ppAfterMonth, setPpAfterMonth] = useState(12);

  const ppSavings = useMemo(() => {
    return prepaymentSavings(ppAmount, ppRate, ppTenure, ppPrepayAmount, ppAfterMonth);
  }, [ppAmount, ppRate, ppTenure, ppPrepayAmount, ppAfterMonth]);

  const ppOriginal = useMemo(() => {
    return emiSummary(ppAmount, ppRate, ppTenure);
  }, [ppAmount, ppRate, ppTenure]);

  const ppNewInterest = Math.max(ppOriginal.totalInterest - ppSavings.interestSaved, 0);

  // ================= 4. EMI BURDEN STATE =================
  const [ebIncome, setEbIncome] = useState(80000);
  const [ebExistingEmi, setEbExistingEmi] = useState(15000);
  const [ebNewEmi, setEbNewEmi] = useState(20000);

  const ebFoir = useMemo(() => {
    return foir(ebIncome, ebExistingEmi, ebNewEmi);
  }, [ebIncome, ebExistingEmi, ebNewEmi]);

  const ebZoneWords = useMemo(() => {
    if (ebFoir <= 0.4) {
      return "Low burden — prime approval likelihood. Lenders consider your debt levels very safe.";
    }
    if (ebFoir <= 0.5) {
      return "Moderate burden — standard approval range. Fits standard credit parameters of most banks.";
    }
    if (ebFoir <= 0.6) {
      return "High burden — review or guarantor likely required. Lenders will closely inspect living expenses.";
    }
    return "Critical burden — likely to be declined or loan trimmed. Monthly payments exceed safe debt ratios.";
  }, [ebFoir]);

  // ================= 5. COMPARE LOANS STATE =================
  const [cAmountA, setCAmountA] = useState(500000);
  const [cRateA, setCRateA] = useState(11.5);
  const [cTenureA, setCTenureA] = useState(36);
  const [cFeePctA, setCFeePctA] = useState(1.0);

  const [cAmountB, setCAmountB] = useState(500000);
  const [cRateB, setCRateB] = useState(10.5);
  const [cTenureB, setCTenureB] = useState(36);
  const [cFeePctB, setCFeePctB] = useState(1.5);

  const compA = useMemo(() => {
    const s = emiSummary(cAmountA, cRateA, cTenureA);
    const fee = cAmountA * (cFeePctA / 100);
    const totalCost = cAmountA + s.totalInterest + fee;
    return { emi: s.emi, totalInterest: s.totalInterest, fee, totalCost };
  }, [cAmountA, cRateA, cTenureA, cFeePctA]);

  const compB = useMemo(() => {
    const s = emiSummary(cAmountB, cRateB, cTenureB);
    const fee = cAmountB * (cFeePctB / 100);
    const totalCost = cAmountB + s.totalInterest + fee;
    return { emi: s.emi, totalInterest: s.totalInterest, fee, totalCost };
  }, [cAmountB, cRateB, cTenureB, cFeePctB]);

  const diffCost = Math.abs(compA.totalCost - compB.totalCost);
  const isACheaper = compA.totalCost <= compB.totalCost;

  return (
    <div className="space-y-6">
      {/* ================= SUB-TABS UNDERLINED ROW ================= */}
      <div className="border-b border-cardborder overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-6 sm:gap-8 min-w-max">
          {TOOLS.map((t) => {
            const isActive = activeTool === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => switchTool(t.key)}
                className={`py-3 text-sm transition-colors border-b-2 font-archivo ${
                  isActive
                    ? "border-[#1E4FD8] text-[#1E4FD8] font-bold"
                    : "border-transparent text-muted hover:text-ink font-semibold"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 1. EMI CALCULATOR ================= */}
      {activeTool === "emi" && (
        <div className="space-y-6">
          {/* Loan Type Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {LOAN_TYPES.map((lt) => {
              const isSelected = loanType === lt.id;
              return (
                <button
                  key={lt.id}
                  type="button"
                  onClick={() => handleSelectLoanType(lt.id)}
                  className={`h-20 rounded-card p-3 flex flex-col justify-between text-left transition-all ${
                    isSelected
                      ? "border-2 border-[#1E4FD8] bg-[#EEF3FF] text-[#1E4FD8] font-bold shadow-xs"
                      : "border border-cardborder bg-white text-ink hover:border-muted font-semibold"
                  }`}
                >
                  <Icon
                    name={lt.icon}
                    size={20}
                    color={isSelected ? "#1E4FD8" : "#0A0A0A"}
                    strokeWidth={isSelected ? 2.2 : 1.8}
                  />
                  <div className="leading-tight">
                    <span className="font-archivo text-sm">{lt.label}</span>
                    <span className="block text-[11px] text-muted font-normal">
                      {lt.defaultRate}% typical
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Inputs Column */}
            <div className="lg:col-span-6 rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-5 shadow-xs">
              <h3 className="font-archivo font-bold text-base text-ink">Loan Parameters</h3>

              {/* Amount */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="emi_amount_input" className="text-xs font-bold text-ink">
                    Loan Amount
                  </label>
                  <span className="text-xs font-bold text-brand bg-[#EEF3FF] px-2 py-0.5 rounded">
                    {inr(emiAmount)} ({inWords(emiAmount)})
                  </span>
                </div>
                <input
                  id="emi_amount_input"
                  type="number"
                  min={activeLoanConfig.minAmount}
                  max={activeLoanConfig.maxAmount}
                  step={10000}
                  value={emiAmount}
                  onChange={(e) => setEmiAmount(Math.max(0, Number(e.target.value)))}
                  className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                />
                <input
                  type="range"
                  min={activeLoanConfig.minAmount}
                  max={activeLoanConfig.maxAmount}
                  step={5000}
                  value={emiAmount}
                  onChange={(e) => setEmiAmount(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-2 bg-page rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-muted font-medium">
                  <span>Min: {inr(activeLoanConfig.minAmount)}</span>
                  <span>Max: {inr(activeLoanConfig.maxAmount)}</span>
                </div>
              </div>

              {/* Tenure */}
              <div className="space-y-2 pt-2 border-t border-cardborder">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="emi_tenure_input" className="text-xs font-bold text-ink">
                    Tenure
                  </label>
                  <span className="text-xs font-bold text-ink">
                    {activeLoanConfig.isHome
                      ? `${(emiMonths / 12).toFixed(1)} Years (${emiMonths} Months)`
                      : `${emiMonths} Months`}
                  </span>
                </div>
                <input
                  id="emi_tenure_input"
                  type="number"
                  min={activeLoanConfig.isHome ? 12 : 6}
                  max={activeLoanConfig.isHome ? 360 : 84}
                  step={activeLoanConfig.isHome ? 12 : 6}
                  value={activeLoanConfig.isHome ? Math.round(emiMonths / 12) : emiMonths}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setEmiMonths(activeLoanConfig.isHome ? v * 12 : v);
                  }}
                  className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                />
                <input
                  type="range"
                  min={activeLoanConfig.isHome ? 12 : 6}
                  max={activeLoanConfig.isHome ? 360 : 84}
                  step={activeLoanConfig.isHome ? 12 : 6}
                  value={emiMonths}
                  onChange={(e) => setEmiMonths(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-2 bg-page rounded-lg"
                />
                <div className="flex justify-between text-[11px] text-muted font-medium">
                  <span>{activeLoanConfig.isHome ? "1 Year" : "6 Months"}</span>
                  <span>{activeLoanConfig.isHome ? "30 Years" : "7 Years"}</span>
                </div>
              </div>

              {/* Interest Rate */}
              <div className="space-y-2 pt-2 border-t border-cardborder">
                <div className="flex justify-between items-baseline">
                  <label htmlFor="emi_rate_input" className="text-xs font-bold text-ink">
                    Interest Rate (% a year)
                  </label>
                  <span className="text-xs font-bold text-brand">{emiRate}% p.a.</span>
                </div>
                <input
                  id="emi_rate_input"
                  type="number"
                  min={1}
                  max={36}
                  step={0.1}
                  value={emiRate}
                  onChange={(e) => setEmiRate(Number(e.target.value))}
                  className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                />
                <input
                  type="range"
                  min={5}
                  max={24}
                  step={0.25}
                  value={emiRate}
                  onChange={(e) => setEmiRate(Number(e.target.value))}
                  className="w-full accent-brand cursor-pointer h-2 bg-page rounded-lg"
                />
              </div>
            </div>

            {/* Black Result Card Column */}
            <div className="lg:col-span-6 rounded-card bg-[#0A0A0A] text-white p-6 sm:p-8 space-y-6 shadow-xl border border-[#27272A]">
              <div>
                <p className="text-xs uppercase font-extrabold tracking-wider text-[#A1A1AA]">
                  Your EMI
                </p>
                <div className="font-archivo font-extrabold text-[36px] sm:text-[40px] text-white leading-tight mt-0.5">
                  {inr(emiRes.emi)}
                  <span className="text-sm font-normal text-[#A1A1AA]"> /month</span>
                </div>
              </div>

              {/* Donut Chart with Hover and Legend */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-5 p-4 rounded-card bg-[#18181B] border border-[#27272A]">
                <div className="shrink-0 flex items-center justify-center">
                  <Donut
                    segments={donutSegments}
                    size={140}
                    thickness={18}
                    centerTop="Total"
                    centerBottom={inWords(emiRes.totalPaid)}
                    dark={true}
                    onHover={(s) => setDonutHovered(s)}
                  />
                </div>

                <div className="flex-1 w-full space-y-3 text-xs">
                  {donutHovered && (
                    <div className="text-[11px] font-bold text-[#FBBF24] bg-[#FBBF24]/10 px-2 py-1 rounded">
                      Hovered: {donutHovered.label} — {inr(donutHovered.value)}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#3B6BF0]" />
                      <span className="text-white/80">Principal</span>
                    </span>
                    <strong className="text-white font-archivo">
                      {inr(emiAmount)} ({((emiAmount / emiRes.totalPaid) * 100).toFixed(0)}%)
                    </strong>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full bg-[#E0A33A]" />
                      <span className="text-white/80">Total Interest</span>
                    </span>
                    <strong className="text-white font-archivo">
                      {inr(emiRes.totalInterest)} (
                      {((emiRes.totalInterest / emiRes.totalPaid) * 100).toFixed(0)}%)
                    </strong>
                  </div>

                  <div className="border-t border-[#27272A] pt-2 flex items-center justify-between text-white/60">
                    <span>Total Amount Payable</span>
                    <strong className="text-white font-archivo">{inr(emiRes.totalPaid)}</strong>
                  </div>
                </div>
              </div>

              {/* Stacked Vertical Bars: "What you pay each year" */}
              <div className="space-y-3 pt-2 border-t border-[#27272A]">
                <div className="flex justify-between items-baseline">
                  <p className="text-xs font-bold text-white uppercase tracking-wider">
                    What you pay each year
                  </p>
                  <span className="text-[11px] text-[#A1A1AA]">
                    {yearlyData.length} {yearlyData.length === 1 ? "year" : "years"}
                  </span>
                </div>

                {/* Stacked Bars Container */}
                <div className="flex items-end gap-1.5 sm:gap-2 h-36 pt-4 pb-2 border-b border-[#27272A] overflow-x-auto [scrollbar-width:none]">
                  {yearlyData.map((y) => {
                    const totalY = y.principal + y.interest;
                    const heightPct = (totalY / maxYearTotal) * 100;
                    const principalPct = (y.principal / totalY) * 100;
                    const interestPct = (y.interest / totalY) * 100;

                    return (
                      <div
                        key={y.year}
                        onMouseEnter={() => setHoveredYear(y)}
                        onMouseLeave={() => setHoveredYear(null)}
                        className="flex-1 min-w-[28px] max-w-[48px] h-full flex flex-col justify-end items-center cursor-pointer group"
                      >
                        <div
                          className="w-full rounded-t-sm flex flex-col justify-end overflow-hidden transition-all group-hover:brightness-110"
                          style={{ height: `${Math.max(heightPct, 15)}%` }}
                        >
                          {/* Interest amber top */}
                          <div
                            style={{ height: `${interestPct}%` }}
                            className="w-full bg-[#E0A33A]"
                            title={`Year ${y.year} Interest: ${inr(y.interest)}`}
                          />
                          {/* Principal blue bottom */}
                          <div
                            style={{ height: `${principalPct}%` }}
                            className="w-full bg-[#3B6BF0]"
                            title={`Year ${y.year} Principal: ${inr(y.principal)}`}
                          />
                        </div>
                        <span className="text-[10px] text-[#A1A1AA] mt-1 group-hover:text-white">
                          Y{y.year}
                        </span>
                        <span className="text-[9px] text-[#E0A33A] font-bold">
                          {inr(y.interest).replace("₹", "")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {hoveredYear && (
                  <div className="p-2 rounded bg-[#18181B] text-[11px] text-[#E4E4E7] flex justify-between items-center">
                    <span>
                      <strong>Year {hoveredYear.year}:</strong> Principal {inr(hoveredYear.principal)}
                    </span>
                    <span>Interest: {inr(hoveredYear.interest)}</span>
                  </div>
                )}

                <p className="text-[11px] text-[#A1A1AA] italic">
                  Interest is front-loaded: a prepayment in year 1 saves the most.
                </p>
              </div>

              {/* Fee and APR */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#27272A] text-xs">
                <div className="p-3 rounded-card bg-[#18181B] border border-[#27272A]">
                  <p className="text-[#A1A1AA]">Processing fee (1%)</p>
                  <p className="font-archivo font-bold text-sm text-white mt-0.5">
                    {inr(processingFee)}
                  </p>
                </div>
                <div className="p-3 rounded-card bg-[#18181B] border border-[#27272A]">
                  <p className="text-[#A1A1AA]">Real cost (APR with fee)</p>
                  <p className="font-archivo font-bold text-sm text-[#34D399] mt-0.5">
                    {realApr}% p.a.
                  </p>
                </div>
              </div>

              {/* Blue CTA button */}
              {onStartCheckWith && (
                <button
                  type="button"
                  onClick={() =>
                    onStartCheckWith({
                      product: loanType,
                      amount: emiAmount,
                      tenureMonths: emiMonths,
                      rate: emiRate,
                    })
                  }
                  className="w-full h-11 rounded-btn bg-[#1E4FD8] hover:bg-[#1A44BD] text-white font-archivo font-bold text-xs inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <span>Check if I&apos;m eligible for this loan</span>
                  <Icon name="arrow" size={15} color="#FFFFFF" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= 2. BORROW POWER ================= */}
      {activeTool === "power" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-5 shadow-xs">
            <h3 className="font-archivo font-bold text-base text-ink">Income & Obligations</h3>

            {/* Monthly Income */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label htmlFor="bp_income_input" className="text-xs font-bold text-ink">
                  Monthly In-Hand Income
                </label>
                <span className="text-xs font-bold text-brand">
                  {inr(bpIncome)} ({inWords(bpIncome)})
                </span>
              </div>
              <input
                id="bp_income_input"
                type="number"
                value={bpIncome}
                onChange={(e) => setBpIncome(Math.max(0, Number(e.target.value)))}
                className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
              />
              <input
                type="range"
                min={20000}
                max={500000}
                step={5000}
                value={bpIncome}
                onChange={(e) => setBpIncome(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer h-2 bg-page rounded-lg"
              />
            </div>

            {/* Existing EMIs */}
            <div className="space-y-1.5 pt-2 border-t border-cardborder">
              <div className="flex justify-between items-baseline">
                <label htmlFor="bp_existing_emi_input" className="text-xs font-bold text-ink">
                  Existing Monthly EMIs
                </label>
                <span className="text-xs font-bold text-ink">{inr(bpExistingEmi)}</span>
              </div>
              <input
                id="bp_existing_emi_input"
                type="number"
                value={bpExistingEmi}
                onChange={(e) => setBpExistingEmi(Math.max(0, Number(e.target.value)))}
                className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
              />
            </div>

            {/* Rate & Tenure */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cardborder">
              <div>
                <label htmlFor="bp_rate_input" className="block text-xs font-bold text-ink mb-1.5">
                  Expected Rate (% p.a.)
                </label>
                <input
                  id="bp_rate_input"
                  type="number"
                  step="0.25"
                  value={bpRate}
                  onChange={(e) => setBpRate(Number(e.target.value))}
                  className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                />
              </div>

              <div>
                <label htmlFor="bp_tenure_input" className="block text-xs font-bold text-ink mb-1.5">
                  Tenure (Months)
                </label>
                <input
                  id="bp_tenure_input"
                  type="number"
                  step="12"
                  value={bpTenure}
                  onChange={(e) => setBpTenure(Number(e.target.value))}
                  className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                />
              </div>
            </div>

            {/* Lender Limit Chips */}
            <div className="pt-2 border-t border-cardborder space-y-2">
              <label className="block text-xs font-bold text-ink">
                Lender FOIR Limit Cap
              </label>
              <div className="flex gap-2">
                {[40, 50, 60].map((lim) => (
                  <button
                    key={lim}
                    type="button"
                    onClick={() => setBpLimitPct(lim)}
                    className={`flex-1 h-11 rounded-btn text-xs font-bold transition-colors ${
                      bpLimitPct === lim
                        ? "bg-ink text-white"
                        : "bg-page border border-cardborder text-muted hover:text-ink"
                    }`}
                  >
                    {lim}% Limit
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted">
                Most prime lenders prefer staying within 50% total income burden.
              </p>
            </div>
          </div>

          {/* Borrow Power Results Card */}
          <div className="lg:col-span-6 rounded-card bg-[#0A0A0A] text-white p-6 sm:p-8 space-y-6 shadow-xl border border-[#27272A]">
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-[#A1A1AA]">
                Maximum Borrowing Power
              </p>
              <div className="font-archivo font-extrabold text-[34px] sm:text-[38px] text-white leading-tight mt-0.5">
                {inr(borrowPowerRes.maxLoan)}
              </div>
              <p className="text-xs text-[#34D399] font-bold mt-1">
                Affordable EMI: {inr(borrowPowerRes.affordableEmi)} /month
              </p>
            </div>

            {/* Meter of capacity used */}
            <div className="p-4 rounded-card bg-[#18181B] border border-[#27272A] flex flex-col items-center text-center space-y-2">
              <Meter
                width={180}
                value={debtCapacityUsedRatio}
                track="#3F3F46"
                color={debtCapacityUsedRatio > 0.8 ? "#EF4444" : "#3B82F6"}
                showKnob={true}
                big={`${Math.round(debtCapacityUsedRatio * 100)}%`}
                label="Of Debt Capacity Used"
              />
              <p className="text-xs text-[#A1A1AA] pt-1">
                Existing EMIs take {inr(bpExistingEmi)} out of {inr(allowableTotalEmi)} total limit.
              </p>
            </div>

            {/* Explanation Sentence */}
            <div className="p-4 rounded-card bg-[#18181B] border border-[#27272A] text-xs text-white/90 leading-relaxed">
              At a {bpLimitPct}% limit with {inr(bpIncome)} monthly income, your maximum allowable
              total EMI is {inr(allowableTotalEmi)}, leaving {inr(borrowPowerRes.affordableEmi)} for
              a new loan.
            </div>
          </div>
        </div>
      )}

      {/* ================= 3. PREPAYMENT ================= */}
      {activeTool === "prepayment" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-5 shadow-xs">
            <h3 className="font-archivo font-bold text-base text-ink">Prepayment Details</h3>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label htmlFor="pp_amount_input" className="text-xs font-bold text-ink">
                  Total Loan Amount
                </label>
                <span className="text-xs font-bold text-ink">{inr(ppAmount)}</span>
              </div>
              <input
                id="pp_amount_input"
                type="number"
                value={ppAmount}
                onChange={(e) => setPpAmount(Number(e.target.value))}
                className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-cardborder">
              <div>
                <label htmlFor="pp_rate_input" className="block text-xs font-bold text-ink mb-1">
                  Rate (% p.a.)
                </label>
                <input
                  id="pp_rate_input"
                  type="number"
                  step="0.25"
                  value={ppRate}
                  onChange={(e) => setPpRate(Number(e.target.value))}
                  className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                />
              </div>

              <div>
                <label htmlFor="pp_tenure_input" className="block text-xs font-bold text-ink mb-1">
                  Tenure (Months)
                </label>
                <input
                  id="pp_tenure_input"
                  type="number"
                  value={ppTenure}
                  onChange={(e) => setPpTenure(Number(e.target.value))}
                  className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-cardborder">
              <div className="flex justify-between items-baseline">
                <label htmlFor="pp_prepay_input" className="text-xs font-bold text-ink">
                  Lump-Sum Prepayment Amount
                </label>
                <span className="text-xs font-bold text-brand">{inr(ppPrepayAmount)}</span>
              </div>
              <input
                id="pp_prepay_input"
                type="number"
                value={ppPrepayAmount}
                onChange={(e) => setPpPrepayAmount(Number(e.target.value))}
                className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-cardborder">
              <div className="flex justify-between items-baseline">
                <label htmlFor="pp_month_slider" className="text-xs font-bold text-ink">
                  Prepay after month N
                </label>
                <span className="text-xs font-bold text-ink">Month {ppAfterMonth}</span>
              </div>
              <input
                id="pp_month_slider"
                type="range"
                min={1}
                max={Math.max(ppTenure - 1, 2)}
                value={ppAfterMonth}
                onChange={(e) => setPpAfterMonth(Number(e.target.value))}
                className="w-full accent-brand cursor-pointer h-2 bg-page rounded-lg"
              />
              <div className="flex justify-between text-[11px] text-muted">
                <span>Month 1</span>
                <span>Month {ppTenure - 1}</span>
              </div>
            </div>
          </div>

          {/* Prepayment Results Card */}
          <div className="lg:col-span-6 rounded-card bg-[#0A0A0A] text-white p-6 sm:p-8 space-y-6 shadow-xl border border-[#27272A]">
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-[#A1A1AA]">
                Interest Saved
              </p>
              <div className="font-archivo font-extrabold text-[32px] sm:text-[36px] text-[#34D399] leading-tight mt-0.5">
                {inr(ppSavings.interestSaved)}
              </div>
              <p className="text-xs text-white/80 font-semibold mt-1">
                Tenure reduced by {ppSavings.monthsSaved} months (finishes in {ppSavings.newMonths}{" "}
                months instead of {ppTenure})
              </p>
            </div>

            {/* Two Bars: Original Total Interest vs New */}
            <div className="p-4 rounded-card bg-[#18181B] border border-[#27272A] space-y-4 text-xs">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#A1A1AA]">
                Total Interest Comparison
              </p>

              {/* Original Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-white/90">
                  <span>Without prepayment</span>
                  <strong>{inr(ppOriginal.totalInterest)}</strong>
                </div>
                <div className="w-full h-4 bg-[#27272A] rounded-full overflow-hidden">
                  <div className="h-full bg-[#E0A33A] rounded-full w-full" />
                </div>
              </div>

              {/* New Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[#34D399]">
                  <span>With ₹{inr(ppPrepayAmount).replace("₹", "")} prepayment</span>
                  <strong>{inr(ppNewInterest)}</strong>
                </div>
                <div className="w-full h-4 bg-[#27272A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#34D399] rounded-full"
                    style={{
                      width: `${Math.max(
                        (ppNewInterest / Math.max(ppOriginal.totalInterest, 1)) * 100,
                        5
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. EMI BURDEN ================= */}
      {activeTool === "burden" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-5 shadow-xs">
            <h3 className="font-archivo font-bold text-base text-ink">Income & Payments</h3>

            <div className="space-y-1.5">
              <div className="flex justify-between items-baseline">
                <label htmlFor="eb_income_input" className="text-xs font-bold text-ink">
                  Monthly Income
                </label>
                <span className="text-xs font-bold text-brand">{inr(ebIncome)}</span>
              </div>
              <input
                id="eb_income_input"
                type="number"
                value={ebIncome}
                onChange={(e) => setEbIncome(Math.max(1, Number(e.target.value)))}
                className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-cardborder">
              <div className="flex justify-between items-baseline">
                <label htmlFor="eb_exist_input" className="text-xs font-bold text-ink">
                  Existing Monthly EMIs
                </label>
                <span className="text-xs font-bold text-ink">{inr(ebExistingEmi)}</span>
              </div>
              <input
                id="eb_exist_input"
                type="number"
                value={ebExistingEmi}
                onChange={(e) => setEbExistingEmi(Math.max(0, Number(e.target.value)))}
                className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
              />
            </div>

            <div className="space-y-1.5 pt-2 border-t border-cardborder">
              <div className="flex justify-between items-baseline">
                <label htmlFor="eb_new_input" className="text-xs font-bold text-ink">
                  Proposed New EMI
                </label>
                <span className="text-xs font-bold text-brand">{inr(ebNewEmi)}</span>
              </div>
              <input
                id="eb_new_input"
                type="number"
                value={ebNewEmi}
                onChange={(e) => setEbNewEmi(Math.max(0, Number(e.target.value)))}
                className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
              />
            </div>
          </div>

          {/* EMI Burden Results Card */}
          <div className="lg:col-span-6 rounded-card bg-[#0A0A0A] text-white p-6 sm:p-8 space-y-6 shadow-xl border border-[#27272A]">
            <div>
              <p className="text-xs uppercase font-extrabold tracking-wider text-[#A1A1AA]">
                Total EMI Burden (FOIR)
              </p>
              <div className="font-archivo font-extrabold text-[36px] sm:text-[40px] text-white leading-tight mt-0.5">
                {(ebFoir * 100).toFixed(1)}%
              </div>
            </div>

            <div className="space-y-2">
              <ZoneBar zones={FOIR_ZONES} value={ebFoir} width="100%" height={12} />
              <div className="flex justify-between text-[11px] text-[#A1A1AA]">
                <span>0% (Safe)</span>
                <span>50% (Comfort Cap)</span>
                <span>60%+ (High)</span>
              </div>
            </div>

            <div className="p-4 rounded-card bg-[#18181B] border border-[#27272A] text-xs text-white/90 leading-relaxed font-medium">
              {ebZoneWords}
            </div>
          </div>
        </div>
      )}

      {/* ================= 5. COMPARE LOANS ================= */}
      {activeTool === "compare" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Loan A */}
            <div
              className={`rounded-card border p-5 sm:p-6 space-y-4 transition-all ${
                isACheaper
                  ? "border-[#047857] bg-white ring-2 ring-[#047857]/20"
                  : "border-cardborder bg-white"
              }`}
            >
              <div className="flex items-center justify-between border-b border-cardborder pb-3">
                <h3 className="font-archivo font-bold text-base text-ink">Loan Offer A</h3>
                {isACheaper && (
                  <span className="text-xs font-bold text-[#047857] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full">
                    Saves {inr(diffCost)}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="cmp_amt_a" className="block text-xs font-bold text-ink mb-1">
                    Amount
                  </label>
                  <input
                    id="cmp_amt_a"
                    type="number"
                    value={cAmountA}
                    onChange={(e) => setCAmountA(Number(e.target.value))}
                    className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cmp_rate_a" className="block text-xs font-bold text-ink mb-1">
                      Rate (% p.a.)
                    </label>
                    <input
                      id="cmp_rate_a"
                      type="number"
                      step="0.1"
                      value={cRateA}
                      onChange={(e) => setCRateA(Number(e.target.value))}
                      className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                    />
                  </div>

                  <div>
                    <label htmlFor="cmp_tenure_a" className="block text-xs font-bold text-ink mb-1">
                      Tenure (Mo)
                    </label>
                    <input
                      id="cmp_tenure_a"
                      type="number"
                      value={cTenureA}
                      onChange={(e) => setCTenureA(Number(e.target.value))}
                      className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="cmp_fee_a" className="block text-xs font-bold text-ink mb-1">
                    Processing fee (%)
                  </label>
                  <input
                    id="cmp_fee_a"
                    type="number"
                    step="0.1"
                    value={cFeePctA}
                    onChange={(e) => setCFeePctA(Number(e.target.value))}
                    className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-cardborder space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Monthly EMI:</span>
                  <strong className="font-archivo text-ink">{inr(compA.emi)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total Interest:</span>
                  <strong className="font-archivo text-ink">{inr(compA.totalInterest)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Processing Fee:</span>
                  <strong className="font-archivo text-ink">{inr(compA.fee)}</strong>
                </div>
                <div className="flex justify-between pt-2 border-t border-cardborder font-bold text-sm">
                  <span>Total Cost:</span>
                  <span className={isACheaper ? "text-[#047857]" : "text-ink"}>
                    {inr(compA.totalCost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Loan B */}
            <div
              className={`rounded-card border p-5 sm:p-6 space-y-4 transition-all ${
                !isACheaper
                  ? "border-[#047857] bg-white ring-2 ring-[#047857]/20"
                  : "border-cardborder bg-white"
              }`}
            >
              <div className="flex items-center justify-between border-b border-cardborder pb-3">
                <h3 className="font-archivo font-bold text-base text-ink">Loan Offer B</h3>
                {!isACheaper && (
                  <span className="text-xs font-bold text-[#047857] bg-[#ECFDF5] px-2.5 py-0.5 rounded-full">
                    Saves {inr(diffCost)}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label htmlFor="cmp_amt_b" className="block text-xs font-bold text-ink mb-1">
                    Amount
                  </label>
                  <input
                    id="cmp_amt_b"
                    type="number"
                    value={cAmountB}
                    onChange={(e) => setCAmountB(Number(e.target.value))}
                    className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="cmp_rate_b" className="block text-xs font-bold text-ink mb-1">
                      Rate (% p.a.)
                    </label>
                    <input
                      id="cmp_rate_b"
                      type="number"
                      step="0.1"
                      value={cRateB}
                      onChange={(e) => setCRateB(Number(e.target.value))}
                      className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                    />
                  </div>

                  <div>
                    <label htmlFor="cmp_tenure_b" className="block text-xs font-bold text-ink mb-1">
                      Tenure (Mo)
                    </label>
                    <input
                      id="cmp_tenure_b"
                      type="number"
                      value={cTenureB}
                      onChange={(e) => setCTenureB(Number(e.target.value))}
                      className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="cmp_fee_b" className="block text-xs font-bold text-ink mb-1">
                    Processing fee (%)
                  </label>
                  <input
                    id="cmp_fee_b"
                    type="number"
                    step="0.1"
                    value={cFeePctB}
                    onChange={(e) => setCFeePctB(Number(e.target.value))}
                    className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink font-semibold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-cardborder space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted">Monthly EMI:</span>
                  <strong className="font-archivo text-ink">{inr(compB.emi)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total Interest:</span>
                  <strong className="font-archivo text-ink">{inr(compB.totalInterest)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Processing Fee:</span>
                  <strong className="font-archivo text-ink">{inr(compB.fee)}</strong>
                </div>
                <div className="flex justify-between pt-2 border-t border-cardborder font-bold text-sm">
                  <span>Total Cost:</span>
                  <span className={!isACheaper ? "text-[#047857]" : "text-ink"}>
                    {inr(compB.totalCost)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
