import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { View } from 'react-native';

import type { IconName } from '@/components/Button3D';
import { useBills, useInvalidate } from '@/data/hooks';
import { rescheduleBillReminders } from '@/lib/notifications';
import { syncSms } from '@/sms/sync';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, tint } from '@/theme/tokens';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-variant' },
  { name: 'activity', title: 'Activity', icon: 'format-list-bulleted-square' },
  { name: 'insights', title: 'Insights', icon: 'chart-donut' },
  { name: 'goals', title: 'Goals', icon: 'piggy-bank' },
  { name: 'more', title: 'More', icon: 'dots-grid' },
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
  useStartupSync();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.info,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 2,
          height: 76,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontFamily: fonts.heavy, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 2,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: focused ? colors.info : 'transparent',
                  backgroundColor: focused ? tint(colors.info, 0.12) : 'transparent',
                }}>
                <MaterialCommunityIcons name={t.icon} size={24} color={color as string} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
