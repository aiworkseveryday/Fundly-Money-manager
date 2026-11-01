import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Segmented } from '@/components/bits';
import { Input } from '@/components/Input';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

type Mode = 'sign-in' | 'sign-up';

export default function SignIn() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = EMAIL_RE.test(email.trim()) && password.length >= (mode === 'sign-up' ? MIN_PASSWORD : 1);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    const credentials = { email: email.trim().toLowerCase(), password };
    // On success the auth listener swaps the protected stack to the app.
    const { error } =
      mode === 'sign-in' ? await supabase.auth.signInWithPassword(credentials) : await supabase.auth.signUp(credentials);
    setBusy(false);
    if (error) {
      setError(
        error.message.includes('Invalid login credentials')
          ? 'Wrong email or password. New here? Switch to "Create account".'
          : error.message,
      );
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Screen edges={['top', 'bottom']} contentStyle={styles.content}>
        <View style={styles.hero}>
          <Mascot size={140} />
          <AppText variant="hero" color={colors.primary} center>
            fundly
          </AppText>
          <AppText variant="heading" muted center>
            The fun, friendly way to master your money.
          </AppText>
        </View>

        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: 'sign-in', label: 'Sign in' },
            { value: 'sign-up', label: 'Create account', color: colors.primary },
          ]}
        />
        <Input
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
        />
        <View>
          <Input
            label="Password"
            placeholder={mode === 'sign-up' ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />
          <Pressable
            onPress={() => setShowPassword((s) => !s)}
            style={styles.eye}
            hitSlop={10}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
            <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        {error && <AppText color={colors.danger}>{error}</AppText>}
        <Button3D title={mode === 'sign-in' ? 'Sign in' : 'Create account'} onPress={submit} disabled={!valid} loading={busy} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingBottom: space.xxl },
  hero: { alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  eye: { position: 'absolute', right: 14, bottom: 15 },
});
