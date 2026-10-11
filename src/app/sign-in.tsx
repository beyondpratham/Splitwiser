import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { Page } from '@/components/Page';
import { haptic } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { space, useTheme } from '@/theme';

export default function SignIn() {
  const t = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && (mode === 'in' || name.trim().length > 0);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setNotice('Check your inbox to confirm your email, then sign in.');
      }
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="SplitWiser" variant="hero" form>
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(11)}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={{ alignItems: 'center', gap: space.xs }}>
          <Text variant="displaySmall" style={{ color: t.colors.onSurface, fontWeight: '600' }}>
            SplitWiser
          </Text>
          <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>
            Split bills with friends. No ads, no limits.
          </Text>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(200).springify()} layout={LinearTransition.springify()} style={styles.form}>
        <SegmentedButtons
          value={mode}
          onValueChange={(v) => {
            setMode(v as 'in' | 'up');
            setError(null);
          }}
          buttons={[
            { value: 'in', label: 'Sign in', icon: 'login' },
            { value: 'up', label: 'Create account', icon: 'account-plus' },
          ]}
        />
        {mode === 'up' && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            <TextInput mode="outlined" label="Your name" value={name} onChangeText={setName} autoComplete="name" left={<TextInput.Icon icon="account" />} />
          </Animated.View>
        )}
        <Animated.View layout={LinearTransition.springify()} style={{ gap: space.md }}>
          <TextInput
            mode="outlined"
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            left={<TextInput.Icon icon="email-outline" />}
          />
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            onSubmitEditing={() => valid && submit()}
            left={<TextInput.Icon icon="lock-outline" />}
            right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} />}
          />
          {mode === 'up' && (
            <HelperText type="info" visible style={{ marginTop: -space.sm }}>
              At least 6 characters
            </HelperText>
          )}
          {error && (
            <HelperText type="error" visible>
              {error}
            </HelperText>
          )}
          {notice && (
            <HelperText type="info" visible style={{ color: t.colors.primary }}>
              {notice}
            </HelperText>
          )}
          <Button mode="contained" onPress={submit} loading={busy} disabled={!valid || busy} contentStyle={{ height: 52 }} style={{ marginTop: space.sm }}>
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </Button>
        </Animated.View>
      </Animated.View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.lg, paddingHorizontal: space.xl, marginTop: space.xl, marginBottom: 36 },
  logo: { width: 104, height: 104, borderRadius: 30 },
  form: { paddingHorizontal: space.xl, gap: space.md },
});
