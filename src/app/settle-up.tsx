import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Row, Section } from '@/components/List';
import { CurrencyPicker } from '@/components/Pickers';
import { Button, EmptyState, haptic, HeaderButton, Screen } from '@/components/ui';
import { useGroup, useGroupBalances, useGroupPairDebts, useMe, useMyBalances, usePeople, useSaveExpense } from '@/lib/api';
import { entries, firstName, groupDebts, summarizeBalances } from '@/lib/balances';
import { currencyByCode } from '@/lib/currencies';
import { formatMoney, fromMinor, parseAmount, toMinor } from '@/lib/money';
import { friendlyError } from '@/lib/supabase';
import { radius, space, useTheme } from '@/theme';

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function SettleUp() {
  const t = useTheme();
  const params = useLocalSearchParams<{ groupId?: string; from?: string; to?: string; amount?: string; currency?: string }>();
  const me = useMe().data;
  const { byId } = usePeople();
  const group = useGroup(params.groupId).data;
  const gBalances = useGroupBalances(params.groupId).data ?? [];
  const gPairs = useGroupPairDebts(params.groupId).data ?? [];
  const myBalances = useMyBalances().data ?? [];
  const save = useSaveExpense();

  const [from, setFrom] = useState(params.from ?? null);
  const [to, setTo] = useState(params.to ?? null);
  const [amountText, setAmountText] = useState(params.amount ?? '');
  const [currency, setCurrency] = useState(params.currency ?? null);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<number | null>(params.amount ? Number(params.amount) : null);


  // ── pick who ──
  if (!from || !to) {
    const options = params.groupId
      ? groupDebts(gBalances, gPairs, group?.simplify_debts ?? true).filter((d) => d.from === me?.id || d.to === me?.id)
      : [...summarizeBalances(myBalances).byFriend.entries()].flatMap(([fid, map]) =>
          entries(map).map(([c, v]) => ({ from: v > 0 ? fid : me?.id ?? '', to: v > 0 ? me?.id ?? '' : fid, currency: c, amount: Math.abs(v) })),
        );
    return (
      <>
        <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} /> }} />
        <Screen>
          {options.length === 0 ? (
            <EmptyState icon="checkmark.circle.fill" title="All settled up" message="You don’t owe anyone and nobody owes you here." />
          ) : (
            <Section title="Choose a balance to settle">
              {options.map((d, i) => {
                const other = byId.get(d.from === me?.id ? d.to : d.from);
                const iOwe = d.from === me?.id;
                return (
                  <Row
                    key={i}
                    left={<Avatar name={other?.name ?? '?'} color={other?.avatar_color ?? '#999'} />}
                    title={other?.name ?? '…'}
                    subtitle={
                      <Text style={{ color: iOwe ? t.owe : t.owed, fontSize: 14, fontWeight: '500' }}>
                        {iOwe ? 'you owe ' : 'owes you '}
                        {formatMoney(d.amount, d.currency)}
                      </Text>
                    }
                    chevron
                    onPress={() => {
                      setFrom(d.from);
                      setTo(d.to);
                      setAmountText(String(d.amount));
                      setSuggested(d.amount);
                      setCurrency(d.currency);
                    }}
                  />
                );
              })}
            </Section>
          )}
        </Screen>
      </>
    );
  }

  const cur = currency ?? group?.default_currency ?? me?.default_currency ?? 'USD';
  const amount = parseAmount(amountText) ?? 0;
  const payer = byId.get(from);
  const payee = byId.get(to);

  async function submit() {
    if (!from || !to) return;
    setError(null);
    const minor = toMinor(amount, cur);
    const payment = (groupId: string | null, amt: number, a: string, b: string) =>
      save.mutateAsync({
        group_id: groupId,
        description: 'Payment',
        amount: amt,
        currency: cur,
        category: 'payment',
        split_type: 'exact',
        is_payment: true,
        spent_on: today(),
        shares: [
          { profile_id: a, paid: amt, owed: 0 },
          { profile_id: b, paid: 0, owed: amt },
        ],
      });
    try {
      // Settling a friend in full across several groups: record one payment per group so each group is settled too.
      const other = from === me?.id ? to : from;
      const perGroup = !params.groupId ? summarizeBalances(myBalances).byFriendGroup.get(other) : undefined;
      const parts = perGroup ? [...perGroup.entries()].map(([gid, map]) => [gid, map[cur] ?? 0] as const).filter(([, v]) => v !== 0) : [];
      const fullTotal = parts.reduce((s, [, v]) => s + v, 0);
      const isFull = parts.length > 1 && toMinor(Math.abs(fullTotal), cur) === minor;

      if (isFull) {
        for (const [gid, v] of parts) {
          // v > 0: they owe me in that group
          const [a, b] = v > 0 ? [other, me!.id] : [me!.id, other];
          await payment(gid, fromMinor(toMinor(Math.abs(v), cur), cur), a, b);
        }
      } else {
        await payment(params.groupId ?? null, fromMinor(minor, cur), from, to);
      }
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerLeft: () => <HeaderButton title="Cancel" onPress={() => router.back()} /> }} />
      <Screen contentContainerStyle={{ paddingTop: space.xl }}>
        <View style={styles.people}>
          <Person name={payer?.name ?? '?'} color={payer?.avatar_color ?? '#999'} label={firstName(payer, me?.id)} />
          <Pressable
            hitSlop={10}
            onPress={() => {
              haptic.tap();
              setFrom(to);
              setTo(from);
            }}
            style={[styles.arrow, { backgroundColor: t.card }]}
          >
            <Icon name="arrow.right" size={20} color={t.accent} weight="semibold" />
          </Pressable>
          <Person name={payee?.name ?? '?'} color={payee?.avatar_color ?? '#999'} label={firstName(payee, me?.id)} />
        </View>
        <Text style={[styles.caption, { color: t.secondary }]}>
          {firstName(payer, me?.id)} {from === me?.id ? 'pay' : 'paid'} {firstName(payee, me?.id).replace(/^You$/, 'you')}
          {group ? ` · ${group.name}` : ''}
        </Text>

        <View style={[styles.amountCard, { backgroundColor: t.card }]}>
          <Pressable onPress={() => setCurrencyOpen(true)} style={[styles.currencyBtn, { backgroundColor: t.fill }]}>
            <Text>{currencyByCode(cur)?.flag}</Text>
            <Text style={{ color: t.text, fontWeight: '600' }}>{cur}</Text>
          </Pressable>
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={t.tertiary}
            selectionColor={t.accent}
            style={[styles.amount, { color: t.text }]}
            autoFocus={!params.amount}
          />
        </View>
        {suggested != null && Math.abs(suggested - amount) > 0.001 && (
          <Pressable onPress={() => setAmountText(String(suggested))} style={{ alignSelf: 'center', marginTop: space.md }}>
            <Text style={{ color: t.accent, fontWeight: '500' }}>Use full balance · {formatMoney(suggested, cur)}</Text>
          </Pressable>
        )}

        {error && <Text style={{ color: t.danger, textAlign: 'center', marginTop: space.lg }}>{error}</Text>}

        <View style={{ paddingHorizontal: space.lg, marginTop: space.xxl }}>
          <Button title="Record payment" icon="checkmark" onPress={submit} loading={save.isPending} disabled={amount <= 0 || from === to} />
          <Text style={[styles.note, { color: t.secondary }]}>
            This only records the payment. Send the money with your usual payment app.
          </Text>
        </View>
      </Screen>
      <CurrencyPicker visible={currencyOpen} value={cur} onClose={() => setCurrencyOpen(false)} onSelect={setCurrency} />
    </KeyboardAvoidingView>
  );
}

function Person({ name, color, label }: { name: string; color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.sm, width: 100 }}>
      <Avatar name={name} color={color} size={72} />
      <Text style={{ color: t.text, fontWeight: '600', fontSize: 16 }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  people: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  caption: { textAlign: 'center', fontSize: 15, marginTop: space.lg, marginBottom: space.xl },
  amountCard: {
    marginHorizontal: space.lg,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    padding: space.lg,
    gap: space.md,
  },
  currencyBtn: { flexDirection: 'row', gap: 6, alignItems: 'center', paddingHorizontal: 12, height: 40, borderRadius: 20 },
  amount: { flex: 1, fontSize: 48, fontWeight: '700', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  note: { textAlign: 'center', fontSize: 13, marginTop: space.md, lineHeight: 18 },
});
