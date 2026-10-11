import { Image } from 'expo-image';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Field, haptic, Screen } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/theme';

export default function SignIn() {
  const t = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { name: name.trim() } },
        });
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
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={[styles.title, { color: t.text }]}>SplitWiser</Text>
          <Text style={[styles.tagline, { color: t.secondary }]}>Split bills with friends.{'\n'}No ads, no limits.</Text>
        </View>

        <View style={[styles.card, { backgroundColor: t.card }]}>
          {mode === 'up' && (
            <>
              <Field placeholder="Your name" value={name} onChangeText={setName} textContentType="name" autoComplete="name" returnKeyType="next" />
              <View style={[styles.sep, { backgroundColor: t.separator }]} />
            </>
          )}
          <Field
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
          <View style={[styles.sep, { backgroundColor: t.separator }]} />
          <Field
            placeholder={mode === 'up' ? 'Password (6+ characters)' : 'Password'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === 'up' ? 'newPassword' : 'password'}
            autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
            onSubmitEditing={() => valid && submit()}
            returnKeyType="go"
          />
        </View>

        {error && <Text style={[styles.message, { color: t.danger }]}>{error}</Text>}
        {notice && <Text style={[styles.message, { color: t.accent }]}>{notice}</Text>}

        <Button title={mode === 'in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} disabled={!valid} style={{ marginTop: space.lg }} />

        <Pressable onPress={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(null); }} style={styles.switch} hitSlop={8}>
          <Text style={{ color: t.secondary, fontSize: 15 }}>
            {mode === 'in' ? 'New here? ' : 'Already have an account? '}
            <Text style={{ color: t.accent, fontWeight: '600' }}>{mode === 'in' ? 'Create an account' : 'Sign in'}</Text>
          </Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: space.xl, paddingTop: 72 },
  hero: { alignItems: 'center', marginBottom: 40, gap: space.sm },
  logo: { width: 88, height: 88, borderRadius: 20, marginBottom: space.md },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { fontSize: 17, textAlign: 'center', lineHeight: 23 },
  card: { borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: space.lg },
  message: { marginTop: space.md, fontSize: 15, textAlign: 'center' },
  switch: { alignItems: 'center', marginTop: space.xl },
});
