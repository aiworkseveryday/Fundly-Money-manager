import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Mascot } from '@/components/Mascot';
import { prefs } from '@/lib/prefs';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const PREF = 'appLock';
/** Re-lock after the app has been in the background this long */
const GRACE_MS = 30_000;

export const isAppLockEnabled = () => prefs.get(PREF) === '1';

/** Turns the lock on only after a successful biometric check, so users cannot lock themselves out. */
export async function setAppLockEnabled(enabled: boolean): Promise<{ ok: boolean; reason?: string }> {
  if (enabled) {
    const [hw, enrolled] = await Promise.all([LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync()]);
    if (!hw || !enrolled) return { ok: false, reason: 'Set up a fingerprint or screen lock on your phone first.' };
    const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Confirm to enable App Lock' });
    if (!res.success) return { ok: false };
  }
  prefs.set(PREF, enabled ? '1' : null);
  return { ok: true };
}

export function AppLockGate({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const [locked, setLocked] = useState(isAppLockEnabled);
  const backgroundedAt = useRef<number | null>(null);
  const prompting = useRef(false);

  const unlock = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      const res = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Fundly',
        promptSubtitle: 'Your money stays private',
        cancelLabel: 'Cancel',
      });
      if (res.success) setLocked(false);
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    if (locked) unlock();
  }, [locked, unlock]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      // The biometric prompt itself backgrounds the app on some phones; ignore those transitions.
      if (prompting.current) return;
      if (s === 'background') backgroundedAt.current = Date.now();
      if (s === 'active' && backgroundedAt.current && isAppLockEnabled()) {
        if (Date.now() - backgroundedAt.current > GRACE_MS) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      {children}
      {locked && (
        <View style={[StyleSheet.absoluteFill, styles.lock, { backgroundColor: colors.bg }]}>
          <Mascot mood="sleepy" size={140} />
          <AppText variant="title" center>
            Fundly is locked
          </AppText>
          <AppText muted center>
            Use your fingerprint or screen lock to continue.
          </AppText>
          <Button3D title="Unlock" icon="fingerprint" onPress={unlock} style={{ alignSelf: 'stretch' }} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  lock: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xxl, zIndex: 100 },
});
