import { activeItems, isPaid, planActuals, starterRows } from './plan';

describe('plan', () => {
  const items = [
    { id: 'tea', grp: 'health' as const, category_id: null, match_text: 'tea, chai' },
    { id: 'food', grp: 'health' as const, category_id: 'cat-food', match_text: null },
    { id: 'emi', grp: 'fixed' as const, category_id: null, match_text: 'car loan' },
    { id: 'prepay', grp: 'saving' as const, category_id: null, match_text: 'car loan prepay, prepay' },
  ];

  it('counts each transaction once, by note words first, then category', () => {
    const { byItem, unplanned } = planActuals(items, [
      { id: '1', kind: 'expense', amount: 20, category_id: 'cat-food', note: 'Tea' },
      { id: '2', kind: 'expense', amount: 250, category_id: 'cat-food', note: 'Swiggy' },
      { id: '3', kind: 'expense', amount: 11100, category_id: null, note: 'Car loan EMI' },
      { id: '4', kind: 'expense', amount: 99, category_id: 'cat-shop', note: 'Amazon' },
      { id: '5', kind: 'income', amount: 1000, category_id: null, note: 'tea refund' },
      { id: '6', kind: 'transfer', amount: 5000, category_id: null, note: null },
      { id: '7', kind: 'transfer', amount: 8800, category_id: null, note: 'Into atom: Car loan prepay' },
      { id: '8', kind: 'expense', amount: 300, category_id: 'cat-food', note: 'Steak house' },
    ]);
    expect(byItem.get('prepay')).toBe(8800);
    expect(byItem.get('tea')).toBe(20);
    expect(byItem.get('food')).toBe(550);
    expect(byItem.get('emi')).toBe(11100);
    expect(unplanned).toBe(99);
  });

  it('puts unmatched spends in the miscellaneous buffer when there is one', () => {
    const misc = { id: 'misc', grp: 'misc' as const, category_id: null, match_text: null };
    const { byItem, unplanned } = planActuals([...items, misc], [{ id: '1', kind: 'expense', amount: 99, category_id: 'cat-shop', note: 'Amazon' }]);
    expect(byItem.get('misc')).toBe(99);
    expect(unplanned).toBe(0);
  });

  it('matches plan words against the category name too', () => {
    const rent = { id: 'rent', grp: 'fixed' as const, category_id: null, match_text: 'rent' };
    const { byItem } = planActuals([rent], [{ id: '1', kind: 'expense', amount: 8500, category_id: 'c', note: 'ATM WDL', category: { name: 'Rent' } }]);
    expect(byItem.get('rent')).toBe(8500);
  });

  it('marks checklist items paid near the planned amount', () => {
    expect(isPaid(11100, 11100, false)).toBe(true);
    expect(isPaid(11100, 5000, false)).toBe(false);
    expect(isPaid(11100, 0, true)).toBe(true);
  });

  it('ends hair-care items after six months', () => {
    const rows = starterRows(new Date(2026, 10, 5));
    const serum = rows.find((r) => r.name === 'Hair serum')!;
    expect(serum.starts_on).toBe('2026-11-01');
    expect(serum.ends_on).toBe('2027-04-30');
    expect(activeItems([serum], new Date(2027, 3, 10))).toHaveLength(1);
    expect(activeItems([serum], new Date(2027, 4, 1))).toHaveLength(0);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    expect(total).toBeLessThanOrEqual(110948);
  });
});
