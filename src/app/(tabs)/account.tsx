import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { Tile } from '@/components/Tile';
import { useMe } from '@/lib/api';
import { COFFEE_AMOUNT_INR } from '@/lib/support';
import { supabase } from '@/lib/supabase';
import { space, useTheme } from '@/theme';

export default function Account() {
  const t = useTheme();
  const me = useMe().data;
  const { confirm } = useFeedback();

  return (
    <Page title="Account" variant="large" inTabs>
      {me && (
        <>
          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.section}>
            <Glass variant="pane" onPress={() => router.push('/profile')} accessibilityLabel="Edit profile" contentStyle={styles.profile}>
              <Animated.View key={me.avatar_color} entering={ZoomIn.springify().damping(12)}>
                <Avatar name={me.name} color={me.avatar_color} size={64} />
              </Animated.View>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="heading" numberOfLines={1}>
                  {me.name}
                </T>
                <T variant="caption" tone="dim" numberOfLines={1}>
                  {me.email}
                </T>
              </View>
              <Icon name="chevron-right" size={22} color={t.inkFaint} />
            </Glass>
          </Animated.View>

          <ListGroup animateIndex={1}>
            <ListItem left={<Tile icon="account-edit-outline" />} title="Edit profile" subtitle="Name, photo colour, default currency" chevron onPress={() => router.push('/profile')} />
            <ListItem left={<Tile icon="cog-outline" />} title="Settings" subtitle="Appearance, server, account" chevron onPress={() => router.push('/settings')} />
            <ListItem left={<Tile icon="lifebuoy" />} title="Help & support" subtitle="FAQ, contact, report a problem" chevron onPress={() => router.push('/help')} />
          </ListGroup>

          <Animated.View entering={FadeInDown.delay(150).springify().damping(18)} style={styles.section}>
            <Glass variant="pane" onPress={() => router.push('/coffee')} accessibilityLabel="Buy me a coffee" tint={t.accentSoft} contentStyle={styles.coffee}>
              <T style={{ fontSize: 30 }}>☕</T>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="subhead">Buy me a coffee</T>
                <T variant="caption" tone="dim">
                  SplitWiser is free and ad-free. Say thanks with ₹{COFFEE_AMOUNT_INR}.
                </T>
              </View>
              <Icon name="chevron-right" size={22} color={t.accentText} />
            </Glass>
          </Animated.View>

          <View style={styles.footer}>
            <Button
              title="Log out"
              variant="ghost"
              icon="logout"
              onPress={async () => {
                if (await confirm({ title: 'Log out?', confirmLabel: 'Log out', destructive: true })) supabase.auth.signOut();
              }}
            />
            <T variant="caption" tone="faint">
              SplitWiser {Constants.expoConfig?.version ?? ''}
            </T>
          </View>
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.lg, padding: space.lg },
  coffee: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.lg },
  footer: { alignItems: 'center', gap: space.xs, marginTop: space.sm },
});
