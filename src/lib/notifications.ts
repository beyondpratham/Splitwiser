import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type Channel = 'off' | 'push' | 'email' | 'both';
export type NotifyCategory = 'expenses' | 'payments' | 'comments' | 'friends' | 'reminders' | 'weekly';
export type NotificationPrefs = Record<NotifyCategory, Channel>;

const supported = Platform.OS !== 'web';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

let registeredToken: string | null = null;

export type PushStatus = 'on' | 'denied' | 'unavailable';

/**
 * Asks for notification permission (once) and registers this phone for push with the signed-in account.
 * "unavailable" on the web, and in builds without an EAS project id (push needs a real build).
 */
export async function registerForPush({ ask = true } = {}): Promise<PushStatus> {
  if (!supported) return 'unavailable';
  try {
    if (Platform.OS === 'android') {
      // must exist before asking, or Android 13+ never shows the prompt
      await Notifications.setNotificationChannelAsync('default', { name: 'SplitWiser', importance: Notifications.AndroidImportance.HIGH, lightColor: '#13B079' });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return 'unavailable';
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.rpc('register_push_token', { push_token: token, device_platform: Platform.OS });
    if (error) throw error;
    registeredToken = token;
    return 'on';
  } catch {
    return 'unavailable';
  }
}

/** Stop pushes to this phone for the current account (call before signing out). */
export async function unregisterPush() {
  if (!registeredToken) return;
  await supabase.rpc('unregister_push_token', { push_token: registeredToken }).then(
    () => {},
    () => {},
  );
  registeredToken = null;
}

/** Signs out, after detaching this phone from the account's push notifications. */
export async function signOut() {
  await unregisterPush();
  await supabase.auth.signOut();
}

function open(response: Notifications.NotificationResponse | null | undefined) {
  const url = response?.notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/')) router.push(url as Href);
}

/** Registers for push once signed in, and opens the right screen when a notification is tapped. */
export function usePushNotifications(signedIn: boolean) {
  useEffect(() => {
    if (signedIn) registerForPush();
  }, [signedIn]);

  useEffect(() => {
    if (!supported || !signedIn) return;
    // a tap that launched the app
    Notifications.getLastNotificationResponseAsync().then((r) => {
      open(r);
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    });
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [signedIn]);
}
