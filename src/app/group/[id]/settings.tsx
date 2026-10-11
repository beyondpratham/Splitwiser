import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Switch } from 'react-native-paper';
import { Avatar, EmojiTile } from '@/components/Avatar';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { CurrencyPicker, EmojiPicker } from '@/components/Pickers';
import { Sheet } from '@/components/Sheet';
import { haptic } from '@/components/ui';
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
  const { confirm, prompt, toast, fail } = useFeedback();
  const [sheet, setSheet] = useState<null | 'members' | 'currency' | 'emoji'>(null);

  if (!g || !me) return <Page title="Group settings" back>{null}</Page>;
  const memberIds = new Set(g.group_members.map((m) => m.profile_id));
  const candidates = friends.filter((f) => !memberIds.has(f.id));
  const owesInGroup = entries(balances.byGroup.get(g.id)).length > 0;

  return (
    <Page title="Group settings" back variant="large">
      <ListGroup title="Group" animateIndex={0}>
        <ListItem left={<EmojiTile emoji={g.emoji} size={40} />} title="Icon" chevron onPress={() => setSheet('emoji')} />
        <ListItem
          left={<Icon name="pencil" color={t.colors.onSurfaceVariant} />}
          title="Name"
          detail={g.name}
          chevron
          onPress={async () => {
            const name = await prompt({ title: 'Group name', label: 'Name', initial: g.name });
            if (name && name !== g.name) update.mutateAsync({ id: g.id, name }).catch(fail);
          }}
        />
        <ListItem
          left={<Icon name="currency-usd" color={t.colors.onSurfaceVariant} />}
          title="Default currency"
          detail={`${currencyByCode(g.default_currency)?.flag ?? ''} ${g.default_currency}`}
          chevron
          onPress={() => setSheet('currency')}
        />
      </ListGroup>

      <ListGroup
        footer="Automatically combines debts to reduce the total number of payments between members. Nobody ends up owing more overall."
        animateIndex={1}
      >
        <ListItem
          left={<Icon name="auto-fix" color={t.colors.primary} />}
          title="Simplify group debts"
          right={
            <Switch
              value={g.simplify_debts}
              onValueChange={(v) => {
                haptic.tap();
                update.mutateAsync({ id: g.id, simplify_debts: v }).catch(fail);
              }}
            />
          }
          onPress={() => update.mutateAsync({ id: g.id, simplify_debts: !g.simplify_debts }).catch(fail)}
        />
      </ListGroup>

      <ListGroup title={`Members · ${g.group_members.length}`} animateIndex={2}>
        {g.group_members.map(({ profile_id }) => {
          const p = byId.get(profile_id);
          return (
            <ListItem
              key={profile_id}
              left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} />}
              title={profile_id === me.id ? `${p?.name} (you)` : p?.name ?? '…'}
              subtitle={p?.user_id ? p.email ?? undefined : `${p?.email ?? ''} · invited`}
            />
          );
        })}
        <ListItem left={<Icon name="account-plus" size={28} color={t.colors.primary} />} title="Add people" tone="primary" onPress={() => setSheet('members')} />
      </ListGroup>

      <ListGroup footer={owesInGroup ? 'Settle up before leaving this group.' : undefined} animateIndex={3}>
        <ListItem
          left={<Icon name="exit-run" color={t.colors.error} />}
          title="Leave group"
          tone="error"
          disabled={owesInGroup}
          onPress={async () => {
            if (await confirm({ title: `Leave ${g.name}?`, message: 'You will no longer see this group’s expenses.', confirmLabel: 'Leave', destructive: true })) {
              leave
                .mutateAsync({ groupId: g.id, profileId: me.id })
                .then(() => router.dismissTo('/groups'))
                .catch(fail);
            }
          }}
        />
        {g.created_by === me.id ? (
          <ListItem
            left={<Icon name="delete-outline" color={t.colors.error} />}
            title="Delete group"
            tone="error"
            onPress={async () => {
              if (
                await confirm({
                  title: `Delete ${g.name}?`,
                  message: 'This permanently deletes the group and all of its expenses for everyone.',
                  confirmLabel: 'Delete',
                  destructive: true,
                })
              ) {
                del
                  .mutateAsync(g.id)
                  .then(() => router.dismissTo('/groups'))
                  .catch(fail);
              }
            }}
          />
        ) : null}
      </ListGroup>

      <CurrencyPicker
        visible={sheet === 'currency'}
        value={g.default_currency}
        onClose={() => setSheet(null)}
        onSelect={(c) => update.mutateAsync({ id: g.id, default_currency: c }).catch(fail)}
      />
      <EmojiPicker visible={sheet === 'emoji'} value={g.emoji} onClose={() => setSheet(null)} onSelect={(e) => update.mutateAsync({ id: g.id, emoji: e }).catch(fail)} />
      <Sheet visible={sheet === 'members'} title="Add people" onClose={() => setSheet(null)}>
        <ListGroup footer="Only friends can be added. Add new friends by email first.">
          {candidates.length === 0 ? (
            <ListItem title="All your friends are already here" />
          ) : (
            candidates.map((f) => (
              <ListItem
                key={f.id}
                left={<Avatar name={f.name} color={f.avatar_color} />}
                title={f.name}
                subtitle={f.email ?? undefined}
                right={<Icon name="plus-circle-outline" color={t.colors.primary} />}
                onPress={() =>
                  addMember
                    .mutateAsync({ groupId: g.id, profileId: f.id })
                    .then(() => {
                      haptic.success();
                      toast(`${f.name} added to ${g.name}`);
                    })
                    .catch(fail)
                }
              />
            ))
          )}
        </ListGroup>
        <ListGroup>
          <ListItem
            left={<Icon name="account-plus-outline" color={t.colors.primary} />}
            title="Add a new friend"
            tone="primary"
            chevron
            onPress={() => {
              setSheet(null);
              router.push('/add-friend');
            }}
          />
        </ListGroup>
      </Sheet>
    </Page>
  );
}
