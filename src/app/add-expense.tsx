import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { Checkbox, Chip, HelperText, RadioButton, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { DatePickerModal } from 'react-native-paper-dates';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { Avatar, CategoryTile, EmojiTile } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { CategoryPicker, CurrencyPicker } from '@/components/Pickers';
import { Sheet } from '@/components/Sheet';
import { haptic, Loading } from '@/components/ui';
import { useExpense, useFriends, useGroups, useMe, usePeople, useSaveExpense } from '@/lib/api';
import { firstName } from '@/lib/balances';
import { categoryById, guessCategory } from '@/lib/categories';
import { currencyByCode } from '@/lib/currencies';
import { computeSplit, currencyDecimals, distribute, formatMoney, fromMinor, parseAmount, toMinor, type SplitType } from '@/lib/money';
import { friendlyError } from '@/lib/supabase';
import { hexAlpha, space, useTheme } from '@/theme';

const SPLIT_LABEL: Record<SplitType, string> = { equal: 'equally', exact: 'by amounts', percent: 'by percent', shares: 'by shares' };

function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface FormState {
  description: string;
  amountText: string;
  currency: string | null;
  category: string;
  categoryTouched: boolean;
  groupId: string | null;
  participants: string[];
  payerMode: 'single' | 'multiple';
  payerId: string | null;
  paidText: Record<string, string>;
  splitType: SplitType;
  included: Record<string, boolean>;
  splitText: Record<string, string>;
  date: Date;
  notes: string;
}

type Params = { groupId?: string; friendId?: string; expenseId?: string };

/** Loads what the form needs, then mounts it with its initial state. */
export default function AddExpense() {
  const params = useLocalSearchParams<Params>();
  const me = useMe().data;
  const groups = useGroups().data;
  const existing = useExpense(params.expenseId);

  if (!me || !groups || (params.expenseId && !existing.data)) return <Loading />;

  const blank: FormState = {
    description: '',
    amountText: '',
    currency: null,
    category: 'general',
    categoryTouched: false,
    groupId: null,
    participants: [me.id],
    payerMode: 'single',
    payerId: me.id,
    paidText: {},
    splitType: 'equal',
    included: {},
    splitText: {},
    date: new Date(),
    notes: '',
  };
  let initial = blank;
  const e = existing.data;
  if (params.expenseId && e) {
    const payers = e.expense_shares.filter((s) => Number(s.paid) > 0);
    initial = {
      ...blank,
      description: e.description,
      amountText: String(Number(e.amount)),
      currency: e.currency,
      category: e.category,
      categoryTouched: true,
      groupId: e.group_id,
      participants: e.expense_shares.map((s) => s.profile_id),
      payerMode: payers.length === 1 ? 'single' : 'multiple',
      payerId: payers.length === 1 ? payers[0].profile_id : me.id,
      paidText: Object.fromEntries(payers.map((s) => [s.profile_id, String(Number(s.paid))])),
      splitType: e.split_type,
      included: Object.fromEntries(e.expense_shares.map((s) => [s.profile_id, Number(s.owed) > 0])),
      splitText: Object.fromEntries(
        e.expense_shares.map((s) => [
          s.profile_id,
          e.split_type === 'exact' ? String(Number(s.owed)) : s.split_value != null ? String(Number(s.split_value)) : '',
        ]),
      ),
      date: new Date(`${e.spent_on}T12:00:00`),
      notes: e.notes ?? '',
    };
  } else if (params.groupId) {
    const g = groups.find((x) => x.id === params.groupId);
    if (g) initial = { ...blank, groupId: g.id, currency: g.default_currency, participants: g.group_members.map((m) => m.profile_id) };
  } else if (params.friendId) {
    initial = { ...blank, participants: [me.id, params.friendId] };
  }
  return <ExpenseForm initial={initial} params={params} />;
}

function ExpenseForm({ initial, params }: { initial: FormState; params: Params }) {
  const t = useTheme();
  const me = useMe().data;
  const { byId } = usePeople();
  const groups = useGroups().data ?? [];
  const { friends } = useFriends();
  const save = useSaveExpense();

  const [description, setDescription] = useState(initial.description);
  const [amountText, setAmountText] = useState(initial.amountText);
  const [currency, setCurrency] = useState(initial.currency);
  const [category, setCategory] = useState(initial.category);
  const [categoryTouched, setCategoryTouched] = useState(initial.categoryTouched);
  const [groupId, setGroupId] = useState(initial.groupId);
  const [participants, setParticipants] = useState(initial.participants);
  const [payerMode, setPayerMode] = useState(initial.payerMode);
  const [payerId, setPayerId] = useState(initial.payerId);
  const [paidText, setPaidText] = useState(initial.paidText);
  const [splitType, setSplitType] = useState(initial.splitType);
  const [included, setIncluded] = useState(initial.included);
  const [splitText, setSplitText] = useState(initial.splitText);
  const [date, setDate] = useState(initial.date);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'with' | 'payer' | 'split' | 'currency' | 'category' | 'date'>(null);

  const group = groups.find((g) => g.id === groupId);
  const cur = currency ?? group?.default_currency ?? me?.default_currency ?? 'USD';
  const amount = parseAmount(amountText) ?? 0;
  const totalMinor = toMinor(amount, cur);
  const decimals = currencyDecimals(cur);

  // ── derived shares ──
  const calc = useMemo(() => {
    const ids = participants;
    let paid: number[];
    let payerError: string | null = null;
    if (payerMode === 'single') {
      const pid = payerId && ids.includes(payerId) ? payerId : me?.id;
      paid = ids.map((id) => (id === pid ? totalMinor : 0));
    } else {
      paid = ids.map((id) => toMinor(parseAmount(paidText[id] ?? '') ?? 0, cur));
      const diff = totalMinor - paid.reduce((a, b) => a + b, 0);
      if (diff !== 0) payerError = `Payments are ${formatMoney(Math.abs(fromMinor(diff, cur)), cur)} ${diff > 0 ? 'short' : 'over'}`;
    }
    let owed: number[];
    let splitError: string | null = null;
    if (splitType === 'equal') {
      const w = ids.map((id) => (included[id] === false ? 0 : 1));
      owed = distribute(totalMinor, w);
      if (!w.some(Boolean)) splitError = 'Include at least one person';
    } else {
      const values = ids.map((id) => {
        const v = parseAmount(splitText[id] ?? '') ?? 0;
        return splitType === 'exact' ? toMinor(v, cur) : v;
      });
      const r = computeSplit({ type: splitType, totalMinor, values });
      owed = r.owed;
      if (r.error) {
        splitError =
          splitType === 'exact'
            ? `${formatMoney(Math.abs(fromMinor(r.remainingMinor, cur)), cur)} ${r.remainingMinor > 0 ? 'left to assign' : 'over the total'}`
            : r.error;
      }
    }
    return { paid, owed, payerError, splitError };
  }, [participants, payerMode, payerId, paidText, splitType, included, splitText, totalMinor, cur, me?.id]);

  const withLabel = group
    ? group.name
    : participants
        .filter((id) => id !== me?.id)
        .map((id) => byId.get(id)?.name.split(' ')[0] ?? '…')
        .join(', ');
  const payerLabel =
    payerMode === 'multiple'
      ? `${participants.filter((_, i) => calc.paid[i] > 0).length || 'multiple'} people`
      : payerId === me?.id
        ? 'you'
        : firstName(byId.get(payerId ?? ''));

  const canSave = description.trim().length > 0 && totalMinor > 0 && participants.length >= 2 && !calc.payerError && !calc.splitError && !save.isPending;
  const missing =
    participants.length < 2 ? 'Choose who you’re splitting with' : !description.trim() || totalMinor <= 0 ? null : calc.payerError ?? calc.splitError;

  async function onSave() {
    setError(null);
    try {
      await save.mutateAsync({
        id: params.expenseId,
        group_id: groupId,
        description: description.trim(),
        amount: fromMinor(totalMinor, cur),
        currency: cur,
        category,
        split_type: splitType,
        spent_on: isoDate(date),
        notes: notes.trim() || null,
        shares: participants.map((id, i) => ({
          profile_id: id,
          paid: fromMinor(calc.paid[i], cur),
          owed: fromMinor(calc.owed[i], cur),
          split_value: splitType === 'percent' || splitType === 'shares' ? parseAmount(splitText[id] ?? '') : null,
        })),
      });
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
    }
  }

  const name = (id: string) => (id === me?.id ? 'You' : byId.get(id)?.name ?? '…');

  return (
    <Page
      title={params.expenseId ? 'Edit expense' : 'Add expense'}
      variant="dialog"
      form
      confirm={{ label: 'Save', onPress: onSave, disabled: !canSave, loading: save.isPending }}
    >
      {/* With */}
      <View style={[styles.withCard, { backgroundColor: t.colors.secondaryContainer }]}>
        <Pressable onPress={() => setSheet('with')} android_ripple={{ color: hexAlpha(t.colors.onSecondaryContainer, 0.12) }} style={styles.withRow}>
          {group ? <EmojiTile emoji={group.emoji} size={32} /> : <Icon name="account-multiple" size={24} color={t.colors.onSecondaryContainer} />}
          <View style={{ flex: 1 }}>
            <Text variant="labelMedium" style={{ color: t.colors.onSecondaryContainer, opacity: 0.8 }}>
              With you and
            </Text>
            <Text variant="titleMedium" numberOfLines={1} style={{ color: t.colors.onSecondaryContainer }}>
              {participants.length < 2 ? 'Choose people or a group' : withLabel}
            </Text>
          </View>
          <Icon name="chevron-down" color={t.colors.onSecondaryContainer} />
        </Pressable>
      </View>

      {/* Hero */}
      <View style={[styles.hero, { backgroundColor: t.colors.surfaceContainerLow }]}>
        <View style={styles.descRow}>
          <Pressable onPress={() => setSheet('category')} hitSlop={6} accessibilityLabel="Choose category">
            <CategoryTile category={category} size={52} />
          </Pressable>
          <RNTextInput
            value={description}
            onChangeText={(v) => {
              setDescription(v);
              if (!categoryTouched) setCategory(guessCategory(v) ?? 'general');
            }}
            placeholder="What was it for?"
            placeholderTextColor={t.colors.outline}
            selectionColor={t.colors.primary}
            cursorColor={t.colors.primary}
            autoFocus={!params.expenseId}
            style={[styles.descInput, { color: t.colors.onSurface }]}
          />
        </View>
        <View style={[styles.amountRow, { borderTopColor: t.colors.outlineVariant }]}>
          <Chip onPress={() => setSheet('currency')} icon={() => <Text>{currencyByCode(cur)?.flag ?? '💱'}</Text>} compact>
            {cur}
          </Chip>
          <RNTextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder={decimals ? '0.00' : '0'}
            placeholderTextColor={t.colors.outline}
            selectionColor={t.colors.primary}
            cursorColor={t.colors.primary}
            keyboardType="decimal-pad"
            style={[styles.amountInput, { color: t.colors.onSurface }]}
          />
        </View>
        <Text variant="labelMedium" style={[styles.categoryHint, { color: t.colors.onSurfaceVariant }]}>
          {categoryById(category).label}
          {!categoryTouched && category !== 'general' ? ' · picked automatically' : ''}
        </Text>
      </View>

      {/* Paid by / split */}
      <View style={styles.sentence}>
        <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant }}>
          Paid by
        </Text>
        <Chip mode="flat" selected showSelectedCheck={false} onPress={() => setSheet('payer')} icon="account-cash">
          {payerLabel}
        </Chip>
        <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant }}>
          and split
        </Text>
        <Chip mode="flat" selected showSelectedCheck={false} onPress={() => setSheet('split')} icon="call-split">
          {SPLIT_LABEL[splitType]}
        </Chip>
      </View>
      {totalMinor > 0 && participants.length >= 2 && !calc.splitError && (
        <Animated.Text entering={FadeIn} style={[styles.perPerson, { color: t.colors.onSurfaceVariant }]}>
          {splitType === 'equal'
            ? `${formatMoney(fromMinor(Math.max(...calc.owed), cur), cur)} per person`
            : participants.map((id, i) => `${firstName(byId.get(id), me?.id)} ${formatMoney(fromMinor(calc.owed[i], cur), cur)}`).join(' · ')}
        </Animated.Text>
      )}

      <View style={styles.extra}>
        <Chip icon="calendar" onPress={() => setSheet('date')} style={{ alignSelf: 'flex-start' }}>
          {date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
        </Chip>
        <TextInput mode="outlined" label="Notes" value={notes} onChangeText={setNotes} multiline left={<TextInput.Icon icon="note-text-outline" />} />
        {(error || missing) && (
          <HelperText type={error ? 'error' : 'info'} visible style={!error ? { color: t.colors.owe } : undefined}>
            {error ?? missing}
          </HelperText>
        )}
      </View>

      <DatePickerModal
        locale="en"
        mode="single"
        visible={sheet === 'date'}
        date={date}
        onDismiss={() => setSheet(null)}
        onConfirm={({ date: d }) => {
          setSheet(null);
          if (d) setDate(d);
        }}
      />
      <CurrencyPicker visible={sheet === 'currency'} value={cur} onClose={() => setSheet(null)} onSelect={setCurrency} />
      <CategoryPicker
        visible={sheet === 'category'}
        value={category}
        onClose={() => setSheet(null)}
        onSelect={(c) => {
          setCategory(c);
          setCategoryTouched(true);
        }}
      />

      {/* With whom */}
      <Sheet visible={sheet === 'with'} title="Split with" onClose={() => setSheet(null)} action={{ label: 'Done', onPress: () => setSheet(null) }}>
        {groups.length > 0 && (
          <ListGroup title="Groups">
            {groups.map((g) => (
              <ListItem
                key={g.id}
                left={<EmojiTile emoji={g.emoji} size={40} />}
                title={g.name}
                subtitle={`${g.group_members.length} people`}
                right={<RadioButton.Android value={g.id} status={groupId === g.id ? 'checked' : 'unchecked'} onPress={() => {}} />}
                onPress={() => {
                  haptic.tap();
                  setGroupId(g.id);
                  setParticipants(g.group_members.map((m) => m.profile_id));
                  if (!currency) setCurrency(g.default_currency);
                }}
              />
            ))}
          </ListGroup>
        )}
        <ListGroup title="Friends" footer={friends.length === 0 ? 'Add friends from the Friends tab first.' : 'Pick one or more friends for an expense outside any group.'}>
          {friends.map((f) => {
            const on = !groupId && participants.includes(f.id);
            const toggle = () => {
              haptic.tap();
              const base = groupId ? [me!.id] : participants;
              setGroupId(null);
              setParticipants(on ? base.filter((x) => x !== f.id) : [...base, f.id]);
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
        </ListGroup>
      </Sheet>

      {/* Payer */}
      <Sheet visible={sheet === 'payer'} title="Who paid?" onClose={() => setSheet(null)} action={{ label: 'Done', onPress: () => setSheet(null), disabled: !!calc.payerError }}>
        <View style={styles.sheetControls}>
          <SegmentedButtons
            value={payerMode}
            onValueChange={(v) => setPayerMode(v as 'single' | 'multiple')}
            buttons={[
              { value: 'single', label: 'One person', icon: 'account' },
              { value: 'multiple', label: 'Several', icon: 'account-multiple' },
            ]}
          />
        </View>
        <Animated.View layout={LinearTransition.springify()}>
          <ListGroup footer={payerMode === 'multiple' ? calc.payerError ?? `Adds up to ${formatMoney(fromMinor(totalMinor, cur), cur)} ✓` : undefined}>
            {participants.map((id) => {
              const p = byId.get(id);
              return (
                <ListItem
                  key={id}
                  left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} />}
                  title={name(id)}
                  right={
                    payerMode === 'single' ? (
                      <RadioButton.Android value={id} status={payerId === id ? 'checked' : 'unchecked'} onPress={() => setPayerId(id)} />
                    ) : (
                      <AmountInput value={paidText[id] ?? ''} onChange={(v) => setPaidText({ ...paidText, [id]: v })} suffix={cur} />
                    )
                  }
                  onPress={
                    payerMode === 'single'
                      ? () => {
                          haptic.tap();
                          setPayerId(id);
                        }
                      : undefined
                  }
                />
              );
            })}
          </ListGroup>
        </Animated.View>
      </Sheet>

      {/* Split */}
      <Sheet visible={sheet === 'split'} title="Split options" onClose={() => setSheet(null)} action={{ label: 'Done', onPress: () => setSheet(null), disabled: !!calc.splitError }}>
        <View style={styles.sheetControls}>
          <SegmentedButtons
            value={splitType}
            onValueChange={(v) => {
              setSplitType(v as SplitType);
              setSplitText({});
            }}
            buttons={[
              { value: 'equal', label: 'Equal' },
              { value: 'exact', label: 'Exact' },
              { value: 'percent', label: '%' },
              { value: 'shares', label: 'Shares' },
            ]}
          />
        </View>
        <Animated.View layout={LinearTransition.springify()}>
          <ListGroup footer={calc.splitError ?? (totalMinor > 0 ? `Total ${formatMoney(fromMinor(totalMinor, cur), cur)} ✓` : 'Enter an amount to see each share.')}>
            {participants.map((id, i) => {
              const p = byId.get(id);
              const share = formatMoney(fromMinor(calc.owed[i] ?? 0, cur), cur);
              const toggle = () => {
                haptic.tap();
                setIncluded({ ...included, [id]: included[id] === false });
              };
              return (
                <ListItem
                  key={id}
                  left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} />}
                  title={name(id)}
                  subtitle={splitType === 'percent' || splitType === 'shares' ? share : undefined}
                  right={
                    splitType === 'equal' ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                        <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant, fontVariant: ['tabular-nums'] }}>
                          {included[id] === false ? '' : share}
                        </Text>
                        <Checkbox.Android status={included[id] === false ? 'unchecked' : 'checked'} onPress={toggle} />
                      </View>
                    ) : (
                      <AmountInput
                        value={splitText[id] ?? ''}
                        onChange={(v) => setSplitText({ ...splitText, [id]: v })}
                        suffix={splitType === 'exact' ? cur : splitType === 'percent' ? '%' : '×'}
                      />
                    )
                  }
                  onPress={splitType === 'equal' ? toggle : undefined}
                />
              );
            })}
          </ListGroup>
        </Animated.View>
        {splitType === 'percent' && (
          <Chip
            icon="equal"
            style={{ alignSelf: 'center' }}
            onPress={() => {
              const parts = distribute(10000, participants.map(() => 1));
              setSplitText(Object.fromEntries(participants.map((id, i) => [id, String(parts[i] / 100)])));
            }}
          >
            Split evenly
          </Chip>
        )}
      </Sheet>
    </Page>
  );
}

function AmountInput({ value, onChange, suffix }: { value: string; onChange: (v: string) => void; suffix: string }) {
  return (
    <TextInput
      mode="outlined"
      dense
      value={value}
      onChangeText={onChange}
      keyboardType="decimal-pad"
      placeholder="0"
      right={<TextInput.Affix text={suffix} />}
      style={{ width: 128, textAlign: 'right' }}
    />
  );
}

const styles = StyleSheet.create({
  withCard: { marginHorizontal: space.lg, borderRadius: 20, overflow: 'hidden', marginBottom: space.md },
  withRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
  hero: { marginHorizontal: space.lg, borderRadius: 28, overflow: 'hidden' },
  descRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  descInput: { flex: 1, fontSize: 22, paddingVertical: 6 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
  amountInput: { flex: 1, fontSize: 48, fontWeight: '500', letterSpacing: -1, paddingVertical: space.sm, fontVariant: ['tabular-nums'] },
  categoryHint: { paddingHorizontal: space.lg, paddingBottom: space.lg },
  sentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.xl, paddingHorizontal: space.lg },
  perPerson: { textAlign: 'center', fontSize: 13, marginTop: space.md, paddingHorizontal: space.xl },
  extra: { paddingHorizontal: space.lg, gap: space.md, marginTop: space.xl },
  sheetControls: { paddingHorizontal: space.lg, marginBottom: space.lg },
});
