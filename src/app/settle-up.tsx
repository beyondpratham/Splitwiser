import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput as RNTextInput, View } from 'react-native';
import { Button, Chip, HelperText, IconButton, Text } from 'react-native-paper';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, ZoomIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { CurrencyPicker } from '@/components/Pickers';
import { EmptyState, haptic } from '@/components/ui';
import { useGroup, useGroupBalances, useGroupPairDebts, useMe, useMyBalances, usePeople, useSaveExpense } from '@/lib/api';
import { entries, firstName, groupDebts, summarizeBalances } from '@/lib/balances';
import { currencyByCode } from '@/lib/currencies';
import { formatMoney, fromMinor, parseAmount, toMinor } from '@/lib/money';
import { friendlyError } from '@/lib/supabase';
import { motion, space, useTheme } from '@/theme';

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
  const spin = useSharedValue(0);
  const spinStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.get() * 180}deg` }] }));

  // ── pick who ──
  if (!from || !to) {
    const options = params.groupId
      ? groupDebts(gBalances, gPairs, group?.simplify_debts ?? true).filter((d) => d.from === me?.id || d.to === me?.id)
      : [...summarizeBalances(myBalances).byFriend.entries()].flatMap(([fid, map]) =>
          entries(map).map(([c, v]) => ({ from: v > 0 ? fid : me?.id ?? '', to: v > 0 ? me?.id ?? '' : fid, currency: c, amount: Math.abs(v) })),
        );
    return (
      <Page title="Settle up" variant="dialog">
        {options.length === 0 ? (
          <EmptyState icon="check-decagram" title="All settled up" message="You don’t owe anyone and nobody owes you here." />
        ) : (
          <ListGroup title="Choose a balance to settle" animateIndex={0}>
            {options.map((d, i) => {
              const other = byId.get(d.from === me?.id ? d.to : d.from);
              const iOwe = d.from === me?.id;
              return (
                <ListItem
                  key={i}
                  left={<Avatar name={other?.name ?? '?'} color={other?.avatar_color ?? '#999'} />}
                  title={other?.name ?? '…'}
                  subtitle={
                    <Text variant="bodyMedium" style={{ color: iOwe ? t.colors.owe : t.colors.owed }}>
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
          </ListGroup>
        )}
      </Page>
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
      // Settling a friend in full across several groups: one payment per group so each group is settled too.
      const other = from === me?.id ? to : from;
      const perGroup = !params.groupId ? summarizeBalances(myBalances).byFriendGroup.get(other) : undefined;
      const parts = perGroup ? [...perGroup.entries()].map(([gid, map]) => [gid, map[cur] ?? 0] as const).filter(([, v]) => v !== 0) : [];
      const fullTotal = parts.reduce((s, [, v]) => s + v, 0);
      const isFull = parts.length > 1 && toMinor(Math.abs(fullTotal), cur) === minor;

      if (isFull) {
        for (const [gid, v] of parts) {
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
    <Page title="Settle up" variant="dialog" form>
      <View style={styles.people}>
        <Person name={payer?.name ?? '?'} color={payer?.avatar_color ?? '#999'} label={firstName(payer, me?.id)} />
        <Animated.View style={[spinStyle, { marginBottom: 28 }]}>
          <IconButton
            icon="arrow-right"
            mode="contained-tonal"
            size={24}
            accessibilityLabel="Swap direction"
            onPress={() => {
              haptic.tap();
              spin.set(withSpring(spin.get() + 1, motion.bouncy));
              setFrom(to);
              setTo(from);
            }}
          />
        </Animated.View>
        <Person name={payee?.name ?? '?'} color={payee?.avatar_color ?? '#999'} label={firstName(payee, me?.id)} />
      </View>
      <Text variant="bodyLarge" style={[styles.caption, { color: t.colors.onSurfaceVariant }]}>
        {firstName(payer, me?.id)} {from === me?.id ? 'pay' : 'paid'} {firstName(payee, me?.id).replace(/^You$/, 'you')}
        {group ? ` · ${group.name}` : ''}
      </Text>

      <Animated.View entering={FadeInDown.springify()} style={[styles.amountCard, { backgroundColor: t.colors.primaryContainer }]}>
        <Chip onPress={() => setCurrencyOpen(true)} icon={() => <Text>{currencyByCode(cur)?.flag}</Text>} compact>
          {cur}
        </Chip>
        <RNTextInput
          value={amountText}
          onChangeText={setAmountText}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={t.colors.onPrimaryContainer}
          selectionColor={t.colors.primary}
          cursorColor={t.colors.onPrimaryContainer}
          style={[styles.amount, { color: t.colors.onPrimaryContainer }]}
          autoFocus={!params.amount}
        />
      </Animated.View>
      {suggested != null && Math.abs(suggested - amount) > 0.001 && (
        <Chip icon="restore" style={{ alignSelf: 'center', marginTop: space.md }} onPress={() => setAmountText(String(suggested))}>
          Use full balance · {formatMoney(suggested, cur)}
        </Chip>
      )}

      {error && (
        <HelperText type="error" visible style={{ textAlign: 'center', marginTop: space.md }}>
          {error}
        </HelperText>
      )}

      <View style={{ paddingHorizontal: space.lg, marginTop: space.xxl, gap: space.md }}>
        <Button mode="contained" icon="check" onPress={submit} loading={save.isPending} disabled={amount <= 0 || from === to || save.isPending} contentStyle={{ height: 56 }}>
          Record payment
        </Button>
        <Text variant="bodySmall" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>
          This only records the payment. Send the money with your usual payment app.
        </Text>
      </View>
      <CurrencyPicker visible={currencyOpen} value={cur} onClose={() => setCurrencyOpen(false)} onSelect={setCurrency} />
    </Page>
  );
}

function Person({ name, color, label }: { name: string; color: string; label: string }) {
  const t = useTheme();
  return (
    <Animated.View key={name} entering={ZoomIn.springify().damping(12)} style={{ alignItems: 'center', gap: space.sm, width: 104 }}>
      <Avatar name={name} color={color} size={76} />
      <Text variant="titleMedium" numberOfLines={1} style={{ color: t.colors.onSurface }}>
        {label}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  people: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, marginTop: space.lg },
  caption: { textAlign: 'center', marginTop: space.lg, marginBottom: space.xl },
  amountCard: { marginHorizontal: space.lg, borderRadius: 28, flexDirection: 'row', alignItems: 'center', padding: space.lg, gap: space.md },
  amount: { flex: 1, fontSize: 48, fontWeight: '500', letterSpacing: -1, fontVariant: ['tabular-nums'] },
});
