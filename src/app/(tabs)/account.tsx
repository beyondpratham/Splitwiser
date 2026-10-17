import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { CoffeeCup } from '@/components/CoffeeCup';
import { CoffeeSheet } from '@/components/CoffeeSheet';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { profileQrValue, QrCode } from '@/components/QrCode';
import { QrViewer } from '@/components/QrViewer';
import { T } from '@/components/Text';
import { Tile } from '@/components/Tile';
import { useMe, useMyExpenses } from '@/lib/api';
import { qrColor } from '@/lib/avatars';
import { mainCurrency, monthlyShare } from '@/lib/insights';
import { formatMoney } from '@/lib/money';
import { COFFEE_AMOUNT_INR } from '@/lib/support';
import { R, space, useTheme } from '@/theme';

export default function Account() {
  const t = useTheme();
  const me = useMe().data;
  const expenses = useMyExpenses().data ?? [];
  const [qrOpen, setQrOpen] = useState(false);
  const [coffeeOpen, setCoffeeOpen] = useState(false);

  const currency = mainCurrency(expenses, me?.default_currency ?? 'INR');
  const months = monthlyShare(expenses, me?.id, currency);
  const thisMonth = months.at(-1)?.total ?? 0;
  const lastMonth = months.at(-2)?.total ?? 0;
  const peak = Math.max(...months.map((m) => m.total), 1);

  return (
    <Page title="Account" variant="large" inTabs>
      {me && (
        <>
          {/* Profile + QR */}
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.section}>
            <Glass variant="pane" contentStyle={styles.profile}>
              <Pressable
                onPress={() => router.push('/profile')}
                accessibilityRole="button"
                accessibilityLabel="Your profile"
                style={({ pressed }) => [styles.profileTap, pressed && { backgroundColor: t.glassPressed }]}
              >
                <Avatar name={me.name} color={me.avatar_color} avatar={me.avatar} size={60} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="heading" numberOfLines={1}>
                    {me.name}
                  </T>
                  <T variant="caption" tone="dim" numberOfLines={1}>
                    {me.email}
                  </T>
                  {me.phone && (
                    <T variant="caption" tone="dim" numberOfLines={1}>
                      {me.phone}
                    </T>
                  )}
                </View>
              </Pressable>
              <Pressable onPress={() => setQrOpen(true)} accessibilityRole="button" accessibilityLabel="Show my QR code" style={({ pressed }) => [styles.qrThumb, { borderColor: t.line }, pressed && { transform: [{ scale: 0.96 }] }]}>
                <View style={styles.qrBox}>
                  <QrCode value={profileQrValue(me)} size={56} color={qrColor(me)} />
                </View>
              </Pressable>
            </Glass>
          </Animated.View>

          {/* Spending insights */}
          <Animated.View entering={FadeInDown.delay(60).springify().damping(18)} style={styles.section}>
            <Glass variant="pane" onPress={() => router.push('/insights')} accessibilityLabel="Spending insights" contentStyle={styles.insights}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="caption" tone="dim">
                  Your spending this month
                </T>
                <T variant="title" numeric tone="accent">
                  {formatMoney(thisMonth, currency)}
                </T>
                <T variant="caption" tone="dim">
                  {lastMonth > 0
                    ? `${thisMonth >= lastMonth ? '▲' : '▼'} ${Math.abs(Math.round(((thisMonth - lastMonth) / lastMonth) * 100))}% vs last month`
                    : 'Your share of every expense'}
                </T>
                <View style={styles.insightsLink}>
                  <T variant="label" tone="accent">
                    Spending insights
                  </T>
                  <Icon name="chevron-right" size={18} color={t.accentText} />
                </View>
              </View>
              <View style={styles.bars}>
                {months.map((m, i) => (
                  <View key={m.month} style={styles.barCol}>
                    <View style={[styles.bar, { height: Math.max(4, (m.total / peak) * 56), backgroundColor: t.accent, opacity: i === months.length - 1 ? 1 : 0.35 }]} />
                  </View>
                ))}
              </View>
            </Glass>
          </Animated.View>

          <ListGroup animateIndex={2}>
            <ListItem left={<Tile icon="cog-outline" />} title="Settings" subtitle="Appearance, notifications, privacy, account" chevron onPress={() => router.push('/settings')} />
            <ListItem left={<Tile icon="lifebuoy" />} title="Help & support" subtitle="FAQ, contact, share the app" chevron onPress={() => router.push('/help')} />
          </ListGroup>

          <Animated.View entering={FadeInDown.delay(180).springify().damping(18)} style={styles.section}>
            <Glass variant="pane" onPress={() => setCoffeeOpen(true)} accessibilityLabel="Buy me a coffee" contentStyle={styles.coffee}>
              <CoffeeCup />
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="subhead">Buy me a coffee</T>
                <T variant="caption" tone="dim">
                  Free and ad-free. Say thanks with ₹{COFFEE_AMOUNT_INR}.
                </T>
              </View>
              <Icon name="chevron-right" size={22} color={t.inkFaint} />
            </Glass>
          </Animated.View>

          <T variant="caption" tone="faint" style={{ textAlign: 'center' }}>
            SplitWiser {Constants.expoConfig?.version ?? ''}
          </T>
          <QrViewer me={me} visible={qrOpen} onClose={() => setQrOpen(false)} />
          <CoffeeSheet visible={coffeeOpen} onClose={() => setCoffeeOpen(false)} />
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.lg },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  profileTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm, borderRadius: R - 6 },
  qrThumb: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth, marginRight: space.xs },
  qrBox: { padding: 2 },
  insights: { flexDirection: 'row', alignItems: 'flex-end', gap: space.lg, padding: space.lg },
  insightsLink: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 60 },
  barCol: { width: 10, justifyContent: 'flex-end', height: 60 },
  bar: { width: 10, borderRadius: 4 },
  coffee: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
});
