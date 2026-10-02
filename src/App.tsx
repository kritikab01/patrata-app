import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import type { Product, FormState, ScoreResult, ScoreBody, TabKey, AppMode, BorrowerTabKey, DeskTabKey } from "./types";
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
  BorrowerBottomNav,
  LenderDeskHeader,
  LenderDeskSidebar,
  LenderDeskMobileNav,
  Footer,
  AboutModal,
} from "./components/Layout";
import { ToolsScreen, MyChecksScreen } from "./components/BorrowerScreens";
import { BorrowerHome } from "./components/BorrowerHome";
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
const MODE_KEY = "patrata_mode";
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

function saveCheckIdToHistory(id: string) {
  try {
    const raw = localStorage.getItem("patrata_checks");
    let list: string[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        list = parsed
          .map((item) => (typeof item === "string" ? item : item?.id))
          .filter(Boolean);
      }
    }
    list = [id, ...list.filter((x) => x !== id)];
    localStorage.setItem("patrata_checks", JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function formSignature(form: FormState): string {
  return JSON.stringify(form);
}

function loadInitialNavState(): { mode: AppMode; tab: TabKey } {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlMode = params.get("mode") as AppMode | null;
    const urlTab = params.get("tab");

    // Old desk tabs open desk mode directly
    if (
      urlTab === "dashboard" ||
      urlTab === "review" ||
      urlTab === "batch" ||
      urlTab === "compare" ||
      urlTab === "model"
    ) {
      return { mode: "desk", tab: urlTab };
    }

    if (urlTab === "assistant") {
      return { mode: "borrower", tab: "help" };
    }

    if (urlMode === "desk") {
      const validDeskTab =
        urlTab === "dashboard" ||
        urlTab === "review" ||
        urlTab === "batch" ||
        urlTab === "compare" ||
        urlTab === "model" ||
        urlTab === "check"
          ? (urlTab as DeskTabKey)
          : "dashboard";
      return { mode: "desk", tab: validDeskTab };
    }

    if (urlMode === "borrower") {
      const validBorrowerTab =
        urlTab === "home" ||
        urlTab === "check" ||
        urlTab === "tools" ||
        urlTab === "checks" ||
        urlTab === "help"
          ? (urlTab as BorrowerTabKey)
          : "home";
      return { mode: "borrower", tab: validBorrowerTab };
    }

    if (urlTab === "home" || urlTab === "tools" || urlTab === "checks" || urlTab === "help") {
      return { mode: "borrower", tab: urlTab };
    }

    if (urlTab === "check") {
      return { mode: "borrower", tab: "check" };
    }

    // Local storage fallback
    const savedMode = localStorage.getItem(MODE_KEY) as AppMode | null;
    const savedTab = localStorage.getItem(TAB_KEY) as TabKey | null;

    if (savedMode === "desk") {
      const validDeskTab =
        savedTab && ["dashboard", "review", "batch", "compare", "model", "check"].includes(savedTab)
          ? savedTab
          : "dashboard";
      return { mode: "desk", tab: validDeskTab };
    }

    if (savedMode === "borrower" && savedTab) {
      const validBorrowerTab = ["home", "check", "tools", "checks", "help"].includes(savedTab)
        ? savedTab
        : "home";
      return { mode: "borrower", tab: validBorrowerTab };
    }
  } catch {
    /* ignore */
  }

  return { mode: "borrower", tab: "home" };
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
  
  // Navigation mode and tab state
  const initialNav = useMemo(loadInitialNavState, []);
  const [mode, setMode] = useState<AppMode>(initialNav.mode);
  const [activeTab, setActiveTab] = useState<TabKey>(initialNav.tab);
  const [reviewCount, setReviewCount] = useState(0);
  const [lang, setLang] = useState<"en" | "hi">("en");
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [helpQuestion, setHelpQuestion] = useState<string | null>(null);

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
        /* non-critical */
      });
    return () => {
      cancelled = true;
    };
  }, [health, activeTab]);

  // --- Save draft on form change ---
  useEffect(() => {
    saveDraft(form);
  }, [form]);

  // --- Sync navigation with URL & localStorage ---
  const updateNav = useCallback((newMode: AppMode, newTab: TabKey, resultId?: string | null) => {
    setMode(newMode);
    setActiveTab(newTab);
    try {
      localStorage.setItem(MODE_KEY, newMode);
      localStorage.setItem(TAB_KEY, newTab);
      const url = new URL(window.location.href);
      url.searchParams.set("mode", newMode);
      url.searchParams.set("tab", newTab);
      if (resultId) {
        url.searchParams.set("id", resultId);
      } else if (newTab !== "check") {
        url.searchParams.delete("id");
      }
      window.history.pushState({}, "", url.toString());
    } catch {
      /* ignore */
    }
  }, []);

  const handleTabChange = useCallback((tab: TabKey) => {
    updateNav(mode, tab, result?.id);
  }, [mode, result, updateNav]);

  const handleModeChange = useCallback((newMode: AppMode) => {
    const defaultTab = newMode === "desk" ? "dashboard" : "home";
    updateNav(newMode, defaultTab, result?.id);
  }, [result, updateNav]);

  // Popstate listener for browser back/forward
  useEffect(() => {
    function handlePopState() {
      const { mode: popMode, tab: popTab } = loadInitialNavState();
      setMode(popMode);
      setActiveTab(popTab);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // --- Load result from URL ?id on Check tab ---
  useEffect(() => {
    if (health !== "ready") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) return;

    let cancelled = false;
    setResultLoading(true);
    setResultError(null);
    setExpiredResult(false);

    getApplication(id)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          setExpiredResult(true);
        } else {
          setResultError("Could not load application result.");
        }
      })
      .finally(() => {
        if (!cancelled) setResultLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [health]);

  const products = useMemo(() => {
    return productsState.status === "ready" ? productsState.products : [];
  }, [productsState]);

  // Select default product & variant when products arrive
  useEffect(() => {
    if (products.length === 0) return;
    setForm((prev) => {
      if (prev.product && products.some((p) => p.id === prev.product)) return prev;
      const first = products[0];
      return {
        ...prev,
        product: first.id,
        variant: first.variants[0]?.id || "",
        annual_rate: first.variants[0]?.criteria?.annual_rate
          ? String(first.variants[0].criteria.annual_rate)
          : prev.annual_rate,
      };
    });
  }, [products]);

  // Generate request_id once
  useEffect(() => {
    if (!requestIdRef.current) {
      const id = generateRequestId();
      requestIdRef.current = id;
      setRequestId(id);
    }
  }, []);

  function handleChange(field: keyof FormState, value: unknown) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "product") {
        const prod = products.find((p) => p.id === value);
        if (prod && prod.variants.length > 0) {
          next.variant = prod.variants[0].id;
        }
      }
      return next;
    });

    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as keyof ValidationErrors];
        return next;
      });
    }

    if (apiErrors[field]) {
      setApiErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function focusFirstError(errs: Record<string, string>) {
    for (const field of FIELD_FOCUS_ORDER) {
      if (errs[field]) {
        const el =
          document.querySelector(`[name="${field}"]`) ||
          document.querySelector(`#field-${field}`);
        if (el && typeof (el as HTMLElement).focus === "function") {
          (el as HTMLElement).focus();
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        break;
      }
    }
  }

  function loadSample() {
    setForm({ ...SAMPLE_APPLICANT });
    setErrors({});
    setApiErrors({});
    setSubmitError(null);
  }

  function loadBorderline() {
    setForm({ ...BORDERLINE_APPLICANT });
    setErrors({});
    setApiErrors({});
    setSubmitError(null);
  }

  function startOver() {
    setForm({
      ...EMPTY_FORM,
      product: products[0]?.id || "",
      variant: products[0]?.variants[0]?.id || "",
    });
    setErrors({});
    setApiErrors({});
    setSubmitError(null);
    setResult(null);
    setExpiredResult(false);
    lastFormRef.current = "";
    localStorage.removeItem(LAST_FORM_KEY);
    const newId = generateRequestId();
    requestIdRef.current = newId;
    setRequestId(newId);
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url.toString());
  }

  async function handleSubmit() {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      focusFirstError(errs);
      return;
    }

    const currentSig = formSignature(form);
    if (currentSig === lastFormRef.current) {
      const newId = generateRequestId();
      requestIdRef.current = newId;
      setRequestId(newId);
    }

    setSubmitting(true);
    setSubmitError(null);
    setApiErrors({});

    try {
      const body = buildScoreBody(form, requestIdRef.current);
      const res = await postScore(body);
      setResult(res);
      saveCheckIdToHistory(res.id);
      lastFormRef.current = formSignature(form);
      setLastForm(form);

      const url = new URL(window.location.href);
      url.searchParams.set("id", res.id);
      window.history.replaceState({}, "", url.toString());

      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err: unknown) {
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
    } finally {
      setSubmitting(false);
    }
  }

  function handleCheckWith(amount: number, termMonths: number) {
    const updatedForm = {
      ...form,
      loan_amount: String(amount),
      tenure_months: String(termMonths),
    };
    setForm(updatedForm);

    setTimeout(() => {
      const errs = validateForm(updatedForm);
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
      setSubmitting(true);
      setSubmitError(null);
      const body = buildScoreBody(updatedForm, requestIdRef.current);
      postScore(body)
        .then((res) => {
          setResult(res);
          saveCheckIdToHistory(res.id);
          const url = new URL(window.location.href);
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

  function openApplication(appId: string) {
    updateNav(mode, "check", appId);
    setResultLoading(true);
    setResultError(null);
    setExpiredResult(false);
    getApplication(appId)
      .then((data) => {
        setResult(data);
      })
      .catch((err) => {
        const status = (err as { status?: number })?.status;
        if (status === 404) setExpiredResult(true);
        else setResultError("Could not load application result.");
      })
      .finally(() => setResultLoading(false));
  }

  function handleSelectProduct(productId: string) {
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      setForm((prev) => ({
        ...prev,
        product: prod.id,
        variant: prod.variants[0]?.id || "",
        annual_rate: prod.variants[0]?.criteria?.annual_rate
          ? String(prod.variants[0].criteria.annual_rate)
          : prev.annual_rate,
      }));
    }
    updateNav(mode, "check");
  }

  function handleStartCheckFromTool(params: {
    product: string;
    amount: number;
    tenureMonths: number;
    rate: number;
  }) {
    const prod = products.find((p) => p.id === params.product) || products[0];
    setForm((prev) => ({
      ...prev,
      product: prod?.id || "personal",
      variant: prod?.variants[0]?.id || "pl_salaried",
      loan_amount: String(params.amount),
      tenure_months: String(params.tenureMonths),
      annual_rate: String(params.rate),
    }));
    updateNav(mode, "check");
  }

  // --- Shared wrapper for non-ready states ---
  if (health === "checking") {
    return (
      <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden bg-page">
        {mode === "borrower" ? (
          <BorrowerHeader
            activeTab="home"
            onTabChange={(t) => handleTabChange(t)}
            lang={lang}
            onLangToggle={() => setLang((l) => (l === "en" ? "hi" : "en"))}
            onSwitchToDesk={() => handleModeChange("desk")}
            onOpenAbout={() => setAboutModalOpen(true)}
          />
        ) : (
          <LenderDeskHeader
            onSwitchToBorrower={() => handleModeChange("borrower")}
            onOpenAbout={() => setAboutModalOpen(true)}
            onNewApplication={() => handleTabChange("check")}
          />
        )}
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
        {mode === "borrower" ? (
          <BorrowerHeader
            activeTab="home"
            onTabChange={(t) => handleTabChange(t)}
            lang={lang}
            onLangToggle={() => setLang((l) => (l === "en" ? "hi" : "en"))}
            onSwitchToDesk={() => handleModeChange("desk")}
            onOpenAbout={() => setAboutModalOpen(true)}
          />
        ) : (
          <LenderDeskHeader
            onSwitchToBorrower={() => handleModeChange("borrower")}
            onOpenAbout={() => setAboutModalOpen(true)}
            onNewApplication={() => handleTabChange("check")}
          />
        )}
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-card border border-cardborder bg-white p-6 text-center">
            <Spinner className="mx-auto text-brand" />
            <p className="mt-3 text-sm text-ink font-700">Waking up the Patrata engine.</p>
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
        {mode === "borrower" ? (
          <BorrowerHeader
            activeTab="home"
            onTabChange={(t) => handleTabChange(t)}
            lang={lang}
            onLangToggle={() => setLang((l) => (l === "en" ? "hi" : "en"))}
            onSwitchToDesk={() => handleModeChange("desk")}
            onOpenAbout={() => setAboutModalOpen(true)}
          />
        ) : (
          <LenderDeskHeader
            onSwitchToBorrower={() => handleModeChange("borrower")}
            onOpenAbout={() => setAboutModalOpen(true)}
            onNewApplication={() => handleTabChange("check")}
          />
        )}
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

  // --- Check Screen Content (Shared between Borrower & Desk) ---
  const checkScreenContent = (
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
            onBackToHome={() => handleTabChange(mode === "borrower" ? "home" : "dashboard")}
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

            {result && (
              <ResultPanel
                result={result}
                products={products}
                onCheckWith={handleCheckWith}
                onBack={() => setResult(null)}
              />
            )}
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex flex-col w-full max-w-full overflow-x-hidden bg-page">
      {/* 1. BORROWER APP MODE */}
      {mode === "borrower" && (
        <>
          <BorrowerHeader
            activeTab={activeTab as BorrowerTabKey}
            onTabChange={(t) => handleTabChange(t)}
            lang={lang}
            onLangToggle={() => setLang((l) => (l === "en" ? "hi" : "en"))}
            onSwitchToDesk={() => handleModeChange("desk")}
            onOpenAbout={() => setAboutModalOpen(true)}
          />

          <main className="flex-1 mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8 pb-24 md:pb-8">
            {activeTab === "home" && (
              <BorrowerHome
                products={products}
                onGoCheck={() => handleTabChange("check")}
                onGoTools={(focus) => {
                  if (focus) {
                    const url = new URL(window.location.href);
                    url.searchParams.set("tool", focus);
                    window.history.replaceState({}, "", url.toString());
                  }
                  handleTabChange("tools");
                }}
                onSelectProduct={handleSelectProduct}
                onViewResult={(id) => openApplication(id)}
                onAskQuestion={(q) => {
                  setHelpQuestion(q);
                  handleTabChange("help");
                }}
              />
            )}

            {activeTab === "check" && checkScreenContent}

            {activeTab === "tools" && (
              <ToolsScreen onStartCheckWith={handleStartCheckFromTool} />
            )}

            {activeTab === "checks" && (
              <MyChecksScreen
                lastResult={result}
                onOpenCheck={() => handleTabChange("check")}
                onStartNew={startOver}
              />
            )}

            {activeTab === "help" && (
              <Assistant
                lang={lang}
                onLangChange={setLang}
                initialQuestion={helpQuestion}
                onClearInitialQuestion={() => setHelpQuestion(null)}
              />
            )}
          </main>

          {/* Fixed bottom tab bar for phone (<768px) */}
          <BorrowerBottomNav
            activeTab={activeTab as BorrowerTabKey}
            onTabChange={(t) => handleTabChange(t)}
          />

          <Footer />
        </>
      )}

      {/* 2. LENDER DESK MODE */}
      {mode === "desk" && (
        <>
          <LenderDeskHeader
            onSwitchToBorrower={() => handleModeChange("borrower")}
            onOpenAbout={() => setAboutModalOpen(true)}
            onNewApplication={() => handleTabChange("check")}
          />

          {/* Mobile top scrollable row (<768px) */}
          <LenderDeskMobileNav
            activeTab={activeTab as DeskTabKey}
            onTabChange={(t) => handleTabChange(t)}
            onNewApplication={() => handleTabChange("check")}
            reviewCount={reviewCount}
          />

          <div className="flex-1 flex w-full max-w-[1400px] mx-auto">
            {/* Desktop Left Sidebar (≥768px) */}
            <div className="hidden md:block">
              <LenderDeskSidebar
                activeTab={activeTab as DeskTabKey}
                onTabChange={(t) => handleTabChange(t)}
                onNewApplication={() => handleTabChange("check")}
                onSwitchToBorrower={() => handleModeChange("borrower")}
                reviewCount={reviewCount}
              />
            </div>

            {/* Main Desk Viewport */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
              {activeTab === "dashboard" && <Dashboard onOpenApplication={openApplication} />}

              {activeTab === "review" && <ReviewQueue />}

              {activeTab === "batch" && <Batch />}

              {activeTab === "compare" && <Compare products={products} />}

              {activeTab === "model" && <ModelCard />}

              {activeTab === "check" && (
                <div className="max-w-3xl mx-auto">{checkScreenContent}</div>
              )}
            </main>
          </div>

          <Footer />
        </>
      )}

      {/* Shared About Modal */}
      <AboutModal
        isOpen={aboutModalOpen}
        onClose={() => setAboutModalOpen(false)}
        modelVersion={result?.model_version}
      />
    </div>
  );
}
