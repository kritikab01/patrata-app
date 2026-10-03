import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { ScoreResult, ExplainResult, AskResult, Product } from "../types";
import { postExplain, postAsk } from "../api";
import { formatMonths, formatNotice } from "../utils";
import { Spinner, ErrorBox, LoadingSkeleton, CardErrorBoundary } from "./ui";
import { SlipModal } from "./DecisionSlip";
import { Icon, IconTile, Meter, ZoneBar, FOIR_ZONES } from "./viz";
import { inr } from "../lib/calc";

function renderTextWithCitations(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\[\d+\]|【\d+】|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (
      (token.startsWith("[") && token.endsWith("]")) ||
      (token.startsWith("【") && token.endsWith("】"))
    ) {
      const num = token.replace(/[[\]【】]/g, "");
      parts.push(
        <sup
          key={match.index}
          className="inline-flex items-center justify-center font-bold text-[10px] text-brand bg-[#EEF3FF] border border-brand/30 rounded px-1 ml-0.5"
        >
          [{num}]
        </sup>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-bold text-ink">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      parts.push(
        <code
          key={match.index}
          className="rounded bg-page border border-cardborder px-1 py-0.5 text-xs font-mono text-ink"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      parts.push(
        <em key={match.index} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

function getResultSummaryText(result: ScoreResult): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const resultLink = `${origin}/?id=${encodeURIComponent(result.id)}`;

  const lines = [
    `Patrata Loan Pre-Screening: ${result.decision}`,
    `Product: ${result.product_name} (${result.variant_name})`,
  ];

  if (result.emi_estimate != null) {
    lines.push(`Estimated EMI: ${inr(result.emi_estimate)}/month`);
  }
  if (result.foir != null) {
    lines.push(`EMI Burden (FOIR): ${(result.foir * 100).toFixed(1)}%`);
  }
  if (result.approval_probability != null) {
    lines.push(`Approval Probability: ${(result.approval_probability * 100).toFixed(1)}%`);
  }
  if (result.repayment_risk?.probability != null) {
    lines.push(`Default Risk: ${(result.repayment_risk.probability * 100).toFixed(1)}%`);
  }

  if (result.reasons && result.reasons.length > 0) {
    lines.push(``, `Reasons:`);
    result.reasons.slice(0, 4).forEach((r, i) => {
      lines.push(`${i + 1}. ${r}`);
    });
  }

  lines.push(``, `Result link: ${resultLink}`);

  let text = lines.join("\n");
  if (text.length > 1400) {
    text = text.substring(0, 1390) + "\n...";
  }
  return text;
}

export function ResultPanel({
  result,
  products = [],
  onCheckWith,
  onBack,
  reviewPanel,
}: {
  result: ScoreResult;
  products?: Product[];
  onCheckWith: (amount: number, termMonths: number) => void;
  onBack?: () => void;
  reviewPanel?: React.ReactNode;
}) {
  const [slipOpen, setSlipOpen] = useState(false);
  const [autoDownloadPdf, setAutoDownloadPdf] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllChecks, setShowAllChecks] = useState(false);

  const askRef = useRef<HTMLDivElement>(null);

  // Formatted date and short ID
  const dateFormatted = useMemo(() => {
    const raw = result.created_at || (result as { timestamp?: string }).timestamp;
    const d = raw ? new Date(raw) : new Date();
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [result]);

  const shortId = useMemo(() => {
    return (result.id || "APP").substring(0, 8).toUpperCase();
  }, [result.id]);

  // Documents required for variant from /api/products
  const documentsList = useMemo(() => {
    const resVariantId = (result as { variant_id?: string }).variant_id;
    let variantObj = products
      .flatMap((p) => p.variants || [])
      .find(
        (v) =>
          v.id === result.variant ||
          v.id === resVariantId ||
          v.name === result.variant_name
      );

    if (!variantObj) {
      const prod = products.find(
        (p) =>
          p.id === result.product ||
          p.id === (result as { product_id?: string }).product_id ||
          p.name === result.product_name
      );
      variantObj =
        prod?.variants?.find(
          (v) =>
            v.id === result.variant ||
            v.id === resVariantId ||
            v.name === result.variant_name
        ) || prod?.variants?.[0];
    }

    const docs =
      (variantObj as { documents?: string[] })?.documents ||
      ((variantObj?.criteria as Record<string, unknown> | undefined)?.documents as string[] | undefined);

    if (Array.isArray(docs) && docs.length > 0) {
      return docs.map(String);
    }
    return [];
  }, [products, result]);

  // Copy summary handler
  const summaryText = useMemo(() => getResultSummaryText(result), [result]);

  async function handleCopy() {
    let success = false;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(summaryText);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success && typeof document !== "undefined") {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = summaryText;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        success = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch {
        success = false;
      }
    }
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Email href
  const subject = `Patrata Loan Decision: ${result.product_name} - ${result.decision}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summaryText)}`;

  // Google Calendar follow-up href
  const calendarTitle = `Patrata follow-up: ${result.product_name}`;
  const calendarDetails = `Decision summary: ${result.decision} for ${result.product_name} (${result.variant_name}). Estimated EMI: ${result.emi_estimate != null ? inr(result.emi_estimate) : "—"}. Application ID: ${result.id}`;
  const calendarHref = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calendarTitle)}&details=${encodeURIComponent(calendarDetails)}`;

  // Policy checks ordering: non-pass first, then up to 3 passes (or all if expanded)
  const ruleChecks = result.rule_checks || [];
  const passedChecksCount = ruleChecks.filter((c) => c.status === "pass").length;
  const nonPassChecks = ruleChecks.filter((c) => c.status !== "pass");
  const passChecks = ruleChecks.filter((c) => c.status === "pass");

  const visibleRuleChecks = useMemo(() => {
    if (showAllChecks) return [...nonPassChecks, ...passChecks];
    return [...nonPassChecks, ...passChecks.slice(0, 3)];
  }, [nonPassChecks, passChecks, showAllChecks]);

  // Helped vs Worked Against items - deduplicated by label
  const helpedItems: { label: string; value: string }[] = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const seen = new Set<string>();
    const add = (label: string, value: string) => {
      const key = (label || "").trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({ label, value });
      }
    };
    result.repayment_risk?.drivers?.forEach((d) => {
      if (d.direction === "lowers_risk") {
        add(d.label, d.value);
      }
    });
    result.drivers?.forEach((d) => {
      if (d.direction === "towards_approve") {
        add(d.label, d.value);
      }
    });
    return list;
  }, [result]);

  const workedAgainstItems: { label: string; value: string }[] = useMemo(() => {
    const list: { label: string; value: string }[] = [];
    const seen = new Set<string>();
    const add = (label: string, value: string) => {
      const key = (label || "").trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        list.push({ label, value });
      }
    };
    result.repayment_risk?.drivers?.forEach((d) => {
      if (d.direction === "raises_risk") {
        add(d.label, d.value);
      }
    });
    result.drivers?.forEach((d) => {
      if (d.direction === "towards_decline") {
        add(d.label, d.value);
      }
    });
    return list;
  }, [result]);

  // Default risk band indicator
  const riskBand = (result.repayment_risk?.band || "Medium").toLowerCase();

  return (
    <div className="space-y-6">
      {/* ================= 1. BLACK HEADER ================= */}
      <div className="rounded-card bg-[#0A0A0A] text-white p-6 sm:p-8 relative overflow-hidden shadow-xl border border-[#27272A]">
        {/* Top date and ID bar */}
        <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <Icon name="back" size={14} color="#FFFFFF" strokeWidth={2} />
              </button>
            )}
            <span className="text-xs text-[#A1A1AA] font-500 tracking-wide">
              {dateFormatted} · APP {shortId}
            </span>
          </div>

          <span className="text-[11px] font-bold uppercase tracking-widest text-[#71717A]">
            PRE-SCREENING RESULT
          </span>
        </div>

        {/* Hero: 56px white circle + Product & Decision in Archivo 34px */}
        <div className="flex items-start gap-4 sm:gap-5">
          <div className="h-14 w-14 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md">
            {result.decision === "APPROVE" ? (
              <Icon name="tick" size={28} color="#047857" strokeWidth={3} />
            ) : result.decision === "REFER" ? (
              <Icon name="clock" size={28} color="#D97706" strokeWidth={2.5} />
            ) : (
              <Icon name="cross" size={28} color="#DC2626" strokeWidth={3} />
            )}
          </div>

          <div className="min-w-0">
            <p className="text-xs sm:text-sm text-white/70 font-500 truncate">
              {result.product_name}, {result.variant_name}
            </p>
            <h1 className="font-archivo font-extrabold text-[32px] sm:text-[34px] leading-tight text-white mt-0.5 tracking-tight">
              {result.decision === "APPROVE"
                ? "Approved"
                : result.decision === "REFER"
                ? "Referred"
                : "Declined"}
            </h1>
          </div>
        </div>

        {/* Order Tracker: 3 dark tiles */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-3 gap-2 sm:gap-3">
          {/* Tile 1: Submitted ✓ */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-card p-3 text-center flex flex-col items-center justify-center">
            <span className="text-xs font-archivo font-bold text-white">Submitted ✓</span>
            <span className="text-[10px] text-[#A1A1AA] mt-0.5">Details entered</span>
          </div>

          {/* Tile 2: Screened ✓ */}
          <div className="bg-[#18181B] border border-[#27272A] rounded-card p-3 text-center flex flex-col items-center justify-center">
            <span className="text-xs font-archivo font-bold text-white">Screened ✓</span>
            <span className="text-[10px] text-[#A1A1AA] mt-0.5">Rules & models</span>
          </div>

          {/* Tile 3: Officer review OR Lender decides */}
          {result.decision === "REFER" ? (
            <div className="border-2 border-[#D97706] bg-[#D97706]/15 text-[#FBBF24] rounded-card p-3 text-center flex flex-col items-center justify-center font-bold">
              <span className="text-xs font-archivo">Officer review</span>
              <span className="text-[10px] text-[#FDE68A] mt-0.5">Current step</span>
            </div>
          ) : (
            <div className="bg-white text-ink border border-white rounded-card p-3 text-center flex items-center justify-center gap-1.5 font-bold shadow-xs">
              <Icon name="shield" size={15} color="#0A0A0A" strokeWidth={2} />
              <span className="text-xs font-archivo">Lender decides</span>
            </div>
          )}
        </div>
      </div>

      {/* ================= 2. ACTION ROW ================= */}
      {/* 4 equal tiles with IconTile + label */}
      <div className="rounded-card border border-cardborder bg-white p-4 sm:p-5 shadow-xs">
        <p className="text-[11px] font-bold text-muted uppercase tracking-wider mb-3">Actions</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. Slip (receipt, blue) */}
          <button
            type="button"
            onClick={() => {
              setAutoDownloadPdf(false);
              setSlipOpen(true);
            }}
            className="flex flex-col items-center justify-center p-3 rounded-card border border-cardborder bg-white hover:border-[#1E4FD8] hover:bg-page transition-all text-center group"
          >
            <IconTile name="receipt" tint="blue" size={42} />
            <span className="font-archivo font-bold text-xs text-ink mt-2 group-hover:text-[#1E4FD8]">
              Decision slip
            </span>
          </button>

          {/* 2. PDF (download, green) */}
          <button
            type="button"
            onClick={() => {
              setAutoDownloadPdf(true);
              setSlipOpen(true);
            }}
            className="flex flex-col items-center justify-center p-3 rounded-card border border-cardborder bg-white hover:border-[#047857] hover:bg-page transition-all text-center group"
          >
            <IconTile name="download" tint="green" size={42} />
            <span className="font-archivo font-bold text-xs text-ink mt-2 group-hover:text-[#047857]">
              Download PDF
            </span>
          </button>

          {/* 3. Email (mail, amber) */}
          <a
            href={emailHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-3 rounded-card border border-cardborder bg-white hover:border-[#B45309] hover:bg-page transition-all text-center group"
          >
            <IconTile name="mail" tint="amber" size={42} />
            <span className="font-archivo font-bold text-xs text-ink mt-2 group-hover:text-[#B45309]">
              Email result
            </span>
          </a>

          {/* 4. Ask AI (sparkle, rose) */}
          <button
            type="button"
            onClick={() => {
              askRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="flex flex-col items-center justify-center p-3 rounded-card border border-cardborder bg-white hover:border-[#B42318] hover:bg-page transition-all text-center group"
          >
            <IconTile name="sparkle" tint="rose" size={42} />
            <span className="font-archivo font-bold text-xs text-ink mt-2 group-hover:text-[#B42318]">
              Ask AI
            </span>
          </button>
        </div>

        {/* Auxiliary actions: Copy summary & Add follow-up to Google Calendar */}
        <div className="flex flex-wrap items-center gap-3 pt-3 mt-3 border-t border-cardborder text-xs">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 font-bold text-muted hover:text-ink px-2.5 py-1.5 rounded-btn bg-page border border-cardborder transition-colors"
          >
            {copied ? (
              <>
                <Icon name="tick" size={14} color="#047857" />
                <span className="text-[#047857]">Summary copied!</span>
              </>
            ) : (
              <>
                <Icon name="check" size={14} />
                <span>Copy summary</span>
              </>
            )}
          </button>

          <a
            href={calendarHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-bold text-muted hover:text-ink px-2.5 py-1.5 rounded-btn bg-page border border-cardborder transition-colors"
          >
            <Icon name="clock" size={14} />
            <span>Add follow-up to calendar</span>
          </a>
        </div>
      </div>

      {/* ================= 2-COLUMN LAYOUT ON LAPTOP ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Numbers, Helped/Worked Against, Policy checks, Documents */}
        <div className="lg:col-span-7 space-y-6">
          {/* ================= 3. "YOUR NUMBERS" CARD ================= */}
          <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              YOUR NUMBERS
            </h3>

            {/* Approval probability with Meter width 120 and Archivo 28px */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 pb-5 border-b border-cardborder">
              <div className="shrink-0 flex justify-center">
                <Meter
                  width={120}
                  value={result.approval_probability}
                  showKnob={true}
                  big={
                    result.approval_probability != null
                      ? `${Math.round(result.approval_probability * 100)}%`
                      : "—"
                  }
                  label=""
                />
              </div>

              <div className="text-center sm:text-left flex-1">
                <div className="font-archivo font-extrabold text-[28px] text-ink leading-tight">
                  {result.approval_probability != null
                    ? `${Math.round(result.approval_probability * 100)}%`
                    : "Not used"}
                </div>
                <p className="text-xs text-muted mt-1 leading-relaxed">
                  {result.approval_probability != null
                    ? "Approval likelihood, from 1M real past decisions"
                    : result.approval_model_note || "Approval model not used for this product"}
                </p>
              </div>
            </div>

            {/* EMI burden with ZoneBar(FOIR_ZONES) and "X% of income" */}
            <div className="pb-5 border-b border-cardborder space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-ink">EMI burden (FOIR)</span>
                <span className="font-archivo font-bold text-sm text-ink">
                  {result.foir != null ? `${(result.foir * 100).toFixed(1)}% of income` : "—"}
                </span>
              </div>
              <ZoneBar zones={FOIR_ZONES} value={result.foir} width="100%" height={10} />
              <p className="text-[11px] text-muted">
                {result.foir != null && result.foir <= 0.5
                  ? "Comfortable zone: Under 50% allows smooth repayment approval."
                  : result.foir != null && result.foir <= 0.6
                  ? "Review zone: Between 50% and 60% requires credit officer verification."
                  : "High burden zone: Over 60% increases risk of decline."}
              </p>
            </div>

            {/* Default risk as three segments (low/medium/high, band filled) */}
            <div className="pb-5 border-b border-cardborder space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-ink">Default risk</span>
                <span className="font-archivo font-bold text-sm text-ink">
                  {result.repayment_risk
                    ? `${(result.repayment_risk.probability * 100).toFixed(1)}% · ${result.repayment_risk.band}`
                    : "—"}
                </span>
              </div>

              {/* 3 Segments bar */}
              <div className="grid grid-cols-3 gap-1.5 h-3">
                <div
                  className={`rounded-l-sm transition-all ${
                    riskBand.includes("low") ? "bg-[#047857]" : "bg-page border border-cardborder"
                  }`}
                  title="Low risk band"
                />
                <div
                  className={`transition-all ${
                    riskBand.includes("medium") ? "bg-[#D97706]" : "bg-page border border-cardborder"
                  }`}
                  title="Medium risk band"
                />
                <div
                  className={`rounded-r-sm transition-all ${
                    riskBand.includes("high") ? "bg-[#DC2626]" : "bg-page border border-cardborder"
                  }`}
                  title="High risk band"
                />
              </div>

              <div className="flex justify-between text-[11px] text-muted font-bold">
                <span>Low</span>
                <span>Medium</span>
                <span>High</span>
              </div>

              {result.repayment_risk?.relative && (
                <p className="text-xs font-semibold text-muted pt-1">
                  {result.repayment_risk.relative}× the average borrower
                </p>
              )}
            </div>

            {/* New EMI ₹X /month */}
            {result.emi_estimate != null && (
              <div className="pt-1 flex items-baseline justify-between">
                <span className="text-xs font-bold text-muted">Estimated New EMI</span>
                <span className="font-archivo font-extrabold text-xl text-ink">
                  {inr(result.emi_estimate)}
                  <span className="text-xs font-500 text-muted"> /month</span>
                </span>
              </div>
            )}
          </div>

          {/* ================= 4. "WHAT WOULD HELP" (APPROVABLE OFFER) ================= */}
          {result.counterfactual?.possible && result.decision !== "APPROVE" && (
            <div className="rounded-card border-2 border-[#1E4FD8] bg-[#EEF3FF] p-5 sm:p-6 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <Icon name="sparkle" size={16} color="#1E4FD8" />
                <h4 className="font-archivo font-bold text-base text-[#1E4FD8]">
                  What would help
                </h4>
              </div>

              <p className="text-xs text-ink leading-relaxed font-500">
                {result.counterfactual.summary}
              </p>

              <div className="flex flex-wrap gap-4 text-xs pt-1">
                {result.counterfactual.loan_amount != null && (
                  <div>
                    <span className="text-muted">Adjusted amount: </span>
                    <strong className="font-archivo font-bold text-ink">
                      {inr(result.counterfactual.loan_amount)}
                    </strong>
                  </div>
                )}
                {result.counterfactual.loan_term != null && (
                  <div>
                    <span className="text-muted">Tenure: </span>
                    <strong className="font-archivo font-bold text-ink">
                      {formatMonths(Math.round(result.counterfactual.loan_term * 12))}
                    </strong>
                  </div>
                )}
              </div>

              {result.counterfactual.loan_amount != null && (
                <button
                  type="button"
                  onClick={() =>
                    onCheckWith(
                      result.counterfactual!.loan_amount!,
                      Math.round((result.counterfactual!.loan_term || 3) * 12)
                    )
                  }
                  className="mt-2 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-btn bg-[#1E4FD8] px-5 text-xs font-archivo font-bold text-white hover:bg-[#1A44BD] transition-colors shadow-sm"
                >
                  <span>Check with this amount</span>
                  <Icon name="arrow" size={14} color="#FFFFFF" />
                </button>
              )}
            </div>
          )}

          {/* ================= 5. "WHAT HELPED, WHAT DIDN'T" ================= */}
          {(helpedItems.length > 0 || workedAgainstItems.length > 0) && (
            <div>
              <h3 className="font-archivo font-bold text-base text-ink mb-3">
                What helped, what didn&apos;t
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Green "Helped" Column */}
                <div className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-card p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-[#047857] text-white flex items-center justify-center text-xs font-bold">
                      ✓
                    </div>
                    <h4 className="font-archivo font-bold text-sm text-[#047857]">Helped</h4>
                  </div>
                  {helpedItems.length > 0 ? (
                    <ul className="space-y-2 text-xs">
                      {helpedItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-ink leading-snug">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#047857]" />
                          <span>
                            <strong>{item.label}</strong>: {item.value || "positive impact"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">No primary positive drivers recorded.</p>
                  )}
                </div>

                {/* Rose "Worked against" Column */}
                <div className="bg-[#FFF1F2] border border-[#FECDD3] rounded-card p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-[#BE123C] text-white flex items-center justify-center text-xs font-bold">
                      ✕
                    </div>
                    <h4 className="font-archivo font-bold text-sm text-[#BE123C]">
                      Worked against
                    </h4>
                  </div>
                  {workedAgainstItems.length > 0 ? (
                    <ul className="space-y-2 text-xs">
                      {workedAgainstItems.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5 text-ink leading-snug">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#BE123C]" />
                          <span>
                            <strong>{item.label}</strong>: {item.value || "adverse impact"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted">No primary negative drivers recorded.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= 6. "POLICY CHECKS" ================= */}
          {ruleChecks.length > 0 && (
            <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-archivo font-bold text-base text-ink">Policy checks</h3>
                <span className="text-xs font-bold text-brand bg-[#EEF3FF] px-2.5 py-0.5 rounded-full">
                  {passedChecksCount} of {ruleChecks.length} passed
                </span>
              </div>

              <div className="divide-y divide-cardborder">
                {visibleRuleChecks.map((check, idx) => {
                  const isPass = check.status === "pass";
                  const isReview = check.status === "review" || check.status === "refer";

                  return (
                    <div key={idx} className="py-3 flex items-start justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-xs font-bold text-ink leading-tight">
                          {check.label}
                        </p>
                        <p className="text-[11px] text-muted">
                          Value: {check.value != null ? String(check.value) : "—"}
                          {check.threshold != null && (
                            <span> · Benchmark: {String(check.threshold)}</span>
                          )}
                        </p>
                        {check.detail && (
                          <p className="text-[11px] text-[#52525B] pt-0.5 leading-snug">
                            {check.detail}
                          </p>
                        )}
                      </div>

                      {/* Markers: filled square Pass, outline square Review, cross Fail */}
                      <div className="shrink-0 flex items-center justify-center">
                        {isPass ? (
                          <span
                            className="inline-flex items-center justify-center h-5 w-5 rounded bg-[#047857] text-white text-[10px] font-bold"
                            title="Pass"
                          >
                            ■
                          </span>
                        ) : isReview ? (
                          <span
                            className="inline-flex items-center justify-center h-5 w-5 rounded border-2 border-[#D97706] text-[#D97706] text-[10px] font-bold bg-[#D97706]/10"
                            title="Review"
                          >
                            □
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center h-5 w-5 rounded bg-[#DC2626] text-white text-[11px] font-bold"
                            title="Fail"
                          >
                            ✕
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {ruleChecks.length > visibleRuleChecks.length && (
                <button
                  type="button"
                  onClick={() => setShowAllChecks(true)}
                  className="w-full pt-2 text-center text-xs font-bold text-brand hover:underline"
                >
                  Show all {ruleChecks.length} checks ({ruleChecks.length - visibleRuleChecks.length} more)
                </button>
              )}
            </div>
          )}

          {/* ================= 7. "KEEP THESE READY FOR THE LENDER" ================= */}
          {documentsList.length > 0 && (
            <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-4 shadow-xs">
              <div>
                <h3 className="font-archivo font-bold text-base text-ink">
                  Keep these ready for the lender
                </h3>
                <p className="text-xs text-muted mt-0.5">
                  Standard documents required for final underwriting verification
                </p>
              </div>

              <div className="space-y-3">
                {documentsList.map((doc, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-card bg-page border border-cardborder">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-white font-archivo font-bold text-xs">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-ink font-500 leading-snug pt-0.5">{doc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Plain language explanation, Ask AI, Notices & Desk review */}
        <div className="lg:col-span-5 space-y-6">
          {/* ================= 8. "IN PLAIN LANGUAGE" CARD ================= */}
          <CardErrorBoundary>
            <PlainLanguageCard resultId={result.id} />
          </CardErrorBoundary>

          {/* ================= 8. ASK CARD ================= */}
          <div ref={askRef}>
            <CardErrorBoundary>
              <AskSection resultId={result.id} />
            </CardErrorBoundary>
          </div>

          {/* ================= NOTICES ================= */}
          {(result.warnings?.length || result.flags?.length) ? (
            <div className="space-y-2">
              {result.warnings?.map((w, i) => (
                <div
                  key={`w${i}`}
                  className="rounded-card border border-[#D97706]/40 bg-[#FFFBEB] p-3 text-xs text-[#B45309] font-500 flex items-start gap-2"
                >
                  <Icon name="clock" size={16} color="#D97706" />
                  <span>{formatNotice(w)}</span>
                </div>
              ))}
              {result.flags?.map((f, i) => (
                <div
                  key={`f${i}`}
                  className="rounded-card border border-cardborder bg-page p-3 text-xs text-muted font-500 flex items-start gap-2"
                >
                  <Icon name="info" size={16} color="#71717A" />
                  <span>{formatNotice(f)}</span>
                </div>
              ))}
            </div>
          ) : null}

          {/* Desk Review Panel if provided */}
          {reviewPanel && <div className="space-y-4">{reviewPanel}</div>}
        </div>
      </div>

      {/* Decision Slip Modal */}
      {slipOpen && (
        <SlipModal
          result={result}
          onClose={() => setSlipOpen(false)}
          autoDownload={autoDownloadPdf}
        />
      )}
    </div>
  );
}

// In plain language explanation card with EN/हिं toggle
function PlainLanguageCard({ resultId }: { resultId: string }) {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [data, setData] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (language: "en" | "hi") => {
      setLoading(true);
      setError(null);
      try {
        const res = await postExplain(resultId, language);
        setData(res);
      } catch {
        setError("Could not load explanation. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [resultId]
  );

  useEffect(() => {
    load(lang);
  }, [load, lang]);

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-cardborder pb-3">
        <h3 className="font-archivo font-bold text-base text-ink">In plain language</h3>
        <div className="flex rounded-btn border border-cardborder p-0.5">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-[8px] px-2.5 py-1 text-xs font-bold transition-colors ${
              lang === "en" ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={`rounded-[8px] px-2.5 py-1 text-xs font-bold transition-colors ${
              lang === "hi" ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-4">
          <LoadingSkeleton label="Generating explanation…" />
        </div>
      ) : error ? (
        <ErrorBox message={error} onRetry={() => load(lang)} />
      ) : data ? (
        <div className={`space-y-3 ${lang === "hi" ? "font-deva" : ""}`}>
          <p className="text-xs text-ink leading-relaxed font-500">{data.summary}</p>

          {data.reasons && data.reasons.length > 0 && (
            <div className="space-y-1 pt-1">
              <p className="text-[11px] font-bold text-muted uppercase">Key Factors</p>
              <ul className="space-y-1.5">
                {data.reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-ink">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.next_steps && (
            <div className="pt-2 border-t border-cardborder space-y-1">
              <p className="text-[11px] font-bold text-muted uppercase">Recommended Next Steps</p>
              {Array.isArray(data.next_steps) ? (
                <ul className="space-y-1">
                  {data.next_steps.map((s, i) => (
                    <li key={i} className="text-xs text-ink leading-snug">
                      • {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink">{data.next_steps}</p>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Ask AI Section with chips, input, audio and citations
function AskSection({ resultId }: { resultId: string }) {
  const [question, setQuestion] = useState("");
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [data, setData] = useState<AskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chips =
    lang === "hi"
      ? ["यह नतीजा क्यों?", "मेरे मौके कैसे बढ़ें?", "क्या आप इसे मंज़ूर कर सकते हैं?"]
      : ["Why this result?", "What would improve my chances?", "Can you just approve it?"];

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await postAsk(resultId, q, lang);
      setData(res);
    } catch {
      setError(
        lang === "hi"
          ? "उत्तर नहीं मिल सका। कृपया पुनः प्रयास करें।"
          : "Could not get an answer. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 shadow-xs space-y-3">
      <div className="flex items-center justify-between border-b border-cardborder pb-3">
        <label htmlFor="ask_question_input" className="font-archivo font-bold text-base text-ink">
          {lang === "hi" ? "निर्णय के बारे में पूछें" : "Ask about this decision"}
        </label>
        <div className="flex rounded-btn border border-cardborder p-0.5">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-[8px] px-2.5 py-1 text-xs font-bold transition-colors ${
              lang === "en" ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={`rounded-[8px] px-2.5 py-1 text-xs font-bold transition-colors ${
              lang === "hi" ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      <textarea
        id="ask_question_input"
        className={`w-full rounded-btn border border-cardborder bg-page p-3 text-xs text-ink placeholder:text-muted/60 focus:bg-white focus:outline-none focus:border-brand ${
          lang === "hi" ? "font-deva" : ""
        }`}
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={
          lang === "hi"
            ? "इस निर्णय या नियमों के बारे में प्रश्न पूछें…"
            : "Ask any question about this screening decision…"
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setQuestion(c);
              ask(c);
            }}
            className={`rounded-full border border-cardborder bg-white px-2.5 py-1 text-[11px] font-semibold text-ink hover:border-brand hover:text-brand transition-colors ${
              lang === "hi" ? "font-deva" : ""
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => ask(question)}
        disabled={loading || !question.trim()}
        className="w-full inline-flex min-h-[42px] items-center justify-center gap-2 rounded-btn bg-[#1E4FD8] px-5 font-archivo font-bold text-xs text-white hover:bg-[#1A44BD] disabled:opacity-50 transition-colors shadow-sm"
      >
        {loading ? (
          <>
            <Spinner /> <span>{lang === "hi" ? "पूछ रहे हैं…" : "Thinking…"}</span>
          </>
        ) : (
          <>
            <Icon name="sparkle" size={14} color="#FFFFFF" />
            <span>{lang === "hi" ? "पूछें" : "Ask Patrata AI"}</span>
          </>
        )}
      </button>

      {error && <ErrorBox message={error} onRetry={() => ask(question)} />}

      {data && (
        <div
          className={`rounded-card border border-[#EEF3FF] bg-[#EEF3FF]/40 p-3.5 space-y-2 text-xs text-ink ${
            lang === "hi" ? "font-deva" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 text-brand font-bold text-[11px]">
            <Icon name="sparkle" size={12} color="#1E4FD8" />
            <span>Patrata Answer</span>
          </div>
          <p className="leading-relaxed">{renderTextWithCitations(data.answer)}</p>
          {data.in_scope === false && (
            <p className="text-[11px] font-bold text-[#D97706]">
              {lang === "hi" ? "Patrata के दायरे से बाहर" : "Outside what Patrata can do"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
