import { useState, useCallback, useEffect, useRef } from "react";
import type { ScoreResult, ExplainResult, AskResult } from "../types";
import { formatINR, formatPct, formatMonths, formatNotice } from "../utils";
import { postExplain, postAsk } from "../api";
import { Spinner, ErrorBox, LoadingSkeleton, StatusMarker, CardErrorBoundary } from "./ui";

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

  const chips = ["Why this result?", "What would improve my chances?", "Can you just approve it?"];

  async function ask(q: string) {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await postAsk(resultId, q, lang);
      setData(res);
    } catch {
      setError("Could not get an answer. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <label htmlFor="ask_question_input" className="font-archivo font-700 text-base text-ink block">
          Ask about this decision
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
        className="mt-3 w-full rounded-btn border border-cardborder bg-white p-3 text-sm text-ink placeholder:text-muted/60"
        rows={3}
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask a question about this decision…"
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
            className="rounded-md border border-cardborder bg-page px-3 py-1.5 text-xs font-500 text-ink hover:border-brand hover:text-brand"
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
            <Spinner /> Asking…
          </>
        ) : (
          "Ask"
        )}
      </button>

      {error && (
        <div className="mt-3">
          <ErrorBox message={error} onRetry={() => ask(question)} />
        </div>
      )}

      {data && (
        <div className={`mt-4 rounded-btn border border-cardborder bg-page p-4 ${lang === "hi" ? "font-deva" : ""}`}>
          <p className="text-sm text-ink">{data.answer}</p>
          {data.in_scope === false && (
            <p className="mt-2 text-xs font-600 text-refer">
              Outside what Patrata can do
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
  return (
    <div className="space-y-5">
      <CardErrorBoundary>
        <DecisionSlab result={result} />
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
    </div>
  );
}
