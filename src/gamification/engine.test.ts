import type { Profile } from '@/data/types';
import { applyActivity, levelFor, liveStreak } from './engine';

const base: Profile = {
  id: 'u1',
  display_name: 'me',
  streak_count: 0,
  longest_streak: 0,
  last_logged_on: null,
  xp: 0,
  badges: [],
};
const today = new Date(2026, 10, 2);

describe('applyActivity', () => {
  it('starts a streak and awards the first badge', () => {
    const r = applyActivity(base, 'log', today);
    expect(r.patch.streak_count).toBe(1);
    expect(r.patch.last_logged_on).toBe('2026-11-02');
    expect(r.newBadges.map((b) => b.id)).toEqual(['first_log']);
    expect(r.xpGained).toBe(10);
  });

  it('extends the streak from yesterday and does not double count today', () => {
    const p = { ...base, streak_count: 2, last_logged_on: '2026-11-01', badges: ['first_log'] };
    const r = applyActivity(p, 'log', today);
    expect(r.patch.streak_count).toBe(3);
    expect(r.newBadges.map((b) => b.id)).toEqual(['streak_3']);
    const again = applyActivity({ ...p, ...r.patch }, 'log', today);
    expect(again.patch.streak_count).toBe(3);
    expect(again.streakIncreased).toBe(false);
  });

  it('resets a broken streak but keeps the longest streak', () => {
    const p = { ...base, streak_count: 9, longest_streak: 9, last_logged_on: '2026-10-25' };
    const r = applyActivity(p, 'log', today);
    expect(r.patch.streak_count).toBe(1);
    expect(r.patch.longest_streak).toBe(9);
  });

  it('does not touch the streak for goal events', () => {
    const r = applyActivity(base, 'goal_contribution', today);
    expect(r.patch.streak_count).toBe(0);
    expect(r.xpGained).toBe(15);
  });
});

describe('levels and live streak', () => {
  it('computes levels', () => {
    expect(levelFor(0)).toEqual({ level: 1, intoLevel: 0, levelSize: 100 });
    expect(levelFor(100)).toEqual({ level: 2, intoLevel: 0, levelSize: 150 });
    expect(levelFor(260).level).toBe(3);
  });

  it('hides a broken streak', () => {
    expect(liveStreak({ streak_count: 5, last_logged_on: '2026-11-01' }, today)).toBe(5);
    expect(liveStreak({ streak_count: 5, last_logged_on: '2026-10-30' }, today)).toBe(0);
  });
});
