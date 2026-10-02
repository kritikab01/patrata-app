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
  const sampleProfiles: Array<{
    variant: "pl_salaried" | "pl_self_employed";
    age: number;
    dependents: number;
    yearsInJob: number;
    income: number;
    loanAmount: number;
    loanTermYears: number;
    rate: number;
    cibil: number;
    existingEmiFraction: number;
    existingLoans: number;
    debt: number;
    creditYears: number;
    newLoans: number;
    overdue: boolean;
    resAssets: number;
    commAssets: number;
    luxAssets: number;
    bankAssets: number;
  }> = [
    { variant: "pl_salaried", age: 34, dependents: 1, yearsInJob: 6, income: 1800000, loanAmount: 500000, loanTermYears: 3, rate: 11.0, cibil: 790, existingEmiFraction: 0.08, existingLoans: 1, debt: 150000, creditYears: 8, newLoans: 0, overdue: false, resAssets: 4000000, commAssets: 0, luxAssets: 500000, bankAssets: 300000 },
    { variant: "pl_self_employed", age: 38, dependents: 2, yearsInJob: 8, income: 2400000, loanAmount: 800000, loanTermYears: 4, rate: 11.5, cibil: 810, existingEmiFraction: 0.10, existingLoans: 2, debt: 300000, creditYears: 12, newLoans: 0, overdue: false, resAssets: 6000000, commAssets: 2000000, luxAssets: 800000, bankAssets: 600000 },
    { variant: "pl_salaried", age: 26, dependents: 0, yearsInJob: 3, income: 900000, loanAmount: 250000, loanTermYears: 2, rate: 12.0, cibil: 760, existingEmiFraction: 0.05, existingLoans: 0, debt: 0, creditYears: 4, newLoans: 0, overdue: false, resAssets: 1500000, commAssets: 0, luxAssets: 200000, bankAssets: 150000 },
    { variant: "pl_self_employed", age: 45, dependents: 3, yearsInJob: 15, income: 2800000, loanAmount: 1200000, loanTermYears: 5, rate: 11.0, cibil: 785, existingEmiFraction: 0.12, existingLoans: 2, debt: 450000, creditYears: 16, newLoans: 1, overdue: false, resAssets: 8000000, commAssets: 3500000, luxAssets: 1200000, bankAssets: 900000 },
    { variant: "pl_salaried", age: 31, dependents: 1, yearsInJob: 4, income: 1200000, loanAmount: 400000, loanTermYears: 3, rate: 11.5, cibil: 770, existingEmiFraction: 0.07, existingLoans: 1, debt: 80000, creditYears: 6, newLoans: 0, overdue: false, resAssets: 3000000, commAssets: 0, luxAssets: 400000, bankAssets: 250000 },
    { variant: "pl_self_employed", age: 32, dependents: 1, yearsInJob: 4, income: 1400000, loanAmount: 700000, loanTermYears: 4, rate: 13.0, cibil: 685, existingEmiFraction: 0.14, existingLoans: 1, debt: 220000, creditYears: 5, newLoans: 1, overdue: false, resAssets: 2500000, commAssets: 500000, luxAssets: 300000, bankAssets: 200000 },
    { variant: "pl_salaried", age: 29, dependents: 0, yearsInJob: 2, income: 750000, loanAmount: 350000, loanTermYears: 3, rate: 13.5, cibil: 645, existingEmiFraction: 0.15, existingLoans: 1, debt: 110000, creditYears: 3, newLoans: 2, overdue: true, resAssets: 1000000, commAssets: 0, luxAssets: 150000, bankAssets: 50000 },
    { variant: "pl_self_employed", age: 41, dependents: 2, yearsInJob: 10, income: 2600000, loanAmount: 1000000, loanTermYears: 3, rate: 11.5, cibil: 800, existingEmiFraction: 0.09, existingLoans: 1, debt: 250000, creditYears: 14, newLoans: 0, overdue: false, resAssets: 7500000, commAssets: 2500000, luxAssets: 900000, bankAssets: 800000 },
    { variant: "pl_salaried", age: 36, dependents: 2, yearsInJob: 7, income: 1500000, loanAmount: 600000, loanTermYears: 4, rate: 12.5, cibil: 695, existingEmiFraction: 0.13, existingLoans: 2, debt: 240000, creditYears: 9, newLoans: 1, overdue: false, resAssets: 3800000, commAssets: 0, luxAssets: 450000, bankAssets: 220000 },
    { variant: "pl_self_employed", age: 30, dependents: 1, yearsInJob: 3, income: 800000, loanAmount: 600000, loanTermYears: 5, rate: 14.0, cibil: 625, existingEmiFraction: 0.18, existingLoans: 2, debt: 180000, creditYears: 4, newLoans: 2, overdue: false, resAssets: 1200000, commAssets: 0, luxAssets: 100000, bankAssets: 80000 },
    { variant: "pl_salaried", age: 42, dependents: 2, yearsInJob: 12, income: 3000000, loanAmount: 1500000, loanTermYears: 5, rate: 10.5, cibil: 820, existingEmiFraction: 0.11, existingLoans: 1, debt: 350000, creditYears: 15, newLoans: 0, overdue: false, resAssets: 9000000, commAssets: 0, luxAssets: 1500000, bankAssets: 1200000 },
    { variant: "pl_self_employed", age: 35, dependents: 2, yearsInJob: 6, income: 1600000, loanAmount: 850000, loanTermYears: 4, rate: 12.5, cibil: 710, existingEmiFraction: 0.15, existingLoans: 2, debt: 280000, creditYears: 8, newLoans: 1, overdue: false, resAssets: 3200000, commAssets: 800000, luxAssets: 350000, bankAssets: 300000 },
    { variant: "pl_salaried", age: 25, dependents: 0, yearsInJob: 2, income: 650000, loanAmount: 150000, loanTermYears: 2, rate: 12.0, cibil: 755, existingEmiFraction: 0.06, existingLoans: 0, debt: 0, creditYears: 3, newLoans: 0, overdue: false, resAssets: 800000, commAssets: 0, luxAssets: 100000, bankAssets: 120000 },
    { variant: "pl_self_employed", age: 48, dependents: 2, yearsInJob: 11, income: 1100000, loanAmount: 750000, loanTermYears: 4, rate: 14.0, cibil: 630, existingEmiFraction: 0.17, existingLoans: 2, debt: 210000, creditYears: 10, newLoans: 2, overdue: true, resAssets: 2800000, commAssets: 600000, luxAssets: 200000, bankAssets: 90000 },
    { variant: "pl_salaried", age: 37, dependents: 2, yearsInJob: 8, income: 2100000, loanAmount: 700000, loanTermYears: 3, rate: 11.0, cibil: 795, existingEmiFraction: 0.10, existingLoans: 1, debt: 200000, creditYears: 11, newLoans: 0, overdue: false, resAssets: 5500000, commAssets: 0, luxAssets: 700000, bankAssets: 500000 },
    { variant: "pl_self_employed", age: 34, dependents: 1, yearsInJob: 5, income: 1750000, loanAmount: 500000, loanTermYears: 3, rate: 12.0, cibil: 775, existingEmiFraction: 0.08, existingLoans: 1, debt: 140000, creditYears: 7, newLoans: 0, overdue: false, resAssets: 3600000, commAssets: 1000000, luxAssets: 400000, bankAssets: 350000 },
    { variant: "pl_salaried", age: 33, dependents: 1, yearsInJob: 5, income: 1000000, loanAmount: 550000, loanTermYears: 3, rate: 12.5, cibil: 705, existingEmiFraction: 0.16, existingLoans: 1, debt: 160000, creditYears: 7, newLoans: 1, overdue: false, resAssets: 2200000, commAssets: 0, luxAssets: 250000, bankAssets: 180000 },
    { variant: "pl_self_employed", age: 52, dependents: 1, yearsInJob: 18, income: 2500000, loanAmount: 900000, loanTermYears: 4, rate: 11.5, cibil: 805, existingEmiFraction: 0.09, existingLoans: 1, debt: 220000, creditYears: 20, newLoans: 0, overdue: false, resAssets: 8500000, commAssets: 3000000, luxAssets: 1100000, bankAssets: 750000 },
    { variant: "pl_salaried", age: 28, dependents: 1, yearsInJob: 3, income: 600000, loanAmount: 400000, loanTermYears: 3, rate: 13.5, cibil: 620, existingEmiFraction: 0.19, existingLoans: 2, debt: 120000, creditYears: 4, newLoans: 2, overdue: false, resAssets: 700000, commAssets: 0, luxAssets: 50000, bankAssets: 40000 },
    { variant: "pl_self_employed", age: 39, dependents: 2, yearsInJob: 9, income: 2200000, loanAmount: 650000, loanTermYears: 3, rate: 11.5, cibil: 780, existingEmiFraction: 0.11, existingLoans: 1, debt: 230000, creditYears: 13, newLoans: 0, overdue: false, resAssets: 5200000, commAssets: 1500000, luxAssets: 600000, bankAssets: 450000 },
  ];

  return sampleProfiles.map((p, i) => {
    const monthlyIncome = Math.round(p.income / 12);
    const existingEmi = Math.round(monthlyIncome * p.existingEmiFraction);
    return {
      ref: `S-${String(i + 1).padStart(3, "0")}`,
      variant: p.variant,
      product: "personal",
      age: p.age,
      no_of_dependents: p.dependents,
      employment_type: p.variant === "pl_salaried" ? "salaried" : "self_employed",
      years_in_job: p.yearsInJob,
      income_annum: p.income,
      existing_emi_monthly: existingEmi,
      loan_amount: p.loanAmount,
      property_value: null,
      asset_price: null,
      loan_term: p.loanTermYears,
      annual_rate: p.rate,
      cibil_score: p.cibil,
      no_credit_history: false,
      existing_loans_count: p.existingLoans,
      outstanding_debt: p.debt,
      credit_history_years: p.creditYears,
      new_loans_12m: p.newLoans,
      overdue_now: p.overdue,
      residential_assets_value: p.resAssets,
      commercial_assets_value: p.commAssets,
      luxury_assets_value: p.luxAssets,
      bank_asset_value: p.bankAssets,
    };
  });
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
