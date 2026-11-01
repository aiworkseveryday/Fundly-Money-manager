import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Input } from '@/components/Input';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignIn() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = EMAIL_RE.test(email.trim());

  const send = async () => {
    setBusy(true);
    setError(null);
    const address = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(error.message);
    else router.push({ pathname: '/verify', params: { email: address } });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <View style={styles.hero}>
          <Mascot size={150} />
          <AppText variant="hero" color={colors.primary} center>
            fundly
          </AppText>
          <AppText variant="heading" muted center>
            The fun, friendly way to master your money.
          </AppText>
        </View>
        <Input
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          onSubmitEditing={() => valid && send()}
        />
        {error && <AppText color={colors.danger}>{error}</AppText>}
        <Button3D title="Send me a code" onPress={send} disabled={!valid} loading={busy} />
        <AppText variant="caption" muted center>
          {"We'll email you a 6-digit code. No password needed."}
        </AppText>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingBottom: space.xxl },
  hero: { alignItems: 'center', gap: space.sm, marginBottom: space.xl },
});
