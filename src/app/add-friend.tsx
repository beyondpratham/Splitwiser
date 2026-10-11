import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Section } from '@/components/List';
import { Button, Field, haptic, Screen } from '@/components/ui';
import { useAddFriend } from '@/lib/api';
import { friendlyError } from '@/lib/supabase';
import { space, useTheme } from '@/theme';

export default function AddFriend() {
  const t = useTheme();
  const add = useAddFriend();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function submit() {
    setError(null);
    try {
      await add.mutateAsync({ email: email.trim(), name: name.trim() || undefined });
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
    }
  }

  return (
    <Screen contentContainerStyle={{ paddingTop: space.lg, paddingBottom: 40 }}>
      <Section footer="If they don’t have an account yet, they’ll see all shared expenses as soon as they sign up with this email.">
        <Field placeholder="Name" value={name} onChangeText={setName} autoFocus textContentType="name" />
        <Field
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          onSubmitEditing={() => valid && submit()}
        />
      </Section>
      {error && <Text style={[styles.error, { color: t.danger }]}>{error}</Text>}
      <View style={{ paddingHorizontal: space.lg }}>
        <Button title="Add friend" icon="person.badge.plus" onPress={submit} disabled={!valid} loading={add.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { textAlign: 'center', marginBottom: space.md, fontSize: 15 },
});
