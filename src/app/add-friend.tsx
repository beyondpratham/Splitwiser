import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { HelperText, Text, TextInput } from 'react-native-paper';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { haptic } from '@/components/ui';
import { useAddFriend } from '@/lib/api';
import { friendlyError } from '@/lib/supabase';
import { space, useTheme } from '@/theme';

export default function AddFriend() {
  const t = useTheme();
  const add = useAddFriend();
  const { toast } = useFeedback();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function submit() {
    setError(null);
    try {
      await add.mutateAsync({ email: email.trim(), name: name.trim() || undefined });
      haptic.success();
      toast(`${name.trim() || email.trim()} added`);
      router.back();
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
    }
  }

  return (
    <Page title="Add friend" variant="dialog" form confirm={{ label: 'Add', onPress: submit, disabled: !valid, loading: add.isPending }}>
      <View style={{ alignItems: 'center', marginBottom: space.xl, gap: space.md, paddingHorizontal: space.xl }}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: t.colors.primaryContainer, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="account-plus" size={40} color={t.colors.onPrimaryContainer} />
        </Animated.View>
        <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>
          If they don’t have an account yet, they’ll see all shared expenses as soon as they sign up with this email.
        </Text>
      </View>
      <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
        <TextInput mode="outlined" label="Name" value={name} onChangeText={setName} autoFocus left={<TextInput.Icon icon="account-outline" />} />
        <TextInput
          mode="outlined"
          label="Email address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onSubmitEditing={() => valid && submit()}
          left={<TextInput.Icon icon="email-outline" />}
        />
        {error && (
          <HelperText type="error" visible>
            {error}
          </HelperText>
        )}
      </View>
    </Page>
  );
}
