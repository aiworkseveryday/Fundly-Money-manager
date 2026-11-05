import type { Loan, LoanPayment } from '@/data/types';
import { addMonths, fromISODate, startOfMonth, toISODate } from '@/lib/dates';

const monthlyRate = (annual: number) => annual / 12 / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** What is still owed when `months` EMIs of `emi` remain at `annualRate` (standard reducing-balance EMI). */
export function outstandingFrom(emi: number, annualRate: number, months: number): number {
  const r = monthlyRate(annualRate);
  if (months <= 0) return 0;
  if (r === 0) return round2(emi * months);
  return round2((emi * (1 - Math.pow(1 + r, -months))) / r);
}

/** Month-by-month balances (after each EMI) until the loan is cleared; the last EMI is usually smaller. */
export function schedule(balance: number, emi: number, annualRate: number, maxMonths = 600): { balance: number; interest: number }[] {
  const r = monthlyRate(annualRate);
  const out: { balance: number; interest: number }[] = [];
  let b = balance;
  while (b > 0.5 && out.length < maxMonths) {
    const interest = b * r;
    // an EMI that doesn't cover the interest would never finish
    if (emi <= interest) break;
    b = Math.max(0, b + interest - emi);
    out.push({ balance: round2(b), interest: round2(interest) });
  }
  return out;
}

export function projection(balance: number, emi: number, annualRate: number) {
  const s = schedule(balance, emi, annualRate);
  const finishes = balance <= 0.5 || (s.length > 0 && s[s.length - 1].balance === 0);
  return { months: s.length, interest: round2(s.reduce((t, m) => t + m.interest, 0)), finishes, schedule: s };
}

export type LoanState = {
  balance: number;
  principalPaid: number;
  interestPaid: number;
  monthsLeft: number;
  interestLeft: number;
  /** false when the EMI no longer covers the interest */
  finishes: boolean;
  /** this month's EMI date, or next month's once this month is paid */
  nextDue: Date;
  paidThisMonth: boolean;
  debtFree: Date;
  /** share of the original loan repaid, when the full tenure is known */
  progress: number | null;
  prepaysThisYear: number;
  /** balance at the start of tracking and after each recorded payment, oldest first */
  history: { date: string; balance: number }[];
};

/** Replays recorded EMIs and prepayments on top of the balance the loan was added with. */
export function loanState(loan: Loan, payments: LoanPayment[], today = new Date()): LoanState {
  const r = monthlyRate(loan.annual_rate);
  const mine = payments.filter((p) => p.loan_id === loan.id).sort((a, b) => a.paid_on.localeCompare(b.paid_on));
  // payments before `as_of` are already inside `outstanding` (e.g. after typing the lender's figure)
  const replay = mine.filter((p) => p.paid_on >= loan.as_of);
  let balance = loan.outstanding;
  let principalPaid = 0;
  let interestPaid = 0;
  const history = [{ date: loan.as_of, balance }];
  for (const p of replay) {
    const interest = p.kind === 'emi' ? balance * r : 0;
    const principal = Math.min(balance, p.amount - interest);
    balance = round2(Math.max(0, balance - principal));
    principalPaid += principal;
    interestPaid += interest;
    history.push({ date: p.paid_on, balance });
  }

  const monthStart = toISODate(startOfMonth(today));
  const paidThisMonth = mine.some((p) => p.kind === 'emi' && p.paid_on >= monthStart);
  const thisMonthDue = new Date(today.getFullYear(), today.getMonth(), Math.min(loan.emi_day, 28));
  const nextDue = paidThisMonth ? addMonths(thisMonthDue, 1) : thisMonthDue;
  const proj = projection(balance, loan.emi, loan.annual_rate);
  const original = loan.total_months ? outstandingFrom(loan.emi, loan.annual_rate, loan.total_months) : null;

  return {
    balance,
    principalPaid: round2(principalPaid),
    interestPaid: round2(interestPaid),
    monthsLeft: proj.months,
    interestLeft: proj.interest,
    finishes: proj.finishes,
    nextDue,
    paidThisMonth,
    debtFree: addMonths(nextDue, Math.max(0, proj.months - 1)),
    progress: original ? Math.min(1, Math.max(0, 1 - balance / original)) : null,
    prepaysThisYear: mine.filter((p) => p.kind === 'prepay' && fromISODate(p.paid_on).getFullYear() === today.getFullYear()).length,
    history,
  };
}

/** What a one-off prepayment now does when the EMI stays the same (tenure gets shorter). */
export function simulatePrepay(balance: number, emi: number, annualRate: number, amount: number) {
  const before = projection(balance, emi, annualRate);
  const after = projection(Math.max(0, balance - amount), emi, annualRate);
  return {
    monthsSaved: before.months - after.months,
    interestSaved: round2(before.interest - after.interest),
    monthsAfter: after.months,
  };
}

/**
 * Total owed across loans, month by month from now until the last one is cleared, for the chart.
 * Month 0 is today's total.
 */
export function totalOwedSeries(loans: { balance: number; emi: number; annual_rate: number }[]): number[] {
  const schedules = loans.map((l) => [l.balance, ...schedule(l.balance, l.emi, l.annual_rate).map((m) => m.balance)]);
  const len = Math.max(1, ...schedules.map((s) => s.length));
  return Array.from({ length: len }, (_, i) => round2(schedules.reduce((t, s) => t + (s[i] ?? 0), 0)));
}

/** Loans the user described: EMI, rate and months left; outstanding is worked out on save. */
export const STARTER_LOANS = [
  { name: 'Personal loan', emi: 34383, annual_rate: 10.49, months_left: 45, sms_match: 'personal loan', color: '#FF4B4B' },
  { name: 'Car loan', emi: 11100, annual_rate: 11.5, months_left: 44, sms_match: 'car loan, vehicle loan, auto loan', color: '#FF9600' },
];
