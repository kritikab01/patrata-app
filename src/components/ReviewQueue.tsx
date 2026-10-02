import { useState, useEffect, useCallback } from "react";
import type { ScoreResult, ReviewAgentResult } from "../types";
import { getReviewQueue, postReviewAgent, postReview } from "../api";
import { formatINR } from "../utils";
import { Spinner, ErrorBox } from "./ui";
import { ResultPanel } from "./ResultPanel";

type QueueState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: ScoreResult[] };

const recommendationStyles: Record<string, string> = {
  APPROVE: "bg-approve/10 text-approve border-approve/30",
  APPROVE_WITH_CONDITIONS: "bg-brand-50 text-brand border-brand/30",
  DECLINE: "bg-decline/10 text-decline border-decline/30",
  NEEDS_MORE_INFO: "bg-refer/10 text-refer border-refer/30",
};

const recommendationLabels: Record<string, string> = {
  APPROVE: "Approve",
  APPROVE_WITH_CONDITIONS: "Approve with conditions",
  DECLINE: "Decline",
  NEEDS_MORE_INFO: "Needs more info",
};

function formatObservation(obs: Record<string, unknown>): { key: string; value: string }[] {
  return Object.entries(obs).map(([key, val]) => ({
    key: key.replace(/_/g, " "),
    value: typeof val === "object" ? JSON.stringify(val) : String(val),
  }));
}

function ReviewAgentCard({ applicationId }: { applicationId: string }) {
  const [data, setData] = useState<ReviewAgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    setElapsed(0);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const res = await postReviewAgent(applicationId);
      setData(res);
    } catch {
      setError("Could not run the review agent. Please try again.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }, [applicationId]);

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <h3 className="font-archivo font-700 text-base text-ink">Review agent</h3>

      {!data && !loading && !error && (
        <div className="mt-3">
          <button
            type="button"
            onClick={run}
            className="inline-flex min-h-[44px] items-center justify-center rounded-btn bg-brand px-5 font-archivo font-700 text-white hover:bg-brand-600"
          >
            Ask the Review Agent
          </button>
        </div>
      )}

      {loading && (
        <div className="mt-3">
          <div className="flex items-center gap-2 text-sm text-muted">
            <Spinner className="text-brand" />
            <span>
              The agent is reviewing this case… {elapsed}s
              {elapsed > 10 && " — this can take up to 60 seconds."}
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3">
          <ErrorBox message={error} onRetry={run} />
        </div>
      )}

      {data && (
        <div className="mt-4 space-y-4">
          <p className="text-xs font-600 text-muted">
            {data.source === "llm" ? "AI planned these steps" : "Scripted plan"}
          </p>

          {/* Steps */}
          <div>
            <p className="text-sm font-700 text-ink">Steps</p>
            <ol className="mt-2 space-y-3">
              {data.steps.map((step, i) => (
                <li key={i} className="rounded-btn border border-cardborder bg-page p-3">
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-700 text-white">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-700 text-ink">{step.thought}</p>
                      <span className="mt-1 inline-block rounded-md bg-white border border-cardborder px-1.5 py-0.5 text-[11px] font-600 text-muted">
                        {step.action}
                      </span>
                      {Object.keys(step.observation).length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {formatObservation(step.observation).map(({ key, value }, j) => (
                            <p key={j} className="text-xs text-muted">
                              <span className="font-600">{key}:</span> {value}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Memo */}
          <div className="rounded-btn border border-cardborder bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-700 text-ink">Recommendation</p>
              <span
                className={`inline-block rounded-md border px-2.5 py-1 text-xs font-700 ${
                  recommendationStyles[data.memo.recommendation] ?? "bg-page text-muted border-cardborder"
                }`}
              >
                {recommendationLabels[data.memo.recommendation] ?? data.memo.recommendation}
              </span>
            </div>

            {data.memo.summary && (
              <p className="mt-2 text-sm text-ink">{data.memo.summary}</p>
            )}

            {data.memo.conditions.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-600 text-muted">Conditions</p>
                <ul className="mt-1 space-y-1">
                  {data.memo.conditions.map((c, i) => (
                    <li key={i} className="text-sm text-ink flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.memo.reasons.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-600 text-muted">Reasons</p>
                <ul className="mt-1 space-y-1">
                  {data.memo.reasons.map((r, i) => (
                    <li key={i} className="text-sm text-ink flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.memo.risks.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-600 text-muted">Risks</p>
                <ul className="mt-1 space-y-1">
                  {data.memo.risks.map((r, i) => (
                    <li key={i} className="text-sm text-decline flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-decline" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.notes && (
              <p className="mt-3 text-xs text-muted italic">{data.notes}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FinalDecisionCard({
  applicationId,
  onSubmitted,
}: {
  applicationId: string;
  onSubmitted: () => void;
}) {
  const [decision, setDecision] = useState<"APPROVE" | "DECLINE" | null>(null);
  const [note, setNote] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const minNote = 10;
  const canSubmit = decision !== null && note.length >= minNote && reviewer.trim().length > 0 && !submitting;

  async function submit() {
    if (!canSubmit || decision === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await postReview(applicationId, {
        final_decision: decision,
        note,
        reviewer: reviewer.trim(),
      });
      setSuccess(true);
      setTimeout(onSubmitted, 800);
    } catch {
      setError("Could not record the decision. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-card border border-approve/30 bg-approve/5 p-5 text-center">
        <p className="font-archivo font-700 text-base text-approve">Decision recorded</p>
        <p className="mt-1 text-sm text-muted">Refreshing the review queue…</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
      <h3 className="font-archivo font-700 text-base text-ink">Credit manager review</h3>
      <p className="mt-1 text-sm font-600 text-muted">
        The agent advises. The credit manager decides.
      </p>

      {/* Decision toggle */}
      <div className="mt-4">
        <p className="text-sm font-600 text-ink mb-2">Final decision</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDecision("APPROVE")}
            className={`min-h-[44px] flex-1 rounded-btn border-2 px-4 font-archivo font-700 text-sm transition-colors ${
              decision === "APPROVE"
                ? "border-approve bg-approve/10 text-approve"
                : "border-cardborder text-muted hover:border-muted"
            }`}
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => setDecision("DECLINE")}
            className={`min-h-[44px] flex-1 rounded-btn border-2 px-4 font-archivo font-700 text-sm transition-colors ${
              decision === "DECLINE"
                ? "border-decline bg-decline/10 text-decline"
                : "border-cardborder text-muted hover:border-muted"
            }`}
          >
            Decline
          </button>
        </div>
      </div>

      {/* Reason box */}
      <div className="mt-4">
        <label className="block text-sm font-600 text-ink mb-1">
          Reasoning
        </label>
        <textarea
          className="w-full rounded-btn border border-cardborder bg-white p-3 text-sm text-ink placeholder:text-muted/60"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Explain your decision (at least 10 characters)…"
        />
        <p className={`mt-1 text-xs ${note.length < minNote ? "text-muted" : "text-approve"}`}>
          {note.length} / {minNote} characters minimum
        </p>
      </div>

      {/* Reviewer name */}
      <div className="mt-3">
        <label className="block text-sm font-600 text-ink mb-1">Your name</label>
        <input
          className="w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink placeholder:text-muted/60"
          value={reviewer}
          onChange={(e) => setReviewer(e.target.value)}
          placeholder="Reviewer name"
        />
      </div>

      {error && (
        <div className="mt-3">
          <ErrorBox message={error} onRetry={submit} />
        </div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-ink px-6 font-archivo font-700 text-white hover:bg-ink/90 disabled:opacity-50"
      >
        {submitting ? (
          <>
            <Spinner /> Recording…
          </>
        ) : (
          "Record final decision"
        )}
      </button>
    </div>
  );
}

export function ReviewQueue() {
  const [queueState, setQueueState] = useState<QueueState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<ScoreResult | null>(null);
  const [detailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setQueueState({ status: "loading" });
    try {
      const items = await getReviewQueue();
      setQueueState({ status: "ready", items });
      setSelectedId(null);
      setSelectedResult(null);
    } catch {
      setQueueState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  function handleCheckWith() {
    // no-op in review context — counterfactual re-scoring not applicable
  }

  return (
    <div className="space-y-5">
      {/* Queue list or detail view */}
      {!selectedId && (
        <>
          {queueState.status === "loading" && (
            <div className="flex items-center gap-2 p-4 text-muted text-sm">
              <Spinner className="text-brand" /> Loading review queue…
            </div>
          )}
          {queueState.status === "error" && (
            <ErrorBox message="Could not load the review queue." onRetry={loadQueue} />
          )}
          {queueState.status === "ready" && (
            <>
              {queueState.items.length === 0 ? (
                <div className="rounded-card border border-cardborder bg-white p-8 text-center">
                  <p className="font-archivo font-700 text-base text-ink">No cases waiting</p>
                  <p className="mt-1 text-sm text-muted">
                    All referred applications have been reviewed.
                  </p>
                </div>
              ) : (
                <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
                  <h3 className="font-archivo font-700 text-base text-ink">
                    Awaiting review ({queueState.items.length})
                  </h3>
                  <div className="mt-3 divide-y divide-cardborder">
                    {queueState.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedId(item.id);
                          setSelectedResult(item);
                        }}
                        className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-page -mx-2 px-2 rounded-btn transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-600 text-ink truncate">
                            {item.product_name}, {item.variant_name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted">
                            EMI {formatINR(item.emi_estimate)} · {item.status}
                          </p>
                        </div>
                        <span className="inline-block rounded-md border border-refer/30 bg-refer/10 px-2 py-0.5 text-xs font-600 text-refer">
                          Referred
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Detail view */}
      {selectedId && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setSelectedResult(null);
              setDetailError(null);
            }}
            className="text-sm font-600 text-brand hover:underline"
          >
            ← Back to queue
          </button>

          {detailLoading && (
            <div className="flex items-center gap-2 p-4 text-muted text-sm">
              <Spinner className="text-brand" /> Loading case…
            </div>
          )}

          {detailError && (
            <ErrorBox message={detailError} onRetry={() => setDetailError(null)} />
          )}

          {selectedResult && (
            <>
              <ResultPanel result={selectedResult} onCheckWith={handleCheckWith} />
              <ReviewAgentCard applicationId={selectedId} />
              <FinalDecisionCard
                applicationId={selectedId}
                onSubmitted={loadQueue}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
