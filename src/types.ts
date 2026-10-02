export type ProductVariant = {
  id: string;
  name: string;
  for: string;
  features: string[];
  criteria: Record<string, unknown>;
};

export type Product = {
  id: string;
  name: string;
  secured: boolean;
  summary: string;
  variants: ProductVariant[];
};

export type EmploymentType =
  | "salaried"
  | "self_employed"
  | "government"
  | "pensioner"
  | "not_employed";

export type RuleCheck = {
  label: string;
  status: "pass" | "review" | "fail";
  value: string | number | null;
  threshold: string | number | null;
  detail: string;
};

export type Driver = {
  label: string;
  value: string;
  impact: number;
  direction: "towards_approve" | "towards_decline";
};

export type RepaymentRisk = {
  probability: number;
  band: string;
  relative: string;
  drivers: { label: string; value: string; direction: "raises_risk" | "lowers_risk" }[];
};

export type Counterfactual = {
  possible: boolean;
  loan_amount: number | null;
  loan_term: number | null;
  summary: string;
};

export type ScoreResult = {
  id: string;
  decision: "APPROVE" | "REFER" | "DECLINE";
  status: string;
  product_name: string;
  variant_name: string;
  approval_probability: number | null;
  approval_model_note: string;
  emi_estimate: number | null;
  foir: number | null;
  reasons: string[];
  rule_checks: RuleCheck[];
  drivers: Driver[];
  repayment_risk: RepaymentRisk | null;
  counterfactual: Counterfactual | null;
  flags: string[];
  warnings: string[];
  model_version?: string;
};

export type ValidationError = { field: string; message: string };

export type ExplainResult = {
  summary: string;
  reasons: string[];
  next_steps: string[] | string;
  source: string;
};

export type AskResult = {
  answer: string;
  in_scope: boolean;
  source: string;
};

export type ScoreBody = {
  variant: string;
  request_id: string;
  product: string;
  product_id: string;
  age: number;
  no_of_dependents: number;
  employment_type: EmploymentType;
  years_in_job: number;
  income_annum: number;
  existing_emi_monthly: number;
  loan_amount: number;
  property_value: number | null;
  asset_price: number | null;
  loan_term: number;
  annual_rate: number;
  cibil_score: number | null;
  no_credit_history: boolean;
  existing_loans_count: number;
  outstanding_debt: number;
  credit_history_years: number;
  new_loans_12m: number;
  overdue_now: boolean;
  residential_assets_value: number;
  commercial_assets_value: number;
  luxury_assets_value: number;
  bank_asset_value: number;
};

export type FormState = {
  product: string;
  variant: string;
  age: string;
  no_of_dependents: string;
  employment_type: EmploymentType;
  years_in_job: string;
  income_annum: string;
  existing_emi_monthly: string;
  loan_amount: string;
  property_value: string;
  asset_price: string;
  tenure_months: string;
  annual_rate: string;
  cibil_score: string;
  no_credit_history: boolean;
  existing_loans_count: string;
  outstanding_debt: string;
  credit_history_years: string;
  new_loans_12m: string;
  overdue_now: boolean;
  residential_assets_value: string;
  commercial_assets_value: string;
  luxury_assets_value: string;
  bank_asset_value: string;
};

export type DailyStat = {
  date: string;
  APPROVE: number;
  REFER: number;
  DECLINE: number;
};

export type CibilBandStat = {
  band: string;
  count: number;
  approve_rate: number;
};

export type ProductStat = {
  product: string;
  total: number;
  approve: number;
  refer: number;
  decline: number;
};

export type StatsData = {
  total: number;
  by_decision: { APPROVE: number; REFER: number; DECLINE: number };
  approval_rate: number;
  awaiting_review: number;
  reviewed?: number;
  overrides?: number;
  avg_cibil: number | null;
  avg_foir: number | null;
  daily: DailyStat[];
  attention_reasons: { reason: string; count: number }[];
  cibil_bands?: CibilBandStat[];
  by_product?: ProductStat[] | Record<string, number>;
};

export type ReviewAgentStep = {
  thought: string;
  action: string;
  args: Record<string, unknown>;
  observation: Record<string, unknown>;
};

export type ReviewAgentMemo = {
  recommendation: "APPROVE" | "APPROVE_WITH_CONDITIONS" | "DECLINE" | "NEEDS_MORE_INFO";
  summary: string;
  conditions: string[];
  reasons: string[];
  risks: string[];
};

export type ReviewAgentResult = {
  steps: ReviewAgentStep[];
  memo: ReviewAgentMemo;
  source: string;
  notes: string;
};

export type ReviewBody = {
  final_decision: "APPROVE" | "DECLINE";
  note: string;
  reviewer: string;
};

export type AppMode = "borrower" | "desk";
export type BorrowerTabKey = "home" | "check" | "tools" | "checks" | "help";
export type DeskTabKey = "dashboard" | "review" | "batch" | "compare" | "model" | "check";
export type TabKey = BorrowerTabKey | DeskTabKey | "assistant";

export type ModelMetrics = {
  roc_auc?: number | null;
  logistic_regression_roc_auc?: number | null;
  [key: string]: unknown;
};

export type ModelDetails = {
  name?: string;
  data_source?: string | null;
  training_rows?: number | null;
  rows?: number | null;
  model_version?: string | null;
  algorithm?: string | null;
  metrics?: ModelMetrics | null;
  [key: string]: unknown;
};

export type LLMDetails = {
  provider?: string | null;
  model?: string | null;
  role?: string | null;
  data_sent?: string | null;
  [key: string]: unknown;
};

export type AssistantRetrievalEval = {
  top1_hits?: number | string | null;
  total_questions?: number | null;
  accuracy?: number | null;
  [key: string]: unknown;
};

export type ModelCardResponse = {
  approval_v2?: ModelDetails | null;
  risk_model?: ModelDetails | null;
  models?: Record<string, ModelDetails> | null;
  llm?: LLMDetails | null;
  assistant_retrieval_eval?: AssistantRetrievalEval | null;
  policy?: Record<string, unknown> | null;
  policy_thresholds?: Record<string, unknown> | null;
  limitations?: string[] | null;
  [key: string]: unknown;
};

export type AssistantSource = {
  n: number;
  title: string;
};

export type AssistantResponse = {
  answer: string;
  sources?: AssistantSource[];
  kind?: "grounded" | "general" | "calculator" | "guard" | string;
  calc?: Record<string, unknown> | null;
};

export type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantRequestBody = {
  question: string;
  language: "en" | "hi";
  history: ChatTurn[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  lang?: "en" | "hi";
  sources?: AssistantSource[];
  kind?: string;
  calc?: Record<string, unknown> | null;
  error?: boolean;
};

export type BatchRow = {
  ref: string;
  variant: string;
  product: string;
  age: number;
  no_of_dependents: number;
  employment_type: EmploymentType;
  years_in_job: number;
  income_annum: number;
  existing_emi_monthly: number;
  loan_amount: number;
  property_value: number | null;
  asset_price: number | null;
  loan_term: number;
  annual_rate: number;
  cibil_score: number | null;
  no_credit_history: boolean;
  existing_loans_count: number;
  outstanding_debt: number;
  credit_history_years: number;
  new_loans_12m: number;
  overdue_now: boolean;
  residential_assets_value: number;
  commercial_assets_value: number;
  luxury_assets_value: number;
  bank_asset_value: number;
};

export type BatchResultRow = {
  row: number;
  ref: string;
  valid: boolean;
  decision: "APPROVE" | "REFER" | "DECLINE" | null;
  approval_probability: number | null;
  foir: number | null;
  emi_estimate: number | null;
  reason: string;
  suggested_change: string | null;
  errors: string[];
};

export type BatchSummary = {
  APPROVE: number;
  REFER: number;
  DECLINE: number;
  INVALID: number;
};

export type BatchResult = {
  summary: BatchSummary;
  rows: BatchResultRow[];
};

export type SimulateResult = {
  decision: "APPROVE" | "REFER" | "DECLINE";
  approval_probability: number | null;
  foir: number | null;
  emi_estimate: number | null;
  flags: string[];
  rule_checks: RuleCheck[];
  drivers: Driver[];
  reasons: string[];
};
