import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer, X } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ENGINE_URL } from "../config";
import type { ScoreResult } from "../types";

/* Decision slip: a thermal-receipt record of one screening (same design as Patrata v3).
   "Print or save as PDF" prints only the slip; "Download PDF" saves a receipt-sized PDF. */

type Kfs = {
  monthly_emi: string;
  total_interest: string;
  processing_fee: string;
  apr_including_fee: string;
};

type SlipResult = ScoreResult & {
  created_at?: string;
  model_version?: string;
  application?: {
    loan_amount?: number;
    loan_term?: number;
    annual_rate?: number;
    existing_emi_monthly?: number;
    income_annum?: number;
  };
  review?: { final_decision?: string } | null;
};

const CHECK: Record<string, string> = { pass: "OK", refer: "** REVIEW", review: "** REVIEW", fail: "** FAIL" };

const rs = (v: number | null | undefined) => {
  if (v == null || isNaN(v)) return "-";
  const s = Math.round(Math.abs(v)).toString();
  const last = s.slice(-3);
  const rest = s.slice(0, -3);
  return "Rs " + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last : last);
};
const txt = (v: unknown) => String(v ?? "").toUpperCase().replace(/₹\s?/g, "Rs ");
const pct = (v: number | null | undefined) => (v == null ? "NOT SCORED" : `${(v * 100).toFixed(1)}%`);
const when = (iso?: string) => {
  const d = iso ? new Date(iso) : new Date();
  return d
    .toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })
    .toUpperCase();
};

function Edge({ flip = false }: { flip?: boolean }) {
  const pts = Array.from({ length: 35 }, (_, i) => `${i * 10},${(i % 2 === 0) !== flip ? 10 : 0}`).join(" ");
  return (
    <svg width="100%" height="10" viewBox="0 0 340 10" preserveAspectRatio="none" aria-hidden="true" style={{ display: "block" }}>
      <polygon fill="#FFFFFF" points={flip ? `0,0 ${pts} 340,0` : `0,10 ${pts} 340,10`} />
    </svg>
  );
}

function Barcode({ text }: { text: string }) {
  let x = 0;
  const bars: { x: number; w: number }[] = [];
  for (const ch of (text + text).slice(0, 24)) {
    const c = ch.charCodeAt(0);
    for (const w of [1 + (c % 3), 1 + ((c >> 2) % 3)]) {
      bars.push({ x, w });
      x += w + 1 + (c % 2);
    }
  }
  return (
    <svg width="100%" height="40" viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" role="img" aria-label={`Barcode for application ${text}`}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} width={b.w} height="40" fill="#111111" />
      ))}
    </svg>
  );
}

const Row = ({ l, r, bold }: { l: string; r: string; bold?: boolean }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontWeight: bold ? 700 : 400 }}>
    <span>{l}</span>
    <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>{r}</span>
  </div>
);
const Rule = () => <div style={{ margin: "6px 0", borderTop: "1px dashed #111111" }} />;

export function SlipBody({ r, kfs }: { r: SlipResult; kfs: Kfs | null }) {
  const a = r.application ?? {};
  const cf = r.counterfactual;
  const id = r.id.toUpperCase();
  return (
    <div style={{ margin: "0 auto", width: "100%", maxWidth: 340 }}>
      <Edge />
      <div
        style={{
          fontFamily: "'Courier Prime', 'Courier New', monospace",
          background: "#FFFFFF",
          color: "#111111",
          padding: "12px 20px",
          fontSize: 13.5,
          lineHeight: 1.35,
        }}
      >
        <p style={{ textAlign: "center", fontSize: 16, fontWeight: 700 }}>PATRATA CREDIT DESK</p>
        <p style={{ textAlign: "center" }}>PRE-SCREENING SLIP</p>
        <p style={{ textAlign: "center", fontSize: 12 }}>
          {when(r.created_at)}  APP {id}
        </p>
        <Rule />
        <Row l="LOAN ASKED" r={rs(a.loan_amount)} />
        <Row l="TERM / RATE" r={`${a.loan_term ?? "-"}Y / ${a.annual_rate != null ? a.annual_rate.toFixed(2) : "-"}%`} />
        <Row l="NEW EMI" r={rs(r.emi_estimate)} />
        <Row l="OLD EMIS" r={rs(a.existing_emi_monthly)} />
        <Row l="INCOME / MONTH" r={rs(a.income_annum != null ? a.income_annum / 12 : null)} />
        <Rule />
        {r.rule_checks.map((c, i) => (
          <Row
            key={i}
            l={`${txt(c.label).replace(" (FOIR)", "")} ${txt(c.value)}`}
            r={CHECK[c.status as string] ?? "** REVIEW"}
            bold={c.status !== "pass"}
          />
        ))}
        <Row l="APPROVAL MODEL" r={pct(r.approval_probability)} />
        <div
          style={{
            margin: "8px 0",
            background: "#111111",
            color: "#FFFFFF",
            padding: "6px 0",
            textAlign: "center",
            fontSize: 17,
            fontWeight: 700,
          }}
        >
          RESULT: {r.decision}
        </div>
        {r.review?.final_decision && <Row l="FINAL (REVIEWED)" r={txt(r.review.final_decision)} bold />}
        {cf?.possible && cf.loan_amount && r.decision !== "APPROVE" && (
          <p>
            SUGGESTED: {rs(cf.loan_amount)} / {cf.loan_term}Y
          </p>
        )}
        <Rule />
        <p style={{ fontWeight: 700 }}>KEY FACTS (AS ASKED)</p>
        {kfs ? (
          <>
            <Row l="EMI" r={txt(kfs.monthly_emi)} />
            <Row l="TOTAL INTEREST" r={txt(kfs.total_interest)} />
            <Row l="PROCESSING FEE 1%" r={txt(kfs.processing_fee)} />
            <Row l="APR INCL. FEES" r={kfs.apr_including_fee} bold />
          </>
        ) : (
          <p>LOADING...</p>
        )}
        <Rule />
        <Barcode text={id} />
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 12 }}>
          <span style={{ borderTop: "1px solid #111111", paddingTop: 4 }}>OFFICER</span>
          <span style={{ borderTop: "1px solid #111111", paddingTop: 4 }}>MANAGER</span>
        </div>
        <p style={{ marginTop: 8, textAlign: "center", fontSize: 11.5 }}>
          DECISION SUPPORT ONLY. THE LENDER DECIDES.
          <br />
          NO PERSONAL IDENTIFIERS COLLECTED.
          {r.model_version && (
            <>
              <br />
              MODEL {r.model_version}
            </>
          )}
        </p>
      </div>
      <Edge flip />
    </div>
  );
}

export function useKfs(id: string, enabled: boolean) {
  const [kfs, setKfs] = useState<Kfs | null>(null);
  useEffect(() => {
    if (!enabled || kfs) return;
    fetch(`${ENGINE_URL}/api/applications/${id}/kfs`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setKfs(d))
      .catch(() => {});
  }, [id, enabled, kfs]);
  return kfs;
}

const inFrame = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

export function SlipModal({ result, onClose }: { result: ScoreResult; onClose: () => void }) {
  const r = result as SlipResult;
  const kfs = useKfs(r.id, true);
  const slipRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    document.body.classList.add("slip-open");
    return () => {
      window.removeEventListener("keydown", k);
      document.body.classList.remove("slip-open");
    };
  }, [onClose]);

  // Opened in a new tab with &slip=1&print=1: print as soon as the key facts have loaded.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("print") === "1" && kfs) {
      const t = setTimeout(() => window.print(), 600);
      return () => clearTimeout(t);
    }
  }, [kfs]);

  const print = () => {
    if (inFrame()) {
      const u = new URL(window.location.href);
      u.searchParams.set("id", r.id);
      u.searchParams.set("slip", "1");
      u.searchParams.set("print", "1");
      window.open(u.toString(), "_blank", "noopener");
      return;
    }
    window.print();
  };

  const download = async () => {
    if (!slipRef.current) return;
    setBusy(true);
    setError(null);
    try {
      await document.fonts?.ready;
      const canvas = await html2canvas(slipRef.current, { scale: 3, backgroundColor: null, useCORS: true });
      const widthMm = 80; // thermal-receipt width
      const heightMm = (canvas.height / canvas.width) * widthMm;
      const pdf = new jsPDF({ unit: "mm", format: [widthMm, heightMm] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, widthMm, heightMm);
      pdf.save(`Patrata-slip-${r.id}.pdf`);
    } catch {
      setError("Couldn't create the PDF. Try Print instead.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div
        className="slip-modal"
        style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(10,10,10,0.6)", padding: 16 }}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Decision slip"
          style={{ maxHeight: "92vh", width: "100%", maxWidth: 420, overflowY: "auto", borderRadius: 24, background: "#D6D6D2", padding: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ fontFamily: "Archivo, sans-serif", fontSize: 18, fontWeight: 800 }}>Decision slip</p>
            <button type="button" aria-label="Close" onClick={onClose} style={{ width: 40, height: 40, borderRadius: 999, display: "grid", placeItems: "center" }}>
              <X size={20} />
            </button>
          </div>
          <div ref={slipRef}>
            <SlipBody r={r} kfs={kfs} />
          </div>
          <button
            type="button"
            onClick={print}
            style={{ marginTop: 16, minHeight: 48, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, background: "#0A0A0A", color: "#fff", fontWeight: 600 }}
          >
            <Printer size={18} />
            Print or save as PDF
          </button>
          <button
            type="button"
            onClick={download}
            disabled={busy || !kfs}
            style={{ marginTop: 8, minHeight: 44, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, border: "1px solid #0A0A0A", background: "transparent", fontWeight: 600, opacity: busy || !kfs ? 0.5 : 1 }}
          >
            <Download size={18} />
            {busy ? "Creating PDF..." : "Download PDF"}
          </button>
          {error && <p style={{ marginTop: 8, color: "#B42318", fontSize: 13 }}>{error}</p>}
        </div>
      </div>
      {/* Print copy: the only thing visible when printing */}
      {createPortal(
        <div className="slip-print">
          <SlipBody r={r} kfs={kfs} />
        </div>,
        document.body
      )}
    </>
  );
}
