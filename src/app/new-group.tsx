import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Checkbox, HelperText, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Avatar, EmojiTile } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { CurrencyPicker, EmojiPicker } from '@/components/Pickers';
import { haptic } from '@/components/ui';
import { useCreateGroup, useFriends, useMe } from '@/lib/api';
import { currencyByCode } from '@/lib/currencies';
import { friendlyError } from '@/lib/supabase';
import type { GroupKind } from '@/lib/types';
import { space, useTheme } from '@/theme';

const KIND_EMOJI: Record<GroupKind, string> = { trip: '✈️', home: '🏠', couple: '💑', other: '👥' };

export default function NewGroup() {
  const t = useTheme();
  const me = useMe().data;
  const { friends } = useFriends();
  const create = useCreateGroup();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<GroupKind>('trip');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [sheet, setSheet] = useState<null | 'emoji' | 'currency'>(null);
  const [error, setError] = useState<string | null>(null);

  const cur = currency ?? me?.default_currency ?? 'USD';
  const icon = emoji ?? KIND_EMOJI[kind];

  async function submit() {
    setError(null);
    try {
      const id = await create.mutateAsync({ name: name.trim(), emoji: icon, kind, currency: cur, memberIds: members });
      haptic.success();
      router.dismiss();
      router.push({ pathname: '/group/[id]', params: { id } });
    } catch (e) {
      setError(friendlyError(e));
    }
  }

  return (
    <Page title="New group" variant="dialog" form confirm={{ label: 'Create', onPress: submit, disabled: !name.trim(), loading: create.isPending }}>
      <View style={styles.hero}>
        <Pressable onPress={() => setSheet('emoji')} style={{ alignItems: 'center', gap: space.sm }} accessibilityLabel="Change icon">
          <Animated.View key={icon} entering={ZoomIn.springify().damping(10)}>
            <EmojiTile emoji={icon} size={96} />
          </Animated.View>
          <Text variant="labelLarge" style={{ color: t.colors.primary }}>
            Change icon
          </Text>
        </Pressable>
        <TextInput mode="outlined" label="Group name" value={name} onChangeText={setName} autoFocus style={{ alignSelf: 'stretch' }} />
      </View>

      <View style={{ paddingHorizontal: space.lg, marginBottom: space.xl }}>
        <SegmentedButtons
          value={kind}
          onValueChange={(v) => setKind(v as GroupKind)}
          buttons={[
            { value: 'trip', label: 'Trip', icon: 'airplane' },
            { value: 'home', label: 'Home', icon: 'home' },
            { value: 'couple', label: 'Couple', icon: 'heart' },
            { value: 'other', label: 'Other', icon: 'dots-horizontal' },
          ]}
        />
      </View>

      <ListGroup>
        <ListItem
          left={<Icon name="currency-usd" color={t.colors.onSurfaceVariant} />}
          title="Currency"
          detail={`${currencyByCode(cur)?.flag ?? ''} ${cur}`}
          chevron
          onPress={() => setSheet('currency')}
        />
      </ListGroup>

      <ListGroup title="Members" footer={friends.length === 0 ? 'Add friends first, or add people to the group later.' : `${members.length + 1} people including you`}>
        {friends.map((f) => {
          const on = members.includes(f.id);
          const toggle = () => {
            haptic.tap();
            setMembers(on ? members.filter((x) => x !== f.id) : [...members, f.id]);
          };
          return (
            <ListItem
              key={f.id}
              left={<Avatar name={f.name} color={f.avatar_color} />}
              title={f.name}
              subtitle={f.email ?? undefined}
              right={<Checkbox.Android status={on ? 'checked' : 'unchecked'} onPress={toggle} />}
              onPress={toggle}
            />
          );
        })}
        <ListItem left={<Icon name="account-plus-outline" color={t.colors.primary} />} title="Add a new friend" tone="primary" chevron onPress={() => router.push('/add-friend')} />
      </ListGroup>
      {error && (
        <HelperText type="error" visible style={{ textAlign: 'center' }}>
          {error}
        </HelperText>
      )}
      <EmojiPicker visible={sheet === 'emoji'} value={icon} onClose={() => setSheet(null)} onSelect={setEmoji} />
      <CurrencyPicker visible={sheet === 'currency'} value={cur} onClose={() => setSheet(null)} onSelect={setCurrency} />
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, marginBottom: space.xl },
});
