/* Loan maths for the Tools tab. Pure functions, no network: they work even when
   the Patrata engine is asleep. Amounts in rupees, rates in % a year, terms in months. */

export function emi(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months; // no-cost EMI
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

export type YearSplit = { year: number; principal: number; interest: number };

/** Principal and interest paid in each loan year (last year may be partial). */
export function yearlySplit(principal: number, annualRatePct: number, months: number): YearSplit[] {
  const r = annualRatePct / 12 / 100;
  const pay = emi(principal, annualRatePct, months);
  const out: YearSplit[] = [];
  let bal = principal;
  for (let m = 0; m < months; m++) {
    const y = Math.floor(m / 12);
    if (!out[y]) out[y] = { year: y + 1, principal: 0, interest: 0 };
    const i = bal * r;
    const p = Math.min(pay - i, bal);
    bal -= p;
    out[y].principal += p;
    out[y].interest += i;
  }
  return out;
}

export type EmiSummary = { emi: number; totalInterest: number; totalPaid: number; interestShare: number };

export function emiSummary(principal: number, annualRatePct: number, months: number): EmiSummary {
  const e = emi(principal, annualRatePct, months);
  const totalPaid = e * months;
  const totalInterest = Math.max(totalPaid - principal, 0);
  return { emi: e, totalInterest, totalPaid, interestShare: totalPaid > 0 ? totalInterest / totalPaid : 0 };
}

/** Largest loan whose EMI keeps total EMIs within foirCap of monthly income. */
export function borrowPower(
  monthlyIncome: number,
  existingEmi: number,
  annualRatePct: number,
  months: number,
  foirCap = 0.5
): { affordableEmi: number; maxLoan: number } {
  const affordableEmi = Math.max(monthlyIncome * foirCap - existingEmi, 0);
  const r = annualRatePct / 12 / 100;
  const maxLoan = r === 0 ? affordableEmi * months : (affordableEmi * (1 - Math.pow(1 + r, -months))) / r;
  return { affordableEmi, maxLoan: Math.max(maxLoan, 0) };
}

/** One lump-sum prepayment after `atMonth` EMIs, keeping the EMI the same (tenure shortens). */
export function prepaymentSavings(
  principal: number,
  annualRatePct: number,
  months: number,
  prepayAmount: number,
  atMonth: number
): { interestSaved: number; monthsSaved: number; newMonths: number } {
  const r = annualRatePct / 12 / 100;
  const pay = emi(principal, annualRatePct, months);
  const base = emiSummary(principal, annualRatePct, months).totalInterest;
  let bal = principal;
  let interest = 0;
  let m = 0;
  while (bal > 0.5 && m < months) {
    const i = bal * r;
    interest += i;
    bal -= Math.min(pay - i, bal);
    m += 1;
    if (m === atMonth) bal = Math.max(bal - prepayAmount, 0);
  }
  return { interestSaved: Math.max(base - interest, 0), monthsSaved: Math.max(months - m, 0), newMonths: m };
}

/** EMI burden (FOIR): all EMIs as a share of monthly income. */
export function foir(monthlyIncome: number, existingEmi: number, newEmi: number): number {
  return monthlyIncome > 0 ? (existingEmi + newEmi) / monthlyIncome : 0;
}

export type FoirZone = "comfortable" | "review" | "high";
export function foirZone(f: number): FoirZone {
  return f <= 0.5 ? "comfortable" : f <= 0.6 ? "review" : "high";
}

/** ₹ in Indian format, e.g. 500000 -> "₹5,00,000". */
export function inr(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  const s = Math.round(Math.abs(v)).toString();
  const last = s.slice(-3);
  const rest = s.slice(0, -3);
  return (v < 0 ? "−" : "") + "₹" + (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last : last);
}

/** Amount in words, e.g. 500000 -> "5 lakh", 25000000 -> "2.5 crore". */
export function inWords(v: number): string {
  if (v >= 1e7) return `${+(v / 1e7).toFixed(2)} crore`;
  if (v >= 1e5) return `${+(v / 1e5).toFixed(2)} lakh`;
  if (v >= 1e3) return `${+(v / 1e3).toFixed(1)} thousand`;
  return `${Math.round(v)}`;
}
