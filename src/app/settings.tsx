import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { canUseAppLock, confirmIdentity } from '@/components/AppLock';
import { Segmented, Switch } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { ActionSheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { Tile } from '@/components/Tile';
import { useDeleteAccount, useMe, useNotificationPrefs, useSetNotificationPref, useUpdateProfile } from '@/lib/api';
import { registerForPush, signOut, type Channel, type NotifyCategory } from '@/lib/notifications';
import { usePrefs } from '@/lib/prefs';
import { backendLocked } from '@/lib/supabase';
import { space, useThemeMode, type ThemeMode } from '@/theme';
import type { IconName } from '@/components/Icon';

const NOTIFY: { key: NotifyCategory; title: string; about: string; icon: IconName }[] = [
  { key: 'expenses', title: 'Expenses', about: 'Someone adds, edits or deletes an expense you’re in', icon: 'receipt-text-outline' },
  { key: 'payments', title: 'Payments', about: 'Someone pays you or records a payment with you', icon: 'cash-check' },
  { key: 'comments', title: 'Comments', about: 'Someone comments on an expense you’re in', icon: 'comment-text-outline' },
  { key: 'friends', title: 'Friends & groups', about: 'Someone adds you as a friend or to a group', icon: 'account-multiple-plus-outline' },
  { key: 'reminders', title: 'Reminders', about: 'A friend reminds you that you owe them', icon: 'bell-ring-outline' },
  { key: 'weekly', title: 'Weekly summary', about: 'What you owe and are owed, every Sunday', icon: 'calendar-week' },
];

const CHANNELS: { value: Channel; label: string; icon: IconName }[] = [
  { value: 'push', label: 'Push notification', icon: 'cellphone-message' },
  { value: 'email', label: 'Email', icon: 'email-outline' },
  { value: 'both', label: 'Push and email', icon: 'bell-plus-outline' },
  { value: 'off', label: 'Off', icon: 'bell-off-outline' },
];
const channelLabel = (c?: Channel) => (c === 'both' ? 'Push and email' : c === 'push' ? 'Push' : c === 'email' ? 'Email' : c === 'off' ? 'Off' : '…');

export default function Settings() {
  const { mode, setMode } = useThemeMode();
  const { prefs, set } = usePrefs();
  const deleteAccount = useDeleteAccount();
  const { confirm, toast, fail } = useFeedback();
  const me = useMe().data;
  const updateProfile = useUpdateProfile();
  const notify = useNotificationPrefs();
  const setNotify = useSetNotificationPref();
  const [choosing, setChoosing] = useState<NotifyCategory | null>(null);
  const picked = NOTIFY.find((n) => n.key === choosing);

  const choose = async (category: NotifyCategory, channel: Channel) => {
    setChoosing(null);
    setNotify.mutate({ category, channel }, { onError: fail });
    if ((channel === 'push' || channel === 'both') && (await registerForPush()) === 'denied') {
      toast('Notifications are off for SplitWiser. Turn them on in your phone’s settings to get push alerts.');
    }
  };

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

      <ListGroup title="Notifications" footer="Pick how you hear about each thing: a push notification on this phone, an email, both, or nothing. You’re never notified about things you did yourself.">
        {NOTIFY.map((n) => (
          <ListItem
            key={n.key}
            left={<Tile icon={n.icon} />}
            title={n.title}
            subtitle={n.about}
            right={
              <T variant="label" tone={notify.data?.[n.key] === 'off' ? 'faint' : 'accent'}>
                {channelLabel(notify.data?.[n.key])}
              </T>
            }
            chevron
            onPress={() => notify.data && setChoosing(n.key)}
          />
        ))}
      </ListGroup>
      <ActionSheet
        visible={!!choosing}
        title={picked ? `${picked.title}: ${picked.about.charAt(0).toLowerCase()}${picked.about.slice(1)}` : undefined}
        actions={CHANNELS.map((c) => ({
          label: notify.data && choosing && notify.data[choosing] === c.value ? `${c.label}  ✓` : c.label,
          icon: c.icon,
          onPress: () => choosing && choose(choosing, c.value),
        }))}
        onClose={() => setChoosing(null)}
      />

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
          title="Find me by my number"
          subtitle="People who have your number can find you when they sync contacts. Nobody can see your number."
          right={
            <Switch
              label="Find me by my number"
              value={me?.phone_discoverable ?? true}
              onValueChange={(v) => me && updateProfile.mutate({ id: me.id, phone_discoverable: v }, { onError: fail })}
            />
          }
        />
      </ListGroup>

      <ListGroup title="Friends & data">
        <ListItem left={<Tile icon="contacts-outline" />} title="Sync contacts" subtitle="Find friends from your phone’s contacts" chevron onPress={() => router.push('/contacts')} />
        <ListItem left={<Tile icon="import" />} title="Import from other apps" subtitle="Bring your groups over from Splitwise" chevron onPress={() => router.push('/import')} />
        {!backendLocked && (
          <ListItem left={<Tile icon="database-cog-outline" />} title="Server" subtitle="The Supabase project this app uses" chevron onPress={() => router.push('/backend')} />
        )}
      </ListGroup>

      <ListGroup title="Account" footer="SplitWiser works on one device at a time. Signing in on another phone signs you out here.">
        <ListItem
          left={<Tile icon="logout" />}
          title="Log out"
          onPress={async () => {
            if (await confirm({ title: 'Log out?', confirmLabel: 'Log out', destructive: true })) signOut();
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
