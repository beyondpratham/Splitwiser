import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { useFeedback } from '@/components/Feedback';
import { Icon, type IconName } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { CurrencyPicker } from '@/components/Pickers';
import { haptic } from '@/components/ui';
import { useMe, useUpdateProfile } from '@/lib/api';
import { currencyByCode } from '@/lib/currencies';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/theme';

const COLORS = ['#10A66B', '#00897B', '#1E88E5', '#5E35B1', '#8E24AA', '#D81B60', '#F4511E', '#6D4C41'];

export default function Account() {
  const t = useTheme();
  const me = useMe().data;
  const update = useUpdateProfile();
  const { confirm, prompt, fail } = useFeedback();
  const [currencyOpen, setCurrencyOpen] = useState(false);

  return (
    <Page title="Account" variant="large" inTabs>
      {me && (
        <>
          <View style={styles.profile}>
            <Animated.View key={me.avatar_color} entering={ZoomIn.springify().damping(12)}>
              <Avatar name={me.name} color={me.avatar_color} size={96} />
            </Animated.View>
            <Text variant="headlineSmall" style={{ color: t.colors.onSurface, marginTop: space.md }}>
              {me.name}
            </Text>
            <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>
              {me.email}
            </Text>
            <View style={styles.colors}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  hitSlop={4}
                  accessibilityLabel={`Avatar color ${c}`}
                  onPress={() => {
                    haptic.tap();
                    update.mutate({ id: me.id, avatar_color: c });
                  }}
                  style={[styles.swatch, { backgroundColor: c, borderColor: me.avatar_color === c ? t.colors.onSurface : 'transparent' }]}
                />
              ))}
            </View>
          </View>

          <Animated.View entering={FadeInDown.delay(80).springify()}>
            <ListGroup title="Profile">
              <ListItem
                left={<Tile icon="pencil" />}
                title="Name"
                detail={me.name}
                chevron
                onPress={async () => {
                  const name = await prompt({ title: 'Your name', label: 'Name', initial: me.name });
                  if (name && name !== me.name) update.mutateAsync({ id: me.id, name }).catch(fail);
                }}
              />
              <ListItem
                left={<Tile icon="currency-usd" />}
                title="Default currency"
                detail={`${currencyByCode(me.default_currency)?.flag ?? ''} ${me.default_currency}`}
                chevron
                onPress={() => setCurrencyOpen(true)}
              />
            </ListGroup>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(140).springify()}>
            <ListGroup title="App">
              <ListItem left={<Tile icon="chart-donut" />} title="Spending insights" chevron onPress={() => router.push('/insights')} />
              <ListItem left={<Tile icon="database-cog-outline" />} title="Backend" subtitle="Change the Supabase project" chevron onPress={() => router.push('/backend')} />
            </ListGroup>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <ListGroup footer="SplitWiser is ad-free and has no limits on expenses.">
              <ListItem
                left={<Tile icon="logout" danger />}
                title="Sign out"
                tone="error"
                onPress={async () => {
                  if (await confirm({ title: 'Sign out?', confirmLabel: 'Sign out', destructive: true })) supabase.auth.signOut();
                }}
              />
            </ListGroup>
          </Animated.View>

          <CurrencyPicker
            visible={currencyOpen}
            value={me.default_currency}
            onClose={() => setCurrencyOpen(false)}
            onSelect={(c) => update.mutateAsync({ id: me.id, default_currency: c }).catch(fail)}
          />
        </>
      )}
    </Page>
  );
}

function Tile({ icon, danger }: { icon: IconName; danger?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: danger ? t.colors.errorContainer : t.colors.secondaryContainer }]}>
      <Icon name={icon} size={20} color={danger ? t.colors.onErrorContainer : t.colors.onSecondaryContainer} />
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: 'center', gap: 2, marginBottom: space.xl },
  colors: { flexDirection: 'row', gap: 10, marginTop: space.lg },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 3 },
  tile: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
