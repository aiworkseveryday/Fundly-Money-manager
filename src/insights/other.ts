type Tx = { kind: string; amount: number; note: string | null; occurred_at: string; category: { name: string } | null };

export type OtherGroup = { label: string; count: number; total: number; isNew: boolean };

export type OtherAnalysis = {
  total: number;
  prevTotal: number;
  /** share of the month's spends that went under Other */
  share: number;
  groups: OtherGroup[];
  /** spends under Other with no note, so they can't be grouped */
  unnamed: number;
  /** groups worth their own category or plan line: repeated, or big */
  suggestions: OtherGroup[];
};

const isOther = (t: Tx) => t.kind === 'expense' && (!t.category || t.category.name.toLowerCase() === 'other');

const SMALL_WORDS = new Set(['a', 'an', 'the', 'for', 'to', 'at', 'of', 'from', 'in', 'on', 'with', 'and', 'my']);

/** "Gym fees Nov" and "gym fees" land together: lower-case, first two real words, no digits. */
export function groupKey(note: string | null): string | null {
  const words = (note ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !SMALL_WORDS.has(w));
  return words.length ? words.slice(0, 2).join(' ') : null;
}

const title = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

/** Looks at spends logged under "Other" (or no category) and finds what keeps coming up. */
export function analyseOther(month: Tx[], prevMonth: Tx[]): OtherAnalysis {
  const others = month.filter(isOther);
  const prevKeys = new Set(prevMonth.filter(isOther).map((t) => groupKey(t.note)));
  const spent = month.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0);

  const byKey = new Map<string, OtherGroup>();
  let unnamed = 0;
  for (const t of others) {
    const key = groupKey(t.note);
    if (!key) {
      unnamed += 1;
      continue;
    }
    const g = byKey.get(key) ?? { label: title(key), count: 0, total: 0, isNew: !prevKeys.has(key) };
    g.count += 1;
    g.total += t.amount;
    byKey.set(key, g);
  }
  const groups = [...byKey.values()].sort((a, b) => b.total - a.total);
  const total = others.reduce((s, t) => s + t.amount, 0);

  return {
    total,
    prevTotal: prevMonth.filter(isOther).reduce((s, t) => s + t.amount, 0),
    share: spent ? total / spent : 0,
    groups,
    unnamed,
    suggestions: groups.filter((g) => g.count >= 2 || g.total >= 1000).slice(0, 3),
  };
}
