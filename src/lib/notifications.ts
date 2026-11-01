import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Bill } from '@/data/types';
import { addDays, fromISODate } from './dates';
import { formatINR } from './money';

const CHANNEL = 'bills';
const REMIND_HOUR = 9;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  if (Platform.OS === 'android') {
    // Android 13+ only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Bill reminders',
      // eslint-disable-next-line import/namespace -- re-exported via export *, verified by tsc
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#58CC02',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/** Cancels and re-creates the reminder for every active bill. */
export async function rescheduleBillReminders(bills: Bill[]) {
  if (!(await ensureNotificationPermission())) return;

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.kind === 'bill')
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );

  const now = Date.now();
  for (const bill of bills.filter((b) => b.active)) {
    const due = fromISODate(bill.next_due_date);
    const candidates = [addDays(due, -bill.remind_days_before), due].map((d) => {
      d.setHours(REMIND_HOUR, 0, 0, 0);
      return d;
    });
    const when = candidates.find((d) => d.getTime() > now);
    if (!when) continue;

    const isDueDay = when.getTime() === candidates[1].getTime();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: isDueDay ? `💸 ${bill.name} is due today` : `⏰ ${bill.name} due in ${bill.remind_days_before} day${bill.remind_days_before === 1 ? '' : 's'}`,
        body: `${formatINR(bill.amount)} — tap to mark it paid in Fundly.`,
        data: { kind: 'bill', billId: bill.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
    });
  }
}
