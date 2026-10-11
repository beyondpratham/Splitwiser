import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, EmojiTile } from '@/components/Avatar';
import { EmojiPicker } from '@/components/EmojiPicker';
import { Row, Section } from '@/components/List';
import { CurrencyPicker } from '@/components/Pickers';
import { Check, haptic, HeaderButton, Screen, Segmented } from '@/components/ui';
import { useCreateGroup, useFriends, useMe } from '@/lib/api';
import { currencyByCode } from '@/lib/currencies';
import { friendlyError } from '@/lib/supabase';
import type { GroupKind } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

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
    <>
      <Stack.Screen
        options={{
          headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton title="Create" bold onPress={submit} disabled={!name.trim() || create.isPending} />,
        }}
      />
      <Screen>
        <View style={styles.hero}>
          <Pressable onPress={() => setSheet('emoji')}>
            <EmojiTile emoji={icon} size={84} tint={t.card} />
            <Text style={{ color: t.accent, textAlign: 'center', marginTop: space.sm, fontSize: 14, fontWeight: '500' }}>Change</Text>
          </Pressable>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            placeholderTextColor={t.tertiary}
            selectionColor={t.accent}
            autoFocus
            style={[styles.name, { color: t.text, backgroundColor: t.card }]}
            textAlign="center"
          />
        </View>

        <View style={{ paddingHorizontal: space.lg, marginBottom: space.xl }}>
          <Segmented
            options={[
              { value: 'trip', label: 'Trip' },
              { value: 'home', label: 'Home' },
              { value: 'couple', label: 'Couple' },
              { value: 'other', label: 'Other' },
            ]}
            value={kind}
            onChange={setKind}
          />
        </View>

        <Section>
          <Row
            title="Currency"
            detail={`${currencyByCode(cur)?.flag ?? ''} ${cur}`}
            chevron
            onPress={() => setSheet('currency')}
          />
        </Section>

        <Section
          title="Members"
          footer={friends.length === 0 ? 'Add friends first, or add people to the group later.' : `${members.length + 1} people including you`}
        >
          {friends.map((f) => {
            const on = members.includes(f.id);
            return (
              <Row
                key={f.id}
                left={<Avatar name={f.name} color={f.avatar_color} size={36} />}
                title={f.name}
                subtitle={f.email ?? undefined}
                right={<Check on={on} />}
                onPress={() => {
                  haptic.tap();
                  setMembers(on ? members.filter((x) => x !== f.id) : [...members, f.id]);
                }}
              />
            );
          })}
          <Row title="Add a new friend" tint chevron onPress={() => router.push('/add-friend')} />
        </Section>
        {error && <Text style={{ color: t.danger, textAlign: 'center' }}>{error}</Text>}
      </Screen>
      <EmojiPicker visible={sheet === 'emoji'} value={icon} onClose={() => setSheet(null)} onSelect={setEmoji} />
      <CurrencyPicker visible={sheet === 'currency'} value={cur} onClose={() => setSheet(null)} onSelect={setCurrency} />
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, marginBottom: space.xl },
  name: { alignSelf: 'stretch', fontSize: 22, fontWeight: '600', height: 56, borderRadius: radius.lg, borderCurve: 'continuous', paddingHorizontal: space.lg },
});
