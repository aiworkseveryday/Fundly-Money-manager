import type { Loan } from '@/data/types';
import { loanState, outstandingFrom, projection, simulatePrepay, totalOwedSeries } from './loans';

const base: Loan = {
  id: 'car',
  name: 'Car loan',
  lender: null,
  emi: 11100,
  annual_rate: 11.5,
  outstanding: outstandingFrom(11100, 11.5, 44),
  as_of: '2026-11-05',
  total_months: null,
  emi_day: 5,
  account_id: null,
  sms_match: null,
  prepay_per_year: 2,
  color: '#FF9600',
  closed_at: null,
};

describe('loan maths', () => {
  it('works out what is owed from EMI, rate and months left', () => {
    expect(outstandingFrom(11100, 11.5, 44)).toBeCloseTo(397_000, -3);
    expect(outstandingFrom(34383, 10.49, 45)).toBeCloseTo(1_274_800, -4);
    expect(outstandingFrom(1000, 0, 12)).toBe(12000);
  });

  it('pays the loan off in the months that were given', () => {
    const p = projection(base.outstanding, base.emi, base.annual_rate);
    expect(p.months).toBe(44);
    expect(p.finishes).toBe(true);
    expect(p.interest).toBeGreaterThan(80_000);
  });

  it('shows what a prepayment saves', () => {
    const s = simulatePrepay(base.outstanding, base.emi, base.annual_rate, 53_000);
    expect(s.monthsSaved).toBeGreaterThanOrEqual(5);
    expect(s.interestSaved).toBeGreaterThan(10_000);
  });

  it('replays EMIs and prepayments', () => {
    const st = loanState(
      base,
      [
        { id: 'p1', loan_id: 'car', kind: 'emi', amount: 11100, paid_on: '2026-11-05', transaction_id: null },
        { id: 'p2', loan_id: 'car', kind: 'prepay', amount: 50000, paid_on: '2026-11-20', transaction_id: null },
        { id: 'x', loan_id: 'other', kind: 'emi', amount: 999, paid_on: '2026-11-05', transaction_id: null },
      ],
      new Date(2026, 10, 25),
    );
    const interest = base.outstanding * (11.5 / 1200);
    expect(st.balance).toBeCloseTo(base.outstanding - (11100 - interest) - 50000, 0);
    expect(st.paidThisMonth).toBe(true);
    expect(st.nextDue.getMonth()).toBe(11);
    expect(st.prepaysThisYear).toBe(1);
    expect(st.monthsLeft).toBeLessThan(43);
    expect(st.history).toHaveLength(3);
  });

  it('adds loans up month by month for the chart', () => {
    const s = totalOwedSeries([
      { balance: 1000, emi: 600, annual_rate: 0 },
      { balance: 300, emi: 100, annual_rate: 0 },
    ]);
    expect(s).toEqual([1300, 600, 100, 0]);
  });
});
