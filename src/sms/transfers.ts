import type { Account, Loan, SmsPending } from '@/data/types';

type Acct = Pick<Account, 'id' | 'name' | 'type' | 'sms_last4' | 'sms_keywords'>;
type LoanLite = Pick<Loan, 'id' | 'name' | 'emi' | 'sms_match'>;

/** Hidden account that holds money parked in slice atoms (savings pots). Created on first use. */
export const ATOMS_ACCOUNT_NAME = 'slice atoms';
export const ATOMS = '__atoms__';

/** Two SMS about the same money move (e.g. IDFC debit + slice credit) arrive within this window. */
const PAIR_WINDOW_MS = 15 * 60_000;

export type InboxItem = {
  key: string;
  /** one message, or the debit + credit pair of an own-account transfer */
  rows: SmsPending[];
  amount: number;
  occurred_at: string;
  kind: 'expense' | 'income' | 'transfer';
  /** expense/income: the account the money left or reached */
  accountId?: string;
  /** transfer ends; ATOMS when the atoms account does not exist yet */
  fromId?: string;
  toId?: string;
  atom?: { name: string; dir: 'in' | 'out' };
  /** a debit that looks like this loan's EMI */
  loanId?: string;
};

const isAtomsAccount = (a: Acct) => a.name.trim().toLowerCase() === ATOMS_ACCOUNT_NAME;

/** Words that point to this account in SMS text: its keywords, else the first word of its name. */
export function accountKeywords(a: Acct): string[] {
  const words = (a.sms_keywords ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 2);
  if (words.length) return words;
  const first = a.name.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
  return a.type !== 'cash' && first.length >= 3 && !isAtomsAccount(a) ? [first] : [];
}

/** Index of the first keyword that starts a word in text, or -1 */
function mentionIndex(text: string, words: string[]): number {
  let best = -1;
  for (const w of words) {
    const m = new RegExp(String.raw`(?:^|[^a-z0-9])` + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').exec(text);
    if (m && (best < 0 || m.index < best)) best = m.index;
  }
  return best;
}

/** The account an SMS is about: matched by card/account digits, then by the sender id (e.g. "JD-IDFCFB"). */
export function ownAccount(sms: Pick<SmsPending, 'account_last4' | 'sender'>, accounts: Acct[]): Acct | undefined {
  const l4 = sms.account_last4?.slice(-4);
  const byDigits = l4 ? accounts.find((a) => a.sms_last4 && a.sms_last4.endsWith(l4)) : undefined;
  if (byDigits) return byDigits;
  const sender = sms.sender ?? '';
  return accounts.find((a) => accountKeywords(a).some((w) => sender.toLowerCase().includes(w)));
}

/** Another of the user's accounts named in the message, which makes it an own-account transfer. */
export function otherAccount(sms: Pick<SmsPending, 'body' | 'merchant'>, accounts: Acct[], ownId: string | undefined): Acct | undefined {
  const text = `${sms.merchant ?? ''} ${sms.body}`;
  let best: { a: Acct; i: number } | undefined;
  for (const a of accounts) {
    if (a.id === ownId || isAtomsAccount(a)) continue;
    const i = mentionIndex(text, accountKeywords(a));
    if (i >= 0 && (!best || i < best.i)) best = { a, i };
  }
  return best?.a;
}

/** The loan whose EMI this debit looks like: its SMS words appear in the text, or the amount is the EMI. */
export function matchLoan(sms: Pick<SmsPending, 'body' | 'merchant' | 'amount'>, loans: LoanLite[]): string | undefined {
  const text = `${sms.merchant ?? ''} ${sms.body}`;
  const byWords = loans.find((l) =>
    mentionIndex(
      text,
      (l.sms_match ?? '')
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .filter((w) => w.length >= 3),
    ) >= 0,
  );
  if (byWords) return byWords.id;
  // banks round differently, so allow a rupee or two
  return loans.find((l) => Math.abs(l.emi - sms.amount) <= Math.max(2, l.emi * 0.002))?.id;
}

/**
 * Turns pending SMS into inbox cards. A debit and a credit of the same amount within a few minutes become
 * one transfer card, so moving ₹5,000 from IDFC to slice (or into a slice atom) is not counted twice or as a spend.
 */
export function buildInbox(pending: SmsPending[], accounts: Acct[], loans: LoanLite[] = []): InboxItem[] {
  const atomsId = accounts.find(isAtomsAccount)?.id ?? ATOMS;
  const rows = [...pending].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
  const used = new Set<string>();
  const items: InboxItem[] = [];

  for (const debit of rows) {
    if (used.has(debit.id) || debit.kind !== 'expense') continue;
    const t = Date.parse(debit.occurred_at);
    const credit = rows.find(
      (c) =>
        !used.has(c.id) &&
        c.kind === 'income' &&
        c.amount === debit.amount &&
        Math.abs(Date.parse(c.occurred_at) - t) <= PAIR_WINDOW_MS &&
        // same sender only when one side is an atom (slice moving money between balance and a pot)
        (c.sender !== debit.sender || !!c.atom || !!debit.atom),
    );
    if (!credit) continue;
    const fromId = debit.atom ? atomsId : ownAccount(debit, accounts)?.id;
    const toId = credit.atom ? atomsId : ownAccount(credit, accounts)?.id;
    if (fromId && fromId === toId) continue;
    used.add(debit.id);
    used.add(credit.id);
    const atomRow = credit.atom ? credit : debit.atom ? debit : undefined;
    items.push({
      key: `${debit.id}+${credit.id}`,
      rows: [debit, credit],
      amount: debit.amount,
      occurred_at: debit.occurred_at,
      kind: 'transfer',
      fromId,
      toId,
      atom: atomRow?.atom ? { name: atomRow.atom, dir: atomRow === credit ? 'in' : 'out' } : undefined,
    });
  }

  for (const sms of rows) {
    if (used.has(sms.id)) continue;
    const base = { key: sms.id, rows: [sms], amount: sms.amount, occurred_at: sms.occurred_at };
    const own = ownAccount(sms, accounts)?.id;
    if (sms.atom) {
      // e.g. slice: "₹500 added to atom Internet bills" from the slice balance
      const atom = { name: sms.atom, dir: sms.atom_dir ?? (sms.kind === 'income' ? 'in' : 'out') } as const;
      items.push({ ...base, kind: 'transfer', atom, fromId: atom.dir === 'in' ? own : atomsId, toId: atom.dir === 'in' ? atomsId : own });
      continue;
    }
    const other = otherAccount(sms, accounts, own)?.id;
    if (other) {
      items.push({ ...base, kind: 'transfer', fromId: sms.kind === 'expense' ? own : other, toId: sms.kind === 'expense' ? other : own });
    } else {
      items.push({ ...base, kind: sms.kind, accountId: own, loanId: sms.kind === 'expense' ? matchLoan(sms, loans) : undefined });
    }
  }

  return items.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}
