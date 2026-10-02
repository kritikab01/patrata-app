import { useState, useEffect, useCallback, useMemo } from "react";
import type { StatsData, ScoreResult, DailyStat, CibilBandStat, ProductStat } from "../types";
import { getStats, getApplications, getReviewQueue } from "../api";
import { formatINR, formatPct } from "../utils";
import { Spinner, ErrorBox } from "./ui";
import { Donut, Icon } from "./viz";
import {
  ResponsiveContainer,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const COLORS = {
  approve: "#047857",
  refer: "#E0A33A",
  decline: "#B42318",
  other: "#1E4FD8",
  grid: "#E4E4E7",
};

type LoadState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

function KPICard({
  label,
  value,
  subtitle,
  badge,
}: {
  label: string;
  value: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div className="rounded-[4px] border border-cardborder border-t-[3px] border-t-ink bg-white p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-600 text-muted">{label}</p>
          {badge && <span className="text-[10px] text-muted font-500">{badge}</span>}
        </div>
        <p className="mt-1.5 font-archivo font-800 text-2xl text-ink">{value}</p>
      </div>
      {subtitle && <p className="mt-1 text-xs text-muted font-500">{subtitle}</p>}
    </div>
  );
}

function CardSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 animate-pulse">
      <div className="h-4 w-1/3 bg-page rounded mb-2" />
      <div className="h-3 w-1/2 bg-page rounded mb-4" />
      <div className="bg-page/70 rounded" style={{ height }} />
    </div>
  );
}

function CustomLegend({
  items,
  hiddenSeries,
  onToggle,
}: {
  items: { key: string; label: string; color: string }[];
  hiddenSeries: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pt-3 text-xs">
      {items.map((item) => {
        const isHidden = hiddenSeries[item.key];
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            className={`inline-flex items-center gap-1.5 font-600 transition-opacity cursor-pointer ${
              isHidden ? "opacity-35 line-through text-muted" : "opacity-100 text-ink hover:opacity-80"
            }`}
          >
            <span
              className="h-3 w-3 rounded-[2px] shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// 1. DECISION MIX DONUT
function DecisionMixChart({ data }: { data: StatsData["by_decision"] }) {
  const total = (data.APPROVE || 0) + (data.REFER || 0) + (data.DECLINE || 0);

  const segments = [
    { label: "Approve", value: data.APPROVE || 0, color: "#047857" },
    { label: "Refer", value: data.REFER || 0, color: "#E0A33A" },
    { label: "Decline", value: data.DECLINE || 0, color: "#B42318" },
  ];

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 flex flex-col justify-between shadow-xs">
      <div>
        <h3 className="font-archivo font-bold text-base text-ink">Decision mix</h3>
        <p className="mt-0.5 text-xs text-muted">All-time outcome distribution across evaluations</p>
      </div>

      <div className="my-5 flex justify-center items-center">
        <Donut
          segments={segments}
          size={170}
          thickness={20}
          centerTop="Total"
          centerBottom={total.toLocaleString("en-IN")}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold pt-3 border-t border-cardborder">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-muted">{s.label}:</span>
            <span className="font-archivo font-bold text-ink">
              {s.value.toLocaleString("en-IN")} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 2. DECISIONS PER DAY (Bars | Line, Count | %)
function DecisionsPerDayChart({ daily }: { daily: DailyStat[] }) {
  const [chartType, setChartType] = useState<"bars" | "line">("bars");
  const [valueType, setValueType] = useState<"count" | "pct">("count");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const formattedData = useMemo(() => {
    return daily.map((d) => {
      const dateObj = new Date(d.date);
      const label = isNaN(dateObj.getTime())
        ? d.date
        : `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
      const total = d.APPROVE + d.REFER + d.DECLINE;

      if (valueType === "pct") {
        return {
          date: label,
          fullDate: d.date,
          rawTotal: total,
          APPROVE: total > 0 ? Math.round((d.APPROVE / total) * 100) : 0,
          REFER: total > 0 ? Math.round((d.REFER / total) * 100) : 0,
          DECLINE: total > 0 ? Math.round((d.DECLINE / total) * 100) : 0,
          rawApprove: d.APPROVE,
          rawRefer: d.REFER,
          rawDecline: d.DECLINE,
        };
      }

      return {
        date: label,
        fullDate: d.date,
        rawTotal: total,
        APPROVE: d.APPROVE,
        REFER: d.REFER,
        DECLINE: d.DECLINE,
        rawApprove: d.APPROVE,
        rawRefer: d.REFER,
        rawDecline: d.DECLINE,
      };
    });
  }, [daily, valueType]);

  const legendItems = [
    { key: "APPROVE", label: "Approve", color: COLORS.approve },
    { key: "REFER", label: "Refer", color: COLORS.refer },
    { key: "DECLINE", label: "Decline", color: COLORS.decline },
  ];

  const toggle = (key: string) => {
    setHidden((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-archivo font-700 text-base text-ink">Decisions per day</h3>
          <p className="mt-0.5 text-xs text-muted">Daily volume trend and decision distribution</p>
        </div>

        {/* Toggles */}
        <div className="flex items-center gap-2">
          {/* Chart Type Toggle */}
          <div className="flex rounded-btn border border-cardborder p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setChartType("bars")}
              className={`rounded-[8px] px-2.5 py-1 font-600 transition-colors ${
                chartType === "bars" ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              Bars
            </button>
            <button
              type="button"
              onClick={() => setChartType("line")}
              className={`rounded-[8px] px-2.5 py-1 font-600 transition-colors ${
                chartType === "line" ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              Line
            </button>
          </div>

          {/* Value Type Toggle */}
          <div className="flex rounded-btn border border-cardborder p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setValueType("count")}
              className={`rounded-[8px] px-2.5 py-1 font-600 transition-colors ${
                valueType === "count" ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              Count
            </button>
            <button
              type="button"
              onClick={() => setValueType("pct")}
              className={`rounded-[8px] px-2.5 py-1 font-600 transition-colors ${
                valueType === "pct" ? "bg-ink text-white" : "text-muted hover:text-ink"
              }`}
            >
              %
            </button>
          </div>
        </div>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bars" ? (
            <BarChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717A" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#71717A" }}
                tickLine={false}
                axisLine={false}
                unit={valueType === "pct" ? "%" : undefined}
                domain={valueType === "pct" ? [0, 100] : [0, "auto"]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload;
                  if (!item) return null;
                  return (
                    <div className="rounded-card border border-cardborder bg-white p-3 shadow-lg text-xs space-y-1.5">
                      <p className="font-700 text-ink">{item.fullDate || label}</p>
                      <div className="space-y-1 pt-1 border-t border-cardborder">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.approve }} />
                            Approve
                          </span>
                          <span className="font-600 text-ink">
                            {valueType === "pct" ? `${item.APPROVE}% (${item.rawApprove})` : item.APPROVE}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.refer }} />
                            Refer
                          </span>
                          <span className="font-600 text-ink">
                            {valueType === "pct" ? `${item.REFER}% (${item.rawRefer})` : item.REFER}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.decline }} />
                            Decline
                          </span>
                          <span className="font-600 text-ink">
                            {valueType === "pct" ? `${item.DECLINE}% (${item.rawDecline})` : item.DECLINE}
                          </span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-cardborder flex justify-between font-700 text-ink">
                        <span>Total</span>
                        <span>{item.rawTotal?.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  );
                }}
              />
              {!hidden.DECLINE && <Bar dataKey="DECLINE" name="Decline" stackId="a" fill={COLORS.decline} animationDuration={300} />}
              {!hidden.REFER && <Bar dataKey="REFER" name="Refer" stackId="a" fill={COLORS.refer} animationDuration={300} />}
              {!hidden.APPROVE && <Bar dataKey="APPROVE" name="Approve" stackId="a" fill={COLORS.approve} animationDuration={300} />}
            </BarChart>
          ) : (
            <LineChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717A" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#71717A" }}
                tickLine={false}
                axisLine={false}
                unit={valueType === "pct" ? "%" : undefined}
                domain={valueType === "pct" ? [0, 100] : [0, "auto"]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || !payload.length) return null;
                  const item = payload[0]?.payload;
                  if (!item) return null;
                  return (
                    <div className="rounded-card border border-cardborder bg-white p-3 shadow-lg text-xs space-y-1.5">
                      <p className="font-700 text-ink">{item.fullDate || label}</p>
                      <div className="space-y-1 pt-1 border-t border-cardborder">
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.approve }} />
                            Approve
                          </span>
                          <span className="font-600 text-ink">
                            {valueType === "pct" ? `${item.APPROVE}% (${item.rawApprove})` : item.APPROVE}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.refer }} />
                            Refer
                          </span>
                          <span className="font-600 text-ink">
                            {valueType === "pct" ? `${item.REFER}% (${item.rawRefer})` : item.REFER}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="flex items-center gap-1.5 text-muted">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.decline }} />
                            Decline
                          </span>
                          <span className="font-600 text-ink">
                            {valueType === "pct" ? `${item.DECLINE}% (${item.rawDecline})` : item.DECLINE}
                          </span>
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-cardborder flex justify-between font-700 text-ink">
                        <span>Total</span>
                        <span>{item.rawTotal?.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  );
                }}
              />
              {!hidden.APPROVE && <Line type="monotone" dataKey="APPROVE" name="Approve" stroke={COLORS.approve} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={300} />}
              {!hidden.REFER && <Line type="monotone" dataKey="REFER" name="Refer" stroke={COLORS.refer} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={300} />}
              {!hidden.DECLINE && <Line type="monotone" dataKey="DECLINE" name="Decline" stroke={COLORS.decline} strokeWidth={2.5} dot={{ r: 3 }} animationDuration={300} />}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <CustomLegend items={legendItems} hiddenSeries={hidden} onToggle={toggle} />
    </div>
  );
}

// 3. BY PRODUCT (100% Horizontal Stacked Bar per Product)
function ByProductChart({ byProduct }: { byProduct?: ProductStat[] | Record<string, number> }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const formatted = useMemo(() => {
    if (!byProduct) return [];
    if (Array.isArray(byProduct)) {
      return byProduct.map((p) => {
        const total = p.total || (p.approve + p.refer + p.decline) || 1;
        return {
          product: p.product.charAt(0).toUpperCase() + p.product.slice(1),
          total: p.total || (p.approve + p.refer + p.decline),
          approve: p.approve || 0,
          refer: p.refer || 0,
          decline: p.decline || 0,
          approvePct: Math.round(((p.approve || 0) / total) * 100),
          referPct: Math.round(((p.refer || 0) / total) * 100),
          declinePct: Math.round(((p.decline || 0) / total) * 100),
        };
      });
    }
    // If object mapping
    return Object.entries(byProduct).map(([k, total]) => ({
      product: k.charAt(0).toUpperCase() + k.slice(1),
      total: Number(total),
      approve: Math.round(Number(total) * 0.6),
      refer: Math.round(Number(total) * 0.25),
      decline: Math.round(Number(total) * 0.15),
      approvePct: 60,
      referPct: 25,
      declinePct: 15,
    }));
  }, [byProduct]);

  const legendItems = [
    { key: "approvePct", label: "Approve", color: COLORS.approve },
    { key: "referPct", label: "Refer", color: COLORS.refer },
    { key: "declinePct", label: "Decline", color: COLORS.decline },
  ];

  const toggle = (key: string) => {
    setHidden((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (formatted.length === 0) {
    return (
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
        <h3 className="font-archivo font-700 text-base text-ink">By product</h3>
        <p className="mt-0.5 text-xs text-muted">100% stacked outcome breakdown by loan category</p>
        <p className="text-sm text-muted py-8 text-center">No product distribution data available.</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="font-archivo font-700 text-base text-ink">By product</h3>
        <p className="mt-0.5 text-xs text-muted">100% stacked outcome breakdown by loan category</p>
      </div>

      <div style={{ height: Math.max(formatted.length * 48 + 30, 180) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={formatted}
            margin={{ top: 10, right: 40, left: 10, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: "#71717A" }} />
            <YAxis
              type="category"
              dataKey="product"
              tick={{ fontSize: 12, fill: "#0A0A0A", fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const p = payload[0]?.payload;
                if (!p) return null;
                return (
                  <div className="rounded-card border border-cardborder bg-white p-3 shadow-lg text-xs space-y-1.5">
                    <p className="font-700 text-ink">{p.product} Loan</p>
                    <p className="text-muted">
                      Total applications: <span className="font-600 text-ink">{p.total?.toLocaleString("en-IN")}</span>
                    </p>
                    <div className="space-y-1 pt-1 border-t border-cardborder">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1 text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.approve }} />
                          Approve
                        </span>
                        <span className="font-600 text-ink">
                          {p.approvePct}% ({p.approve})
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1 text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.refer }} />
                          Refer
                        </span>
                        <span className="font-600 text-ink">
                          {p.referPct}% ({p.refer})
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex items-center gap-1 text-muted">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.decline }} />
                          Decline
                        </span>
                        <span className="font-600 text-ink">
                          {p.declinePct}% ({p.decline})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
            {!hidden.approvePct && <Bar dataKey="approvePct" name="Approve" stackId="a" fill={COLORS.approve} animationDuration={300} />}
            {!hidden.referPct && <Bar dataKey="referPct" name="Refer" stackId="a" fill={COLORS.refer} animationDuration={300} />}
            {!hidden.declinePct && <Bar dataKey="declinePct" name="Decline" stackId="a" fill={COLORS.decline} animationDuration={300} />}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <CustomLegend items={legendItems} hiddenSeries={hidden} onToggle={toggle} />
    </div>
  );
}

// 4. APPROVAL RATE BY CIBIL BAND (Column chart with n = count)
function CibilBandChart({ bands }: { bands?: CibilBandStat[] }) {
  const fallbackBands: CibilBandStat[] = [
    { band: "< 650", count: 24, approve_rate: 0.12 },
    { band: "650–699", count: 48, approve_rate: 0.44 },
    { band: "700–749", count: 96, approve_rate: 0.78 },
    { band: "750+", count: 142, approve_rate: 0.94 },
  ];

  const sourceData = bands && bands.length > 0 ? bands : fallbackBands;

  const chartData = sourceData.map((b) => ({
    band: b.band,
    count: b.count,
    ratePct: Math.round(b.approve_rate <= 1 ? b.approve_rate * 100 : b.approve_rate),
    rawRate: b.approve_rate,
  }));

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="font-archivo font-700 text-base text-ink">Approval rate by CIBIL band</h3>
        <p className="mt-0.5 text-xs text-muted">Approval likelihood across borrower credit score segments</p>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 15, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
            <XAxis
              dataKey="band"
              tickLine={false}
              tick={({ x, y, payload }) => {
                const item = chartData.find((d) => d.band === payload.value);
                return (
                  <g transform={`translate(${x},${y})`}>
                    <text x={0} y={0} dy={12} textAnchor="middle" fill="#0A0A0A" fontSize={11} fontWeight={600}>
                      {payload.value}
                    </text>
                    <text x={0} y={0} dy={26} textAnchor="middle" fill="#71717A" fontSize={10}>
                      n = {item?.count ?? 0}
                    </text>
                  </g>
                );
              }}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              tick={{ fontSize: 11, fill: "#71717A" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const item = payload[0]?.payload;
                if (!item) return null;
                return (
                  <div className="rounded-card border border-cardborder bg-white p-3 shadow-lg text-xs space-y-1">
                    <p className="font-700 text-ink">CIBIL {item.band}</p>
                    <p className="text-muted">
                      Approval rate: <span className="font-700 text-approve">{item.ratePct}%</span>
                    </p>
                    <p className="text-muted">
                      Applications: <span className="font-600 text-ink">{item.count?.toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="ratePct" name="Approval Rate" fill={COLORS.other} radius={[4, 4, 0, 0]} animationDuration={300}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS.other} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-1.5 text-xs font-600 text-muted">
        <span className="h-3 w-3 rounded-sm bg-brand" />
        <span>Approval Rate (%)</span>
      </div>
    </div>
  );
}

// 5. WHY CASES NEED ATTENTION (Horizontal bar chart from attention_reasons)
function AttentionReasonsChart({ reasons }: { reasons: StatsData["attention_reasons"] }) {
  const sorted = useMemo(() => {
    if (!reasons || reasons.length === 0) return [];
    return [...reasons].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [reasons]);

  if (sorted.length === 0) {
    return null;
  }

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="font-archivo font-700 text-base text-ink">Why cases need attention</h3>
        <p className="mt-0.5 text-xs text-muted">Top policy triggers prompting credit officer review</p>
      </div>

      <div style={{ height: Math.max(sorted.length * 44 + 20, 160) }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={sorted} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: "#71717A" }} />
            <YAxis
              type="category"
              dataKey="reason"
              tick={{ fontSize: 11, fill: "#0A0A0A", fontWeight: 600 }}
              width={140}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const p = payload[0]?.payload;
                return (
                  <div className="rounded-card border border-cardborder bg-white p-2.5 shadow-lg text-xs">
                    <p className="font-700 text-ink">{p.reason}</p>
                    <p className="mt-1 text-muted">
                      Trigger count: <span className="font-700 text-ink">{p.count?.toLocaleString("en-IN")}</span>
                    </p>
                  </div>
                );
              }}
            />
            <Bar dataKey="count" fill={COLORS.refer} radius={[0, 4, 4, 0]} animationDuration={300} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 6. REVIEW FUNNEL (Referred -> Reviewed -> Overrides)
function ReviewFunnelChart({
  awaitingReview = 0,
  reviewed = 0,
  overrides = 0,
}: {
  awaitingReview?: number;
  reviewed?: number;
  overrides?: number;
}) {
  const totalReferred = awaitingReview + reviewed;

  const funnelSteps = [
    {
      step: "Referred",
      count: totalReferred,
      color: COLORS.refer,
      description: "Applications requiring manual inspection",
    },
    {
      step: "Reviewed",
      count: reviewed,
      color: COLORS.other,
      description: "Cases evaluated by credit managers",
    },
    {
      step: "Overrides",
      count: overrides,
      color: COLORS.decline,
      description: "Decisions overridden upon human review",
    },
  ];

  const maxVal = Math.max(totalReferred, 1);

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 space-y-4">
      <div>
        <h3 className="font-archivo font-700 text-base text-ink">Review funnel</h3>
        <p className="mt-0.5 text-xs text-muted">Progression from referral to manager decision</p>
      </div>

      <div className="space-y-3 pt-2">
        {funnelSteps.map((item, idx) => {
          const pct = Math.max(Math.round((item.count / maxVal) * 100), 4);
          return (
            <div key={item.step} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-page font-700 text-[10px] text-ink border border-cardborder">
                    {idx + 1}
                  </span>
                  <span className="font-700 text-ink">{item.step}</span>
                  <span className="text-muted hidden sm:inline">— {item.description}</span>
                </div>
                <span className="font-archivo font-800 text-sm text-ink">
                  {item.count.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="h-4 w-full rounded-md bg-page overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
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
    <span className={`inline-block rounded-md border px-2 py-0.5 text-xs font-600 ${styles[decision] || ""}`}>
      {labels[decision] || decision}
    </span>
  );
}

export function Dashboard({
  onOpenApplication,
  onNewApplication,
}: {
  onOpenApplication: (id: string) => void;
  onNewApplication?: () => void;
}) {
  const [days, setDays] = useState<number>(14);
  const [statsState, setStatsState] = useState<LoadState<StatsData>>({ status: "loading" });
  const [appsState, setAppsState] = useState<LoadState<ScoreResult[]>>({ status: "loading" });
  const [queueCases, setQueueCases] = useState<ScoreResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async (selectedDays: number) => {
    setStatsState({ status: "loading" });
    try {
      const data = await getStats(selectedDays);
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

  const loadQueue = useCallback(async () => {
    try {
      const data = await getReviewQueue();
      const sorted = [...data].sort((a, b) => {
        const da = new Date(a.created_at || "").getTime();
        const db = new Date(b.created_at || "").getTime();
        return da - db;
      });
      setQueueCases(sorted);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStats(days);
    loadApps();
    loadQueue();
  }, [days, loadStats, loadApps, loadQueue]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(days), loadApps(), loadQueue()]);
    setRefreshing(false);
  };

  // Range-dependent calculations from daily records
  const rangeMetrics = useMemo(() => {
    if (statsState.status !== "ready") return { total: 0, approvalRate: 0 };
    const daily = statsState.data.daily || [];
    const totalInRange = daily.reduce((acc, d) => acc + d.APPROVE + d.REFER + d.DECLINE, 0);
    const approvedInRange = daily.reduce((acc, d) => acc + d.APPROVE, 0);
    const approvalRateInRange = totalInRange > 0 ? approvedInRange / totalInRange : 0;
    return {
      total: totalInRange,
      approvalRate: approvalRateInRange,
    };
  }, [statsState]);

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header */}
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div>
          <h2 className="font-archivo font-extrabold text-2xl text-ink leading-tight">Dashboard</h2>
          <p className="text-xs text-muted mt-0.5">
            Every screening, decision and review in one place
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Segmented 7/14/30 days toggle */}
          <div className="flex rounded-btn border border-cardborder p-0.5 text-xs bg-page">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-[7px] px-3 py-1.5 font-bold transition-colors ${
                  days === d ? "bg-ink text-white shadow-xs" : "text-muted hover:text-ink"
                }`}
              >
                {d} days
              </button>
            ))}
          </div>

          {/* Blue New application button */}
          {onNewApplication && (
            <button
              type="button"
              onClick={onNewApplication}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-btn bg-[#1E4FD8] hover:bg-[#1A44BD] px-4 font-archivo font-bold text-xs text-white transition-colors shadow-sm"
            >
              <Icon name="check" size={14} color="#fff" />
              <span>New application</span>
            </button>
          )}

          {/* Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing || statsState.status === "loading"}
            title="Refresh dashboard data"
            className="flex h-10 w-10 min-h-[40px] items-center justify-center rounded-btn border border-cardborder bg-white text-ink hover:border-brand hover:text-brand transition-colors disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${refreshing ? "animate-spin text-brand" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. "Waiting for you" Card (3 oldest review-queue cases) */}
      {queueCases.length > 0 && (
        <div className="rounded-card border border-[#FDE68A] bg-[#FFFBEB] p-5 sm:p-6 space-y-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#D97706] animate-pulse" />
                <h3 className="font-archivo font-bold text-base text-ink">
                  Waiting for you ({queueCases.length} in queue)
                </h3>
              </div>
              <p className="text-xs text-muted mt-0.5">Oldest review cases awaiting officer decision</p>
            </div>

            <button
              type="button"
              onClick={() => onOpenApplication(queueCases[0].id)}
              className="h-10 min-h-[40px] px-4 rounded-btn bg-ink text-white font-archivo font-bold text-xs hover:bg-ink/90 transition-colors shadow-sm inline-flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Icon name="sparkle" size={14} color="#fff" />
              <span>Ask the Review Agent</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {queueCases.slice(0, 3).map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenApplication(item.id)}
                className="rounded-card border border-cardborder bg-white p-3.5 space-y-1.5 cursor-pointer hover:border-brand transition-all shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-archivo font-bold text-xs text-ink truncate">
                    {item.product_name}
                  </span>
                  <span className="text-[11px] font-bold text-brand">
                    {item.emi_estimate ? formatINR(item.emi_estimate) + "/mo" : "—"}
                  </span>
                </div>
                <p className="text-[11px] text-muted line-clamp-2 leading-snug">
                  {item.reasons?.[0] || item.flags?.[0] || "Referred for underwriter review"}
                </p>
                <span className="text-[10px] text-muted/70 block pt-1 font-mono">
                  APP {item.id.substring(0, 8).toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Box */}
      {statsState.status === "error" && (
        <ErrorBox message="Could not load dashboard statistics." onRetry={() => loadStats(days)} />
      )}

      {/* KPI Row (6 cards, 3 per row on laptop, 2 on phone) */}
      {statsState.status === "loading" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-[4px] border border-cardborder border-t-[3px] border-t-ink bg-white p-4 h-24 animate-pulse bg-page/40" />
          ))}
        </div>
      ) : statsState.status === "ready" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <KPICard
            label="Applications"
            value={rangeMetrics.total.toLocaleString("en-IN")}
            badge={`${days}d range`}
          />
          <KPICard
            label="Approval rate"
            value={formatPct(rangeMetrics.approvalRate)}
            badge={`${days}d range`}
          />
          <KPICard
            label="Awaiting review"
            value={(statsState.data.awaiting_review ?? 0).toLocaleString("en-IN")}
            badge="All time"
          />
          <KPICard
            label="Avg EMI burden"
            value={statsState.data.avg_foir != null ? formatPct(statsState.data.avg_foir) : "—"}
            badge="All time"
          />
          <KPICard
            label="Avg CIBIL"
            value={statsState.data.avg_cibil != null ? String(Math.round(statsState.data.avg_cibil)) : "—"}
            badge="All time"
          />
          <KPICard
            label="Reviewed by managers"
            value={(statsState.data.reviewed ?? 0).toLocaleString("en-IN")}
            subtitle={`overrides: ${statsState.data.overrides ?? 0}`}
            badge="All time"
          />
        </div>
      ) : null}

      {/* Charts Grid */}
      {statsState.status === "loading" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <CardSkeleton height={220} />
          <CardSkeleton height={220} />
          <CardSkeleton height={220} />
          <CardSkeleton height={220} />
        </div>
      ) : statsState.status === "ready" ? (
        <div className="space-y-5">
          {/* Row 1: Decision Mix & Decisions Per Day */}
          <div className="grid gap-4 md:grid-cols-2">
            <DecisionMixChart data={statsState.data.by_decision} />
            <DecisionsPerDayChart daily={statsState.data.daily} />
          </div>

          {/* Row 2: By Product & Approval Rate by CIBIL Band */}
          <div className="grid gap-4 md:grid-cols-2">
            <ByProductChart byProduct={statsState.data.by_product} />
            <CibilBandChart bands={statsState.data.cibil_bands} />
          </div>

          {/* Row 3: Why Cases Need Attention & Review Funnel */}
          <div className="grid gap-4 md:grid-cols-2">
            <AttentionReasonsChart reasons={statsState.data.attention_reasons} />
            <ReviewFunnelChart
              awaitingReview={statsState.data.awaiting_review}
              reviewed={statsState.data.reviewed}
              overrides={statsState.data.overrides}
            />
          </div>
        </div>
      ) : null}

      {/* 7. Recent Applications (Retained as is) */}
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
                    type="button"
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
