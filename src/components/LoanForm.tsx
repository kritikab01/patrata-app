import { useMemo } from "react";
import type { Product, FormState, EmploymentType } from "../types";
import { num } from "../utils";

export const SAMPLE_APPLICANT: Partial<FormState> = {
  product: "personal",
  variant: "pl_salaried",
  age: "32",
  no_of_dependents: "1",
  employment_type: "salaried",
  years_in_job: "5",
  income_annum: "1200000",
  existing_emi_monthly: "8000",
  loan_amount: "500000",
  property_value: "",
  asset_price: "",
  tenure_months: "36",
  annual_rate: "12",
  cibil_score: "760",
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

export const BORDERLINE_APPLICANT: Partial<FormState> = {
  ...SAMPLE_APPLICANT,
  cibil_score: "690",
};

export const EMPTY_FORM: FormState = {
  product: "",
  variant: "",
  age: "",
  no_of_dependents: "0",
  employment_type: "salaried",
  years_in_job: "0",
  income_annum: "",
  existing_emi_monthly: "0",
  loan_amount: "",
  property_value: "",
  asset_price: "",
  tenure_months: "",
  annual_rate: "",
  cibil_score: "",
  no_credit_history: false,
  existing_loans_count: "0",
  outstanding_debt: "0",
  credit_history_years: "0",
  new_loans_12m: "0",
  overdue_now: false,
  residential_assets_value: "0",
  commercial_assets_value: "0",
  luxury_assets_value: "0",
  bank_asset_value: "0",
};

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "salaried", label: "Salaried" },
  { value: "self_employed", label: "Self-employed" },
  { value: "government", label: "Government" },
  { value: "pensioner", label: "Pensioner" },
  { value: "not_employed", label: "Not employed" },
];

export type ValidationErrors = Record<string, string>;

export function validateForm(form: FormState): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!form.product) errors.product = "Select a loan product";
  if (!form.variant) errors.variant = "Select a loan variant";

  const age = num(form.age);
  if (!form.age) errors.age = "Age is required";
  else if (age < 18 || age > 75) errors.age = "Age must be between 18 and 75";

  if (!form.income_annum) errors.income_annum = "Annual income is required";
  else if (num(form.income_annum) < 0) errors.income_annum = "Income must be 0 or more";

  if (!form.loan_amount) errors.loan_amount = "Loan amount is required";
  else if (num(form.loan_amount) < 0) errors.loan_amount = "Amount must be 0 or more";

  const product = form.product;
  if (product === "home") {
    if (!form.property_value) errors.property_value = "Property value is required";
    else if (num(form.property_value) < 0) errors.property_value = "Must be 0 or more";
  }
  if (product === "consumer" || product === "vehicle") {
    if (!form.asset_price) errors.asset_price = "On-road price is required";
    else if (num(form.asset_price) < 0) errors.asset_price = "Must be 0 or more";
  }

  const tenure = num(form.tenure_months);
  if (!form.tenure_months) errors.tenure_months = "Tenure is required";
  else if (tenure < 6 || tenure > 360) errors.tenure_months = "Tenure must be 6–360 months";

  if (!form.annual_rate) errors.annual_rate = "Interest rate is required";
  else if (num(form.annual_rate) < 0) errors.annual_rate = "Must be 0 or more";

  if (!form.no_credit_history && form.cibil_score) {
    const cibil = num(form.cibil_score);
    if (cibil < 300 || cibil > 900) errors.cibil_score = "CIBIL must be 300–900";
  }

  return errors;
}

function Field({
  id,
  label,
  error,
  children,
  hint,
}: {
  id?: string;
  label: string;
  error?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-600 text-ink mb-1">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-decline font-500">{error}</p>}
    </div>
  );
}

const inputCls =
  "w-full h-11 rounded-btn border border-cardborder bg-white px-3 text-sm text-ink placeholder:text-muted/60";

export function LoanForm({
  products,
  form,
  errors,
  onChange,
  onLoadSample,
  onLoadBorderline,
  onStartOver,
  onSubmit,
  submitting,
  apiErrors,
}: {
  products: Product[];
  form: FormState;
  errors: ValidationErrors;
  onChange: (patch: Partial<FormState>) => void;
  onLoadSample: () => void;
  onLoadBorderline: () => void;
  onStartOver: () => void;
  onSubmit: () => void;
  submitting: boolean;
  apiErrors: Record<string, string>;
}) {
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === form.product),
    [products, form.product]
  );

  const productType = form.product;

  function handleProductChange(id: string) {
    const product = products.find((p) => p.id === id);
    onChange({ product: id, variant: product?.variants[0]?.id ?? "" });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-5"
    >
      {/* Section 1: Loan product */}
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
        <h2 className="font-archivo font-700 text-lg text-ink">Loan product</h2>
        <p className="mt-0.5 text-sm text-muted">Choose what you're borrowing for</p>

        <div className="mt-4">
          <Field id="product" label="Product" error={errors.product || apiErrors.product}>
            <select
              id="product"
              className={inputCls}
              value={form.product}
              onChange={(e) => handleProductChange(e.target.value)}
            >
              <option value="">Select a product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {selectedProduct && (
          <div className="mt-4" id="variant">
            <p className="text-sm font-600 text-ink mb-2">Variants</p>
            {errors.variant && <p className="mb-2 text-xs text-decline font-500">{errors.variant}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {selectedProduct.variants.map((v) => {
                const selected = form.variant === v.id;
                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => onChange({ variant: v.id })}
                    className={`text-left rounded-btn border p-4 transition-colors ${
                      selected
                        ? "border-brand bg-brand-50"
                        : "border-cardborder bg-white hover:border-muted"
                    }`}
                  >
                    <p className="font-archivo font-700 text-sm text-ink">{v.name}</p>
                    <p className="mt-1 text-xs text-muted">{v.for}</p>
                    {v.features.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {v.features.map((f, i) => (
                          <span
                            key={i}
                            className="inline-block rounded-md bg-page px-2 py-0.5 text-[11px] font-500 text-muted"
                          >
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">{selectedProduct.summary}</p>
          </div>
        )}
      </div>

      {/* Section 2: Applicant */}
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
        <h2 className="font-archivo font-700 text-lg text-ink">Applicant</h2>
        <p className="mt-0.5 text-sm text-muted">Tell us about the borrower</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="age" label="Age" error={errors.age || apiErrors.age}>
            <input
              id="age"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.age}
              onChange={(e) => onChange({ age: e.target.value })}
              placeholder="e.g. 32"
            />
          </Field>

          <Field id="no_of_dependents" label="No. of dependents" error={apiErrors.no_of_dependents}>
            <input
              id="no_of_dependents"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.no_of_dependents}
              onChange={(e) => onChange({ no_of_dependents: e.target.value })}
            />
          </Field>

          <Field id="employment_type" label="Employment type" error={apiErrors.employment_type}>
            <select
              id="employment_type"
              className={inputCls}
              value={form.employment_type}
              onChange={(e) =>
                onChange({ employment_type: e.target.value as EmploymentType })
              }
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="years_in_job" label="Years in current job" error={apiErrors.years_in_job}>
            <input
              id="years_in_job"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.years_in_job}
              onChange={(e) => onChange({ years_in_job: e.target.value })}
            />
          </Field>

          <Field id="income_annum" label="Annual income" error={errors.income_annum || apiErrors.income_annum}>
            <input
              id="income_annum"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.income_annum}
              onChange={(e) => onChange({ income_annum: e.target.value })}
              placeholder="₹ per year"
            />
          </Field>

          <Field id="existing_emi_monthly" label="Existing monthly EMI" error={apiErrors.existing_emi_monthly}>
            <input
              id="existing_emi_monthly"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.existing_emi_monthly}
              onChange={(e) => onChange({ existing_emi_monthly: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {/* Section 3: Loan and credit */}
      <div className="rounded-card border border-cardborder bg-white p-5 sm:p-6">
        <h2 className="font-archivo font-700 text-lg text-ink">Loan and credit</h2>
        <p className="mt-0.5 text-sm text-muted">Details of this loan and your credit profile</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="loan_amount" label="Loan amount" error={errors.loan_amount || apiErrors.loan_amount}>
            <input
              id="loan_amount"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.loan_amount}
              onChange={(e) => onChange({ loan_amount: e.target.value })}
              placeholder="₹"
            />
          </Field>

          <Field id="tenure_months" label="Tenure (months)" error={errors.tenure_months || apiErrors.loan_term}>
            <input
              id="tenure_months"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.tenure_months}
              onChange={(e) => onChange({ tenure_months: e.target.value })}
              placeholder="6–360"
            />
          </Field>

          {productType === "home" && (
            <Field id="property_value" label="Property value" error={errors.property_value || apiErrors.property_value}>
              <input
                id="property_value"
                className={inputCls}
                type="number"
                inputMode="numeric"
                value={form.property_value}
                onChange={(e) => onChange({ property_value: e.target.value })}
                placeholder="₹"
              />
            </Field>
          )}

          {(productType === "consumer" || productType === "vehicle") && (
            <Field
              id="asset_price"
              label={productType === "vehicle" ? "On-road price" : "Asset price"}
              error={errors.asset_price || apiErrors.asset_price}
            >
              <input
                id="asset_price"
                className={inputCls}
                type="number"
                inputMode="numeric"
                value={form.asset_price}
                onChange={(e) => onChange({ asset_price: e.target.value })}
                placeholder="₹"
              />
            </Field>
          )}

          <Field id="annual_rate" label="Interest rate (% per year)" error={errors.annual_rate || apiErrors.annual_rate}>
            <input
              id="annual_rate"
              className={inputCls}
              type="number"
              inputMode="decimal"
              step="0.1"
              value={form.annual_rate}
              onChange={(e) => onChange({ annual_rate: e.target.value })}
              placeholder="e.g. 9.5"
            />
          </Field>

          <Field
            id="cibil_score"
            label="CIBIL score"
            error={errors.cibil_score || apiErrors.cibil_score}
            hint={form.no_credit_history ? "No credit history — sent as null" : "300–900"}
          >
            <input
              id="cibil_score"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.cibil_score}
              onChange={(e) => onChange({ cibil_score: e.target.value })}
              placeholder="300–900"
              disabled={form.no_credit_history}
            />
          </Field>

          <div className="flex items-end pb-2">
            <label htmlFor="no_credit_history" className="flex items-center gap-2 text-sm text-ink cursor-pointer">
              <input
                id="no_credit_history"
                type="checkbox"
                checked={form.no_credit_history}
                onChange={(e) =>
                  onChange({
                    no_credit_history: e.target.checked,
                    cibil_score: e.target.checked ? "" : form.cibil_score,
                  })
                }
                className="h-4 w-4 accent-brand"
              />
              No credit history yet
            </label>
          </div>

          <Field id="existing_loans_count" label="Existing loans count" error={apiErrors.existing_loans_count}>
            <input
              id="existing_loans_count"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.existing_loans_count}
              onChange={(e) => onChange({ existing_loans_count: e.target.value })}
            />
          </Field>

          <Field id="outstanding_debt" label="Outstanding debt" error={apiErrors.outstanding_debt}>
            <input
              id="outstanding_debt"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.outstanding_debt}
              onChange={(e) => onChange({ outstanding_debt: e.target.value })}
              placeholder="₹"
            />
          </Field>

          <Field id="credit_history_years" label="Credit history (years)" error={apiErrors.credit_history_years}>
            <input
              id="credit_history_years"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.credit_history_years}
              onChange={(e) => onChange({ credit_history_years: e.target.value })}
            />
          </Field>

          <Field id="new_loans_12m" label="New loans in last 12 months" error={apiErrors.new_loans_12m}>
            <input
              id="new_loans_12m"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.new_loans_12m}
              onChange={(e) => onChange({ new_loans_12m: e.target.value })}
            />
          </Field>

          <div>
            <span className="block text-sm font-600 text-ink mb-1">Any overdue right now?</span>
            <div className="flex h-11 items-center gap-4">
              <label htmlFor="overdue_now_no" className="flex items-center gap-1.5 text-sm cursor-pointer text-ink">
                <input
                  id="overdue_now_no"
                  type="radio"
                  name="overdue"
                  checked={!form.overdue_now}
                  onChange={() => onChange({ overdue_now: false })}
                  className="accent-brand"
                />
                No
              </label>
              <label htmlFor="overdue_now_yes" className="flex items-center gap-1.5 text-sm cursor-pointer text-ink">
                <input
                  id="overdue_now_yes"
                  type="radio"
                  name="overdue"
                  checked={form.overdue_now}
                  onChange={() => onChange({ overdue_now: true })}
                  className="accent-brand"
                />
                Yes
              </label>
            </div>
            {apiErrors.overdue_now && (
              <p className="mt-1 text-xs text-decline font-500">{apiErrors.overdue_now}</p>
            )}
          </div>

          <Field id="residential_assets_value" label="Residential assets value" error={apiErrors.residential_assets_value}>
            <input
              id="residential_assets_value"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.residential_assets_value}
              onChange={(e) => onChange({ residential_assets_value: e.target.value })}
            />
          </Field>

          <Field id="commercial_assets_value" label="Commercial assets value" error={apiErrors.commercial_assets_value}>
            <input
              id="commercial_assets_value"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.commercial_assets_value}
              onChange={(e) => onChange({ commercial_assets_value: e.target.value })}
            />
          </Field>

          <Field id="luxury_assets_value" label="Luxury assets value" error={apiErrors.luxury_assets_value}>
            <input
              id="luxury_assets_value"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.luxury_assets_value}
              onChange={(e) => onChange({ luxury_assets_value: e.target.value })}
            />
          </Field>

          <Field id="bank_asset_value" label="Bank deposits value" error={apiErrors.bank_asset_value}>
            <input
              id="bank_asset_value"
              className={inputCls}
              type="number"
              inputMode="numeric"
              value={form.bank_asset_value}
              onChange={(e) => onChange({ bank_asset_value: e.target.value })}
            />
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <button
            type="button"
            onClick={onLoadSample}
            className="text-sm font-600 text-brand hover:underline"
          >
            Load sample applicant
          </button>
          <button
            type="button"
            onClick={onLoadBorderline}
            className="text-sm font-600 text-brand hover:underline"
          >
            Load borderline case
          </button>
          <button
            type="button"
            onClick={onStartOver}
            className="text-sm font-600 text-muted hover:text-ink"
          >
            Start over
          </button>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-btn bg-brand px-6 font-archivo font-700 text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          {submitting ? (
            <>
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking…
            </>
          ) : (
            "Check eligibility"
          )}
        </button>
      </div>
    </form>
  );
}
