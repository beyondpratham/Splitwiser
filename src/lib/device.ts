import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { supabase } from './supabase';

const KEY = 'splitwiser.device';
let cached: string | null = null;

/** A random id for this install, kept for the life of the app. */
export async function deviceId(): Promise<string> {
  if (cached) return cached;
  let id = await AsyncStorage.getItem(KEY).catch(() => null);
  if (!id) {
    id = randomUUID();
    await AsyncStorage.setItem(KEY, id).catch(() => {});
  }
  cached = id;
  return id;
}

/** Make this the account's only device (called right after signing in). */
export async function claimThisDevice() {
  const { error } = await supabase.rpc('claim_device', { device: await deviceId() });
  if (error) throw new Error(error.message);
}

/**
 * Is this still the account's active device? Accounts that have never claimed one (e.g. created
 * before this check existed) claim it now.
 */
export async function isActiveDevice(): Promise<boolean> {
  const { data, error } = await supabase.from('active_devices').select('device_id').maybeSingle();
  if (error) return true; // never sign people out because of a network blip
  if (!data) {
    await claimThisDevice().catch(() => {});
    return true;
  }
  return data.device_id === (await deviceId());
}
