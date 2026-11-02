import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TabIcon, type TabIconName } from '@/components/TabIcons';
import { useBills, useInvalidate } from '@/data/hooks';
import { rescheduleBillReminders } from '@/lib/notifications';
import { syncSms } from '@/sms/sync';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, palette, tint } from '@/theme/tokens';

// Each tab lights up in its own colour when selected
const TABS: { name: string; title: string; icon: TabIconName; color: string }[] = [
  { name: 'index', title: 'Home', icon: 'home', color: palette.green },
  { name: 'activity', title: 'Activity', icon: 'activity', color: palette.blue },
  { name: 'insights', title: 'Insights', icon: 'insights', color: palette.orange },
  { name: 'goals', title: 'Goals', icon: 'goals', color: palette.purple },
  { name: 'more', title: 'More', icon: 'more', color: '#FF86D0' },
];

/** Background jobs that run once the user is signed in. */
function useStartupSync() {
  const invalidate = useInvalidate();
  const bills = useBills();

  useEffect(() => {
    syncSms()
      .then((n) => {
        if (n > 0) invalidate();
      })
      .catch((e) => console.warn('SMS sync failed', e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (bills.data) rescheduleBillReminders(bills.data).catch((e) => console.warn('Reminder scheduling failed', e));
  }, [bills.data]);
}

export default function TabLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useStartupSync();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          // Include the Android navigation bar inset, otherwise it squeezes the icons out
          height: 68 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontFamily: fonts.heavy, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarActiveTintColor: t.color,
            tabBarIcon: ({ focused }) => (
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 3,
                  borderRadius: 14,
                  backgroundColor: focused ? tint(t.color, 0.18) : 'transparent',
                }}>
                <TabIcon name={t.icon} focused={focused} color={focused ? t.color : colors.tabInactive} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
