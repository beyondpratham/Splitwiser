import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Avatar, EmojiTile } from '@/components/Avatar';
import { haptic, Switch } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { CurrencyPicker, EmojiPicker } from '@/components/Pickers';
import { Sheet } from '@/components/Sheet';
import { Tile } from '@/components/Tile';
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
import { currencySymbol } from '@/lib/currencies';
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
          left={<Tile icon="pencil-outline" />}
          title="Name"
          detail={g.name}
          chevron
          onPress={async () => {
            const name = await prompt({ title: 'Group name', label: 'Name', initial: g.name });
            if (name && name !== g.name) update.mutateAsync({ id: g.id, name }).catch(fail);
          }}
        />
        <ListItem left={<Tile icon="currency-usd" />} title="Default currency" detail={`${currencySymbol(g.default_currency)}  ${g.default_currency}`} chevron onPress={() => setSheet('currency')} />
      </ListGroup>

      <ListGroup footer="Combines debts so the fewest payments settle everyone. Nobody ends up paying more overall." animateIndex={1}>
        <ListItem
          left={<Tile icon="auto-fix" />}
          title="Simplify group debts"
          right={
            <Switch
              label="Simplify group debts"
              value={g.simplify_debts}
              onValueChange={(v) => {
                haptic.tap();
                update.mutateAsync({ id: g.id, simplify_debts: v }).catch(fail);
              }}
            />
          }
        />
      </ListGroup>

      <ListGroup title={`Members · ${g.group_members.length}`} animateIndex={2}>
        {g.group_members.map(({ profile_id }) => {
          const p = byId.get(profile_id);
          return (
            <ListItem
              key={profile_id}
              left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} avatar={p?.avatar} />}
              title={profile_id === me.id ? `${p?.name} (you)` : p?.name ?? '…'}
              subtitle={p?.user_id ? p.email ?? undefined : `${p?.email ?? ''} · invited`}
            />
          );
        })}
        <ListItem left={<Icon name="account-plus-outline" size={26} color={t.accentText} />} title="Add people" tone="accent" onPress={() => setSheet('members')} />
      </ListGroup>

      <ListGroup footer={owesInGroup ? 'Settle up before leaving this group.' : undefined} animateIndex={3}>
        <ListItem
          left={<Tile icon="exit-run" danger />}
          title="Leave group"
          tone="danger"
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
            left={<Tile icon="delete-outline" danger />}
            title="Delete group"
            tone="danger"
            onPress={async () => {
              if (await confirm({ title: `Delete ${g.name}?`, message: 'This permanently deletes the group and all of its expenses for everyone.', confirmLabel: 'Delete', destructive: true })) {
                del
                  .mutateAsync(g.id)
                  .then(() => router.dismissTo('/groups'))
                  .catch(fail);
              }
            }}
          />
        ) : null}
      </ListGroup>

      <CurrencyPicker visible={sheet === 'currency'} value={g.default_currency} onClose={() => setSheet(null)} onSelect={(c) => update.mutateAsync({ id: g.id, default_currency: c }).catch(fail)} />
      <EmojiPicker visible={sheet === 'emoji'} value={g.emoji} onClose={() => setSheet(null)} onSelect={(e) => update.mutateAsync({ id: g.id, emoji: e }).catch(fail)} />
      <Sheet visible={sheet === 'members'} title="Add people" onClose={() => setSheet(null)}>
        <ListGroup footer="Only friends can be added. Add new friends by email first.">
          {candidates.length === 0 ? (
            <ListItem title="All your friends are already here" />
          ) : (
            candidates.map((f) => (
              <ListItem
                key={f.id}
                left={<Avatar name={f.name} color={f.avatar_color} avatar={f.avatar} />}
                title={f.name}
                subtitle={f.email ?? undefined}
                right={<Icon name="plus-circle-outline" color={t.accentText} />}
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
            left={<Icon name="account-plus-outline" color={t.accentText} />}
            title="Add a new friend"
            tone="accent"
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
