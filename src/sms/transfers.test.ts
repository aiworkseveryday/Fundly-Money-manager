import type { SmsPending } from '@/data/types';
import { parseBankSms } from './parser';
import { ATOMS, buildInbox } from './transfers';

const accounts = [
  { id: 'cash', name: 'Cash', type: 'cash' as const, sms_last4: null, sms_keywords: null },
  { id: 'idfc', name: 'IDFC', type: 'bank' as const, sms_last4: '4321', sms_keywords: null },
  { id: 'slice', name: 'slice', type: 'bank' as const, sms_last4: null, sms_keywords: 'slice, nesfb, slceit' },
  { id: 'hdfc', name: 'HDFC Bank', type: 'bank' as const, sms_last4: '9988', sms_keywords: null },
];

let n = 0;
function sms(sender: string, body: string, minute: number): SmsPending {
  const p = parseBankSms(body, sender);
  if (!p) throw new Error(`not parsed: ${body}`);
  n += 1;
  return {
    id: `s${n}`,
    sms_hash: `h${n}`,
    sender,
    body,
    kind: p.kind,
    amount: p.amount,
    merchant: p.merchant,
    account_last4: p.accountLast4,
    atom: p.atom ?? null,
    atom_dir: p.atomDir ?? null,
    occurred_at: new Date(Date.UTC(2026, 10, 5, 10, minute)).toISOString(),
    status: 'pending',
  };
}

describe('slice atom messages', () => {
  it.each([
    ['₹500 added to your atom "Internet bills" successfully.', 'Internet bills', 'in'],
    ['Rs.500 moved from IDFC to your Internet bills atom', 'Internet bills', 'in'],
    ['₹1,200 added to atom: Rent. Keep saving!', 'Rent', 'in'],
    ['₹300 withdrawn from your atom "Trip" to slice balance', 'Trip', 'out'],
    ['Rs 300 moved from Trip atom to your slice account', 'Trip', 'out'],
  ])('%s', (body, atom, dir) => {
    const p = parseBankSms(body, 'JD-SLCEIT');
    expect(p).toMatchObject({ atom, atomDir: dir });
  });
});

describe('buildInbox', () => {
  it('merges an IDFC debit and slice atom credit into one transfer', () => {
    const items = buildInbox(
      [
        sms('JD-IDFCFB', 'Your A/C XX4321 is debited by INR 500.00 on 05/11 towards UPI to slice@nesfb. IDFC FIRST Bank', 1),
        sms('JD-SLCEIT', '₹500 added to your atom "Internet bills" successfully.', 2),
      ],
      accounts,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'transfer', fromId: 'idfc', toId: ATOMS, atom: { name: 'Internet bills', dir: 'in' } });
  });

  it('merges an IDFC debit and slice credit into one transfer', () => {
    const items = buildInbox(
      [
        sms('JD-IDFCFB', 'Your A/C XX4321 is debited by INR 5,000.00 towards UPI to sliceit@upi', 1),
        sms('AX-SLCEIT', 'Rs.5000 credited to your slice account from IDFC FIRST', 3),
      ],
      accounts,
    );
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'transfer', fromId: 'idfc', toId: 'slice', amount: 5000 });
  });

  it('treats a lone debit to an own account as a transfer, not a spend', () => {
    const [item] = buildInbox([sms('JD-IDFCFB', 'Your A/C XX4321 is debited by INR 2,000.00 towards UPI to slice@nesfb', 1)], accounts);
    expect(item).toMatchObject({ kind: 'transfer', fromId: 'idfc', toId: 'slice' });
  });

  it('keeps normal spends and income as they are', () => {
    const items = buildInbox(
      [
        sms('JD-IDFCFB', 'Your A/C XX4321 is debited by INR 120.00 towards UPI to swiggy@icici', 1),
        sms('JD-IDFCFB', 'Your A/C XX4321 is credited with INR 1,10,948.00 from ACME PVT LTD', 40),
      ],
      accounts,
    );
    expect(items.map((i) => i.kind)).toEqual(['income', 'expense']);
    expect(items[1].accountId).toBe('idfc');
  });

  it('does not pair a spend with an unrelated credit of a different amount', () => {
    const items = buildInbox(
      [
        sms('JD-IDFCFB', 'Your A/C XX4321 is debited by INR 120.00 towards UPI to swiggy@icici', 1),
        sms('VM-HDFCBK', 'Rs.100 credited to a/c XX9988 from RAVI', 2),
      ],
      accounts,
    );
    expect(items).toHaveLength(2);
  });

  it('spots EMI debits by loan words or by amount', () => {
    const loans = [
      { id: 'pl', name: 'Personal loan', emi: 34383, sms_match: 'personal loan' },
      { id: 'car', name: 'Car loan', emi: 11100, sms_match: 'car loan' },
    ];
    const items = buildInbox(
      [
        sms('JD-IDFCFB', 'Your A/C XX4321 is debited by INR 34,383.00 towards ACH-DR LOAN EMI', 1),
        sms('JD-IDFCFB', 'Your A/C XX4321 is debited by INR 11,100.00 for Car Loan EMI', 30),
        sms('JD-IDFCFB', 'Your A/C XX4321 is debited by INR 450.00 towards UPI to dmart@icici', 60),
      ],
      accounts,
      loans,
    );
    expect(items.map((i) => i.loanId)).toEqual([undefined, 'car', 'pl']);
  });
});
