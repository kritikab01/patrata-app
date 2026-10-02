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
  } catch {}
}

export function clearCheckHistory() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
