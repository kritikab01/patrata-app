export function formatINR(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  const rounded = Math.round(value);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const s = abs.toString();
  const lastThree = s.slice(-3);
  const otherNumbers = s.slice(0, -3);
  const formatted =
    otherNumbers !== ""
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree
      : lastThree;
  return (negative ? "−" : "") + "₹" + formatted;
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  return Math.round(value * 100) + "%";
}

export function formatMonths(months: number | null | undefined): string {
  if (months == null || isNaN(months)) return "—";
  if (months < 12) return `${months} months`;
  const years = months / 12;
  if (Number.isInteger(years)) return `${years} years`;
  return `${months} months`;
}

export function generateRequestId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 16; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function num(v: string): number {
  if (v === "") return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

export function formatNotice(code: string): string {
  if (!code) return "";
  const known: Record<string, string> = {
    approval_model_not_used:
      "The approval model isn't used for this product, so the policy rules decided.",
    model_policy_conflict:
      "The approval model and the policy rules disagree, so a credit officer should review.",
    outside_training_range:
      "This applicant is unlike the data the model learned from. Treat the model score with caution.",
    new_to_credit:
      "No credit history, so the decision relies on income and policy rules.",
  };
  if (known[code]) {
    return known[code];
  }
  const text = code.replace(/_/g, " ").trim();
  if (!text) return "";
  const sentence = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  return sentence.endsWith(".") ? sentence : sentence + ".";
}

