import {
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from '@expo-google-fonts/nunito';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppLockGate } from '@/features/AppLock';
import { AuthProvider, useAuth } from '@/features/auth';
import { CelebrationProvider } from '@/gamification/Celebrations';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, loading } = useAuth();
  const { colors, isDark } = useTheme();
  const [fontsLoaded] = useFonts({ Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold, Nunito_900Black });
  const ready = fontsLoaded && !loading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.text, border: colors.border, primary: colors.primary },
  };
  const modal = { presentation: 'modal' as const };

  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppLockGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Protected guard={!!session}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="transaction" options={modal} />
            <Stack.Screen name="accounts/index" />
            <Stack.Screen name="accounts/edit" options={modal} />
            <Stack.Screen name="categories/index" />
            <Stack.Screen name="categories/edit" options={modal} />
            <Stack.Screen name="budgets" />
            <Stack.Screen name="goals/edit" options={modal} />
            <Stack.Screen name="goals/[id]" />
            <Stack.Screen name="bills/index" />
            <Stack.Screen name="bills/edit" options={modal} />
            <Stack.Screen name="sms-inbox" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="achievements" />
          </Stack.Protected>
          <Stack.Protected guard={!session}>
            <Stack.Screen name="sign-in" />
            <Stack.Screen name="verify" />
          </Stack.Protected>
        </Stack>
      </AppLockGate>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }),
  );
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <CelebrationProvider>
              <RootStack />
            </CelebrationProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
