import { useState, useCallback, useRef } from "react";
import type { BatchRow, BatchResult as BatchResultType } from "../types";
import { postBatch } from "../api";
import { formatINR, formatPct } from "../utils";
import { Spinner, ErrorBox } from "./ui";

const CSV_COLUMNS = [
  "ref",
  "variant",
  "product",
  "age",
  "no_of_dependents",
  "employment_type",
  "years_in_job",
  "income_annum",
  "existing_emi_monthly",
  "loan_amount",
  "property_value",
  "asset_price",
  "loan_term",
  "annual_rate",
  "cibil_score",
  "no_credit_history",
  "existing_loans_count",
  "outstanding_debt",
  "credit_history_years",
  "new_loans_12m",
  "overdue_now",
  "residential_assets_value",
  "commercial_assets_value",
  "luxury_assets_value",
  "bank_asset_value",
];

function downloadCSV(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadTemplate() {
  const header = CSV_COLUMNS.join(",");
  const sampleRow = [
    "APP-001",
    "pl_salaried",
    "personal",
    "32",
    "2",
    "salaried",
    "5",
    "1200000",
    "8000",
    "500000",
    "",
    "",
    "4",
    "11.5",
    "780",
    "false",
    "1",
    "120000",
    "8",
    "0",
    "false",
    "3500000",
    "0",
    "500000",
    "200000",
  ].join(",");
  downloadCSV("patrata_batch_template.csv", `${header}\n${sampleRow}\n`);
}

function generateSampleBatch(): BatchRow[] {
  const rows: BatchRow[] = [];
  const variants = ["pl_salaried", "pl_self_employed"];
  const employmentMap: Record<string, string> = {
    pl_salaried: "salaried",
    pl_self_employed: "self_employed",
  };

  for (let i = 0; i < 20; i++) {
    const variant = variants[i % 2];
    const cibil = 550 + Math.floor(Math.random() * 301);
    const income = 400000 + Math.floor(Math.random() * 1600001);
    const loanAmount = 100000 + Math.floor(Math.random() * 1900001);
    const age = 25 + Math.floor(Math.random() * 31);
    const tenureYears = 1 + Math.floor(Math.random() * 5);

    rows.push({
      ref: `S-${String(i + 1).padStart(3, "0")}`,
      variant,
      product: "personal",
      age,
      no_of_dependents: Math.floor(Math.random() * 4),
      employment_type: employmentMap[variant] as "salaried" | "self_employed",
      years_in_job: Math.floor(Math.random() * 10),
      income_annum: income,
      existing_emi_monthly: Math.floor(Math.random() * 15000),
      loan_amount: loanAmount,
      property_value: null,
      asset_price: null,
      loan_term: tenureYears,
      annual_rate: 10.5 + Math.random() * 3,
      cibil_score: cibil,
      no_credit_history: false,
      existing_loans_count: Math.floor(Math.random() * 3),
      outstanding_debt: Math.floor(Math.random() * 200000),
      credit_history_years: Math.floor(Math.random() * 15),
      new_loans_12m: Math.floor(Math.random() * 3),
      overdue_now: Math.random() < 0.15,
      residential_assets_value: Math.floor(Math.random() * 4000000),
      commercial_assets_value: Math.floor(Math.random() * 1000000),
      luxury_assets_value: Math.floor(Math.random() * 800000),
      bank_asset_value: Math.floor(Math.random() * 500000),
    });
  }
  return rows;
}

function parseCSV(text: string): BatchRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: BatchRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",").map((c) => c.trim());
    if (cells.length < 3) continue;
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length && j < cells.length; j++) {
      row[headers[j]] = cells[j];
    }
    rows.push({
      ref: row.ref || `ROW-${i}`,
      variant: row.variant || "",
      product: row.product || "personal",
      age: parseInt(row.age) || 0,
      no_of_dependents: parseInt(row.no_of_dependents) || 0,
      employment_type: (row.employment_type || "salaried") as "salaried",
      years_in_job: parseFloat(row.years_in_job) || 0,
      income_annum: parseFloat(row.income_annum) || 0,
      existing_emi_monthly: parseFloat(row.existing_emi_monthly) || 0,
      loan_amount: parseFloat(row.loan_amount) || 0,
      property_value: row.property_value ? parseFloat(row.property_value) : null,
      asset_price: row.asset_price ? parseFloat(row.asset_price) : null,
      loan_term: parseFloat(row.loan_term) || 0,
      annual_rate: parseFloat(row.annual_rate) || 0,
      cibil_score: row.cibil_score ? parseFloat(row.cibil_score) : null,
      no_credit_history: row.no_credit_history === "true",
      existing_loans_count: parseInt(row.existing_loans_count) || 0,
      outstanding_debt: parseFloat(row.outstanding_debt) || 0,
      credit_history_years: parseFloat(row.credit_history_years) || 0,
      new_loans_12m: parseInt(row.new_loans_12m) || 0,
      overdue_now: row.overdue_now === "true",
      residential_assets_value: parseFloat(row.residential_assets_value) || 0,
      commercial_assets_value: parseFloat(row.commercial_assets_value) || 0,
      luxury_assets_value: parseFloat(row.luxury_assets_value) || 0,
      bank_asset_value: parseFloat(row.bank_asset_value) || 0,
    });
  }
  return rows;
}

function downloadResultsCSV(result: BatchResultType) {
  const headers = [
    "row", "ref", "valid", "decision", "approval_probability",
    "foir", "emi_estimate", "reason", "suggested_change", "errors",
  ];
  const lines = [headers.join(",")];
  for (const r of result.rows) {
    const cells = [
      r.row,
      r.ref,
      r.valid ? "true" : "false",
      r.decision || "",
      r.approval_probability != null ? Math.round(r.approval_probability * 100) + "%" : "",
      r.foir != null ? Math.round(r.foir * 100) + "%" : "",
      r.emi_estimate != null ? Math.round(r.emi_estimate) : "",
      `"${(r.reason || "").replace(/"/g, '""')}"`,
      `"${(r.suggested_change || "").replace(/"/g, '""')}"`,
      `"${r.errors.join("; ").replace(/"/g, '""')}"`,
    ];
    lines.push(cells.join(","));
  }
  downloadCSV("patrata_batch_results.csv", lines.join("\n"));
}

function DecisionPill({ decision }: { decision: string | null }) {
  if (!decision) return <span className="text-xs text-muted">—</span>;
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

function SummaryTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-[4px] border border-cardborder border-t-[3px] bg-white p-4" style={{ borderTopColor: color }}>
      <p className="text-xs font-600 text-muted">{label}</p>
      <p className="mt-1.5 font-archivo font-800 text-2xl text-ink">{value}</p>
    </div>
  );
}

export function Batch() {
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [result, setResult] = useState<BatchResultType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submit = useCallback(async (batchRows: BatchRow[]) => {
    if (batchRows.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await postBatch(batchRows);
      setResult(res);
    } catch {
      setError("Could not process the batch. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const parsed = parseCSV(text);
      setRows(parsed);
      if (parsed.length === 0) {
        setError("No valid rows found in the CSV file.");
      } else {
        setError(null);
      }
    };
    reader.onerror = () => setError("Could not read the file.");
    reader.readAsText(file);
  }

  function useSample() {
    const sample = generateSampleBatch();
    setRows(sample);
    setFileName("sample_batch.csv");
    setError(null);
  }

  function handleRunBatch() {
    submit(rows);
  }

  return (
    <div className="space-y-5">
      {/* Upload card */}
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
        <h2 className="font-archivo font-700 text-lg text-ink">Batch screening</h2>
        <p className="mt-0.5 text-sm text-muted">Score 100+ applicants at once</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex min-h-[44px] items-center justify-center rounded-btn border border-cardborder bg-white px-4 text-sm font-600 text-ink hover:border-muted"
          >
            Download CSV template
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex min-h-[44px] items-center justify-center rounded-btn border border-cardborder bg-white px-4 text-sm font-600 text-ink hover:border-muted"
          >
            Upload CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleUpload}
          />

          <button
            type="button"
            onClick={useSample}
            className="inline-flex min-h-[44px] items-center justify-center rounded-btn border border-cardborder bg-white px-4 text-sm font-600 text-ink hover:border-muted"
          >
            Use a sample batch
          </button>
        </div>

        {fileName && rows.length > 0 && (
          <p className="mt-3 text-sm text-muted">
            <span className="font-600 text-ink">{fileName}</span> — {rows.length} rows loaded
          </p>
        )}

        {rows.length > 0 && (
          <button
            type="button"
            onClick={handleRunBatch}
            disabled={loading}
            className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-brand px-6 font-archivo font-700 text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Spinner /> Processing {rows.length} rows…
              </>
            ) : (
              `Run batch (${rows.length} rows)`
            )}
          </button>
        )}
      </div>

      {error && (
        <ErrorBox message={error} onRetry={handleRunBatch} />
      )}

      {/* Results */}
      {result && (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryTile label="Approved" value={result.summary.APPROVE} color="#047857" />
            <SummaryTile label="Referred" value={result.summary.REFER} color="#B45309" />
            <SummaryTile label="Declined" value={result.summary.DECLINE} color="#B42318" />
            <SummaryTile label="Invalid" value={result.summary.INVALID} color="#52525B" />
          </div>

          {/* Download results */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => downloadResultsCSV(result)}
              className="inline-flex min-h-[44px] items-center justify-center rounded-btn border border-cardborder bg-white px-4 text-sm font-600 text-ink hover:border-muted"
            >
              Download results CSV
            </button>
          </div>

          {/* Results table */}
          <div className="rounded-card border border-cardborder bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cardborder bg-page">
                    <th className="px-3 py-2.5 text-left font-600 text-muted">Ref</th>
                    <th className="px-3 py-2.5 text-left font-600 text-muted">Decision</th>
                    <th className="px-3 py-2.5 text-right font-600 text-muted">Approval</th>
                    <th className="px-3 py-2.5 text-right font-600 text-muted">EMI burden</th>
                    <th className="px-3 py-2.5 text-right font-600 text-muted">EMI</th>
                    <th className="px-3 py-2.5 text-left font-600 text-muted">Reason</th>
                    <th className="px-3 py-2.5 text-left font-600 text-muted">Suggested change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cardborder">
                  {result.rows.map((r, i) => (
                    <tr key={i} className={r.valid ? "" : "bg-decline/5"}>
                      <td className="px-3 py-2.5 font-600 text-ink whitespace-nowrap">
                        {r.ref}
                        {!r.valid && (
                          <div className="mt-1 text-xs text-decline">
                            {r.errors.map((e, j) => (
                              <p key={j}>{e}</p>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <DecisionPill decision={r.valid ? r.decision : null} />
                        {!r.valid && (
                          <span className="inline-block rounded-md border border-decline/30 bg-decline/10 px-2 py-0.5 text-xs font-600 text-decline">
                            Invalid
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-archivo font-600 text-ink">
                        {r.valid && r.approval_probability != null ? formatPct(r.approval_probability) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-archivo font-600 text-ink">
                        {r.valid && r.foir != null ? formatPct(r.foir) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-archivo font-600 text-ink whitespace-nowrap">
                        {r.valid && r.emi_estimate != null ? formatINR(r.emi_estimate) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted max-w-xs">
                        {r.reason || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted max-w-xs">
                        {r.suggested_change || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
