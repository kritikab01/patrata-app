import { ENGINE_URL } from "./config";
import type {
  Product,
  ScoreResult,
  ScoreBody,
  ValidationError,
  ExplainResult,
  AskResult,
  StatsData,
  ReviewAgentResult,
  ReviewBody,
  BatchRow,
  BatchResult,
  SimulateResult,
  AssistantRequestBody,
  AssistantResponse,
  ModelCardResponse,
} from "./types";

async function fetchJSON<T>(url: string, init?: RequestInit, timeoutMs = 30000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status === 422) {
      const body = await res.json();
      const err: ApiError = { status: 422, errors: body.errors ?? [] };
      throw err;
    }
    if (res.status === 401) {
      let msg = "Lender desk PIN required";
      try {
        const body = await res.json();
        if (body.detail) msg = body.detail;
      } catch {
        /* ignore */
      }
      const err: ApiError = { status: 401, message: msg };
      throw err;
    }
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

export type ApiError = {
  status: number;
  errors?: ValidationError[];
  message?: string;
};

export async function getHealth(): Promise<{ status: string }> {
  return fetchJSON(`${ENGINE_URL}/api/health`, {}, 3000);
}

export async function getProducts(): Promise<{ products: Product[] }> {
  return fetchJSON(`${ENGINE_URL}/api/products`);
}

export async function postScore(body: ScoreBody): Promise<ScoreResult> {
  return fetchJSON(`${ENGINE_URL}/api/score`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getApplication(id: string): Promise<ScoreResult> {
  return fetchJSON(`${ENGINE_URL}/api/applications/${id}`);
}

export async function postExplain(id: string, lang: "en" | "hi"): Promise<ExplainResult> {
  return fetchJSON(`${ENGINE_URL}/api/applications/${id}/explain?lang=${lang}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

export async function postAsk(id: string, question: string, language: "en" | "hi"): Promise<AskResult> {
  return fetchJSON(`${ENGINE_URL}/api/applications/${id}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, language }),
  });
}

export async function getStats(days = 14): Promise<StatsData> {
  return fetchJSON(`${ENGINE_URL}/api/stats?days=${days}`);
}

export async function getApplications(): Promise<ScoreResult[]> {
  return fetchJSON(`${ENGINE_URL}/api/applications`);
}

export async function getReviewQueue(): Promise<ScoreResult[]> {
  return fetchJSON(`${ENGINE_URL}/api/reviews/queue`);
}

export async function postReviewAgent(id: string): Promise<ReviewAgentResult> {
  return fetchJSON(
    `${ENGINE_URL}/api/applications/${id}/review-agent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
    65000
  );
}

export async function postReview(id: string, body: ReviewBody): Promise<unknown> {
  const pin = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("patrata_desk_pin") || "" : "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (pin) {
    headers["X-Desk-Key"] = pin;
  }
  return fetchJSON(`${ENGINE_URL}/api/applications/${id}/review`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

export async function postBatch(rows: BatchRow[]): Promise<BatchResult> {
  return fetchJSON(`${ENGINE_URL}/api/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  }, 120000);
}

export async function postSimulate(body: ScoreBody): Promise<SimulateResult> {
  return fetchJSON(`${ENGINE_URL}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function postAssistant(body: AssistantRequestBody): Promise<AssistantResponse> {
  return fetchJSON(`${ENGINE_URL}/api/assistant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 60000);
}

export async function getModelCard(): Promise<ModelCardResponse> {
  return fetchJSON(`${ENGINE_URL}/api/model-card`);
}


