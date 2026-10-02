import { useState, useCallback, useEffect, useRef } from "react";
import type { ScoreResult, ExplainResult, AskResult } from "../types";
import { formatINR, formatPct, formatMonths, formatNotice } from "../utils";
import { postExplain, postAsk } from "../api";
import { Spinner, ErrorBox, LoadingSkeleton, StatusMarker, CardErrorBoundary } from "./ui";
import { SlipModal } from "./DecisionSlip";

const decisionConfig = {
  APPROVE: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    heading: "Approved",
    color: "text-approve",
  },
  REFER: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" />
        <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    heading: "Referred to a credit officer",
    color: "text-refer",
  },
  DECLINE: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),
    heading: "Declined",
    color: "text-decline",
  },
} as const;

function renderTextWithCitations(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Match [1], [2], 【1】, 【2】 or citations
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
          className="inline-flex items-center justify-center font-700 text-[10px] text-brand bg-brand-50 border border-brand/30 rounded px-1 ml-0.5"
        >
          [{num}]
        </sup>
      );
    } else if (token.startsWith("**") && token.endsWith("**")) {
      parts.push(
        <strong key={match.index} className="font-700 text-ink">
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

function DecisionSlab({ result }: { result: ScoreResult }) {
  const cfg = decisionConfig[result.decision] || decisionConfig.REFER;
  return (
    <div className="rounded-card bg-ink p-6 text-white sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-ink">
          {cfg.icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-white/70 font-500">
            {result.product_name}, {result.variant_name}
          </p>
          <h2 className={`mt-1 font-archivo font-800 text-2xl sm:text-3xl ${cfg.color}`}>
            {cfg.heading}
          </h2>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/15 pt-5">
        <div>
          <p className="text-xs text-white/60">EMI burden (FOIR)</p>
          <p className="mt-1 font-archivo font-700 text-lg">
            {result.foir != null ? formatPct(result.foir) : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-white/60">Approval model</p>
          {result.approval_probability != null ? (
            <p className="mt-1 font-archivo font-700 text-lg">
              {formatPct(result.approval_probability)}
            </p>
          ) : (
            <p
              className="mt-1 font-archivo font-700 text-lg text-white/50"
              title={result.approval_model_note || undefined}
            >
              Not used
            </p>
          )}
        </div>
        <div>
          <p className="text-xs text-white/60">Default risk</p>
          <p className="mt-1 font-archivo font-700 text-lg">
            {result.repayment_risk ? formatPct(result.repayment_risk.probability) : "—"}
          </p>
          {result.repayment_risk?.band && (
            <p className="text-xs text-white/60">{result.repayment_risk.band}</p>
          )}
        </div>
      </div>

      {result.emi_estimate != null && (
        <div className="mt-4 border-t border-white/15 pt-4">
          <p className="text-xs text-white/60">New EMI</p>
          <p className="mt-0.5 font-archivo font-800 text-xl">
            {formatINR(result.emi_estimate)}
            <span className="text-sm font-500 text-white/60"> /month</span>
          </p>
        </div>
      )}
    </div>
  );
}

// Result Actions: Email this result, Copy summary, Add follow-up to calendar, Print or save as PDF
function getResultSummaryText(result: ScoreResult): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const resultLink = `${origin}/?id=${encodeURIComponent(result.id)}`;

  const lines = [
    `Patrata Loan Pre-Screening: ${result.decision}`,
    `Product: ${result.product_name} (${result.variant_name})`,
  ];

  if (result.emi_estimate != null) {
    lines.push(`Estimated EMI: ${formatINR(result.emi_estimate)}/month`);
  }
  if (result.foir != null) {
    lines.push(`EMI Burden (FOIR): ${formatPct(result.foir)}`);
  }
  if (result.approval_probability != null) {
    lines.push(`Approval Probability: ${formatPct(result.approval_probability)}`);
  }
  if (result.repayment_risk?.probability != null) {
    lines.push(`Default Risk: ${formatPct(result.repayment_risk.probability)}`);
  }

  if (result.reasons && result.reasons.length > 0) {
    lines.push(``, `Reasons:`);
    result.reasons.slice(0, 4).forEach((r, i) => {
      lines.push(`${i + 1}. ${r}`);
    });
  }

  lines.push(``, `Result link: ${resultLink}`);

  let text = lines.join("\n");
  // Enforce under 1,500 characters so mailto: links never fail in browsers
  if (text.length > 1400) {
    text = text.substring(0, 1390) + "\n...";
  }
  return text;
}

function ResultActions({ result }: { result: ScoreResult }) {
  const [copied, setCopied] = useState(false);

  const summaryText = getResultSummaryText(result);
  const subject = `Patrata Loan Decision: ${result.product_name} - ${result.decision}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(summaryText)}`;

  const calendarTitle = `Patrata follow-up: ${result.product_name}`;
  const calendarDetails = `Decision summary: ${result.decision} for ${result.product_name} (${result.variant_name}). Estimated EMI: ${result.emi_estimate != null ? formatINR(result.emi_estimate) : "—"}. Application ID: ${result.id}`;
  const calendarHref = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calendarTitle)}&details=${encodeURIComponent(calendarDetails)}`;

  async function handleCopy() {
    let success = false;
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
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
        textarea.style.top = "0";
        textarea.setAttribute("readonly", "");
        document.body.appendChild(textarea);
        textarea.focus();
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

  return (
    <div className="rounded-card border border-cardborder bg-white p-4 sm:p-5 no-print">
      <p className="text-xs font-600 text-muted mb-3">Share or export decision</p>
      <div className="flex flex-wrap gap-2.5 items-center">
        {/* Email this result */}
        <a
          href={emailHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            // Ensure no host navigation
            e.stopPropagation();
          }}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-btn border border-cardborder bg-white px-4 text-xs font-700 text-ink hover:border-brand hover:text-brand transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          Email this result
        </a>

        {/* Copy summary button */}
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-btn border border-cardborder bg-white px-4 text-xs font-700 text-ink hover:border-brand hover:text-brand transition-colors relative"
        >
          {copied ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-approve">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-approve">Copied!</span>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy summary</span>
            </>
          )}
        </button>

        {/* Add follow-up to calendar */}
        <a
          href={calendarHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-btn border border-cardborder bg-white px-4 text-xs font-700 text-ink hover:border-brand hover:text-brand transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Add follow-up to calendar
        </a>
      </div>
    </div>
  );
}

function Reasons({ reasons }: { reasons: string[] }) {
  if (!reasons || !reasons.length) return null;
  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <h3 className="font-archivo font-700 text-base text-ink">Why</h3>
      <ul className="mt-3 space-y-2">
        {reasons.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-ink">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink" />
            <span>{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RuleChecks({ checks }: { checks: ScoreResult["rule_checks"] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!checks || !checks.length) return null;
  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <h3 className="font-archivo font-700 text-base text-ink">Policy checks</h3>
      <div className="mt-3 divide-y divide-cardborder">
        {checks.map((c, i) => (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between py-3 text-left"
            >
              <div className="min-w-0 pr-3">
                <p className="text-sm font-600 text-ink">{c.label}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Value: {c.value != null ? String(c.value) : "—"}
                  {c.threshold != null && <> · Threshold: {String(c.threshold)}</>}
                </p>
              </div>
              <StatusMarker status={c.status} />
            </button>
            {open === i && c.detail && (
              <p className="pb-3 text-xs text-muted">{c.detail}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Drivers({ drivers }: { drivers: ScoreResult["drivers"] }) {
  if (!drivers || !drivers.length) return null;
  const maxImpact = Math.max(...drivers.map((d) => Math.abs(d.impact)), 0.01);
  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <h3 className="font-archivo font-700 text-base text-ink">What drove the score</h3>
      <p className="mt-1 text-xs text-muted">
        Each bar shows how much a factor pushed this application towards approval (green, right) or decline (red, left), compared with a typical applicant.
      </p>
      <div className="mt-4 space-y-4">
        {drivers.map((d, i) => {
          const pct = (Math.abs(d.impact) / maxImpact) * 50;
          const isApprove = d.direction === "towards_approve";
          return (
            <div key={i}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-600 text-ink">{d.label}</span>
                <span className="text-muted">{d.value}</span>
              </div>
              <div className="mt-1.5 flex h-2 items-center">
                <div className="flex h-2 w-1/2 justify-end">
                  {!isApprove && (
                    <div
                      className="h-2 rounded-l-sm bg-decline"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </div>
                <div className="h-3 w-px bg-cardborder" />
                <div className="flex h-2 w-1/2">
                  {isApprove && (
                    <div
                      className="h-2 rounded-r-sm bg-approve"
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RepaymentRiskDrivers({ result }: { result: ScoreResult }) {
  if (!result.repayment_risk?.drivers?.length) return null;
  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <h3 className="font-archivo font-700 text-base text-ink">Repayment risk drivers</h3>
      <ul className="mt-3 space-y-2">
        {result.repayment_risk.drivers.map((d, i) => (
          <li key={i} className="flex items-start justify-between gap-3 text-sm">
            <span className="text-ink">
              <span className="font-600">{d.label}</span>
              {d.value && <span className="text-muted"> — {d.value}</span>}
            </span>
            <span
              className={`shrink-0 text-xs font-600 ${
                d.direction === "raises_risk" ? "text-decline" : "text-approve"
              }`}
            >
              {d.direction === "raises_risk" ? "Raises risk" : "Lowers risk"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CounterfactualCard({
  result,
  onCheckWith,
}: {
  result: ScoreResult;
  onCheckWith: (amount: number, termMonths: number) => void;
}) {
  const cf = result.counterfactual;
  if (!cf?.possible || result.decision === "APPROVE") return null;
  const termMonths = cf.loan_term ? Math.round(cf.loan_term * 12) : null;
  return (
    <div className="rounded-card border-2 border-brand bg-brand-50 p-5 sm:p-6">
      <h3 className="font-archivo font-700 text-base text-brand-700">Approvable offer</h3>
      <p className="mt-2 text-sm text-ink">{cf.summary}</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
        {cf.loan_amount != null && (
          <p className="text-sm">
            <span className="text-muted">Amount: </span>
            <span className="font-archivo font-700">{formatINR(cf.loan_amount)}</span>
          </p>
        )}
        {termMonths != null && (
          <p className="text-sm">
            <span className="text-muted">Tenure: </span>
            <span className="font-archivo font-700">{formatMonths(termMonths)}</span>
          </p>
        )}
      </div>
      {cf.loan_amount != null && termMonths != null && (
        <button
          type="button"
          onClick={() => onCheckWith(cf.loan_amount!, termMonths!)}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-btn bg-brand px-5 font-archivo font-700 text-white hover:bg-brand-600"
        >
          Check with this amount
        </button>
      )}
    </div>
  );
}

function Notices({ result }: { result: ScoreResult }) {
  if (!result.flags?.length && !result.warnings?.length) return null;
  return (
    <div className="space-y-2">
      {result.warnings?.map((w, i) => (
        <div
          key={`w${i}`}
          className="rounded-btn border border-refer/30 bg-refer/5 p-3 text-sm text-refer"
        >
          {formatNotice(w)}
        </div>
      ))}
      {result.flags?.map((f, i) => (
        <div
          key={`f${i}`}
          className="rounded-btn border border-cardborder bg-page p-3 text-sm text-muted"
        >
          {formatNotice(f)}
        </div>
      ))}
    </div>
  );
}

function ExplainCard({ resultId }: { resultId: string }) {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [data, setData] = useState<ExplainResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLangRef = useRef<"en" | "hi">("en");
  const [show, setShow] = useState(false);

  const load = useCallback(
    async (language: "en" | "hi") => {
      setLoading(true);
      setError(null);
      try {
        const res = await postExplain(resultId, language);
        setData(res);
        lastLangRef.current = language;
      } catch {
        setError("Could not load explanation. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [resultId]
  );

  useEffect(() => {
    if (show) load(lang);
  }, [show, load, lang]);

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-archivo font-700 text-base text-ink">In plain language</h3>
        {show && (
          <div className="flex rounded-btn border border-cardborder p-0.5">
            <button
              type="button"
              onClick={() => setLang("en")}
              className={`rounded-[8px] px-3 py-1 text-xs font-600 ${
                lang === "en" ? "bg-ink text-white" : "text-muted"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang("hi")}
              className={`rounded-[8px] px-3 py-1 text-xs font-600 ${
                lang === "hi" ? "bg-ink text-white" : "text-muted"
              }`}
            >
              हिंदी
            </button>
          </div>
        )}
      </div>

      {!show ? (
        <button
          type="button"
          onClick={() => setShow(true)}
          className="mt-3 text-sm font-600 text-brand hover:underline"
        >
          Show explanation
        </button>
      ) : loading ? (
        <div className="mt-3">
          <LoadingSkeleton label="Generating explanation…" />
        </div>
      ) : error ? (
        <div className="mt-3">
          <ErrorBox message={error} onRetry={() => load(lang)} />
        </div>
      ) : data ? (
        <div className={`mt-3 ${lang === "hi" ? "font-deva" : ""}`}>
          <p className="text-sm text-ink">{data.summary}</p>
          {data.reasons && data.reasons.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {data.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
          {data.next_steps && (
            <div className="mt-3">
              <p className="text-xs font-600 text-muted">Next steps</p>
              {Array.isArray(data.next_steps) ? (
                <ul className="mt-1 space-y-1">
                  {data.next_steps.map((s, i) => (
                    <li key={i} className="text-sm text-ink">
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-ink">{data.next_steps}</p>
              )}
            </div>
          )}
          {data.source === "template" && (
            <p className="mt-3 text-xs text-muted italic">
              Standard explanation (AI unavailable)
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function AskCard({ resultId }: { resultId: string }) {
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
      setError(lang === "hi" ? "उत्तर नहीं मिल सका। कृपया पुनः प्रयास करें।" : "Could not get an answer. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 ask-card no-print">
      <div className="flex items-center justify-between">
        <label htmlFor="ask_question_input" className="font-archivo font-700 text-base text-ink block">
          {lang === "hi" ? "इस निर्णय के बारे में पूछें" : "Ask about this decision"}
        </label>
        <div className="flex rounded-btn border border-cardborder p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setLang("en")}
            className={`rounded-[8px] px-3 py-1 text-xs font-600 ${
              lang === "en" ? "bg-ink text-white" : "text-muted"
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLang("hi")}
            className={`rounded-[8px] px-3 py-1 text-xs font-600 ${
              lang === "hi" ? "bg-ink text-white" : "text-muted"
            }`}
          >
            हिंदी
          </button>
        </div>
      </div>

      <textarea
        id="ask_question_input"
        className={`mt-3 w-full rounded-btn border border-cardborder bg-white p-3 text-sm text-ink placeholder:text-muted/60 ${
          lang === "hi" ? "font-deva" : ""
        }`}
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={
          lang === "hi"
            ? "इस निर्णय के बारे में कोई प्रश्न पूछें…"
            : "Ask a question about this decision…"
        }
      />

      <div className="mt-2 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setQuestion(c);
              ask(c);
            }}
            className={`rounded-md border border-cardborder bg-page px-3 py-1.5 text-xs font-500 text-ink hover:border-brand hover:text-brand transition-colors ${
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
        className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-brand px-5 font-archivo font-700 text-white hover:bg-brand-600 disabled:opacity-60"
      >
        {loading ? (
          <>
            <Spinner /> {lang === "hi" ? "पूछ रहे हैं…" : "Asking…"}
          </>
        ) : (
          lang === "hi" ? "पूछें" : "Ask"
        )}
      </button>

      {error && (
        <div className="mt-3">
          <ErrorBox message={error} onRetry={() => ask(question)} />
        </div>
      )}

      {data && (
        <div className={`mt-4 rounded-btn border border-cardborder bg-page p-4 ${lang === "hi" ? "font-deva" : ""}`}>
          <p className="text-sm text-ink">{renderTextWithCitations(data.answer)}</p>
          {data.in_scope === false && (
            <p className="mt-2 text-xs font-600 text-refer">
              {lang === "hi" ? "Patrata के दायरे से बाहर" : "Outside what Patrata can do"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultPanel({
  result,
  onCheckWith,
}: {
  result: ScoreResult;
  onCheckWith: (amount: number, termMonths: number) => void;
}) {
  const [slipOpen, setSlipOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("slip") === "1") {
      setSlipOpen(true);
    }
  }, []);

  return (
    <div className="space-y-5 result-panel-container">
      <CardErrorBoundary>
        <DecisionSlab result={result} />
      </CardErrorBoundary>

      {/* Decision slip button */}
      <button
        type="button"
        onClick={() => setSlipOpen(true)}
        className="w-full min-h-[44px] rounded-btn border border-ink bg-transparent font-archivo font-700 text-sm text-ink hover:bg-ink hover:text-white transition-colors no-print flex items-center justify-center gap-2 shadow-sm"
      >
        Decision slip
      </button>

      <CardErrorBoundary>
        <ResultActions result={result} />
      </CardErrorBoundary>
      <CardErrorBoundary>
        <Reasons reasons={result.reasons} />
      </CardErrorBoundary>
      <CardErrorBoundary>
        <RuleChecks checks={result.rule_checks} />
      </CardErrorBoundary>
      <CardErrorBoundary>
        <Drivers drivers={result.drivers} />
      </CardErrorBoundary>
      <CardErrorBoundary>
        <RepaymentRiskDrivers result={result} />
      </CardErrorBoundary>
      <CardErrorBoundary>
        <CounterfactualCard result={result} onCheckWith={onCheckWith} />
      </CardErrorBoundary>
      <CardErrorBoundary>
        <Notices result={result} />
      </CardErrorBoundary>
      <CardErrorBoundary>
        <ExplainCard resultId={result.id} />
      </CardErrorBoundary>
      <CardErrorBoundary>
        <AskCard resultId={result.id} />
      </CardErrorBoundary>

      {slipOpen && <SlipModal result={result} onClose={() => setSlipOpen(false)} />}
    </div>
  );
}
