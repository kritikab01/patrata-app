import { useState, useMemo, useCallback } from "react";
import type { Product, FormState, EmploymentType, ScoreBody, SimulateResult, RuleCheck } from "../types";
import { postSimulate } from "../api";
import { generateRequestId, num, formatINR, formatPct } from "../utils";
import { Spinner, ErrorBox, StatusMarker } from "./ui";

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "salaried", label: "Salaried" },
  { value: "self_employed", label: "Self-employed" },
  { value: "government", label: "Government" },
  { value: "pensioner", label: "Pensioner" },
  { value: "not_employed", label: "Not employed" },
];

const inputCls =
  "w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink placeholder:text-muted/60";

const BASE_SAMPLE: FormState = {
  product: "personal",
  variant: "pl_salaried",
  age: "32",
  no_of_dependents: "2",
  employment_type: "salaried",
  years_in_job: "5",
  income_annum: "1200000",
  existing_emi_monthly: "8000",
  loan_amount: "500000",
  property_value: "",
  asset_price: "",
  tenure_months: "48",
  annual_rate: "11.5",
  cibil_score: "750",
  no_credit_history: false,
  existing_loans_count: "1",
  outstanding_debt: "120000",
  credit_history_years: "8",
  new_loans_12m: "0",
  overdue_now: false,
  residential_assets_value: "3500000",
  commercial_assets_value: "0",
  luxury_assets_value: "500000",
  bank_asset_value: "200000",
};

function buildSimulateBody(form: FormState): ScoreBody {
  const product = form.product;
  const cibil = form.no_credit_history ? null : form.cibil_score ? num(form.cibil_score) : null;
  return {
    variant: form.variant,
    request_id: generateRequestId(),
    product,
    product_id: product,
    age: num(form.age),
    no_of_dependents: num(form.no_of_dependents),
    employment_type: form.employment_type,
    years_in_job: num(form.years_in_job),
    income_annum: num(form.income_annum),
    existing_emi_monthly: num(form.existing_emi_monthly),
    loan_amount: num(form.loan_amount),
    property_value: product === "home" ? num(form.property_value) : null,
    asset_price: product === "consumer" || product === "vehicle" ? num(form.asset_price) : null,
    loan_term: num(form.tenure_months) / 12,
    annual_rate: num(form.annual_rate),
    cibil_score: cibil,
    no_credit_history: form.no_credit_history,
    existing_loans_count: num(form.existing_loans_count),
    outstanding_debt: num(form.outstanding_debt),
    credit_history_years: num(form.credit_history_years),
    new_loans_12m: num(form.new_loans_12m),
    overdue_now: form.overdue_now,
    residential_assets_value: num(form.residential_assets_value),
    commercial_assets_value: num(form.commercial_assets_value),
    luxury_assets_value: num(form.luxury_assets_value),
    bank_asset_value: num(form.bank_asset_value),
  };
}

const FIELD_LABELS: Record<string, string> = {
  product: "Product",
  variant: "Variant",
  age: "Age",
  no_of_dependents: "Dependents",
  employment_type: "Employment",
  years_in_job: "Years in job",
  income_annum: "Annual income",
  existing_emi_monthly: "Existing EMI",
  loan_amount: "Loan amount",
  property_value: "Property value",
  asset_price: "Asset price",
  tenure_months: "Tenure (months)",
  annual_rate: "Interest rate",
  cibil_score: "CIBIL score",
  no_credit_history: "No credit history",
  existing_loans_count: "Existing loans",
  outstanding_debt: "Outstanding debt",
  credit_history_years: "Credit history years",
  new_loans_12m: "New loans 12m",
  overdue_now: "Overdue now",
  residential_assets_value: "Residential assets",
  commercial_assets_value: "Commercial assets",
  luxury_assets_value: "Luxury assets",
  bank_asset_value: "Bank deposits",
};

function ApplicantForm({
  label,
  products,
  form,
  onChange,
  accentColor,
}: {
  label: string;
  products: Product[];
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  accentColor: string;
}) {
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === form.product),
    [products, form.product]
  );

  function handleProductChange(id: string) {
    const product = products.find((p) => p.id === id);
    onChange({ product: id, variant: product?.variants[0]?.id ?? "" });
  }

  return (
    <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6" style={{ borderTopColor: accentColor, borderTopWidth: "3px" }}>
      <h3 className="font-archivo font-700 text-base text-ink mb-3">{label}</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-600 text-muted mb-1">Product</label>
          <select className={inputCls} value={form.product} onChange={(e) => handleProductChange(e.target.value)}>
            <option value="">Select</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-600 text-muted mb-1">Variant</label>
          <select className={inputCls} value={form.variant} onChange={(e) => onChange({ variant: e.target.value })}>
            {selectedProduct?.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Age" value={form.age} onChange={(v) => onChange({ age: v })} />
          <MiniField label="Dependents" value={form.no_of_dependents} onChange={(v) => onChange({ no_of_dependents: v })} />
        </div>

        <div>
          <label className="block text-xs font-600 text-muted mb-1">Employment</label>
          <select
            className={inputCls}
            value={form.employment_type}
            onChange={(e) => onChange({ employment_type: e.target.value as EmploymentType })}
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Years in job" value={form.years_in_job} onChange={(v) => onChange({ years_in_job: v })} />
          <MiniField label="Annual income" value={form.income_annum} onChange={(v) => onChange({ income_annum: v })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Existing EMI/mo" value={form.existing_emi_monthly} onChange={(v) => onChange({ existing_emi_monthly: v })} />
          <MiniField label="Loan amount" value={form.loan_amount} onChange={(v) => onChange({ loan_amount: v })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Tenure (months)" value={form.tenure_months} onChange={(v) => onChange({ tenure_months: v })} />
          <MiniField label="Interest rate %" value={form.annual_rate} onChange={(v) => onChange({ annual_rate: v })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="CIBIL score" value={form.cibil_score} onChange={(v) => onChange({ cibil_score: v })} disabled={form.no_credit_history} />
          <div className="flex items-end pb-1">
            <label className="flex items-center gap-1.5 text-xs text-ink cursor-pointer">
              <input
                type="checkbox"
                checked={form.no_credit_history}
                onChange={(e) => onChange({ no_credit_history: e.target.checked, cibil_score: e.target.checked ? "" : form.cibil_score })}
                className="h-4 w-4 accent-brand"
              />
              No credit history
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Existing loans" value={form.existing_loans_count} onChange={(v) => onChange({ existing_loans_count: v })} />
          <MiniField label="Outstanding debt" value={form.outstanding_debt} onChange={(v) => onChange({ outstanding_debt: v })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Credit history yrs" value={form.credit_history_years} onChange={(v) => onChange({ credit_history_years: v })} />
          <MiniField label="New loans 12m" value={form.new_loans_12m} onChange={(v) => onChange({ new_loans_12m: v })} />
        </div>

        <div>
          <label className="block text-xs font-600 text-muted mb-1">Overdue now?</label>
          <div className="flex h-11 items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={!form.overdue_now} onChange={() => onChange({ overdue_now: false })} className="accent-brand" />
              No
            </label>
            <label className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input type="radio" checked={form.overdue_now} onChange={() => onChange({ overdue_now: true })} className="accent-brand" />
              Yes
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Residential assets" value={form.residential_assets_value} onChange={(v) => onChange({ residential_assets_value: v })} />
          <MiniField label="Commercial assets" value={form.commercial_assets_value} onChange={(v) => onChange({ commercial_assets_value: v })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MiniField label="Luxury assets" value={form.luxury_assets_value} onChange={(v) => onChange({ luxury_assets_value: v })} />
          <MiniField label="Bank deposits" value={form.bank_asset_value} onChange={(v) => onChange({ bank_asset_value: v })} />
        </div>
      </div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-600 text-muted mb-1">{label}</label>
      <input
        className={inputCls}
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function DecisionPill({ decision }: { decision: string }) {
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
    <span className={`inline-block rounded-md border px-2.5 py-1 text-xs font-700 ${styles[decision]}`}>
      {labels[decision]}
    </span>
  );
}

function ResultColumn({
  label,
  result,
  loading,
  error,
  accentColor,
}: {
  label: string;
  result: SimulateResult | null;
  loading: boolean;
  error: string | null;
  accentColor: string;
}) {
  return (
    <div className="rounded-card border border-cardborder bg-white p-5" style={{ borderTopColor: accentColor, borderTopWidth: "3px" }}>
      <h4 className="font-archivo font-700 text-sm text-ink mb-3">{label}</h4>
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted py-4">
          <Spinner className="text-brand" /> Simulating…
        </div>
      )}
      {error && <ErrorBox message={error} />}
      {result && !loading && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <DecisionPill decision={result.decision} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-xs text-muted">Approval</p>
              <p className="font-archivo font-700 text-lg text-ink">
                {result.approval_probability != null ? formatPct(result.approval_probability) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">EMI burden</p>
              <p className="font-archivo font-700 text-lg text-ink">
                {result.foir != null ? formatPct(result.foir) : "—"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted">Monthly EMI</p>
              <p className="font-archivo font-700 text-lg text-ink">
                {result.emi_estimate != null ? formatINR(result.emi_estimate) : "—"}
              </p>
            </div>
          </div>
          {result.reasons.length > 0 && (
            <ul className="space-y-1 text-xs text-ink">
              {result.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function getDifferingFields(a: FormState, b: FormState): (keyof FormState)[] {
  const keys = Object.keys(a) as (keyof FormState)[];
  return keys.filter((k) => a[k] !== b[k]);
}

function findMatchingChecks(a: RuleCheck[] | undefined, b: RuleCheck[] | undefined): { check: RuleCheck; aStatus: string; bStatus: string; differs: boolean }[] {
  if (!a || !b) return [];
  const map = new Map<string, RuleCheck>();
  b.forEach((c) => map.set(c.label, c));
  return a.map((c) => {
    const bCheck = map.get(c.label);
    const bStatus = bCheck?.status ?? "—";
    const differs = bCheck != null && bCheck.status !== c.status;
    return { check: c, aStatus: c.status, bStatus, differs };
  });
}

export function Compare({ products }: { products: Product[] }) {
  const [formA, setFormA] = useState<FormState>({ ...BASE_SAMPLE });
  const [formB, setFormB] = useState<FormState>({ ...BASE_SAMPLE, cibil_score: "700" });
  const [resultA, setResultA] = useState<SimulateResult | null>(null);
  const [resultB, setResultB] = useState<SimulateResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState<string | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  const setA = useCallback((patch: Partial<FormState>) => setFormA((p) => ({ ...p, ...patch })), []);
  const setB = useCallback((patch: Partial<FormState>) => setFormB((p) => ({ ...p, ...patch })), []);

  function copyAToB() {
    setFormB({ ...formA });
  }

  function presetCibil() {
    const base = { ...BASE_SAMPLE };
    setFormA({ ...base, cibil_score: "699" });
    setFormB({ ...base, cibil_score: "700" });
    setResultA(null);
    setResultB(null);
  }

  async function handleCompare() {
    setLoadingA(true);
    setLoadingB(true);
    setErrorA(null);
    setErrorB(null);
    setResultA(null);
    setResultB(null);

    const bodyA = buildSimulateBody(formA);
    const bodyB = buildSimulateBody(formB);

    try {
      const res = await postSimulate(bodyA);
      setResultA(res);
    } catch {
      setErrorA("Could not simulate applicant A. Please try again.");
    } finally {
      setLoadingA(false);
    }

    try {
      const res = await postSimulate(bodyB);
      setResultB(res);
    } catch {
      setErrorB("Could not simulate applicant B. Please try again.");
    } finally {
      setLoadingB(false);
    }
  }

  const differingInputs = getDifferingFields(formA, formB);
  const matchingChecks = findMatchingChecks(resultA?.rule_checks, resultB?.rule_checks);
  const differingChecks = matchingChecks.filter((c) => c.differs);

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-archivo font-700 text-lg text-ink">Compare applicants</h2>
            <p className="mt-0.5 text-sm text-muted">Test stability across two profiles</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={copyAToB}
              className="inline-flex min-h-[40px] items-center justify-center rounded-btn border border-cardborder bg-white px-3 text-sm font-600 text-ink hover:border-muted"
            >
              Copy A to B
            </button>
            <button
              type="button"
              onClick={presetCibil}
              className="inline-flex min-h-[40px] items-center justify-center rounded-btn border border-cardborder bg-white px-3 text-sm font-600 text-ink hover:border-muted"
            >
              CIBIL 699 vs 700
            </button>
          </div>
        </div>
      </div>

      {/* Side-by-side forms */}
      <div className="grid gap-4 md:grid-cols-2">
        <ApplicantForm label="Applicant A" products={products} form={formA} onChange={setA} accentColor="#1E4FD8" />
        <ApplicantForm label="Applicant B" products={products} form={formB} onChange={setB} accentColor="#047857" />
      </div>

      {/* Compare button */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={handleCompare}
          disabled={loadingA || loadingB}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-brand px-6 font-archivo font-700 text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {(loadingA || loadingB) ? (
            <>
              <Spinner /> Comparing…
            </>
          ) : (
            "Compare"
          )}
        </button>
      </div>

      {/* Differing inputs */}
      {differingInputs.length > 0 && (
        <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
          <h3 className="font-archivo font-700 text-sm text-ink">Fields that differ</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {differingInputs.map((field) => (
              <span key={field} className="inline-block rounded-md bg-brand-50 border border-brand/30 px-2 py-1 text-xs font-600 text-brand-700">
                {FIELD_LABELS[field as string] || field}: {String(formA[field])} vs {String(formB[field])}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side results */}
      {(resultA || resultB || loadingA || loadingB) && (
        <div className="grid gap-4 md:grid-cols-2">
          <ResultColumn label="Applicant A" result={resultA} loading={loadingA} error={errorA} accentColor="#1E4FD8" />
          <ResultColumn label="Applicant B" result={resultB} loading={loadingB} error={errorB} accentColor="#047857" />
        </div>
      )}

      {/* Rule checks comparison */}
      {resultA && resultB && differingChecks.length > 0 && (
        <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
          <h3 className="font-archivo font-700 text-sm text-ink">Policy checks that differ</h3>
          <div className="mt-3 divide-y divide-cardborder">
            {differingChecks.map((c, i) => (
              <div key={i} className="py-3">
                <p className="text-sm font-600 text-ink">{c.check.label}</p>
                <div className="mt-1 flex items-center gap-4 text-sm">
                  <span className="text-brand font-600">A:</span>
                  <StatusMarker status={c.aStatus as "pass" | "review" | "fail"} />
                  <span className="text-muted">|</span>
                  <span className="text-approve font-600">B:</span>
                  <StatusMarker status={c.bStatus as "pass" | "review" | "fail"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All rule checks side by side */}
      {resultA && resultB && (
        <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
          <h3 className="font-archivo font-700 text-sm text-ink">All policy checks</h3>
          <div className="mt-3 divide-y divide-cardborder">
            {matchingChecks.map((c, i) => (
              <div key={i} className={`py-3 ${c.differs ? "bg-brand-50/50 -mx-2 px-2 rounded-btn" : ""}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-600 text-ink">{c.check.label}</p>
                  {c.differs && (
                    <span className="text-xs font-600 text-brand">Differs</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm">
                  <span className="text-brand font-600 text-xs">A:</span>
                  <StatusMarker status={c.aStatus as "pass" | "review" | "fail"} />
                  <span className="text-muted">|</span>
                  <span className="text-approve font-600 text-xs">B:</span>
                  <StatusMarker status={c.bStatus as "pass" | "review" | "fail"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
