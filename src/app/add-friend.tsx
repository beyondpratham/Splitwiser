import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Field, haptic } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
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
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Glass variant="pill" tint={t.accentSoft} contentStyle={{ width: 92, height: 92, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="account-plus-outline" size={40} color={t.accentText} />
          </Glass>
        </Animated.View>
        <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
          If they don’t have an account yet, they’ll see all shared expenses as soon as they sign up with this email.
        </T>
      </View>
      <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
        <Field label="Name" placeholder="Their name" value={name} onChangeText={setName} autoFocus icon="account-outline" />
        <Field
          label="Email"
          placeholder="name@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onSubmitEditing={() => valid && submit()}
          icon="email-outline"
          error={error}
        />
      </View>
    </Page>
  );
}
