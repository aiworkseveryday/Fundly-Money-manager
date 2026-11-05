import { router, type Href } from 'expo-router';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { ListRow } from '@/components/bits';
import { Screen } from '@/components/Screen';
import { usePendingCount } from '@/data/hooks';
import { smsSupported } from '@/sms/sync';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, space } from '@/theme/tokens';

export default function More() {
  const { colors } = useTheme();
  const pendingCount = usePendingCount();

  const rows: { icon: string; color: string; title: string; subtitle: string; href: Href; badge?: number }[] = [
    { icon: 'bank', color: palette.blue, title: 'Accounts', subtitle: 'Cash, bank, UPI & credit cards', href: '/accounts' },
    { icon: 'clipboard-check', color: palette.blue, title: 'Monthly plan', subtitle: 'Your sheet: must-pays and spend groups', href: '/plan' },
    { icon: 'bank', color: palette.red, title: 'Loans', subtitle: 'What you owe, debt-free date, prepay simulator', href: '/loans' },
    { icon: 'receipt', color: palette.orange, title: 'Bills & reminders', subtitle: 'Rent, EMIs, subscriptions', href: '/bills' },
    ...(smsSupported
      ? [{ icon: 'message-text', color: palette.purple, title: 'SMS inbox', subtitle: 'Review transactions from bank SMS', href: '/sms-inbox' as Href, badge: pendingCount }]
      : []),
    { icon: 'shape', color: '#FF86D0', title: 'Categories', subtitle: 'Edit names, icons and colors', href: '/categories' },
    { icon: 'trophy', color: palette.yellow, title: 'Achievements', subtitle: 'Streaks, XP and badges', href: '/achievements' },
    { icon: 'cog', color: colors.textMuted, title: 'Settings', subtitle: 'Theme, app lock, export, sign out', href: '/settings' },
  ];

  return (
    <Screen>
      <AppText variant="title">More</AppText>
      <Card style={{ gap: space.xs, paddingVertical: space.sm }}>
        {rows.map((r) => (
          <ListRow
            key={r.title}
            icon={r.icon}
            color={r.color}
            title={r.title}
            subtitle={r.subtitle}
            onPress={() => router.push(r.href)}
            right={
              r.badge ? (
                <AppText variant="label" color="#fff" style={{ backgroundColor: colors.danger, borderRadius: 12, paddingHorizontal: 8, overflow: 'hidden' }}>
                  {r.badge}
                </AppText>
              ) : undefined
            }
          />
        ))}
      </Card>
    </Screen>
  );
}
