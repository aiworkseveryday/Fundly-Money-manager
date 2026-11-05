import { analyseOther, groupKey } from './other';

const other = { name: 'Other' };
const food = { name: 'Food & Dining' };
const tx = (amount: number, note: string | null, category: { name: string } | null = other) => ({
  kind: 'expense',
  amount,
  note,
  occurred_at: '2026-11-05T10:00:00Z',
  category,
});

describe('analyseOther', () => {
  it('groups notes loosely', () => {
    expect(groupKey('Gym fees Nov')).toBe('gym fees');
    expect(groupKey('gym  fees!')).toBe('gym fees');
    expect(groupKey('  ')).toBeNull();
  });

  it('finds repeated and new spends under Other', () => {
    const a = analyseOther(
      [tx(600, 'Gym fees'), tx(600, 'gym fees'), tx(1500, 'Gift for amma'), tx(80, 'Parking'), tx(50, null), tx(300, 'Swiggy', food)],
      [tx(80, 'Parking')],
    );
    expect(a.total).toBe(2830);
    expect(a.prevTotal).toBe(80);
    expect(a.unnamed).toBe(1);
    expect(a.groups.map((g) => [g.label, g.count, g.isNew])).toEqual([
      ['Gift Amma', 1, true],
      ['Gym Fees', 2, true],
      ['Parking', 1, false],
    ]);
    expect(a.suggestions.map((s) => s.label)).toEqual(['Gift Amma', 'Gym Fees']);
    expect(a.share).toBeCloseTo(2830 / 3130);
  });
});
