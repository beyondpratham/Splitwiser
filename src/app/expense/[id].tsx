import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, IconButton, Text, TextInput } from 'react-native-paper';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { Avatar, CategoryTile } from '@/components/Avatar';
import { useFeedback } from '@/components/Feedback';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { EmptyState, haptic, Loading } from '@/components/ui';
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
import { space, useTheme } from '@/theme';

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
  const { confirm, toast, fail } = useFeedback();
  const [draft, setDraft] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  if (!expense.data) return expense.isLoading ? <Loading /> : <EmptyState icon="alert-circle-outline" title="Expense not found" />;
  const e = expense.data;
  const group = groups.find((g) => g.id === e.group_id);
  const creator = byId.get(e.created_by ?? '');
  const deleted = !!e.deleted_at;

  const remove = async () => {
    if (!(await confirm({ title: e.is_payment ? 'Delete this payment?' : 'Delete this expense?', message: 'Everyone involved will see that it was deleted.', confirmLabel: 'Delete', destructive: true })))
      return;
    try {
      await del.mutateAsync(e.id);
      haptic.success();
      toast(e.is_payment ? 'Payment deleted' : 'Expense deleted', { label: 'Undo', onPress: () => restore.mutateAsync(e.id).catch(fail) });
    } catch (err) {
      fail(err);
    }
  };

  const edits = (history.data ?? []).filter((h) => h.kind === 'expense_updated' && h.data.before && h.data.after);

  return (
    <Page
      title={e.is_payment ? 'Payment' : e.description}
      variant="hero"
      back
      form
      actions={!deleted && !e.is_payment ? [{ icon: 'pencil-outline', label: 'Edit', onPress: () => router.push({ pathname: '/add-expense', params: { expenseId: e.id } }) }] : undefined}
      menu={!deleted ? [{ title: 'Delete', icon: 'delete-outline', onPress: remove }] : undefined}
    >
      {deleted && (
        <Animated.View entering={FadeIn} style={[styles.banner, { backgroundColor: t.colors.errorContainer }]}>
          <Icon name="delete-outline" size={20} color={t.colors.onErrorContainer} />
          <Text variant="bodyMedium" style={{ color: t.colors.onErrorContainer, flex: 1 }}>
            This expense was deleted
          </Text>
          <Button mode="text" textColor={t.colors.onErrorContainer} onPress={() => restore.mutateAsync(e.id).catch(fail)}>
            Restore
          </Button>
        </Animated.View>
      )}

      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <CategoryTile category={e.category} payment={e.is_payment} size={72} />
        </Animated.View>
        <Text variant="headlineSmall" style={[{ color: t.colors.onSurface, textAlign: 'center', marginTop: space.md }, deleted && styles.strike]}>
          {e.is_payment ? 'Payment' : e.description}
        </Text>
        <Text variant="displayMedium" style={{ color: t.colors.onSurface, fontVariant: ['tabular-nums'] }}>
          {formatMoney(Number(e.amount), e.currency)}
        </Text>
        <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>
          {new Date(`${e.spent_on}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
          {group ? ` · ${group.name}` : ''}
          {!e.is_payment ? ` · ${categoryById(e.category).label}` : ''}
        </Text>
        <Text variant="labelMedium" style={{ color: t.colors.outline }}>
          Added by {firstName(creator, me?.id)} {timeAgo(e.created_at)}
          {e.updated_at !== e.created_at && !deleted ? ` · edited ${timeAgo(e.updated_at)}` : ''}
        </Text>
      </View>

      <ListGroup title={e.is_payment ? 'Payment' : 'Who paid & owes'} footer={e.is_payment ? undefined : SPLIT_TEXT[e.split_type]} animateIndex={1}>
        {e.expense_shares
          .slice()
          .sort((a, b) => Number(b.paid) - Number(a.paid))
          .map((s) => {
            const p = byId.get(s.profile_id);
            const paid = Number(s.paid);
            const owed = Number(s.owed);
            const who = firstName(p, me?.id);
            const owes = s.profile_id === me?.id ? 'owe' : 'owes';
            let line: string;
            if (e.is_payment) line = paid > 0 ? `${who} paid ${formatMoney(paid, e.currency)}` : `${who} received ${formatMoney(owed, e.currency)}`;
            else if (paid > 0 && owed > 0) line = `${who} paid ${formatMoney(paid, e.currency)} and ${owes} ${formatMoney(owed, e.currency)}`;
            else if (paid > 0) line = `${who} paid ${formatMoney(paid, e.currency)}`;
            else line = `${who} ${owes} ${formatMoney(owed, e.currency)}`;
            const net = paid - owed;
            return (
              <ListItem
                key={s.profile_id}
                left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} />}
                title={line}
                subtitle={!e.is_payment && net > 0.004 ? `gets back ${formatMoney(net, e.currency)}` : undefined}
              />
            );
          })}
      </ListGroup>

      {e.notes && (
        <ListGroup title="Notes">
          <ListItem left={<Icon name="note-text-outline" color={t.colors.onSurfaceVariant} />} title={<Text variant="bodyLarge">{e.notes}</Text>} />
        </ListGroup>
      )}

      {edits.length > 0 && (
        <ListGroup
          title="History"
          action={
            <Button compact onPress={() => setShowHistory(!showHistory)} icon={showHistory ? 'chevron-up' : 'chevron-down'}>
              {showHistory ? 'Hide' : `${edits.length} ${edits.length === 1 ? 'edit' : 'edits'}`}
            </Button>
          }
        >
          {showHistory ? (
            edits.map((h) => (
              <ListItem
                key={h.id}
                left={<Icon name="history" color={t.colors.onSurfaceVariant} />}
                title={
                  <Text variant="titleSmall" style={{ color: t.colors.onSurface }}>
                    {firstName(byId.get(h.actor_id ?? ''), me?.id)} edited · <Text style={{ color: t.colors.onSurfaceVariant }}>{timeAgo(h.created_at)}</Text>
                  </Text>
                }
                subtitle={
                  <Animated.View entering={FadeIn}>
                    {diffSnapshots(h.data.before!, h.data.after!).map((line, i) => (
                      <Text key={i} variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>
                        • {line}
                      </Text>
                    ))}
                  </Animated.View>
                }
              />
            ))
          ) : (
            <ListItem left={<Icon name="history" color={t.colors.onSurfaceVariant} />} title={`Edited ${edits.length} ${edits.length === 1 ? 'time' : 'times'}`} onPress={() => setShowHistory(true)} />
          )}
        </ListGroup>
      )}

      <View style={styles.comments}>
        <Text variant="titleSmall" style={{ color: t.colors.primary, marginLeft: space.xs, marginBottom: space.sm }}>
          Comments
        </Text>
        {(comments.data ?? []).length === 0 && (
          <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant, marginLeft: space.xs, marginBottom: space.md }}>
            No comments yet.
          </Text>
        )}
        {(comments.data ?? []).map((c) => {
          const author = byId.get(c.author_id);
          const mine = c.author_id === me?.id;
          return (
            <Animated.View key={c.id} entering={FadeInDown.springify().damping(16)} layout={LinearTransition} style={[styles.comment, mine && { flexDirection: 'row-reverse' }]}>
              <Avatar name={author?.name ?? '?'} color={author?.avatar_color ?? '#999'} size={32} />
              <Pressable
                onLongPress={
                  mine
                    ? async () => {
                        if (await confirm({ title: 'Delete comment?', confirmLabel: 'Delete', destructive: true })) deleteComment.mutateAsync(c.id).catch(fail);
                      }
                    : undefined
                }
                style={[
                  styles.bubble,
                  { backgroundColor: mine ? t.colors.primaryContainer : t.colors.surfaceContainerHigh },
                  mine ? { borderTopRightRadius: 6 } : { borderTopLeftRadius: 6 },
                ]}
              >
                <Text variant="labelMedium" style={{ color: mine ? t.colors.onPrimaryContainer : t.colors.onSurfaceVariant }}>
                  {firstName(author, me?.id)} · {timeAgo(c.created_at)}
                </Text>
                <Text variant="bodyLarge" style={{ color: mine ? t.colors.onPrimaryContainer : t.colors.onSurface }}>
                  {c.body}
                </Text>
              </Pressable>
            </Animated.View>
          );
        })}
        {!deleted && (
          <View style={styles.composer}>
            <TextInput
              mode="outlined"
              placeholder="Add a comment"
              value={draft}
              onChangeText={setDraft}
              multiline
              style={{ flex: 1, maxHeight: 140 }}
              outlineStyle={{ borderRadius: 24 }}
            />
            <IconButton
              icon="send"
              mode="contained"
              disabled={!draft.trim() || addComment.isPending}
              accessibilityLabel="Send comment"
              onPress={() =>
                addComment
                  .mutateAsync({ expenseId: e.id, body: draft.trim() })
                  .then(() => {
                    haptic.success();
                    setDraft('');
                  })
                  .catch(fail)
              }
            />
          </View>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.lg, marginBottom: space.lg, paddingLeft: space.lg, paddingRight: space.xs, borderRadius: 16 },
  hero: { alignItems: 'center', gap: 4, paddingHorizontal: space.xl, marginBottom: space.xl },
  strike: { textDecorationLine: 'line-through' },
  comments: { marginHorizontal: space.lg },
  comment: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', marginBottom: space.md },
  bubble: { maxWidth: '80%', borderRadius: 20, paddingHorizontal: space.lg, paddingVertical: space.sm, gap: 2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
});
