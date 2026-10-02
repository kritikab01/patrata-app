import { useState, useEffect, useCallback } from "react";
import type { StatsData, ScoreResult, DailyStat } from "../types";
import { getStats, getApplications } from "../api";
import { formatINR, formatPct } from "../utils";
import { Spinner, ErrorBox } from "./ui";

type LoadState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

const referColor = "#E0A33A";

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[4px] border border-cardborder border-t-[3px] border-t-ink bg-white p-4">
      <p className="text-xs font-600 text-muted">{label}</p>
      <p className="mt-1.5 font-archivo font-800 text-2xl text-ink">{value}</p>
    </div>
  );
}

function StackedBarChart({ daily }: { daily: DailyStat[] }) {
  const maxVal = Math.max(...daily.map((d) => d.APPROVE + d.REFER + d.DECLINE), 1);
  const chartH = 180;
  const barW = 100 / Math.max(daily.length, 1);
  const gap = barW * 0.2;

  function shortDate(date: string): string {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  }

  return (
    <div>
      <div className="relative" style={{ height: chartH + 24 }}>
        <svg width="100%" height={chartH} viewBox={`0 0 100 ${chartH}`} preserveAspectRatio="none">
          {daily.map((d, i) => {
            const total = d.APPROVE + d.REFER + d.DECLINE;
            if (total === 0) return null;
            const x = i * barW + gap / 2;
            const w = barW - gap;
            const approveH = (d.APPROVE / maxVal) * chartH;
            const referH = (d.REFER / maxVal) * chartH;
            const declineH = (d.DECLINE / maxVal) * chartH;
            let y = chartH;
            return (
              <g key={i}>
                {d.DECLINE > 0 && (
                  <rect x={x} y={(y -= declineH)} width={w} height={declineH} fill="#B42318" />
                )}
                {d.REFER > 0 && (
                  <rect x={x} y={(y -= referH)} width={w} height={referH} fill={referColor} />
                )}
                {d.APPROVE > 0 && (
                  <rect x={x} y={(y -= approveH)} width={w} height={approveH} fill="#047857" />
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex justify-between mt-1">
        {daily.map((d, i) => (
          <span key={i} className="text-[10px] text-muted" style={{ width: `${barW}%`, textAlign: "center" }}>
            {shortDate(d.date)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { label: "Approve", color: "#047857" },
    { label: "Refer", color: referColor },
    { label: "Decline", color: "#B42318" },
  ];
  return (
    <div className="flex flex-wrap gap-4 mt-3">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs font-600 text-muted">
          <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function DecisionPill({ decision }: { decision: ScoreResult["decision"] }) {
  const styles: Record<string, string> = {
    APPROVE: "bg-approve/10 text-approve border-approve/30",
    REFER: "bg-refer/10 text-refer border-refer/30",
    DECLINE: "bg-decline/10 text-decline border-decline/30",
  };
  const labels: Record<string, string> = {
    APPROVE: "Approved",
    REFER: "Referred",
    DECLINE: "Declined",
  };
  return (
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-600 ${styles[decision]}`}>
      {labels[decision]}
    </span>
  );
}

export function Dashboard({ onOpenApplication }: { onOpenApplication: (id: string) => void }) {
  const [statsState, setStatsState] = useState<LoadState<StatsData>>({ status: "loading" });
  const [appsState, setAppsState] = useState<LoadState<ScoreResult[]>>({ status: "loading" });

  const loadStats = useCallback(async () => {
    setStatsState({ status: "loading" });
    try {
      const data = await getStats(14);
      setStatsState({ status: "ready", data });
    } catch {
      setStatsState({ status: "error" });
    }
  }, []);

  const loadApps = useCallback(async () => {
    setAppsState({ status: "loading" });
    try {
      const data = await getApplications();
      setAppsState({ status: "ready", data });
    } catch {
      setAppsState({ status: "error" });
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadApps();
  }, [loadStats, loadApps]);

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      {statsState.status === "loading" && (
        <div className="flex items-center gap-2 p-4 text-muted text-sm">
          <Spinner className="text-brand" /> Loading dashboard…
        </div>
      )}
      {statsState.status === "error" && (
        <ErrorBox message="Could not load dashboard stats." onRetry={loadStats} />
      )}
      {statsState.status === "ready" && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KPICard label="Total applications" value={String(statsState.data.total)} />
            <KPICard label="Approval rate" value={formatPct(statsState.data.approval_rate)} />
            <KPICard label="Awaiting review" value={String(statsState.data.awaiting_review)} />
            <KPICard
              label="Avg EMI burden"
              value={statsState.data.avg_foir != null ? formatPct(statsState.data.avg_foir) : "—"}
            />
          </div>

          {/* Chart */}
          <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
            <h3 className="font-archivo font-700 text-base text-ink">Decisions per day</h3>
            <p className="text-xs text-muted">Last 14 days</p>
            <div className="mt-4">
              {statsState.data.daily.length > 0 ? (
                <StackedBarChart daily={statsState.data.daily} />
              ) : (
                <p className="text-sm text-muted py-8 text-center">No data yet</p>
              )}
            </div>
            <Legend />
          </div>

          {/* Attention reasons */}
          {statsState.data.attention_reasons.length > 0 && (
            <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
              <h3 className="font-archivo font-700 text-base text-ink">Why cases need attention</h3>
              <ul className="mt-3 space-y-2">
                {statsState.data.attention_reasons.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 text-sm text-ink">
                    <span className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-refer" />
                      <span>{item.reason}</span>
                    </span>
                    {item.count != null && (
                      <span className="shrink-0 rounded-md bg-refer/10 px-1.5 py-0.5 text-xs font-600 text-refer">
                        {item.count}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Recent applications */}
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
        <h3 className="font-archivo font-700 text-base text-ink">Recent applications</h3>
        {appsState.status === "loading" && (
          <div className="mt-3 flex items-center gap-2 text-muted text-sm">
            <Spinner className="text-brand" /> Loading applications…
          </div>
        )}
        {appsState.status === "error" && (
          <div className="mt-3">
            <ErrorBox message="Could not load recent applications." onRetry={loadApps} />
          </div>
        )}
        {appsState.status === "ready" && (
          <>
            {appsState.data.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No applications yet.</p>
            ) : (
              <div className="mt-3 divide-y divide-cardborder">
                {appsState.data.slice(0, 8).map((app) => (
                  <button
                    key={app.id}
                    onClick={() => onOpenApplication(app.id)}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-page -mx-2 px-2 rounded-btn transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-600 text-ink truncate">
                        {app.product_name}, {app.variant_name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {formatINR(app.emi_estimate)} EMI · {app.status}
                      </p>
                    </div>
                    <DecisionPill decision={app.decision} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
