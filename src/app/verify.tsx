import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, StyleSheet, TextInput, View, type TextInputInstance } from 'react-native';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Header } from '@/components/bits';
import { Mascot } from '@/components/Mascot';
import { Screen } from '@/components/Screen';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, radius, space } from '@/theme/tokens';

const LENGTH = 6;

export default function Verify() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { colors } = useTheme();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const input = useRef<TextInputInstance>(null);

  const verify = async (token = code) => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setBusy(false);
    // On success the auth listener swaps the protected stack to the app.
    if (error) setError(error.message);
  };

  const resend = async () => {
    await supabase.auth.signInWithOtp({ email });
    setResent(true);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Header title="" />
      <Screen edges={['bottom']} contentStyle={{ alignItems: 'stretch' }}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Mascot size={110} mood="happy" />
          <AppText variant="title" center>
            Check your inbox!
          </AppText>
          <AppText muted center>
            Enter the code we sent to{'\n'}
            <AppText variant="label">{email}</AppText>
          </AppText>
        </View>

        <Pressable onPress={() => input.current?.focus()} style={styles.boxes}>
          {Array.from({ length: LENGTH }, (_, i) => (
            <View
              key={i}
              style={[
                styles.box,
                {
                  borderColor: code.length === i ? colors.info : colors.border,
                  backgroundColor: colors.surfaceAlt,
                },
              ]}>
              <AppText style={styles.digit}>{code[i] ?? ''}</AppText>
            </View>
          ))}
        </Pressable>
        <TextInput
          ref={input}
          value={code}
          autoFocus
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={LENGTH}
          onChangeText={(t) => {
            const digits = t.replace(/\D/g, '');
            setCode(digits);
            if (digits.length === LENGTH) verify(digits);
          }}
          style={styles.hidden}
        />

        {error && (
          <AppText color={colors.danger} center>
            {error}
          </AppText>
        )}
        <Button3D title="Verify" onPress={() => verify()} disabled={code.length !== LENGTH} loading={busy} />
        <Button3D title={resent ? 'Code sent again' : 'Resend code'} tone="ghost" onPress={resend} disabled={resent} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: space.lg },
  box: { width: 48, height: 58, borderWidth: 2, borderBottomWidth: 4, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  digit: { fontFamily: fonts.black, fontSize: 26, lineHeight: 32 },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
});
