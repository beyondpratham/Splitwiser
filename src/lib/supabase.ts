import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

export interface BackendConfig {
  url: string;
  key: string;
}

const STORAGE_KEY = 'splitwiser.backend';

/** Build-time config from .env, if present. */
export function envConfig(): BackendConfig | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key || url.includes('YOUR-PROJECT')) return null;
  return { url, key };
}

/**
 * Release builds made with the Supabase URL and key built in (EAS environment variables) always use that
 * project: no server setup screen, no local server, no Server row in Settings.
 */
export const backendLocked = !__DEV__ && envConfig() !== null;

function makeClient(config: BackendConfig | null) {
  return createClient(config?.url ?? 'https://placeholder.supabase.co', config?.key ?? 'placeholder', {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

let current: SupabaseClient = makeClient(envConfig());

/** Always forwards to the active client, so the backend can be configured at runtime. */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const value = Reflect.get(current, prop, current);
    return typeof value === 'function' ? value.bind(current) : value;
  },
});

/** Stored (runtime) config wins over the build-time one. */
export async function loadConfig(): Promise<BackendConfig | null> {
  if (backendLocked) return envConfig();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as BackendConfig;
  } catch {
    // fall through to env
  }
  return envConfig();
}

export function activateConfig(config: BackendConfig | null) {
  current = makeClient(config);
}

export async function saveConfig(config: BackendConfig | null) {
  if (config) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  else await AsyncStorage.removeItem(STORAGE_KEY);
  current = makeClient(config ?? envConfig());
}

/** Checks the URL / key pair actually reaches a SplitWiser database. */
export async function testConfig(config: BackendConfig): Promise<string | null> {
  try {
    const res = await fetch(`${config.url.replace(/\/$/, '')}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: config.key, Authorization: `Bearer ${config.key}` },
    });
    if (res.status === 401 || res.status === 403) return 'The key was rejected. Use the publishable (anon) key.';
    if (res.status === 404) return 'Connected, but the database tables are missing. Run the migration first.';
    if (!res.ok) return `The server answered with ${res.status}.`;
    return null;
  } catch {
    return config.url.includes('localhost')
      ? 'The local server isn’t running. Start it with npm run local:backend.'
      : 'Could not reach that URL. Check it and your connection.';
  }
}

// Only refresh tokens while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') current.auth.startAutoRefresh();
    else current.auth.stopAutoRefresh();
  });
}

/** Turns a Supabase / Postgres error into something worth showing a person. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(msg)) return 'That email and password don’t match.';
  if (/User already registered/i.test(msg)) return 'An account with that email already exists.';
  if (/Network request failed|fetch failed/i.test(msg)) return 'You appear to be offline.';
  if (/profiles_phone_key/i.test(msg)) return 'That phone number is already linked to another account.';
  if (/profiles_phone_format/i.test(msg)) return 'Enter the phone number with its country code, like +91 98765 43210.';
  if (/profiles_avatar_size/i.test(msg)) return 'That photo is too large. Try another one.';
  return msg.charAt(0).toUpperCase() + msg.slice(1);
}
