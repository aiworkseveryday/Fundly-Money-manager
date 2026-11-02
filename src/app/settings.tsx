import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { Header, ListRow, Segmented } from '@/components/bits';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { useProfile, useUpdateProfile } from '@/data/hooks';
import { isAppLockEnabled, setAppLockEnabled } from '@/features/AppLock';
import { useAuth } from '@/features/auth';
import { exportTransactionsCsv } from '@/lib/csv';
import { initials } from '@/lib/names';
import { supabase } from '@/lib/supabase';
import { resetSmsSync, smsSupported } from '@/sms/sync';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { palette, space } from '@/theme/tokens';

export default function Settings() {
  const { colors, preference, setPreference } = useTheme();
  const { session } = useAuth();
  const profile = useProfile();
  const updateProfile = useUpdateProfile();
  const [name, setName] = useState<string | null>(null);
  const [lock, setLock] = useState(isAppLockEnabled);
  const [exporting, setExporting] = useState(false);

  const displayName = name ?? profile.data?.display_name ?? '';

  const toggleLock = async (next: boolean) => {
    const res = await setAppLockEnabled(next);
    if (res.ok) setLock(next);
    else if (res.reason) Alert.alert('App lock unavailable', res.reason);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const n = await exportTransactionsCsv();
      if (!n) Alert.alert('Nothing to export', 'Add some transactions first.');
    } catch (e) {
      Alert.alert('Export failed', (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Settings" />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }}>
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                borderBottomWidth: 3,
                backgroundColor: colors.primary,
                borderBottomColor: colors.primaryEdge,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <AppText variant="heading" color="#fff">
                {initials(displayName)}
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="heading">{displayName || 'Profile'}</AppText>
              <AppText variant="caption" muted numberOfLines={1}>
                {session?.user.email}
              </AppText>
            </View>
          </View>
          <Input label="Your name" value={displayName} onChangeText={setName} maxLength={30} />
          {name != null && name.trim() !== (profile.data?.display_name ?? '') && (
            <Button3D
              title="Save name"
              small
              onPress={() => profile.data && updateProfile.mutate({ id: profile.data.id, display_name: name.trim() })}
              loading={updateProfile.isPending}
            />
          )}
        </Card>

        <Card style={{ gap: space.md }}>
          <AppText variant="heading">Appearance</AppText>
          <Segmented<ThemePreference>
            value={preference}
            onChange={setPreference}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Card>

        <Card style={{ gap: space.xs, paddingVertical: space.sm }}>
          <ListRow
            icon="fingerprint"
            color={palette.green}
            title="App lock"
            subtitle="Fingerprint or screen lock when opening Fundly"
            right={<Switch value={lock} onValueChange={toggleLock} trackColor={{ true: colors.primary }} />}
          />
          <ListRow icon="file-delimited" color={palette.blue} title="Export to CSV" subtitle="Opens in Excel or Google Sheets" onPress={exportCsv} right={exporting ? <AppText muted>…</AppText> : undefined} />
          {smsSupported && (
            <ListRow
              icon="message-arrow-right"
              color={palette.purple}
              title="Re-scan SMS"
              subtitle="Look again at the last 45 days of bank SMS"
              onPress={() => {
                resetSmsSync();
                Alert.alert('Done', 'Open the SMS inbox and pull down to re-scan.');
              }}
            />
          )}
        </Card>

        <Button3D
          title="Sign out"
          tone="outline"
          icon="logout"
          onPress={() =>
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ])
          }
        />
        <AppText variant="caption" muted center>
          Fundly v1.0 · Made with 💚 and a little piggy
        </AppText>
      </Screen>
    </View>
  );
}
