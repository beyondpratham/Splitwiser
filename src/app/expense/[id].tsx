import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { Avatar, CategoryTile } from '@/components/Avatar';
import { Button, haptic, IconButton } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { EmptyState, Loading } from '@/components/ui';
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
import { dayToDate, formatMoney } from '@/lib/money';
import { font, space, useTheme, R } from '@/theme';

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
      menu={!deleted ? [{ label: 'Delete', icon: 'delete-outline', destructive: true, onPress: remove }] : undefined}
    >
      {deleted && (
        <Animated.View entering={FadeIn} style={styles.section}>
          <Glass variant="pill" tint={t.dangerSoft} contentStyle={styles.banner}>
            <Icon name="delete-outline" size={20} color={t.danger} />
            <T variant="label" tone="danger" style={{ flex: 1 }}>
              This expense was deleted
            </T>
            <Button title="Restore" size="sm" variant="ghost" onPress={() => restore.mutateAsync(e.id).catch(fail)} />
          </Glass>
        </Animated.View>
      )}

      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <CategoryTile category={e.category} payment={e.is_payment} size={76} />
        </Animated.View>
        <T variant="heading" style={[{ textAlign: 'center', marginTop: space.md }, deleted && styles.strike]}>
          {e.is_payment ? 'Payment' : e.description}
        </T>
        <T variant="display" numeric style={{ fontSize: 42, lineHeight: 50 }}>
          {formatMoney(Number(e.amount), e.currency)}
        </T>
        <T variant="caption" tone="dim" style={{ textAlign: 'center' }}>
          {dayToDate(e.spent_on).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
          {group ? ` · ${group.name}` : ''}
          {!e.is_payment ? ` · ${categoryById(e.category).label}` : ''}
        </T>
        <T variant="caption" tone="faint">
          Added by {firstName(creator, me?.id)} {timeAgo(e.created_at)}
          {e.updated_at !== e.created_at && !deleted ? ` · edited ${timeAgo(e.updated_at)}` : ''}
        </T>
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
                left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} avatar={p?.avatar} />}
                title={line}
                subtitle={!e.is_payment && net > 0.004 ? `gets back ${formatMoney(net, e.currency)}` : undefined}
              />
            );
          })}
      </ListGroup>

      {e.notes && (
        <ListGroup title="Notes">
          <ListItem left={<Icon name="note-text-outline" color={t.inkDim} />} title={<T variant="body">{e.notes}</T>} />
        </ListGroup>
      )}

      {edits.length > 0 && (
        <ListGroup
          title="History"
          action={<Button title={showHistory ? 'Hide' : `${edits.length} ${edits.length === 1 ? 'edit' : 'edits'}`} variant="ghost" size="sm" onPress={() => setShowHistory(!showHistory)} />}
        >
          {showHistory ? (
            edits.map((h) => (
              <ListItem
                key={h.id}
                left={<Icon name="history" color={t.inkDim} />}
                title={`${firstName(byId.get(h.actor_id ?? ''), me?.id)} edited · ${timeAgo(h.created_at)}`}
                subtitle={
                  <Animated.View entering={FadeIn}>
                    {diffSnapshots(h.data.before!, h.data.after!).map((line, i) => (
                      <T key={i} variant="caption" tone="dim">
                        • {line}
                      </T>
                    ))}
                  </Animated.View>
                }
              />
            ))
          ) : (
            <ListItem left={<Icon name="history" color={t.inkDim} />} title={`Edited ${edits.length} ${edits.length === 1 ? 'time' : 'times'}`} chevron onPress={() => setShowHistory(true)} />
          )}
        </ListGroup>
      )}

      <View style={styles.comments}>
        <T variant="overline" tone="dim" style={{ marginLeft: space.sm, marginBottom: space.sm }}>
          Comments
        </T>
        {(comments.data ?? []).length === 0 && (
          <T variant="body" tone="dim" style={{ marginLeft: space.sm, marginBottom: space.md }}>
            No comments yet.
          </T>
        )}
        {(comments.data ?? []).map((c) => {
          const author = byId.get(c.author_id);
          const mine = c.author_id === me?.id;
          return (
            <Animated.View key={c.id} entering={FadeInDown.springify().damping(16)} layout={LinearTransition} style={[styles.comment, mine && { flexDirection: 'row-reverse' }]}>
              <Avatar name={author?.name ?? '?'} color={author?.avatar_color ?? '#999'} avatar={author?.avatar} size={32} />
              <Pressable
                onLongPress={
                  mine
                    ? async () => {
                        if (await confirm({ title: 'Delete comment?', confirmLabel: 'Delete', destructive: true })) deleteComment.mutateAsync(c.id).catch(fail);
                      }
                    : undefined
                }
                style={{ maxWidth: '80%' }}
              >
                {mine ? (
                  <View style={[styles.bubble, { backgroundColor: t.accent, borderTopRightRadius: 4 }]}>
                    <T variant="caption" style={{ color: t.accentInk, opacity: 0.8 }}>
                      You · {timeAgo(c.created_at)}
                    </T>
                    <T variant="body" style={{ color: t.accentInk }}>
                      {c.body}
                    </T>
                  </View>
                ) : (
                  <Glass contentStyle={styles.bubble}>
                    <T variant="caption" tone="dim">
                      {firstName(author, me?.id)} · {timeAgo(c.created_at)}
                    </T>
                    <T variant="body">{c.body}</T>
                  </Glass>
                )}
              </Pressable>
            </Animated.View>
          );
        })}
        {!deleted && (
          <Glass variant="pill" style={{ marginTop: space.sm }} contentStyle={styles.composer}>
            <TextInput
              placeholder="Add a comment"
              value={draft}
              onChangeText={setDraft}
              multiline
              placeholderTextColor={t.inkFaint}
              selectionColor={t.accent}
              style={[styles.composerInput, { color: t.ink }]}
            />
            <IconButton
              icon="send"
              label="Send comment"
              color={draft.trim() ? t.accentText : t.inkFaint}
              onPress={() => {
                if (!draft.trim() || addComment.isPending) return;
                addComment
                  .mutateAsync({ expenseId: e.id, body: draft.trim() })
                  .then(() => {
                    haptic.success();
                    setDraft('');
                  })
                  .catch(fail);
              }}
            />
          </Glass>
        )}
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.lg },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg, paddingRight: space.xs, height: 52 },
  hero: { alignItems: 'center', gap: 4, paddingHorizontal: space.xl, marginBottom: space.xl },
  strike: { textDecorationLine: 'line-through' },
  comments: { marginHorizontal: space.lg },
  comment: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', marginBottom: space.md },
  bubble: { borderRadius: R, paddingHorizontal: space.lg, paddingVertical: space.sm, gap: 2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.lg, paddingRight: 6, minHeight: 52 },
  composerInput: { flex: 1, fontSize: 16, fontFamily: font.regular, maxHeight: 140, paddingVertical: 10, outlineStyle: 'none' } as never,
});
