import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';
import { Avatar, EmojiTile } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Row, Section } from '@/components/List';
import { CurrencyPicker } from '@/components/Pickers';
import { Check, Field, haptic, Screen, Sheet } from '@/components/ui';
import { EmojiPicker } from '@/components/EmojiPicker';
import {
  useAddGroupMember,
  useDeleteGroup,
  useFriends,
  useGroup,
  useLeaveGroup,
  useMe,
  useMyBalances,
  usePeople,
  useUpdateGroup,
} from '@/lib/api';
import { entries, summarizeBalances } from '@/lib/balances';
import { currencyByCode } from '@/lib/currencies';
import { friendlyError } from '@/lib/supabase';
import { useTheme } from '@/theme';

export default function GroupSettings() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = useGroup(id).data;
  const me = useMe().data;
  const { byId } = usePeople();
  const { friends } = useFriends();
  const balances = summarizeBalances(useMyBalances().data ?? []);
  const update = useUpdateGroup();
  const addMember = useAddGroupMember();
  const leave = useLeaveGroup();
  const del = useDeleteGroup();

  const [nameDraft, setName] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'members' | 'currency' | 'emoji'>(null);


  if (!g || !me) return null;
  const name = nameDraft ?? g.name;
  const memberIds = new Set(g.group_members.map((m) => m.profile_id));
  const candidates = friends.filter((f) => !memberIds.has(f.id));
  const myGroupBalance = entries(balances.byGroup.get(g.id));

  const run = (p: Promise<unknown>) => p.catch((e) => Alert.alert('Something went wrong', friendlyError(e)));

  return (
    <Screen>
      <Section title="Group">
        <Row left={<EmojiTile emoji={g.emoji} size={36} />} title="Icon" chevron onPress={() => setSheet('emoji')} />
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16 }}>
          <Text style={{ color: t.secondary, fontSize: 17, width: 70 }}>Name</Text>
          <Field
            value={name}
            onChangeText={setName}
            onEndEditing={() => {
              if (name.trim() && name.trim() !== g.name) run(update.mutateAsync({ id: g.id, name: name.trim() }));
              setName(null);
            }}
            style={{ flex: 1 }}
            returnKeyType="done"
          />
        </View>
        <Row
          title="Default currency"
          detail={`${currencyByCode(g.default_currency)?.flag ?? ''} ${g.default_currency}`}
          chevron
          onPress={() => setSheet('currency')}
        />
      </Section>

      <Section footer="Automatically combines debts to reduce the total number of payments between members. Nobody ends up owing more overall.">
        <Row
          left={<Icon name="sparkles" size={22} color={t.accent} />}
          title="Simplify group debts"
          right={
            <Switch
              value={g.simplify_debts}
              trackColor={{ true: t.accent }}
              onValueChange={(v) => {
                haptic.tap();
                run(update.mutateAsync({ id: g.id, simplify_debts: v }));
              }}
            />
          }
        />
      </Section>

      <Section title="Members">
        {g.group_members.map(({ profile_id }) => {
          const p = byId.get(profile_id);
          return (
            <Row
              key={profile_id}
              left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} size={36} />}
              title={profile_id === me.id ? `${p?.name} (you)` : p?.name ?? '…'}
              subtitle={p?.user_id ? p.email ?? undefined : `${p?.email ?? ''} · invited`}
            />
          );
        })}
        <Row
          left={<Icon name="person.badge.plus" size={24} color={t.accent} />}
          title="Add people"
          tint
          onPress={() => setSheet('members')}
        />
      </Section>

      <Section footer={myGroupBalance.length ? 'You need to settle up before leaving this group.' : undefined}>
        <Row
          title="Leave group"
          destructive
          disabled={myGroupBalance.length > 0}
          onPress={() =>
            Alert.alert(`Leave ${g.name}?`, 'You will no longer see this group’s expenses.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Leave',
                style: 'destructive',
                onPress: () => run(leave.mutateAsync({ groupId: g.id, profileId: me.id }).then(() => router.dismissTo('/groups'))),
              },
            ])
          }
        />
        {g.created_by === me.id && (
          <Row
            title="Delete group"
            destructive
            onPress={() =>
              Alert.alert(`Delete ${g.name}?`, 'This permanently deletes the group and all of its expenses for everyone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => run(del.mutateAsync(g.id).then(() => router.dismissTo('/groups'))) },
              ])
            }
          />
        )}
      </Section>

      <CurrencyPicker
        visible={sheet === 'currency'}
        value={g.default_currency}
        onClose={() => setSheet(null)}
        onSelect={(c) => run(update.mutateAsync({ id: g.id, default_currency: c }))}
      />
      <EmojiPicker
        visible={sheet === 'emoji'}
        value={g.emoji}
        onClose={() => setSheet(null)}
        onSelect={(e) => run(update.mutateAsync({ id: g.id, emoji: e }))}
      />
      <Sheet visible={sheet === 'members'} title="Add people" onClose={() => setSheet(null)}>
        <Section footer="Only friends can be added. Add new friends by email from the Friends tab.">
          {candidates.length === 0 ? (
            <Row title="All your friends are already here" />
          ) : (
            candidates.map((f) => (
              <Row
                key={f.id}
                left={<Avatar name={f.name} color={f.avatar_color} size={36} />}
                title={f.name}
                subtitle={f.email ?? undefined}
                right={<Check on={false} />}
                onPress={() => {
                  haptic.success();
                  run(addMember.mutateAsync({ groupId: g.id, profileId: f.id }));
                }}
              />
            ))
          )}
        </Section>
        <Section>
          <Row title="Add a new friend" tint chevron onPress={() => { setSheet(null); router.push('/add-friend'); }} />
        </Section>
      </Sheet>
    </Screen>
  );
}
