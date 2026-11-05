import { addDays, toISODate } from '@/lib/dates';
import type { Profile } from '@/data/types';

export type XpEvent = 'log' | 'sms_review' | 'goal_contribution' | 'goal_complete' | 'bill_paid';

export const XP_FOR: Record<XpEvent, number> = {
  log: 10,
  sms_review: 5,
  goal_contribution: 15,
  goal_complete: 50,
  bill_paid: 10,
};

export type Badge = { id: string; title: string; description: string; emoji: string };

export const BADGES: Badge[] = [
  { id: 'first_log', title: 'First Coin', description: 'Logged your first transaction', emoji: '🪙' },
  { id: 'streak_3', title: 'Warming Up', description: '3-day logging streak', emoji: '🔥' },
  { id: 'streak_7', title: 'On Fire', description: '7-day logging streak', emoji: '🚀' },
  { id: 'streak_30', title: 'Unstoppable', description: '30-day logging streak', emoji: '🏆' },
  { id: 'xp_500', title: 'Money Nerd', description: 'Earned 500 XP', emoji: '🤓' },
  { id: 'goal_getter', title: 'Goal Getter', description: 'Completed a savings goal', emoji: '💎' },
  { id: 'sms_sorter', title: 'Inbox Zero', description: 'Reviewed a bank SMS', emoji: '📬' },
];

export const badgeById = (id: string) => BADGES.find((b) => b.id === id);

/** XP needed to reach each level grows gently: 100, 250, 450, ... */
export function levelFor(xp: number) {
  let level = 1;
  let need = 100;
  let floor = 0;
  while (xp >= floor + need) {
    floor += need;
    level += 1;
    need += 50;
  }
  return { level, intoLevel: xp - floor, levelSize: need };
}

export type ActivityResult = {
  patch: Pick<Profile, 'xp' | 'streak_count' | 'longest_streak' | 'last_logged_on' | 'badges'>;
  xpGained: number;
  newBadges: Badge[];
  streakIncreased: boolean;
};

/** Pure function: applies an XP event to a profile and works out streak + badge changes. */
export function applyActivity(profile: Profile, event: XpEvent, today = new Date()): ActivityResult {
  const todayKey = toISODate(today);
  const yesterdayKey = toISODate(addDays(today, -1));
  let streak = profile.streak_count;
  let lastLogged = profile.last_logged_on;
  let streakIncreased = false;

  // Only logging money (manually, by SMS review, or paying a bill) keeps the streak alive.
  if (event === 'log' || event === 'sms_review' || event === 'bill_paid') {
    if (lastLogged !== todayKey) {
      streak = lastLogged === yesterdayKey ? streak + 1 : 1;
      lastLogged = todayKey;
      streakIncreased = true;
    }
  }

  const xp = profile.xp + XP_FOR[event];
  const owned = new Set(profile.badges);
  const earned: string[] = [];
  const award = (id: string, when: boolean) => {
    if (when && !owned.has(id)) {
      owned.add(id);
      earned.push(id);
    }
  };
  award('first_log', event === 'log' || event === 'sms_review');
  award('streak_3', streak >= 3);
  award('streak_7', streak >= 7);
  award('streak_30', streak >= 30);
  award('xp_500', xp >= 500);
  award('goal_getter', event === 'goal_complete');
  award('sms_sorter', event === 'sms_review');

  return {
    patch: {
      xp,
      streak_count: streak,
      longest_streak: Math.max(profile.longest_streak, streak),
      last_logged_on: lastLogged,
      badges: [...owned],
    },
    xpGained: XP_FOR[event],
    newBadges: earned.map((id) => badgeById(id)!),
    streakIncreased,
  };
}

/** Streak shown to the user: it is broken if the last log was before yesterday. */
export function liveStreak(profile: Pick<Profile, 'streak_count' | 'last_logged_on'>, today = new Date()) {
  const last = profile.last_logged_on;
  if (!last) return 0;
  if (last === toISODate(today) || last === toISODate(addDays(today, -1))) return profile.streak_count;
  return 0;
}
