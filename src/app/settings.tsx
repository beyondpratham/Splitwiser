import { router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { canUseAppLock, confirmIdentity } from '@/components/AppLock';
import { Segmented, Switch } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { Tile } from '@/components/Tile';
import { useDeleteAccount } from '@/lib/api';
import { usePrefs, type Prefs } from '@/lib/prefs';
import { supabase } from '@/lib/supabase';
import { space, useThemeMode, type ThemeMode } from '@/theme';
import type { IconName } from '@/components/Icon';

const NOTIFY: { key: keyof Prefs['notify']; title: string; subtitle: string; icon: IconName }[] = [
  { key: 'expenses', title: 'New expenses', subtitle: 'When someone adds or edits an expense with you', icon: 'receipt-text-outline' },
  { key: 'comments', title: 'Comments', subtitle: 'Replies on expenses you’re part of', icon: 'comment-text-outline' },
  { key: 'payments', title: 'Payments', subtitle: 'When someone settles up with you', icon: 'cash-check' },
  { key: 'reminders', title: 'Reminders', subtitle: 'Friendly nudges from friends you owe', icon: 'bell-ring-outline' },
  { key: 'weekly', title: 'Weekly summary', subtitle: 'What you owe and are owed, every Sunday', icon: 'calendar-week' },
];

export default function Settings() {
  const { mode, setMode } = useThemeMode();
  const { prefs, set } = usePrefs();
  const deleteAccount = useDeleteAccount();
  const { confirm, toast, fail } = useFeedback();

  const toggleAppLock = async (on: boolean) => {
    if (!on) {
      set('privacy', 'appLock', false);
      return;
    }
    if (!(await canUseAppLock())) {
      toast('Set up a fingerprint, face unlock or screen lock on your phone first.');
      return;
    }
    if (await confirmIdentity('Turn on app lock')) set('privacy', 'appLock', true);
  };

  return (
    <Page title="Settings" back variant="large">
      <View style={styles.section}>
        <T variant="overline" tone="dim" style={styles.label}>
          Appearance
        </T>
        <Glass variant="pane" contentStyle={{ padding: space.lg, gap: space.md }}>
          <Segmented<ThemeMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
              { value: 'dark', label: 'Dark', icon: 'weather-night' },
              { value: 'system', label: 'System', icon: 'cellphone' },
            ]}
          />
          <T variant="caption" tone="dim">
            System follows your phone’s light or dark mode.
          </T>
        </Glass>
      </View>

      <ListGroup title="Notifications" footer="Choose what SplitWiser tells you about. Alerts arrive on this phone once notifications are switched on for the app.">
        {NOTIFY.map((n) => (
          <ListItem
            key={n.key}
            left={<Tile icon={n.icon} />}
            title={n.title}
            subtitle={n.subtitle}
            right={<Switch label={n.title} value={prefs.notify[n.key]} onValueChange={(v) => set('notify', n.key, v)} />}
          />
        ))}
      </ListGroup>

      <ListGroup title="Privacy">
        {Platform.OS !== 'web' ? (
          <ListItem
            left={<Tile icon="fingerprint" />}
            title="App lock"
            subtitle="Ask for fingerprint, face or PIN when opening SplitWiser"
            right={<Switch label="App lock" value={prefs.privacy.appLock} onValueChange={toggleAppLock} />}
          />
        ) : null}
        <ListItem
          left={<Tile icon="eye-off-outline" />}
          title="Hide balances"
          subtitle="Blur your totals until you tap them"
          right={<Switch label="Hide balances" value={prefs.privacy.hideBalances} onValueChange={(v) => set('privacy', 'hideBalances', v)} />}
        />
        <ListItem
          left={<Tile icon="phone-lock-outline" />}
          title="Show my number to friends"
          subtitle="Friends see your phone number on your profile"
          right={<Switch label="Show my number to friends" value={prefs.privacy.showPhone} onValueChange={(v) => set('privacy', 'showPhone', v)} />}
        />
      </ListGroup>

      <ListGroup title="Friends & data">
        <ListItem left={<Tile icon="contacts-outline" />} title="Sync contacts" subtitle="Find friends from your phone’s contacts" chevron onPress={() => router.push('/contacts')} />
        <ListItem left={<Tile icon="import" />} title="Import from other apps" subtitle="Bring your groups over from Splitwise" chevron onPress={() => router.push('/import')} />
        <ListItem left={<Tile icon="database-cog-outline" />} title="Server" subtitle="The Supabase project this app uses" chevron onPress={() => router.push('/backend')} />
      </ListGroup>

      <ListGroup title="Account" footer="SplitWiser works on one device at a time. Signing in on another phone signs you out here.">
        <ListItem
          left={<Tile icon="logout" />}
          title="Log out"
          onPress={async () => {
            if (await confirm({ title: 'Log out?', confirmLabel: 'Log out', destructive: true })) supabase.auth.signOut();
          }}
        />
        <ListItem
          left={<Tile icon="account-remove-outline" danger />}
          title="Delete account"
          tone="danger"
          onPress={async () => {
            const sure = await confirm({
              title: 'Delete your account?',
              message: 'Your login, friend list and comments are removed for good. Shared expenses stay with the others as “Deleted user”.',
              confirmLabel: 'Delete account',
              destructive: true,
            });
            if (sure) deleteAccount.mutateAsync().catch(fail);
          }}
        />
      </ListGroup>
    </Page>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  label: { marginBottom: space.sm, marginLeft: space.sm },
});
