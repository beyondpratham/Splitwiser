import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, CategoryTile } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Row, Section } from '@/components/List';
import { Button, EmptyState, haptic, HeaderButton, Loading, Screen } from '@/components/ui';
import { diffSnapshots, timeAgo } from '@/lib/activity';
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useDeleteExpense,
  useExpense,
  useExpenseHistory,
  useGroups,
  useMe,
  usePeople,
  useRestoreExpense,
} from '@/lib/api';
import { firstName } from '@/lib/balances';
import { categoryById } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import { friendlyError } from '@/lib/supabase';
import { radius, space, useTheme } from '@/theme';

const SPLIT_TEXT = { equal: 'Split equally', exact: 'Split by exact amounts', percent: 'Split by percentage', shares: 'Split by shares' };

export default function ExpenseScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const expense = useExpense(id);
  const comments = useComments(id);
  const history = useExpenseHistory(id);
  const me = useMe().data;
  const { byId } = usePeople();
  const groups = useGroups().data ?? [];
  const del = useDeleteExpense();
  const restore = useRestoreExpense();
  const addComment = useAddComment();
  const deleteComment = useDeleteComment();
  const [draft, setDraft] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  if (!expense.data) return expense.isLoading ? <Loading /> : <EmptyState icon="exclamationmark.triangle.fill" title="Expense not found" />;
  const e = expense.data;
  const group = groups.find((g) => g.id === e.group_id);
  const creator = byId.get(e.created_by ?? '');
  const deleted = !!e.deleted_at;
  const run = (p: Promise<unknown>) => p.catch((err) => Alert.alert('Something went wrong', friendlyError(err)));

  const confirmDelete = () =>
    Alert.alert('Delete this expense?', 'Everyone involved will see that it was deleted. You can restore it later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => run(del.mutateAsync(e.id).then(() => haptic.success())) },
    ]);

  const openMenu = () => {
    const edit = () => router.push({ pathname: '/add-expense', params: { expenseId: e.id } });
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: e.is_payment ? ['Cancel', 'Delete payment'] : ['Cancel', 'Edit', 'Delete'], destructiveButtonIndex: e.is_payment ? 1 : 2, cancelButtonIndex: 0 },
        (i) => {
          if (e.is_payment ? i === 1 : i === 2) confirmDelete();
          else if (!e.is_payment && i === 1) edit();
        },
      );
    } else {
      Alert.alert(e.description, undefined, [
        ...(e.is_payment ? [] : [{ text: 'Edit', onPress: edit }]),
        { text: 'Delete', style: 'destructive' as const, onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' as const },
      ]);
    }
  };

  const payers = e.expense_shares.filter((s) => Number(s.paid) > 0);
  const edits = (history.data ?? []).filter((h) => h.kind === 'expense_updated' && h.data.before && h.data.after);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <Stack.Screen options={{ title: '', headerRight: deleted ? undefined : () => <HeaderButton icon="ellipsis.circle" onPress={openMenu} /> }} />
      <Screen contentContainerStyle={{ paddingBottom: 40 }}>
        {deleted && (
          <View style={[styles.banner, { backgroundColor: t.oweSoft }]}>
            <Icon name="trash" size={16} color={t.owe} />
            <Text style={{ color: t.owe, flex: 1, fontWeight: '500' }}>This expense was deleted</Text>
            <Button title="Restore" kind="tinted" size="small" onPress={() => run(restore.mutateAsync(e.id))} />
          </View>
        )}

        <View style={styles.hero}>
          <CategoryTile category={e.category} payment={e.is_payment} size={64} />
          <Text style={[styles.desc, { color: t.text }, deleted && styles.strike]}>{e.is_payment ? 'Payment' : e.description}</Text>
          <Text style={[styles.amount, { color: t.text }]}>{formatMoney(Number(e.amount), e.currency)}</Text>
          <Text style={{ color: t.secondary, fontSize: 14, textAlign: 'center' }}>
            {new Date(`${e.spent_on}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
            {group ? ` · ${group.name}` : ''}
            {!e.is_payment ? ` · ${categoryById(e.category).label}` : ''}
          </Text>
          <Text style={{ color: t.tertiary, fontSize: 13 }}>
            Added by {firstName(creator, me?.id)} {timeAgo(e.created_at)}
            {e.updated_at !== e.created_at && !deleted ? ` · edited ${timeAgo(e.updated_at)}` : ''}
          </Text>
        </View>

        <Section title={e.is_payment ? 'Payment' : 'Who paid & owes'} footer={e.is_payment ? undefined : SPLIT_TEXT[e.split_type]}>
          {e.expense_shares
            .slice()
            .sort((a, b) => Number(b.paid) - Number(a.paid))
            .map((s) => {
              const p = byId.get(s.profile_id);
              const paid = Number(s.paid);
              const owed = Number(s.owed);
              const who = firstName(p, me?.id);
              let line: string;
              if (e.is_payment) line = paid > 0 ? `${who} paid ${formatMoney(paid, e.currency)}` : `${who} received ${formatMoney(owed, e.currency)}`;
              else if (paid > 0 && owed > 0) line = `${who} paid ${formatMoney(paid, e.currency)} and ${s.profile_id === me?.id ? 'owe' : 'owes'} ${formatMoney(owed, e.currency)}`;
              else if (paid > 0) line = `${who} paid ${formatMoney(paid, e.currency)}`;
              else line = `${who} ${s.profile_id === me?.id ? 'owe' : 'owes'} ${formatMoney(owed, e.currency)}`;
              return (
                <Row
                  key={s.profile_id}
                  left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} size={36} />}
                  title={line}
                  subtitle={!e.is_payment && payers.length > 0 && paid - owed !== 0 ? (paid - owed > 0 ? `gets back ${formatMoney(paid - owed, e.currency)}` : undefined) : undefined}
                />
              );
            })}
        </Section>

        {e.notes && (
          <Section title="Notes">
            <Text style={{ color: t.text, fontSize: 16, padding: space.lg, lineHeight: 22 }}>{e.notes}</Text>
          </Section>
        )}

        {edits.length > 0 && (
          <Section
            title="History"
            action={
              <Pressable onPress={() => setShowHistory(!showHistory)} hitSlop={8}>
                <Text style={{ color: t.accent, fontSize: 15 }}>{showHistory ? 'Hide' : `Show ${edits.length} ${edits.length === 1 ? 'edit' : 'edits'}`}</Text>
              </Pressable>
            }
          >
            {showHistory ? (
              edits.map((h) => (
                <View key={h.id} style={{ padding: space.lg, gap: 4 }}>
                  <Text style={{ color: t.text, fontWeight: '600' }}>
                    {firstName(byId.get(h.actor_id ?? ''), me?.id)} edited · <Text style={{ color: t.secondary, fontWeight: '400' }}>{timeAgo(h.created_at)}</Text>
                  </Text>
                  {diffSnapshots(h.data.before!, h.data.after!).map((line, i) => (
                    <Text key={i} style={{ color: t.secondary, fontSize: 14 }}>
                      • {line}
                    </Text>
                  ))}
                </View>
              ))
            ) : (
              <Row left={<Icon name="clock.arrow.circlepath" size={20} color={t.secondary} />} title={`Edited ${edits.length} ${edits.length === 1 ? 'time' : 'times'}`} />
            )}
          </Section>
        )}

        <Section title="Comments">
          {(comments.data ?? []).length === 0 && (
            <Text style={{ color: t.secondary, padding: space.lg, fontSize: 15 }}>No comments yet.</Text>
          )}
          {(comments.data ?? []).map((c) => {
            const author = byId.get(c.author_id);
            const mine = c.author_id === me?.id;
            return (
              <Pressable
                key={c.id}
                onLongPress={
                  mine
                    ? () =>
                        Alert.alert('Delete comment?', undefined, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => run(deleteComment.mutateAsync(c.id)) },
                        ])
                    : undefined
                }
                style={styles.comment}
              >
                <Avatar name={author?.name ?? '?'} color={author?.avatar_color ?? '#999'} size={30} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: t.text, fontWeight: '600', fontSize: 14 }}>
                    {firstName(author, me?.id)} <Text style={{ color: t.tertiary, fontWeight: '400' }}>{timeAgo(c.created_at)}</Text>
                  </Text>
                  <Text style={{ color: t.text, fontSize: 15, lineHeight: 20 }}>{c.body}</Text>
                </View>
              </Pressable>
            );
          })}
        </Section>

        {!deleted && (
          <View style={[styles.composer, { backgroundColor: t.card }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment"
              placeholderTextColor={t.tertiary}
              selectionColor={t.accent}
              multiline
              style={[styles.composerInput, { color: t.text }]}
            />
            <Pressable
              disabled={!draft.trim() || addComment.isPending}
              onPress={() =>
                run(
                  addComment.mutateAsync({ expenseId: e.id, body: draft.trim() }).then(() => {
                    haptic.success();
                    setDraft('');
                  }),
                )
              }
              hitSlop={8}
            >
              <Icon name="arrow.up.circle.fill" size={30} color={draft.trim() ? t.accent : t.tertiary} />
            </Pressable>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.lg, marginBottom: space.lg, padding: space.md, borderRadius: radius.md },
  hero: { alignItems: 'center', gap: 6, paddingHorizontal: space.xl, marginBottom: space.xl },
  desc: { fontSize: 22, fontWeight: '600', marginTop: space.md, textAlign: 'center' },
  strike: { textDecorationLine: 'line-through' },
  amount: { fontSize: 44, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  comment: { flexDirection: 'row', gap: space.md, padding: space.lg, alignItems: 'flex-start' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    marginHorizontal: space.lg,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
  },
  composerInput: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: 6 },
});
