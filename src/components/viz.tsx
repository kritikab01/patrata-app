/* Patrata 2.0 visual building blocks: meter, donut, zone bar, tracker, icon tile and icons.
   Same tokens as the rest of the app; colour always comes with a word or number. */
import type { ReactNode } from "react";

export const C = {
  ink: "#0A0A0A",
  paper: "#F4F4F5",
  line: "#E4E4E7",
  muted: "#52525B",
  brand: "#1E4FD8",
  approve: "#047857",
  refer: "#B45309",
  decline: "#B42318",
  amber: "#E0A33A",
} as const;

export const TINT = {
  blue: { bg: "#EEF3FF", fg: "#1E4FD8" },
  green: { bg: "#E8F5EE", fg: "#047857" },
  amber: { bg: "#FDF2E3", fg: "#B45309" },
  rose: { bg: "#FBECEA", fg: "#B42318" },
} as const;
export type Tint = keyof typeof TINT;

/* ---------- Icons (stroke, 24 grid) ---------- */
const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  check: (<><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9zM9 14l2 2 4-4" /></>),
  tools: (<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2" /></>),
  receipt: (<><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" /></>),
  help: (<><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1" /><rect x="17" y="14" width="4" height="6" rx="1" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  wallet: (<><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /></>),
  house: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  gadget: (<><rect x="3" y="5" width="18" height="12" rx="2" /><path d="M8 21h8M12 17v4" /></>),
  car: <path d="M5 17V12l2-5h10l2 5v5M3 17h18v2H3zM7 19v2M17 19v2" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M15 5l-7 7 7 7" />,
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>),
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />,
  mic: (<><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>),
  tick: <path d="M5 12l5 5 9-10" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronUp: <path d="M6 15l6-6 6 6" />,
  alert: <path d="M12 9v4M12 16.5v.5M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />,
  percent: (<><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2" /><circle cx="17" cy="17" r="2" /></>),
  book: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM19 19v2H6" />,
  dashboard: (<><path d="M4 13a8 8 0 0 1 16 0M12 13l4-4" /><path d="M3 17h18" /></>),
  layers: <path d="M12 3 3 8l9 5 9-5zM3 13l9 5 9-5" />,
  compare: <path d="M8 3v18M16 3v18M3 8h5M16 16h5" />,
};
export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, color = "currentColor", strokeWidth = 1.8 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** Rounded square with a tinted background holding an icon (quick actions, products). */
export function IconTile({ name, tint = "blue", size = 44 }: { name: IconName; tint?: Tint; size?: number }) {
  const t = TINT[tint];
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.27, background: t.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
      <Icon name={name} color={t.fg} size={Math.round(size * 0.52)} />
    </span>
  );
}

/* ---------- Semicircle meter ---------- */
/** value 0..1. Draws a 180° arc; the number and label sit under it. */
export function Meter({
  value,
  width = 240,
  color = C.brand,
  track = C.line,
  label,
  big,
  showKnob = true,
  ariaLabel,
}: {
  value: number | null;
  width?: number;
  color?: string;
  track?: string;
  label?: string;
  big?: string;
  showKnob?: boolean;
  ariaLabel?: string;
}) {
  const v = value == null || isNaN(value) ? 0 : Math.min(Math.max(value, 0), 1);
  const phi = Math.PI * v;
  const x = 110 - 90 * Math.cos(phi);
  const y = 110 - 90 * Math.sin(phi);
  const h = Math.round(width * (128 / 220));
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={width} height={h} viewBox="0 0 220 128" role="img" aria-label={ariaLabel ?? `${label ?? "Value"} ${Math.round(v * 100)} percent`}>
        <path d="M20 110 A90 90 0 0 1 200 110" fill="none" stroke={track} strokeWidth="14" strokeLinecap="round" />
        {value != null && v > 0.001 && (
          <path d={`M20 110 A90 90 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)}`} fill="none" stroke={color} strokeWidth="14" strokeLinecap="round" />
        )}
        {showKnob && value != null && <circle cx={x} cy={y} r="9" fill="#fff" stroke={color} strokeWidth="4" />}
      </svg>
      {(big || label) && (
        <div style={{ marginTop: -Math.round(h * 0.45), display: "flex", flexDirection: "column", alignItems: "center" }}>
          {big && <span style={{ fontFamily: "Archivo, sans-serif", fontWeight: 800, fontSize: Math.round(width / 6), lineHeight: 1 }}>{big}</span>}
          {label && <span style={{ fontSize: 13, color: C.muted }}>{label}</span>}
        </div>
      )}
    </div>
  );
}

/* ---------- Donut ---------- */
export type DonutSegment = { label: string; value: number; color: string };

export function Donut({
  segments,
  size = 140,
  thickness = 18,
  centerTop,
  centerBottom,
  dark = false,
  onHover,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerTop?: string;
  centerBottom?: string;
  dark?: boolean;
  onHover?: (s: DonutSegment | null) => void;
}) {
  const r = 50;
  const circ = 2 * Math.PI * r;
  const total = segments.reduce((a, s) => a + Math.max(s.value, 0), 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" role="img" aria-label={segments.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(", ")}>
      <circle cx="64" cy="64" r={r} fill="none" stroke={dark ? "#27272A" : C.line} strokeWidth={thickness} />
      {segments.map((s) => {
        const len = (Math.max(s.value, 0) / total) * circ;
        const el = (
          <circle
            key={s.label}
            cx="64"
            cy="64"
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${circ}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 64 64)"
            style={{ cursor: onHover ? "pointer" : undefined, transition: "stroke-dasharray 300ms ease" }}
            onMouseEnter={() => onHover?.(s)}
            onMouseLeave={() => onHover?.(null)}
          >
            <title>{`${s.label}: ${Math.round((s.value / total) * 100)}%`}</title>
          </circle>
        );
        offset += len;
        return el;
      })}
      {centerTop && (
        <text x="64" y={centerBottom ? 60 : 69} textAnchor="middle" fill={dark ? "#A1A1AA" : C.muted} fontFamily="Figtree, sans-serif" fontSize="11">
          {centerTop}
        </text>
      )}
      {centerBottom && (
        <text x="64" y="78" textAnchor="middle" fill={dark ? "#fff" : C.ink} fontFamily="Archivo, sans-serif" fontWeight="800" fontSize="16">
          {centerBottom}
        </text>
      )}
    </svg>
  );
}

/* ---------- Zone bar (e.g. EMI burden) ---------- */
export type Zone = { upTo: number; color: string; label: string };

/** value and zone limits are 0..1 of the bar. A black marker shows the value. */
export function ZoneBar({
  value,
  zones,
  height = 12,
  width,
}: {
  value?: number | null;
  zones: Zone[];
  height?: number;
  width?: string | number;
}) {
  const v = Math.min(Math.max(value ?? 0, 0), 1);
  let start = 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, width }}>
      <div style={{ position: "relative", height }}>
        <div style={{ display: "flex", height, borderRadius: height / 2, overflow: "hidden" }}>
          {zones.map((z) => {
            const w = Math.max(z.upTo - start, 0);
            start = z.upTo;
            return <div key={z.label} style={{ width: `${w * 100}%`, background: z.color }} title={z.label} />;
          })}
        </div>
        <div style={{ position: "absolute", left: `${v * 100}%`, top: -4, width: 4, height: height + 8, marginLeft: -2, background: C.ink, borderRadius: 2 }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, gap: 8 }}>
        {zones.map((z) => (
          <span key={z.label}>{z.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Standard EMI-burden zones: comfortable ≤50%, review 50–60%, high above (bar shows 0–100%). */
export const FOIR_ZONES: Zone[] = [
  { upTo: 0.5, color: "#CDE9D9", label: "Comfortable up to 50%" },
  { upTo: 0.6, color: "#F5DDB8", label: "Review 50–60%" },
  { upTo: 1, color: "#F3D0CB", label: "Over 60%" },
];

/* ---------- Order-style tracker ---------- */
export type StepState = "done" | "current" | "todo";
export type TrackerStep = { label: string; state: StepState; tone?: "approve" | "refer" | "decline" };

export function Tracker({ steps }: { steps: TrackerStep[] }) {
  const toneColor = (t?: TrackerStep["tone"]) => (t === "approve" ? C.approve : t === "refer" ? C.refer : t === "decline" ? C.decline : C.ink);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {steps.map((s, i) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", flex: i === steps.length - 1 ? "0 0 auto" : 1 }}>
            <span
              aria-label={`${s.label}: ${s.state === "done" ? "done" : s.state === "current" ? "in progress" : "not yet"}`}
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                boxSizing: "border-box",
                display: "grid",
                placeItems: "center",
                background: s.state === "done" ? toneColor(s.tone) : s.state === "current" ? "#fff" : C.line,
                border: s.state === "current" ? `3px solid ${toneColor(s.tone)}` : "none",
              }}
            >
              {s.state === "done" && <Icon name="tick" size={12} color="#fff" strokeWidth={3} />}
            </span>
            {i < steps.length - 1 && <span style={{ flex: 1, height: 3, background: steps[i + 1].state === "todo" ? C.line : C.ink }} />}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted, gap: 6 }}>
        {steps.map((s) => (
          <span key={s.label} style={{ fontWeight: s.state === "current" ? 700 : 500, color: s.state === "current" ? toneColor(s.tone) : C.muted }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Status pill ---------- */
export function DecisionPill({ decision }: { decision: "APPROVE" | "REFER" | "DECLINE" | string }) {
  const map: Record<string, { bg: string; fg: string; text: string; icon: IconName }> = {
    APPROVE: { bg: TINT.green.bg, fg: C.approve, text: "Approved", icon: "tick" },
    REFER: { bg: TINT.amber.bg, fg: "#8A4108", text: "Referred", icon: "clock" },
    DECLINE: { bg: TINT.rose.bg, fg: C.decline, text: "Declined", icon: "cross" },
  };
  const m = map[decision] ?? { bg: C.paper, fg: C.ink, text: decision, icon: "info" as IconName };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 999, background: m.bg, color: m.fg, fontSize: 13, fontWeight: 700 }}>
      <Icon name={m.icon} size={14} strokeWidth={2.4} />
      {m.text}
    </span>
  );
}
