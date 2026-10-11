import DateTimePicker from '@react-native-community/datetimepicker';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, CategoryTile, EmojiTile } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Row, Section } from '@/components/List';
import { CategoryPicker, CurrencyPicker } from '@/components/Pickers';
import { Check, Field, haptic, HeaderButton, Loading, Screen, Segmented, Sheet } from '@/components/ui';
import { useExpense, useFriends, useGroups, useMe, usePeople, useSaveExpense } from '@/lib/api';
import { firstName } from '@/lib/balances';
import { categoryById, guessCategory } from '@/lib/categories';
import { currencyByCode } from '@/lib/currencies';
import { computeSplit, currencyDecimals, distribute, formatMoney, fromMinor, parseAmount, toMinor, type SplitType } from '@/lib/money';
import { friendlyError } from '@/lib/supabase';
import { radius, space, useTheme } from '@/theme';

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
  const [sheet, setSheet] = useState<null | 'with' | 'payer' | 'split' | 'currency' | 'category'>(null);
  const [showAndroidDate, setShowAndroidDate] = useState(false);

  const group = groups.find((g) => g.id === groupId);

  const cur = currency ?? group?.default_currency ?? me?.default_currency ?? 'USD';
  const amount = parseAmount(amountText) ?? 0;
  const totalMinor = toMinor(amount, cur);
  const decimals = currencyDecimals(cur);

  // ── derived shares ──
  const calc = useMemo(() => {
    const ids = participants;
    // paid
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
    // owed
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
    return { paid, owed, payerError, splitError, remainingMinor: splitType === 'exact' ? totalMinor - owed.reduce((a, b) => a + b, 0) : 0 };
  }, [participants, payerMode, payerId, paidText, splitType, included, splitText, totalMinor, cur, me?.id]);

  const withLabel = group
    ? group.name
    : participants.filter((id) => id !== me?.id).map((id) => byId.get(id)?.name.split(' ')[0] ?? '…').join(', ');

  const payerLabel =
    payerMode === 'multiple' ? `${participants.filter((_, i) => calc.paid[i] > 0).length || 'multiple'} people` : payerId === me?.id ? 'you' : firstName(byId.get(payerId ?? ''));

  const canSave =
    description.trim().length > 0 && totalMinor > 0 && participants.length >= 2 && !calc.payerError && !calc.splitError && !save.isPending;

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

  const missing =
    participants.length < 2 ? 'Choose who you’re splitting with' : !description.trim() ? null : totalMinor <= 0 ? null : calc.payerError ?? calc.splitError;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: params.expenseId ? 'Edit expense' : 'Add expense',
          headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} />,
          headerRight: () => <HeaderButton title="Save" bold onPress={onSave} disabled={!canSave} />,
        }}
      />
      <Screen contentContainerStyle={{ paddingBottom: 60 }}>
        {/* With */}
        <Pressable onPress={() => setSheet('with')} style={[styles.withRow, { backgroundColor: t.card }]}>
          <Text style={{ color: t.secondary, fontSize: 15 }}>With you and</Text>
          {group && <EmojiTile emoji={group.emoji} size={24} />}
          <Text style={[styles.withValue, { color: participants.length < 2 ? t.accent : t.text }]} numberOfLines={1}>
            {participants.length < 2 ? 'Choose people or a group' : withLabel}
          </Text>
          <Icon name="chevron.down" size={13} color={t.tertiary} weight="semibold" />
        </Pressable>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: t.card }]}>
          <View style={styles.descRow}>
            <Pressable onPress={() => setSheet('category')} hitSlop={6}>
              <CategoryTile category={category} size={48} />
            </Pressable>
            <TextInput
              value={description}
              onChangeText={(v) => {
                setDescription(v);
                if (!categoryTouched) setCategory(guessCategory(v) ?? 'general');
              }}
              placeholder="What was it for?"
              placeholderTextColor={t.tertiary}
              selectionColor={t.accent}
              autoFocus={!params.expenseId}
              style={[styles.descInput, { color: t.text }]}
              returnKeyType="next"
            />
          </View>
          <View style={[styles.amountRow, { borderTopColor: t.separator }]}>
            <Pressable onPress={() => setSheet('currency')} style={[styles.currencyBtn, { backgroundColor: t.fill }]}>
              <Text style={{ fontSize: 16 }}>{currencyByCode(cur)?.flag ?? '💱'}</Text>
              <Text style={{ color: t.text, fontWeight: '600', fontSize: 15 }}>{cur}</Text>
            </Pressable>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder={decimals ? '0.00' : '0'}
              placeholderTextColor={t.tertiary}
              selectionColor={t.accent}
              keyboardType="decimal-pad"
              style={[styles.amountInput, { color: t.text }]}
            />
          </View>
          <Text style={{ color: t.secondary, fontSize: 13, paddingHorizontal: space.lg, paddingBottom: space.md }}>
            {categoryById(category).label}
            {!categoryTouched && category !== 'general' ? ' · auto' : ''}
          </Text>
        </View>

        {/* Paid by / split */}
        <View style={[styles.sentence, { backgroundColor: t.card }]}>
          <Text style={[styles.sentenceText, { color: t.secondary }]}>Paid by </Text>
          <Chip label={payerLabel} onPress={() => setSheet('payer')} />
          <Text style={[styles.sentenceText, { color: t.secondary }]}> and split </Text>
          <Chip label={SPLIT_LABEL[splitType]} onPress={() => setSheet('split')} />
        </View>
        {totalMinor > 0 && participants.length >= 2 && !calc.splitError && (
          <Text style={[styles.perPerson, { color: t.secondary }]}>
            {splitType === 'equal'
              ? `${formatMoney(fromMinor(Math.max(...calc.owed), cur), cur)} per person`
              : participants.map((id, i) => `${firstName(byId.get(id), me?.id)} ${formatMoney(fromMinor(calc.owed[i], cur), cur)}`).join(' · ')}
          </Text>
        )}

        <Section style={{ marginTop: space.lg }}>
          <Row
            left={<Icon name="calendar" size={20} color={t.accent} />}
            title="Date"
            right={
              Platform.OS === 'ios' ? (
                <DateTimePicker value={date} mode="date" display="compact" maximumDate={new Date(2100, 0)} onChange={(_, d) => d && setDate(d)} accentColor={t.accent} />
              ) : (
                <Text style={{ color: t.secondary, fontSize: 17 }}>{date.toLocaleDateString()}</Text>
              )
            }
            onPress={Platform.OS === 'ios' ? undefined : () => setShowAndroidDate(true)}
          />
          <View style={styles.notesRow}>
            <Icon name="note.text" size={20} color={t.accent} />
            <Field value={notes} onChangeText={setNotes} placeholder="Notes" multiline style={{ flex: 1, paddingHorizontal: 0 }} />
          </View>
        </Section>

        {(error || missing) && (
          <Text style={[styles.error, { color: error ? t.danger : t.owe }]}>{error ?? missing}</Text>
        )}
      </Screen>

      {showAndroidDate && (
        <DateTimePicker
          value={date}
          mode="date"
          onChange={(_, d) => {
            setShowAndroidDate(false);
            if (d) setDate(d);
          }}
        />
      )}

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
      <Sheet visible={sheet === 'with'} title="Split with" onClose={() => setSheet(null)}>
        {groups.length > 0 && (
          <Section title="Groups">
            {groups.map((g) => (
              <Row
                key={g.id}
                left={<EmojiTile emoji={g.emoji} size={36} />}
                title={g.name}
                subtitle={`${g.group_members.length} people`}
                right={<Check on={groupId === g.id} />}
                onPress={() => {
                  haptic.tap();
                  setGroupId(g.id);
                  setParticipants(g.group_members.map((m) => m.profile_id));
                  if (!currency) setCurrency(g.default_currency);
                  setSheet(null);
                }}
              />
            ))}
          </Section>
        )}
        <Section title="Friends" footer={friends.length === 0 ? 'Add friends from the Friends tab first.' : 'Pick one or more friends for an expense outside any group.'}>
          {friends.map((f) => {
            const on = !groupId && participants.includes(f.id);
            return (
              <Row
                key={f.id}
                left={<Avatar name={f.name} color={f.avatar_color} size={36} />}
                title={f.name}
                subtitle={f.email ?? undefined}
                right={<Check on={on} />}
                onPress={() => {
                  haptic.tap();
                  const base = groupId ? [me!.id] : participants;
                  setGroupId(null);
                  setParticipants(on ? base.filter((x) => x !== f.id) : [...base, f.id]);
                }}
              />
            );
          })}
        </Section>
      </Sheet>

      {/* Payer */}
      <Sheet visible={sheet === 'payer'} title="Who paid?" onClose={() => setSheet(null)}>
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.lg }}>
          <Segmented
            options={[
              { value: 'single', label: 'One person' },
              { value: 'multiple', label: 'Multiple people' },
            ]}
            value={payerMode}
            onChange={setPayerMode}
          />
        </View>
        <Section
          footer={
            payerMode === 'multiple'
              ? calc.payerError ?? `Adds up to ${formatMoney(fromMinor(totalMinor, cur), cur)} ✓`
              : undefined
          }
        >
          {participants.map((id) => {
            const p = byId.get(id);
            return (
              <Row
                key={id}
                left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} size={36} />}
                title={id === me?.id ? 'You' : p?.name ?? '…'}
                right={
                  payerMode === 'single' ? (
                    <Check on={payerId === id} />
                  ) : (
                    <MoneyInput value={paidText[id] ?? ''} onChange={(v) => setPaidText({ ...paidText, [id]: v })} currency={cur} />
                  )
                }
                onPress={
                  payerMode === 'single'
                    ? () => {
                        haptic.tap();
                        setPayerId(id);
                        setSheet(null);
                      }
                    : undefined
                }
              />
            );
          })}
        </Section>
      </Sheet>

      {/* Split */}
      <Sheet visible={sheet === 'split'} title="Split options" onClose={() => setSheet(null)}>
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.lg }}>
          <Segmented
            options={[
              { value: 'equal', label: 'Equal', icon: 'equal' },
              { value: 'exact', label: 'Exact', icon: 'number' },
              { value: 'percent', label: '%', icon: 'percent' },
              { value: 'shares', label: 'Shares', icon: 'list.bullet' },
            ]}
            value={splitType}
            onChange={(v) => {
              setSplitType(v);
              setSplitText({});
            }}
          />
        </View>
        <Section
          footer={
            calc.splitError ??
            (totalMinor > 0 ? `Total ${formatMoney(fromMinor(totalMinor, cur), cur)} ✓` : 'Enter an amount to see each share.')
          }
        >
          {participants.map((id, i) => {
            const p = byId.get(id);
            const share = formatMoney(fromMinor(calc.owed[i] ?? 0, cur), cur);
            return (
              <Row
                key={id}
                left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} size={36} />}
                title={id === me?.id ? 'You' : p?.name ?? '…'}
                subtitle={splitType === 'equal' || splitType === 'exact' ? undefined : share}
                right={
                  splitType === 'equal' ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <Text style={{ color: t.secondary, fontVariant: ['tabular-nums'] }}>{included[id] === false ? '' : share}</Text>
                      <Check on={included[id] !== false} />
                    </View>
                  ) : splitType === 'exact' ? (
                    <MoneyInput value={splitText[id] ?? ''} onChange={(v) => setSplitText({ ...splitText, [id]: v })} currency={cur} />
                  ) : (
                    <UnitInput
                      value={splitText[id] ?? ''}
                      onChange={(v) => setSplitText({ ...splitText, [id]: v })}
                      unit={splitType === 'percent' ? '%' : 'shares'}
                    />
                  )
                }
                onPress={
                  splitType === 'equal'
                    ? () => {
                        haptic.tap();
                        setIncluded({ ...included, [id]: included[id] === false });
                      }
                    : undefined
                }
              />
            );
          })}
        </Section>
        {splitType === 'percent' && (
          <Pressable
            style={{ alignSelf: 'center' }}
            onPress={() => {
              const parts = distribute(10000, participants.map(() => 1));
              setSplitText(Object.fromEntries(participants.map((id, i) => [id, String(parts[i] / 100)])));
            }}
          >
            <Text style={{ color: t.accent, fontSize: 15, fontWeight: '500' }}>Split evenly</Text>
          </Pressable>
        )}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

function Chip({ label, onPress }: { label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, { backgroundColor: t.accentSoft, opacity: pressed ? 0.6 : 1 }]}>
      <Text style={{ color: t.accent, fontWeight: '600', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

function MoneyInput({ value, onChange, currency }: { value: string; onChange: (v: string) => void; currency: string }) {
  const t = useTheme();
  return (
    <View style={[styles.inlineInput, { backgroundColor: t.fill }]}>
      <Text style={{ color: t.secondary, fontSize: 13 }}>{currency}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={t.tertiary}
        selectionColor={t.accent}
        style={[styles.inlineField, { color: t.text }]}
      />
    </View>
  );
}

function UnitInput({ value, onChange, unit }: { value: string; onChange: (v: string) => void; unit: string }) {
  const t = useTheme();
  return (
    <View style={[styles.inlineInput, { backgroundColor: t.fill }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={t.tertiary}
        selectionColor={t.accent}
        style={[styles.inlineField, { color: t.text }]}
      />
      <Text style={{ color: t.secondary, fontSize: 13 }}>{unit}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  withRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingHorizontal: space.lg,
    height: 52,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    marginBottom: space.md,
  },
  withValue: { flex: 1, fontSize: 16, fontWeight: '600' },
  hero: { marginHorizontal: space.lg, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  descRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  descInput: { flex: 1, fontSize: 20, fontWeight: '500', paddingVertical: 6 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  currencyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 40, borderRadius: 20 },
  amountInput: { flex: 1, fontSize: 44, fontWeight: '700', letterSpacing: -1, paddingVertical: space.sm, fontVariant: ['tabular-nums'] },
  sentence: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
  },
  sentenceText: { fontSize: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  perPerson: { textAlign: 'center', fontSize: 13, marginTop: space.sm, paddingHorizontal: space.xl },
  notesRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.lg + 10, paddingRight: space.lg },
  error: { textAlign: 'center', fontSize: 14, fontWeight: '500', paddingHorizontal: space.xl },
  inlineInput: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 10, height: 36, minWidth: 110 },
  inlineField: { flex: 1, fontSize: 16, textAlign: 'right', paddingVertical: 0, fontVariant: ['tabular-nums'] },
});
