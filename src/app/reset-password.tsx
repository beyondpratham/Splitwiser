import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Button, Field, haptic, IconButton } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { claimThisDevice } from '@/lib/device';
import { friendlyError, supabase } from '@/lib/supabase';
import { space, useTheme } from '@/theme';

/**
 * Forgot password: we email a one-time code, then the code plus a new password signs you straight in.
 * (A code works the same on every phone and on the web; no links to open.)
 */
export default function ResetPassword() {
  const t = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const { toast } = useFeedback();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
  const codeOk = /^\d{6,10}$/.test(code.trim());

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      haptic.success();
      setStep('code');
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
      if (error) throw error;
      // the code signed us in; now set the new password on this session
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await claimThisDevice().catch(() => {});
      haptic.success();
      toast('Password changed. You’re signed in.');
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <Page title="Reset password" variant="dialog" form>
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Glass tint={t.accentSoft} contentStyle={styles.heroIcon}>
            <Icon name={step === 'email' ? 'lock-reset' : 'email-check-outline'} size={40} color={t.accentText} />
          </Glass>
        </Animated.View>
        <T variant="title" style={{ textAlign: 'center' }}>
          {step === 'email' ? 'Forgot your password?' : 'Check your email'}
        </T>
        <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
          {step === 'email'
            ? 'Enter the email you signed up with and we’ll send you a code to set a new password.'
            : `We sent a code to ${email.trim()}. Enter it below with your new password.`}
        </T>
      </View>

      <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.section}>
        {step === 'email' ? (
          <View style={{ gap: space.lg }}>
            <Field
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              icon="email-outline"
              onSubmitEditing={() => emailOk && sendCode()}
              error={error}
            />
            <Button title="Send code" size="lg" onPress={sendCode} loading={busy} disabled={!emailOk || busy} />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)} style={{ gap: space.lg }}>
            <Field
              label="Code"
              placeholder="6-digit code"
              value={code}
              onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              maxLength={10}
              icon="numeric"
            />
            <Field
              label="New password"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="new-password"
              icon="lock-outline"
              right={<IconButton plain icon={showPassword ? 'eye-off-outline' : 'eye-outline'} label={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)} size={32} />}
              onSubmitEditing={() => codeOk && password.length >= 6 && reset()}
              error={error}
            />
            <Button title="Set new password" size="lg" onPress={reset} loading={busy} disabled={!codeOk || password.length < 6 || busy} />
            <Button title="Send a new code" variant="ghost" onPress={sendCode} disabled={busy} />
          </Animated.View>
        )}
        <Button title="Back to sign in" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} />
      </Animated.View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, marginBottom: space.xl },
  heroIcon: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  section: { marginHorizontal: space.lg },
});
