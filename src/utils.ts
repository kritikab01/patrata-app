export function formatINR(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return "—";
  const rounded = Math.round(value);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const s = abs.toString();
  let lastThree = s.slice(-3);
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
