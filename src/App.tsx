import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Product, FormState, ScoreResult, ScoreBody, TabKey } from "./types";
import { getHealth, getProducts, postScore, getApplication, getReviewQueue } from "./api";
import { generateRequestId, num } from "./utils";
import {
  LoanForm,
  EMPTY_FORM,
  SAMPLE_APPLICANT,
  BORDERLINE_APPLICANT,
  validateForm,
  type ValidationErrors,
} from "./components/LoanForm";
import { ResultPanel } from "./components/ResultPanel";
import { Header, Footer, AboutSection } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { ReviewQueue } from "./components/ReviewQueue";
import { Batch } from "./components/Batch";
import { Compare } from "./components/Compare";
import { Assistant } from "./components/Assistant";
import { ModelCard } from "./components/ModelCard";
import { Spinner } from "./components/ui";

type HealthState = "checking" | "waking" | "ready" | "unavailable";
type ProductsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; products: Product[] };

const DRAFT_KEY = "patrata_draft";
const REQUEST_ID_KEY = "patrata_request_id";
const LAST_FORM_KEY = "patrata_last_form";
const TAB_KEY = "patrata_tab";

function loadDraft(): FormState {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) return { ...EMPTY_FORM, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return EMPTY_FORM;
}

function saveDraft(form: FormState) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  } catch {
    /* ignore */
  }
}

function getRequestId(): string {
  try {
    return localStorage.getItem(REQUEST_ID_KEY) || "";
  } catch {
    return "";
  }
}

function setRequestId(id: string) {
  try {
    localStorage.setItem(REQUEST_ID_KEY, id);
  } catch {
    /* ignore */
  }
}

function getLastForm(): string {
  try {
    return localStorage.getItem(LAST_FORM_KEY) || "";
  } catch {
    return "";
  }
}

function setLastForm(form: FormState) {
  try {
    localStorage.setItem(LAST_FORM_KEY, JSON.stringify(form));
  } catch {
    /* ignore */
  }
}

function formSignature(form: FormState): string {
  return JSON.stringify(form);
}

function loadInitialTab(): TabKey {
  try {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (
      tab === "check" ||
      tab === "dashboard" ||
      tab === "review" ||
      tab === "batch" ||
      tab === "compare" ||
      tab === "assistant" ||
      tab === "model"
    ) {
      return tab;
    }
    const t = localStorage.getItem(TAB_KEY);
    if (
      t === "check" ||
      t === "dashboard" ||
      t === "review" ||
      t === "batch" ||
      t === "compare" ||
      t === "assistant" ||
      t === "model"
    )
      return t;
  } catch {
    /* ignore */
  }
  return "check";
}

function buildScoreBody(form: FormState, requestId: string): ScoreBody {
  const product = form.product;
  const cibil = form.no_credit_history ? null : form.cibil_score ? num(form.cibil_score) : null;
  return {
    variant: form.variant,
    request_id: requestId,
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
    asset_price:
      product === "consumer" || product === "vehicle" ? num(form.asset_price) : null,
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

const FIELD_FOCUS_ORDER = [
  "product",
  "variant",
  "age",
  "no_of_dependents",
  "employment_type",
  "years_in_job",
  "income_annum",
  "existing_emi_monthly",
  "loan_amount",
  "tenure_months",
  "property_value",
  "asset_price",
  "annual_rate",
  "cibil_score",
  "existing_loans_count",
  "outstanding_debt",
  "credit_history_years",
  "new_loans_12m",
  "residential_assets_value",
  "commercial_assets_value",
  "luxury_assets_value",
  "bank_asset_value",
];

export default function App() {
  const [health, setHealth] = useState<HealthState>("checking");
  const [productsState, setProductsState] = useState<ProductsState>({ status: "loading" });
  const [activeTab, setActiveTab] = useState<TabKey>(loadInitialTab);
  const [reviewCount, setReviewCount] = useState(0);

  // Check tab state
  const [form, setForm] = useState<FormState>(loadDraft);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [apiErrors, setApiErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);
  const [expiredResult, setExpiredResult] = useState(false);

  const resultRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef<string>(getRequestId());
  const lastFormRef = useRef<string>(getLastForm());

  // --- Health check ---
  useEffect(() => {
    let elapsed = 0;
    let cancelled = false;

    async function check() {
      try {
        await getHealth();
        if (!cancelled) setHealth("ready");
      } catch {
        if (cancelled) return;
        if (elapsed === 0) setHealth("waking");
        elapsed += 5;
        if (elapsed >= 90) {
          setHealth("unavailable");
        } else {
          setTimeout(check, 5000);
        }
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Fetch products when healthy ---
  useEffect(() => {
    if (health !== "ready") return;
    let cancelled = false;
    setProductsState({ status: "loading" });
    getProducts()
      .then((data) => {
        if (!cancelled) setProductsState({ status: "ready", products: data.products });
      })
      .catch(() => {
        if (!cancelled) setProductsState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [health]);

  // --- Fetch review count for badge ---
  useEffect(() => {
    if (health !== "ready") return;
    let cancelled = false;
    getReviewQueue()
      .then((items) => {
        if (!cancelled) setReviewCount(items.length);
      })
      .catch(() => {
        /* badge is non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, [health, activeTab]);

  // --- Save draft on form change ---
  useEffect(() => {
    saveDraft(form);
  }, [form]);

  // --- Save tab to localStorage and sync URL ---
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab]);

  // --- Popstate listener for back/forward browser navigation ---
  useEffect(() => {
    function handlePopState() {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") as TabKey | null;
      if (
        tab === "dashboard" ||
        tab === "review" ||
        tab === "batch" ||
        tab === "compare" ||
        tab === "assistant" ||
        tab === "model" ||
        tab === "check"
      ) {
        setActiveTab(tab);
      } else {
        setActiveTab("check");
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // --- Load result from URL ?id on Check tab ---
  useEffect(() => {
    if (health !== "ready") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const tab = params.get("tab");
    if (!id || tab === "review") return;
    setResultLoading(true);
    setResultError(null);
    setExpiredResult(false);
    getApplication(id)
      .then((res) => {
        setResult(res);
      })
      .catch((err) => {
        if (err?.message?.includes("404") || err?.message?.includes("failed")) {
          setExpiredResult(true);
        } else {
          setResultError("Could not load this result. Please try again.");
        }
      })
      .finally(() => setResultLoading(false));
  }, [health]);

  // --- Scroll to result when it appears ---
  useEffect(() => {
    if (result && !resultLoading && activeTab === "check") {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [result, resultLoading, activeTab]);

  // --- Auto-trigger print if ?print=1 in URL and result is loaded ---
  useEffect(() => {
    if (!result || resultLoading) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("print") === "1") {
      const timer = setTimeout(() => {
        window.print();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [result, resultLoading]);

  const products = useMemo(
    () => (productsState.status === "ready" ? productsState.products : []),
    [productsState]
  );

  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === "check") {
      url.searchParams.delete("tab");
      // Keep ?id= if we have a current check result
      if (result) {
        url.searchParams.set("id", result.id);
      }
    } else {
      url.searchParams.set("tab", tab);
      if (tab !== "review") {
        url.searchParams.delete("id");
      }
    }
    window.history.pushState({}, "", url.toString());
  }

  function openApplication(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete("tab");
    url.searchParams.set("id", id);
    window.history.pushState({}, "", url.toString());
    setActiveTab("check");
    setResultLoading(true);
    setResultError(null);
    setExpiredResult(false);
    getApplication(id)
      .then((res) => {
        setResult(res);
      })
      .catch((err) => {
        if (err?.message?.includes("404") || err?.message?.includes("failed")) {
          setExpiredResult(true);
        } else {
          setResultError("Could not load this result. Please try again.");
        }
      })
      .finally(() => setResultLoading(false));
  }

  function handleChange(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
    setApiErrors({});
    setSubmitError(null);
  }

  function loadSample() {
    setForm({
      ...EMPTY_FORM,
      ...SAMPLE_APPLICANT,
      product: "personal",
      variant: "pl_salaried",
    });
    setErrors({});
    setApiErrors({});
  }

  function loadBorderline() {
    setForm({
      ...EMPTY_FORM,
      ...BORDERLINE_APPLICANT,
      product: "personal",
      variant: "pl_salaried",
    });
    setErrors({});
    setApiErrors({});
  }

  function startOver() {
    setForm(EMPTY_FORM);
    setErrors({});
    setApiErrors({});
    setResult(null);
    setSubmitError(null);
    setExpiredResult(false);
    requestIdRef.current = generateRequestId();
    setRequestId(requestIdRef.current);
    lastFormRef.current = "";
    setLastForm(EMPTY_FORM);
    try {
      localStorage.removeItem(LAST_FORM_KEY);
    } catch {
      /* ignore */
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url.toString());
  }

  const focusFirstError = useCallback((errorMap: Record<string, string>) => {
    const firstField = FIELD_FOCUS_ORDER.find((f) => errorMap[f]) || Object.keys(errorMap)[0];
    if (firstField) {
      setTimeout(() => {
        const el = document.getElementById(firstField);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 50);
    }
  }, []);

  async function handleSubmit() {
    const validationErrors = validateForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      focusFirstError(validationErrors);
      return;
    }

    const sig = formSignature(form);
    if (lastFormRef.current !== sig) {
      requestIdRef.current = generateRequestId();
      setRequestId(requestIdRef.current);
      lastFormRef.current = sig;
      setLastForm(form);
    }

    setSubmitting(true);
    setSubmitError(null);
    setApiErrors({});

    try {
      const body = buildScoreBody(form, requestIdRef.current);
      const res = await postScore(body);
      setResult(res);
      const url = new URL(window.location.href);
      url.searchParams.delete("tab");
      url.searchParams.set("id", res.id);
      window.history.replaceState({}, "", url.toString());
    } catch (err: unknown) {
      const apiErr = err as { status?: number; errors?: { field: string; message: string }[]; message?: string };
      if (apiErr?.status === 422 && apiErr?.errors) {
        const fieldErrors: Record<string, string> = {};
        for (const e of apiErr.errors) {
          fieldErrors[e.field] = e.message;
        }
        setApiErrors(fieldErrors);
        focusFirstError(fieldErrors);
      } else {
        setSubmitError("Could not reach the Patrata engine. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleCheckWith(amount: number, termMonths: number) {
    setForm((prev) => ({
      ...prev,
      loan_amount: String(amount),
      tenure_months: String(termMonths),
    }));
    requestIdRef.current = generateRequestId();
    setRequestId(requestIdRef.current);
    lastFormRef.current = "";
    setLastForm(EMPTY_FORM);
    setResult(null);
    setTimeout(() => {
      const updatedForm = { ...form, loan_amount: String(amount), tenure_months: String(termMonths) };
      const validationErrors = validateForm(updatedForm);
      setErrors(validationErrors);
      if (Object.keys(validationErrors).length > 0) {
        focusFirstError(validationErrors);
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      const body = buildScoreBody(updatedForm, requestIdRef.current);
      postScore(body)
        .then((res) => {
          setResult(res);
          const url = new URL(window.location.href);
          url.searchParams.delete("tab");
          url.searchParams.set("id", res.id);
          window.history.replaceState({}, "", url.toString());
          lastFormRef.current = formSignature(updatedForm);
          setLastForm(updatedForm);
        })
        .catch((err: unknown) => {
          const apiErr = err as { status?: number; errors?: { field: string; message: string }[]; message?: string };
          if (apiErr?.status === 422 && apiErr?.errors) {
            const fieldErrors: Record<string, string> = {};
            for (const e of apiErr.errors) {
              fieldErrors[e.field] = e.message;
            }
            setApiErrors(fieldErrors);
            focusFirstError(fieldErrors);
          } else {
            setSubmitError("Could not reach the Patrata engine. Please try again.");
          }
        })
        .finally(() => setSubmitting(false));
    }, 0);
  }

  // --- Shared wrapper for non-ready states ---
  if (health === "checking") {
    return (
      <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
        <Header activeTab={activeTab} onTabChange={handleTabChange} reviewCount={reviewCount} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="flex items-center gap-3 text-muted">
            <Spinner className="text-brand" />
            <span className="text-sm">Connecting to Patrata engine…</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (health === "waking") {
    return (
      <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
        <Header activeTab={activeTab} onTabChange={handleTabChange} reviewCount={reviewCount} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-card border border-cardborder bg-white p-6 text-center">
            <Spinner className="mx-auto text-brand" />
            <p className="mt-3 text-sm text-ink font-600">Waking up the Patrata engine.</p>
            <p className="mt-1 text-sm text-muted">The first check can take up to a minute.</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (health === "unavailable") {
    return (
      <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
        <Header activeTab={activeTab} onTabChange={handleTabChange} reviewCount={reviewCount} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-card border border-cardborder bg-white p-6 text-center">
            <p className="font-archivo font-700 text-lg text-ink">Engine unavailable</p>
            <p className="mt-2 text-sm text-muted">The Patrata engine could not be reached.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-btn bg-brand px-5 font-archivo font-700 text-white hover:bg-brand-600"
            >
              Try again
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // health === "ready"
  return (
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
      <Header activeTab={activeTab} onTabChange={handleTabChange} reviewCount={reviewCount} />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* CHECK TAB */}
        {activeTab === "check" && (
          <>
            {productsState.status === "loading" && (
              <div className="rounded-card border border-cardborder bg-white p-6">
                <Spinner className="text-brand" />
                <span className="ml-2 text-sm text-muted">Loading loan products…</span>
              </div>
            )}

            {productsState.status === "error" && (
              <div className="rounded-card border border-cardborder bg-white p-6">
                <p className="text-sm text-decline font-600">Could not load loan products.</p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-2 text-sm font-600 text-brand hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {productsState.status === "ready" && (
              <>
                <LoanForm
                  products={products}
                  form={form}
                  errors={errors}
                  apiErrors={apiErrors}
                  onChange={handleChange}
                  onLoadSample={loadSample}
                  onLoadBorderline={loadBorderline}
                  onStartOver={startOver}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                />

                {submitError && (
                  <div className="mt-4 rounded-card border border-cardborder bg-white p-4">
                    <p className="text-sm text-decline font-600">{submitError}</p>
                    <button
                      onClick={handleSubmit}
                      className="mt-2 text-sm font-600 text-brand hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                )}

                <div ref={resultRef} className="mt-6">
                  {resultLoading && (
                    <div className="rounded-card border border-cardborder bg-white p-6">
                      <Spinner className="text-brand" />
                      <span className="ml-2 text-sm text-muted">Loading result…</span>
                    </div>
                  )}

                  {resultError && (
                    <div className="rounded-card border border-cardborder bg-white p-4">
                      <p className="text-sm text-decline font-600">{resultError}</p>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-2 text-sm font-600 text-brand hover:underline"
                      >
                        Try again
                      </button>
                    </div>
                  )}

                  {expiredResult && (
                    <div className="rounded-card border border-cardborder bg-white p-5 text-center">
                      <p className="text-sm text-muted">
                        This demo result has expired. Run the check again.
                      </p>
                    </div>
                  )}

                  {result && <ResultPanel result={result} onCheckWith={handleCheckWith} />}
                </div>
              </>
            )}
          </>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === "dashboard" && <Dashboard onOpenApplication={openApplication} />}

        {/* REVIEW TAB */}
        {activeTab === "review" && <ReviewQueue />}

        {/* BATCH TAB */}
        {activeTab === "batch" && <Batch />}

        {/* COMPARE TAB */}
        {activeTab === "compare" && <Compare products={products} />}

        {/* ASSISTANT TAB */}
        {activeTab === "assistant" && <Assistant />}

        {/* MODEL TAB */}
        {activeTab === "model" && <ModelCard />}

        {/* ABOUT PATRATA AND YOUR DATA */}
        <AboutSection modelVersion={result?.model_version} />
      </main>
      <Footer />
    </div>
  );
}
