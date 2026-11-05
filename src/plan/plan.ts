import type { PlanGroup, PlanItem, Transaction } from '@/data/types';
import { addMonths, startOfMonth, toISODate } from '@/lib/dates';

/** Groups follow the colour bands of the user's own monthly sheet. */
export const PLAN_GROUPS: { id: PlanGroup; label: string; color: string; icon: string }[] = [
  { id: 'fixed', label: 'Rent & EMIs', color: '#FF4B4B', icon: 'home-city' },
  { id: 'saving', label: 'Savings & prepay', color: '#1CB0F6', icon: 'piggy-bank' },
  { id: 'bills', label: 'Bills', color: '#FF9600', icon: 'flash' },
  { id: 'travel', label: 'Travel', color: '#58CC02', icon: 'bus' },
  { id: 'health', label: 'Food & fitness', color: '#FFC800', icon: 'dumbbell' },
  { id: 'care', label: 'Hair care', color: '#FF86D0', icon: 'face-man-shimmer' },
  { id: 'misc', label: 'Everything else', color: '#AFAFAF', icon: 'dots-horizontal' },
];

export const groupMeta = (g: PlanGroup) => PLAN_GROUPS.find((x) => x.id === g) ?? PLAN_GROUPS[PLAN_GROUPS.length - 1];

/** Items that apply to the month, e.g. hair care stops after its end date. */
export function activeItems<T extends Pick<PlanItem, 'starts_on' | 'ends_on'>>(items: T[], month: Date): T[] {
  const first = toISODate(startOfMonth(month));
  const last = toISODate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
  return items.filter((i) => i.starts_on <= last && (!i.ends_on || i.ends_on >= first));
}

const words = (s: string | null) =>
  (s ?? '')
    .split(',')
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);

type Tx = Pick<Transaction, 'id' | 'kind' | 'amount' | 'category_id' | 'note'> & { category?: { name: string } | null };

/**
 * Splits the month's money-out across plan items. A transaction counts once: first for an item whose words
 * appear in its note ("tea", "emi"), otherwise for an item with the same category. The rest goes to the
 * miscellaneous buffer, or counts as unplanned when there is none.
 */
export function planActuals(items: Pick<PlanItem, 'id' | 'grp' | 'category_id' | 'match_text'>[], txs: Tx[]) {
  const byItem = new Map<string, number>();
  let unplanned = 0;
  // a "Miscellaneous" line with no words or category is the buffer for everything else
  const catchAll = items.find((i) => i.grp === 'misc' && !i.match_text && !i.category_id);
  for (const t of txs) {
    if (t.kind === 'income') continue;
    // words match the note or the category name: an ATM SMS filed under "Rent" still counts as rent
    const note = ` ${(t.note ?? '').toLowerCase()} ${(t.category?.name ?? '').toLowerCase()}`;
    // longest matching word wins: "car loan prepay" belongs to "prepay"-ish items over "car loan"
    let best: { id: string; len: number } | undefined;
    for (const i of items) {
      for (const w of words(i.match_text)) {
        if (w.length > (best?.len ?? 0) && new RegExp(String.raw`[^a-z0-9]` + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(note)) {
          best = { id: i.id, len: w.length };
        }
      }
    }
    const hit =
      (best && items.find((i) => i.id === best.id)) ??
      (t.kind === 'expense' ? items.find((i) => i.category_id && i.category_id === t.category_id) : undefined);
    if (hit) byItem.set(hit.id, (byItem.get(hit.id) ?? 0) + t.amount);
    // moving money between your own accounts is not spending
    else if (t.kind === 'expense') {
      if (catchAll) byItem.set(catchAll.id, (byItem.get(catchAll.id) ?? 0) + t.amount);
      else unplanned += t.amount;
    }
  }
  return { byItem, unplanned };
}

/** A checklist item (EMI, rent) counts as paid once ~90% of it shows up, or when ticked by hand. */
export const isPaid = (planned: number, actual: number, ticked: boolean) => ticked || actual >= planned * 0.9;

type Starter = Omit<PlanItem, 'id' | 'category_id' | 'starts_on' | 'sort_order'> & { months?: number };

/** The user's own monthly sheet, with the suggested cuts (tea, supplements) already applied. */
export const STARTER_PLAN: Starter[] = [
  { name: 'Rent', amount: 8500, grp: 'fixed', match_text: 'rent', is_checklist: true, ends_on: null },
  { name: 'Personal loan EMI', amount: 34383, grp: 'fixed', match_text: 'personal loan, pl emi', is_checklist: true, ends_on: null },
  { name: 'Car loan EMI', amount: 11100, grp: 'fixed', match_text: 'car loan', is_checklist: true, ends_on: null },
  { name: 'Home fund', amount: 10000, grp: 'saving', match_text: 'home fund', is_checklist: true, ends_on: null },
  { name: 'Savings', amount: 10000, grp: 'saving', match_text: 'savings', is_checklist: true, ends_on: null },
  { name: 'Car loan prepay', amount: 8800, grp: 'saving', match_text: 'car loan prepay, prepay', is_checklist: true, ends_on: null },
  { name: 'Electricity bill', amount: 1000, grp: 'bills', match_text: 'electricity, eb bill, tneb', is_checklist: true, ends_on: null },
  { name: 'Internet', amount: 1000, grp: 'bills', match_text: 'internet, broadband, wifi', is_checklist: true, ends_on: null },
  { name: 'Mobile', amount: 399, grp: 'bills', match_text: 'mobile, recharge', is_checklist: true, ends_on: null },
  { name: 'Travel to home', amount: 2000, grp: 'travel', match_text: 'travel, bus, train', is_checklist: false, ends_on: null },
  { name: "Fuel (friend's car)", amount: 1000, grp: 'travel', match_text: 'fuel, petrol', is_checklist: false, ends_on: null },
  { name: 'Eggs (4 a day)', amount: 900, grp: 'health', match_text: 'egg', is_checklist: false, ends_on: null },
  { name: 'Chicken (3–4 days a week)', amount: 1500, grp: 'health', match_text: 'chicken', is_checklist: false, ends_on: null },
  { name: 'Whey protein', amount: 2500, grp: 'health', match_text: 'whey, protein', is_checklist: false, ends_on: null },
  { name: 'Milk', amount: 600, grp: 'health', match_text: 'milk', is_checklist: false, ends_on: null },
  { name: 'Oats', amount: 500, grp: 'health', match_text: 'oats', is_checklist: false, ends_on: null },
  { name: 'Peanut butter', amount: 500, grp: 'health', match_text: 'peanut', is_checklist: false, ends_on: null },
  { name: 'Creatine', amount: 699, grp: 'health', match_text: 'creatine', is_checklist: false, ends_on: null },
  { name: 'Tea', amount: 1500, grp: 'health', match_text: 'tea, chai', is_checklist: false, ends_on: null },
  { name: 'Hair treatment', amount: 3800, grp: 'care', match_text: 'hair treatment, clinic', is_checklist: true, ends_on: null, months: 6 },
  { name: 'Hair serum', amount: 1500, grp: 'care', match_text: 'serum', is_checklist: false, ends_on: null, months: 6 },
  { name: 'Shampoo & lotion', amount: 1500, grp: 'care', match_text: 'shampoo, lotion', is_checklist: false, ends_on: null, months: 6 },
  { name: 'Sunscreen / moisturiser', amount: 1000, grp: 'care', match_text: 'sunscreen, moisturi', is_checklist: false, ends_on: null },
  { name: 'Hair vitamin tablets', amount: 1200, grp: 'care', match_text: 'vitamin, tablet', is_checklist: false, ends_on: null, months: 6 },
  { name: 'Miscellaneous', amount: 5000, grp: 'misc', match_text: null, is_checklist: false, ends_on: null },
];

/** Starter rows ready to insert, starting this month; hair-treatment items end after 6 months. */
export function starterRows(today = new Date()): Omit<PlanItem, 'id'>[] {
  const start = startOfMonth(today);
  return STARTER_PLAN.map(({ months, ...p }, i) => ({
    ...p,
    category_id: null,
    starts_on: toISODate(start),
    // last day of the final month
    ends_on: months ? toISODate(new Date(addMonths(start, months).getTime() - 86_400_000)) : null,
    sort_order: i,
  }));
}

export const SALARY = 110948;
