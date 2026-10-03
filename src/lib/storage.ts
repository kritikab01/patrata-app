export type SavedCheck = {
  id: string;
  product_name: string;
  variant_name: string;
  loan_amount: number;
  months: number;
  decision: "APPROVE" | "REFER" | "DECLINE";
  status: string;
  created_at: string;
  emi_estimate?: number | null;
  reasons?: string[];
  counterfactual?: { possible: boolean; summary: string } | null;
  failing_check?: string | null;
  product_id?: string;
  variant_id?: string;
};

const STORAGE_KEY = "patrata_checks";

export function getSavedChecks(): SavedCheck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map((item) => {
      if (typeof item === "string") {
        return {
          id: item,
          product_name: "Loan Check",
          variant_name: "Standard",
          loan_amount: 500000,
          months: 36,
          decision: "REFER",
          status: "refer",
          created_at: new Date().toISOString(),
        } as SavedCheck;
      }
      return item as SavedCheck;
    });
  } catch {
    return [];
  }
}

export function saveCheckToHistory(item: SavedCheck) {
  if (typeof window === "undefined" || !item.id) return;
  try {
    const current = getSavedChecks();
    // Newest first, max 30, no duplicates by id
    const filtered = current.filter((c) => c.id !== item.id);
    const updated = [item, ...filtered].slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore quota errors
  }
}

export function updateSavedCheck(id: string, updates: Partial<SavedCheck>) {
  if (typeof window === "undefined") return;
  try {
    const current = getSavedChecks();
    const updated = current.map((c) => (c.id === id ? { ...c, ...updates } : c));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    /* ignore storage errors */
  }
}

export function clearCheckHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore storage errors */
  }
}

/* ---------- USER NAME (Stored only on device) ---------- */
export const NAME_KEY = "patrata_name";
export const NAME_SKIPPED_KEY = "patrata_name_skipped";

export function getSavedName(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

export function saveName(name: string): void {
  if (typeof window === "undefined") return;
  try {
    const clean = name.trim().slice(0, 30);
    if (clean) {
      localStorage.setItem(NAME_KEY, clean);
      localStorage.removeItem(NAME_SKIPPED_KEY);
      window.dispatchEvent(new Event("patrata_name_changed"));
    }
  } catch {
    /* ignore storage errors */
  }
}

export function forgetName(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(NAME_SKIPPED_KEY);
    window.dispatchEvent(new Event("patrata_name_changed"));
  } catch {
    /* ignore storage errors */
  }
}

export function isNamePromptNeeded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const hasName = localStorage.getItem(NAME_KEY);
    const skipped = localStorage.getItem(NAME_SKIPPED_KEY);
    return !hasName && skipped !== "true";
  } catch {
    return false;
  }
}

export function skipNamePrompt(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NAME_SKIPPED_KEY, "true");
  } catch {
    /* ignore storage errors */
  }
}

/* ---------- WORD OF THE DAY & HISTORY ---------- */
export const WORDS_KEY = "patrata_words";

export type SavedWord = {
  term: string;
  meaning: string;
  example: string;
  date: string; // e.g. "2 Oct"
  dateKey: string; // e.g. "2026-10-02"
  learned: boolean;
};

export function getSavedWords(): SavedWord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WORDS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordWordOfDay(
  word: { term: string; meaning: string; example: string },
  dateStr: string,
  dateKey: string
): SavedWord[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getSavedWords();
    const existingIndex = current.findIndex((w) => w.term === word.term || w.dateKey === dateKey);
    let updated: SavedWord[];
    if (existingIndex >= 0) {
      const existing = current[existingIndex];
      const merged: SavedWord = {
        ...word,
        date: existing.date || dateStr,
        dateKey: existing.dateKey || dateKey,
        learned: existing.learned,
      };
      updated = [merged, ...current.filter((_, idx) => idx !== existingIndex)].slice(0, 60);
    } else {
      const newItem: SavedWord = {
        ...word,
        date: dateStr,
        dateKey,
        learned: false,
      };
      updated = [newItem, ...current].slice(0, 60);
    }
    localStorage.setItem(WORDS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function setWordLearned(term: string, learned = true): SavedWord[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getSavedWords();
    const updated = current.map((w) => (w.term === term ? { ...w, learned } : w));
    localStorage.setItem(WORDS_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/* ---------- STREAK TRACKING ---------- */
export const STREAK_KEY = "patrata_streak_dates";

export function recordStreakDay(todayDateKey: string): number {
  if (typeof window === "undefined") return 1;
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    let dates: string[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) dates = parsed;
    }
    if (!dates.includes(todayDateKey)) {
      dates = [todayDateKey, ...dates].slice(0, 90);
      localStorage.setItem(STREAK_KEY, JSON.stringify(dates));
    }
    return calculateStreak(dates, todayDateKey);
  } catch {
    return 1;
  }
}

export function calculateStreak(dates: string[], todayKey: string): number {
  if (!dates || dates.length === 0) return 0;
  const uniqueDates = new Set(dates);
  const parts = todayKey.split("-").map(Number);
  const cur = new Date(parts[0], parts[1] - 1, parts[2]);

  const todayStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(
    cur.getDate()
  ).padStart(2, "0")}`;

  const checkDate = new Date(cur.getTime());
  if (!uniqueDates.has(todayStr)) {
    checkDate.setDate(checkDate.getDate() - 1);
    const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(checkDate.getDate()).padStart(2, "0")}`;
    if (!uniqueDates.has(yesterdayStr)) {
      return 0;
    }
  }

  let count = 0;
  while (true) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(checkDate.getDate()).padStart(2, "0")}`;
    if (uniqueDates.has(key)) {
      count++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/* ---------- BORROWER PRE-SCREENING CONSENT ---------- */
export const CONSENT_KEY = "patrata_borrower_consent";

export function getConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CONSENT_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveConsent(agreed: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CONSENT_KEY, agreed ? "true" : "false");
  } catch {
    /* ignore storage errors */
  }
}
