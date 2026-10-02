import { useState, useEffect, useMemo, useCallback } from "react";
import type { ScoreResult } from "../types";
import { getApplication } from "../api";
import { Icon, IconTile, DecisionPill, Tracker, type TrackerStep, type IconName } from "./viz";
import { inr } from "../lib/calc";
import { getSavedChecks, updateSavedCheck, clearCheckHistory, type SavedCheck } from "../lib/storage";
import { SlipModal } from "./DecisionSlip";

function getRelativeTime(isoString?: string): string {
  if (!isoString) return "recently";
  const then = new Date(isoString).getTime();
  const now = Date.now();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function getProductIcon(name: string): IconName {
  const lk = (name || "").toLowerCase();
  if (lk.includes("home") || lk.includes("prop")) return "house";
  if (lk.includes("vehicle") || lk.includes("car")) return "car";
  if (lk.includes("gadget") || lk.includes("consumer")) return "gadget";
  return "wallet";
}

export function MyChecksScreen({
  lastResult,
  onOpenCheck,
  onStartNew,
}: {
  lastResult: ScoreResult | null;
  onOpenCheck: (id: string) => void;
  onStartNew: () => void;
}) {
  const [checks, setChecks] = useState<SavedCheck[]>(getSavedChecks);
  const [filter, setFilter] = useState<"ALL" | "APPROVE" | "REFER" | "DECLINE">("ALL");
  const [selectedSlipResult, setSelectedSlipResult] = useState<ScoreResult | null>(null);
  const [expiredIds, setExpiredIds] = useState<Record<string, boolean>>({});

  // Refresh status with GET /api/applications/{id} when the tab opens
  const refreshChecks = useCallback(async () => {
    const list = getSavedChecks();
    setChecks(list);

    for (const item of list.slice(0, 10)) {
      try {
        const full = await getApplication(item.id);
        if (full) {
          updateSavedCheck(item.id, {
            decision: full.decision,
            status: full.decision.toLowerCase(),
            emi_estimate: full.emi_estimate,
            reasons: full.reasons,
            counterfactual: full.counterfactual
              ? { possible: full.counterfactual.possible, summary: full.counterfactual.summary }
              : null,
            failing_check: full.rule_checks?.find((c) => c.status === "fail")?.label || null,
          });
        }
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          setExpiredIds((prev) => ({ ...prev, [item.id]: true }));
        }
      }
    }
    setChecks(getSavedChecks());
  }, []);

  useEffect(() => {
    refreshChecks();
  }, [refreshChecks]);

  // Synchronize lastResult into checks list
  useEffect(() => {
    if (lastResult) {
      setChecks(getSavedChecks());
    }
  }, [lastResult]);

  // Filter items
  const filteredChecks = useMemo(() => {
    if (filter === "ALL") return checks;
    return checks.filter((c) => c.decision === filter);
  }, [checks, filter]);

  const countAll = checks.length;
  const countApprove = checks.filter((c) => c.decision === "APPROVE").length;
  const countRefer = checks.filter((c) => c.decision === "REFER").length;
  const countDecline = checks.filter((c) => c.decision === "DECLINE").length;

  function handleOpenSlip(check: SavedCheck) {
    if (lastResult && lastResult.id === check.id) {
      setSelectedSlipResult(lastResult);
      return;
    }
    // Fetch full application for slip modal
    getApplication(check.id)
      .then((res) => setSelectedSlipResult(res))
      .catch(() => {
        // Fallback minimal result
        setSelectedSlipResult({
          id: check.id,
          request_id: check.id,
          decision: check.decision,
          status: check.status || check.decision.toLowerCase(),
          approval_model_note: "",
          warnings: [],
          flags: [],
          rule_checks: [],
          drivers: [],
          reasons: check.reasons || [],
          approval_probability: 0.65,
          repayment_risk: null,
          counterfactual: null,
          foir: 0.42,
          emi_estimate: check.emi_estimate || 15000,
          product: check.product_name,
          product_name: check.product_name,
          variant: check.variant_name,
          variant_name: check.variant_name,
          created_at: check.created_at,
        });
      });
  }

  function handleClear() {
    if (window.confirm("Clear screening history from this device?")) {
      clearCheckHistory();
      setChecks([]);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-cardborder pb-4">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="font-archivo font-extrabold text-2xl text-ink">My checks</h2>
            <span className="text-xs text-muted font-medium">Saved on this phone</span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Your recent pre-screenings and evaluations stored locally
          </p>
        </div>

        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-[#1E4FD8] px-5 font-archivo font-bold text-xs text-white hover:bg-[#1A44BD] transition-colors shadow-sm shrink-0"
        >
          <Icon name="check" size={15} color="#FFFFFF" strokeWidth={2.4} />
          <span>New check</span>
        </button>
      </div>

      {/* Filter Chips: All {n} / Approved / Referred / Declined */}
      {checks.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === "ALL"
                ? "bg-ink text-white shadow-xs"
                : "bg-white border border-cardborder text-muted hover:text-ink"
            }`}
          >
            All {countAll}
          </button>
          <button
            type="button"
            onClick={() => setFilter("APPROVE")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === "APPROVE"
                ? "bg-[#047857] text-white shadow-xs"
                : "bg-white border border-cardborder text-muted hover:text-ink"
            }`}
          >
            Approved ({countApprove})
          </button>
          <button
            type="button"
            onClick={() => setFilter("REFER")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === "REFER"
                ? "bg-[#D97706] text-white shadow-xs"
                : "bg-white border border-cardborder text-muted hover:text-ink"
            }`}
          >
            Referred ({countRefer})
          </button>
          <button
            type="button"
            onClick={() => setFilter("DECLINE")}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === "DECLINE"
                ? "bg-[#DC2626] text-white shadow-xs"
                : "bg-white border border-cardborder text-muted hover:text-ink"
            }`}
          >
            Declined ({countDecline})
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredChecks.length === 0 ? (
        <div className="rounded-card border border-cardborder bg-white p-8 sm:p-12 text-center space-y-4 shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-page border border-cardborder text-muted">
            <Icon name="receipt" size={28} />
          </div>
          <div>
            <h3 className="font-archivo font-bold text-lg text-ink">No checks yet</h3>
            <p className="text-xs text-muted max-w-sm mx-auto mt-1 leading-relaxed">
              You haven&apos;t run any loan evaluations on this device yet. Check your eligibility in 2
              minutes with zero impact on your CIBIL score.
            </p>
          </div>
          <button
            type="button"
            onClick={onStartNew}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-[#1E4FD8] px-6 font-archivo font-bold text-xs text-white hover:bg-[#1A44BD] transition-colors shadow-sm"
          >
            <span>Check my eligibility</span>
            <Icon name="arrow" size={14} color="#FFFFFF" />
          </button>
        </div>
      ) : (
        /* Check Cards List */
        <div className="space-y-4">
          {filteredChecks.map((check) => {
            const isExpired = expiredIds[check.id];
            const tint =
              check.decision === "APPROVE"
                ? "green"
                : check.decision === "REFER"
                ? "amber"
                : "rose";

            // Order-style Tracker Steps
            const trackerSteps: TrackerStep[] =
              check.decision === "REFER"
                ? [
                    { label: "Submitted", state: "done" },
                    { label: "Screened", state: "done" },
                    { label: "Officer review", state: "current", tone: "refer" },
                    { label: "Decision", state: "todo" },
                  ]
                : check.decision === "APPROVE"
                ? [
                    { label: "Submitted", state: "done" },
                    { label: "Screened", state: "done" },
                    { label: "Decision", state: "done", tone: "approve" },
                  ]
                : [
                    { label: "Submitted", state: "done" },
                    { label: "Screened", state: "done" },
                    { label: "Decision", state: "done", tone: "decline" },
                  ];

            return (
              <div
                key={check.id}
                className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-4 shadow-xs hover:border-muted transition-all"
              >
                {/* Header Row: IconTile, Product, Amount, DecisionPill */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <IconTile
                      name={getProductIcon(check.product_name)}
                      tint={tint}
                      size={44}
                    />
                    <div>
                      <h4 className="font-archivo font-bold text-base text-ink leading-tight">
                        {check.product_name} · {inr(check.loan_amount)}
                      </h4>
                      <p className="text-xs text-muted mt-0.5">
                        {check.months} months · {getRelativeTime(check.created_at)}
                      </p>
                    </div>
                  </div>

                  <DecisionPill decision={check.decision} />
                </div>

                {/* viz Tracker */}
                <div className="py-2 px-1 bg-page/60 rounded-card border border-cardborder/60">
                  <Tracker steps={trackerSteps} />
                </div>

                {/* Contextual Notes */}
                {isExpired ? (
                  <div className="p-3 rounded-card bg-[#F4F4F5] border border-cardborder text-xs text-muted flex items-center justify-between">
                    <span>This demo result has expired</span>
                    <button
                      type="button"
                      onClick={onStartNew}
                      className="font-bold text-brand hover:underline"
                    >
                      Run again
                    </button>
                  </div>
                ) : check.decision === "REFER" && check.counterfactual?.possible ? (
                  <div className="p-3 rounded-card bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#B45309] font-medium leading-snug">
                    <span className="font-bold">What would help: </span>
                    {check.counterfactual.summary}
                  </div>
                ) : check.decision === "DECLINE" ? (
                  <div className="p-3 rounded-card bg-[#FFF1F2] border border-[#FECDD3] text-xs text-[#BE123C] flex items-center justify-between gap-2">
                    <span className="truncate">
                      {check.failing_check
                        ? `Primary constraint: ${check.failing_check}`
                        : "Debt or criteria threshold not met"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onOpenCheck(check.id)}
                      className="font-bold underline shrink-0"
                    >
                      See what would help
                    </button>
                  </div>
                ) : null}

                {/* Bottom Action Buttons: Decision slip (outline) + Open (black) */}
                <div className="pt-2 border-t border-cardborder flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenSlip(check)}
                    className="h-11 min-h-[44px] px-4 rounded-btn border border-cardborder bg-white text-xs font-archivo font-bold text-ink hover:bg-page transition-colors inline-flex items-center gap-1.5"
                  >
                    <Icon name="receipt" size={14} />
                    <span>Decision slip</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenCheck(check.id)}
                    className="h-11 min-h-[44px] px-5 rounded-btn bg-ink text-xs font-archivo font-bold text-white hover:bg-ink/90 transition-colors shadow-sm inline-flex items-center gap-1.5"
                  >
                    <span>Open</span>
                    <Icon name="arrow" size={14} color="#FFFFFF" />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Clear History Text Button */}
          <div className="pt-3 text-center">
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-muted hover:text-decline transition-colors underline font-medium"
            >
              Clear history
            </button>
          </div>
        </div>
      )}

      {/* Slip Modal Popup */}
      {selectedSlipResult && (
        <SlipModal
          result={selectedSlipResult}
          onClose={() => setSelectedSlipResult(null)}
        />
      )}
    </div>
  );
}
