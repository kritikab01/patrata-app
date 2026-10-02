import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type {
  Product,
  FormState,
  ScoreResult,
  ScoreBody,
  AppMode,
  BorrowerTabKey,
  DeskTabKey,
} from "./types";
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
import {
  BorrowerHeader,
  BorrowerBottomBar,
  DeskSidebar,
  DeskMobileHeader,
  AboutModal,
  Footer,
} from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { ReviewQueue } from "./components/ReviewQueue";
import { Batch } from "./components/Batch";
import { Compare } from "./components/Compare";
import { Assistant } from "./components/Assistant";
import { ModelCard } from "./components/ModelCard";
import { HomeTab } from "./components/HomeTab";
import { Spinner } from "./components/ui";
import { Icon } from "./components/viz";

type HealthState = "checking" | "waking" | "ready" | "unavailable";
type ProductsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; products: Product[] };

const DRAFT_KEY = "patrata_draft";
const REQUEST_ID_KEY = "patrata_request_id";
const LAST_FORM_KEY = "patrata_last_form";

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

function parseNavigationFromUrl(): {
  mode: AppMode;
  borrowerTab: BorrowerTabKey;
  deskTab: DeskTabKey;
} {
  try {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get("mode");
    const tabParam = params.get("tab");
    const idParam = params.get("id");

    const deskTabs: DeskTabKey[] = ["dashboard", "review", "batch", "compare", "model"];
    const borrowerTabs: BorrowerTabKey[] = ["home", "check", "tools", "checks", "help"];

    // Backward compatibility: old direct links like ?tab=dashboard open desk
    if (tabParam && deskTabs.includes(tabParam as DeskTabKey)) {
      return {
        mode: "desk",
        borrowerTab: "check",
        deskTab: tabParam as DeskTabKey,
      };
    }

    if (modeParam === "desk") {
      const validDeskTab =
        tabParam && deskTabs.includes(tabParam as DeskTabKey)
          ? (tabParam as DeskTabKey)
          : "dashboard";
      return {
        mode: "desk",
        borrowerTab: "check",
        deskTab: validDeskTab,
      };
    }

    // Default to Borrower app mode
    let bTab: BorrowerTabKey = "home";
    if (tabParam === "assistant") {
      bTab = "help";
    } else if (tabParam && borrowerTabs.includes(tabParam as BorrowerTabKey)) {
      bTab = tabParam as BorrowerTabKey;
    } else if (idParam) {
      bTab = "check";
    }

    return {
      mode: "borrower",
      borrowerTab: bTab,
      deskTab: "dashboard",
    };
  } catch {
    return {
      mode: "borrower",
      borrowerTab: "home",
      deskTab: "dashboard",
    };
  }
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
  const initialNav = useMemo(parseNavigationFromUrl, []);
  const [mode, setMode] = useState<AppMode>(initialNav.mode);
  const [borrowerTab, setBorrowerTab] = useState<BorrowerTabKey>(initialNav.borrowerTab);
  const [deskTab, setDeskTab] = useState<DeskTabKey>(initialNav.deskTab);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [aboutOpen, setAboutOpen] = useState(false);
  const [assistantInitialQuestion, setAssistantInitialQuestion] = useState<string | undefined>(undefined);

  const [health, setHealth] = useState<HealthState>("checking");
  const [productsState, setProductsState] = useState<ProductsState>({ status: "loading" });
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
  }, [health, mode, deskTab]);

  // --- Save draft on form change ---
  useEffect(() => {
    saveDraft(form);
  }, [form]);

  // --- Popstate listener for back/forward browser navigation ---
  useEffect(() => {
    function handlePopState() {
      const nav = parseNavigationFromUrl();
      setMode(nav.mode);
      setBorrowerTab(nav.borrowerTab);
      setDeskTab(nav.deskTab);
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
    if (result && !resultLoading && mode === "borrower" && borrowerTab === "check") {
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [result, resultLoading, mode, borrowerTab]);

  const products = useMemo(
    () => (productsState.status === "ready" ? productsState.products : []),
    [productsState]
  );

  function handleBorrowerTabChange(tab: BorrowerTabKey) {
    setBorrowerTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "borrower");
    url.searchParams.set("tab", tab);
    if (tab === "check" && result) {
      url.searchParams.set("id", result.id);
    } else {
      url.searchParams.delete("id");
    }
    window.history.pushState({}, "", url.toString());
  }

  function handleDeskTabChange(tab: DeskTabKey) {
    setDeskTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "desk");
    url.searchParams.set("tab", tab);
    url.searchParams.delete("id");
    window.history.pushState({}, "", url.toString());
  }

  function switchToDesk() {
    setMode("desk");
    setDeskTab("dashboard");
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "desk");
    url.searchParams.set("tab", "dashboard");
    url.searchParams.delete("id");
    window.history.pushState({}, "", url.toString());
  }

  function switchToBorrower() {
    setMode("borrower");
    setBorrowerTab("home");
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "borrower");
    url.searchParams.set("tab", "home");
    url.searchParams.delete("id");
    window.history.pushState({}, "", url.toString());
  }

  function handleNewApplication() {
    setMode("borrower");
    setBorrowerTab("check");
    startOver();
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "borrower");
    url.searchParams.set("tab", "check");
    url.searchParams.delete("id");
    window.history.pushState({}, "", url.toString());
  }

  function handleSelectProduct(productId: string) {
    const prod = products.find((p) => p.id === productId);
    const firstVariant = prod?.variants?.[0]?.variant || "standard";
    setForm((prev) => ({
      ...prev,
      product: productId,
      variant: firstVariant,
    }));
    handleBorrowerTabChange("check");
  }

  function handleAskQuestion(question: string) {
    setAssistantInitialQuestion(question);
    handleBorrowerTabChange("help");
  }

  function toggleLang() {
    setLang((prev) => (prev === "en" ? "hi" : "en"));
  }

  function openApplication(id: string) {
    setMode("borrower");
    setBorrowerTab("check");
    setResultLoading(true);
    setResultError(null);
    setExpiredResult(false);
    const url = new URL(window.location.href);
    url.searchParams.set("mode", "borrower");
    url.searchParams.set("tab", "check");
    url.searchParams.set("id", id);
    window.history.pushState({}, "", url.toString());
    getApplication(id)
      .then((res) => {
        setResult(res);
      })
      .catch(() => {
        setResultError("Could not load application details.");
      })
      .finally(() => setResultLoading(false));
  }

  // --- Form handlers ---
  function handleChange(field: keyof FormState, value: unknown) {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };
      if (errors[field]) {
        setErrors((prevErrors) => {
          const next = { ...prevErrors };
          delete next[field];
          return next;
        });
      }
      if (apiErrors[field]) {
        setApiErrors((prevApi) => {
          const next = { ...prevApi };
          delete next[field];
          return next;
        });
      }
      return updated;
    });
  }

  function loadSample() {
    const s = { ...SAMPLE_APPLICANT };
    setForm(s);
    setErrors({});
    setApiErrors({});
    setSubmitError(null);
    setResult(null);
    requestIdRef.current = generateRequestId();
    setRequestId(requestIdRef.current);
    lastFormRef.current = "";
    setLastForm(s);
  }

  function loadBorderline() {
    const s = { ...BORDERLINE_APPLICANT };
    setForm(s);
    setErrors({});
    setApiErrors({});
    setSubmitError(null);
    setResult(null);
    requestIdRef.current = generateRequestId();
    setRequestId(requestIdRef.current);
    lastFormRef.current = "";
    setLastForm(s);
  }

  function startOver() {
    setForm(EMPTY_FORM);
    setErrors({});
    setApiErrors({});
    setSubmitError(null);
    setResult(null);
    setExpiredResult(false);
    requestIdRef.current = generateRequestId();
    setRequestId(requestIdRef.current);
    lastFormRef.current = "";
    setLastForm(EMPTY_FORM);
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url.toString());
  }

  const focusFirstError = useCallback((validationErrors: ValidationErrors) => {
    for (const field of FIELD_FOCUS_ORDER) {
      if (validationErrors[field]) {
        const el = document.getElementById(field);
        if (el) {
          el.focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          break;
        }
      }
    }
  }, []);

  function handleCheckWith(amount: number, termMonths: number) {
    setForm((prev) => ({
      ...prev,
      loan_amount: String(amount),
      tenure_months: String(termMonths),
    }));
    handleSubmitWithOverrides({
      loan_amount: String(amount),
      tenure_months: String(termMonths),
    });
  }

  function handleSubmit() {
    handleSubmitWithOverrides({});
  }

  function handleSubmitWithOverrides(overrides: Partial<FormState>) {
    const updatedForm = { ...form, ...overrides };
    const validationErrors = validateForm(updatedForm);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      focusFirstError(validationErrors);
      return;
    }
    setErrors({});
    setApiErrors({});

    const currentSig = formSignature(updatedForm);
    if (result && lastFormRef.current === currentSig) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!requestIdRef.current) {
      requestIdRef.current = generateRequestId();
      setRequestId(requestIdRef.current);
    }

    setResult(null);
    setTimeout(() => {
      if (submitting) {
        setSubmitError("Scoring is taking longer than usual. Please check your connection.");
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      const body = buildScoreBody(updatedForm, requestIdRef.current);
      postScore(body)
        .then((res) => {
          setResult(res);
          try {
            const raw = localStorage.getItem("patrata_checks");
            const existing = raw ? JSON.parse(raw) : [];
            const updated = [res.id, ...(Array.isArray(existing) ? existing.filter((id: string) => id !== res.id) : [])].slice(0, 50);
            localStorage.setItem("patrata_checks", JSON.stringify(updated));
          } catch {
            /* ignore */
          }
          const url = new URL(window.location.href);
          url.searchParams.set("mode", "borrower");
          url.searchParams.set("tab", "check");
          url.searchParams.set("id", res.id);
          window.history.replaceState({}, "", url.toString());
          lastFormRef.current = formSignature(updatedForm);
          setLastForm(updatedForm);
        })
        .catch((err: unknown) => {
          const apiErr = err as {
            status?: number;
            errors?: { field: string; message: string }[];
            message?: string;
          };
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
      <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden bg-page">
        <BorrowerHeader
          activeTab={borrowerTab}
          onTabChange={handleBorrowerTabChange}
          onSwitchToDesk={switchToDesk}
          onOpenAbout={() => setAboutOpen(true)}
          lang={lang}
          onToggleLang={toggleLang}
        />
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
      <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden bg-page">
        <BorrowerHeader
          activeTab={borrowerTab}
          onTabChange={handleBorrowerTabChange}
          onSwitchToDesk={switchToDesk}
          onOpenAbout={() => setAboutOpen(true)}
          lang={lang}
          onToggleLang={toggleLang}
        />
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
      <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden bg-page">
        <BorrowerHeader
          activeTab={borrowerTab}
          onTabChange={handleBorrowerTabChange}
          onSwitchToDesk={switchToDesk}
          onOpenAbout={() => setAboutOpen(true)}
          lang={lang}
          onToggleLang={toggleLang}
        />
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

  // =========================================================================
  // BORROWER APP MODE (Default)
  // =========================================================================
  if (mode === "borrower") {
    return (
      <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden bg-page">
        <BorrowerHeader
          activeTab={borrowerTab}
          onTabChange={handleBorrowerTabChange}
          onSwitchToDesk={switchToDesk}
          onOpenAbout={() => setAboutOpen(true)}
          lang={lang}
          onToggleLang={toggleLang}
        />

        <main className="flex-1 mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 pb-28 md:pb-8">
          {/* HOME TAB */}
          {borrowerTab === "home" && (
            <HomeTab
              products={products}
              onNavigateToCheck={() => handleBorrowerTabChange("check")}
              onNavigateToTools={() => handleBorrowerTabChange("tools")}
              onSelectProduct={handleSelectProduct}
              onAskQuestion={handleAskQuestion}
              onViewResult={openApplication}
            />
          )}

          {/* CHECK TAB */}
          {borrowerTab === "check" && (
            <div className="max-w-3xl mx-auto">
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
            </div>
          )}

          {/* TOOLS TAB */}
          {borrowerTab === "tools" && (
            <div className="rounded-card border border-cardborder bg-white p-6 sm:p-8 text-center space-y-3 max-w-lg mx-auto my-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-page text-brand">
                <Icon name="tools" size={28} />
              </div>
              <div>
                <h2 className="font-archivo font-800 text-xl text-ink">Loan Calculators & Tools</h2>
                <p className="mt-2 text-sm text-muted">
                  Tools is coming in the next step.
                </p>
              </div>
            </div>
          )}

          {/* MY CHECKS TAB */}
          {borrowerTab === "checks" && (
            <div className="rounded-card border border-cardborder bg-white p-6 sm:p-8 text-center space-y-3 max-w-lg mx-auto my-8">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-page text-muted">
                <Icon name="receipt" size={28} />
              </div>
              <div>
                <h2 className="font-archivo font-800 text-xl text-ink">My Checks</h2>
                <p className="mt-2 text-sm text-muted">
                  My checks is coming in the next step.
                </p>
              </div>
            </div>
          )}

          {/* HELP TAB (ASSISTANT) */}
          {borrowerTab === "help" && (
            <div className="max-w-3xl mx-auto">
              <Assistant
                initialQuestion={assistantInitialQuestion}
                onClearInitialQuestion={() => setAssistantInitialQuestion(undefined)}
              />
            </div>
          )}
        </main>

        <BorrowerBottomBar activeTab={borrowerTab} onTabChange={handleBorrowerTabChange} />
        <Footer />
        <AboutModal
          open={aboutOpen}
          onClose={() => setAboutOpen(false)}
          modelVersion={result?.model_version}
        />
      </div>
    );
  }

  // =========================================================================
  // LENDER DESK MODE
  // =========================================================================
  return (
    <div className="min-h-screen flex flex-col md:flex-row w-full max-w-full overflow-x-hidden bg-page">
      {/* Laptop Sidebar */}
      <DeskSidebar
        activeTab={deskTab}
        onTabChange={handleDeskTabChange}
        reviewCount={reviewCount}
        onNewApplication={handleNewApplication}
        onSwitchToBorrower={switchToBorrower}
      />

      {/* Mobile Top Header */}
      <DeskMobileHeader
        activeTab={deskTab}
        onTabChange={handleDeskTabChange}
        reviewCount={reviewCount}
        onNewApplication={handleNewApplication}
        onSwitchToBorrower={switchToBorrower}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-5xl mx-auto">
          {deskTab === "dashboard" && <Dashboard onOpenApplication={openApplication} />}
          {deskTab === "review" && <ReviewQueue />}
          {deskTab === "batch" && <Batch />}
          {deskTab === "compare" && <Compare products={products} />}
          {deskTab === "model" && <ModelCard />}
        </main>
        <Footer />
      </div>

      <AboutModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        modelVersion={result?.model_version}
      />
    </div>
  );
}
