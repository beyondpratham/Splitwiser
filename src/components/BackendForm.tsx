import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '@/lib/auth';
import { envConfig, testConfig } from '@/lib/supabase';
import { space, useTheme } from '@/theme';
import { Button, Field, haptic } from './Controls';
import { Glass } from './Glass';
import { T } from './Text';

const STEPS = [
  'Create a free project at supabase.com.',
  'In the project’s SQL editor, run the files in supabase/migrations from this repo (or run npm run db:push).',
  'Copy the Project URL and the publishable key from Project Settings → API.',
];

/** The local backend from `npm run local:backend`. On Android, `adb reverse` maps localhost to the computer. */
export const LOCAL_BACKEND = { url: 'http://localhost:54321', key: 'local-development-anon-key' };

/** Lets the installed app connect to any SplitWiser Supabase project, no rebuild needed. */
export function BackendForm({ onDone }: { onDone?: () => void }) {
  const t = useTheme();
  const { setBackend } = useAuth();
  const env = envConfig();
  const [url, setUrl] = useState(env?.url ?? '');
  const [key, setKey] = useState(env?.key ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanUrl = url.trim().replace(/\/$/, '');
  const valid = /^https?:\/\/[^\s/]+/.test(cleanUrl) && key.trim().length > 20;

  async function connect(config = { url: cleanUrl, key: key.trim() }) {
    setBusy(true);
    setError(null);
    const problem = await testConfig(config);
    if (problem) {
      haptic.error();
      setError(problem);
      setBusy(false);
      return;
    }
    haptic.success();
    await setBackend(config);
    setBusy(false);
    onDone?.();
  }

  return (
    <View style={styles.wrap}>
      {env && (
        <Glass variant="pane" tint={t.accentSoft} contentStyle={styles.card}>
          <T variant="subhead">Your SplitWiser server</T>
          <T variant="caption" tone="dim" numberOfLines={1}>
            {env.url}
          </T>
          <Button title="Connect" icon="connection" onPress={() => connect(env)} loading={busy} style={{ alignSelf: 'flex-start', marginTop: space.xs }} />
        </Glass>
      )}

      <Glass variant="pane" contentStyle={styles.card}>
        <T variant="subhead">Trying it on this computer?</T>
        <T variant="caption" tone="dim">
          Run npm run local:backend, then connect to it. Demo login: alex@demo.app / demo1234.
        </T>
        <Button title="Use local server" icon="laptop" variant="glass" size="sm" onPress={() => connect(LOCAL_BACKEND)} disabled={busy} style={{ alignSelf: 'flex-start', marginTop: space.xs }} />
      </Glass>

      <T variant="overline" tone="dim" style={{ marginTop: space.sm, marginLeft: space.sm }}>
        Or connect another Supabase project
      </T>
      <Glass variant="pane" contentStyle={[styles.card, { gap: space.md }]}>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.num, { backgroundColor: t.accentSoft }]}>
              <T variant="label" tone="accent">
                {i + 1}
              </T>
            </View>
            <T variant="caption" style={{ flex: 1 }}>
              {s}
            </T>
          </View>
        ))}
      </Glass>
      <Field label="Project URL" placeholder="https://abcd.supabase.co" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" icon="web" />
      <Field label="Publishable key" placeholder="sb_publishable_…" value={key} onChangeText={setKey} autoCapitalize="none" autoCorrect={false} icon="key-variant" error={error} />
      <Button title="Connect" icon="connection" size="lg" onPress={() => connect()} loading={busy} disabled={!valid || busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  card: { padding: space.lg, gap: space.xs },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  num: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
