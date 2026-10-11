import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useAuth } from '@/lib/auth';
import { envConfig, testConfig } from '@/lib/supabase';
import { space, useTheme } from '@/theme';
import { haptic } from './ui';

const STEPS = [
  'Create a free project at supabase.com.',
  'In the project’s SQL editor, run the file supabase/migrations/…_init.sql from this repo (or run npm run db:push).',
  'Copy the Project URL and the publishable key from Project Settings → API.',
];

/** The local backend from `npm run local:backend`. On Android, `adb reverse` maps localhost to the computer. */
export const LOCAL_BACKEND = { url: 'http://localhost:54321', key: 'local-development-anon-key' };

/** Lets the installed app connect to any SplitWiser Supabase project, no rebuild needed. */
export function BackendForm({ onDone }: { onDone?: () => void }) {
  const t = useTheme();
  const { setBackend } = useAuth();
  const [url, setUrl] = useState(envConfig()?.url ?? '');
  const [key, setKey] = useState(envConfig()?.key ?? '');
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
      <View style={[styles.local, { backgroundColor: t.colors.tertiaryContainer }]}>
        <Text variant="titleMedium" style={{ color: t.colors.onTertiaryContainer }}>
          Trying it on this computer?
        </Text>
        <Text variant="bodyMedium" style={{ color: t.colors.onTertiaryContainer }}>
          Run npm run local:backend, then connect to it here. Demo login: alex@demo.app / demo1234.
        </Text>
        <Button mode="contained-tonal" icon="laptop" onPress={() => connect(LOCAL_BACKEND)} disabled={busy} style={{ alignSelf: 'flex-start', marginTop: space.xs }}>
          Use local server
        </Button>
      </View>
      <Text variant="titleSmall" style={{ color: t.colors.primary, marginTop: space.sm, marginLeft: space.xs }}>
        Or connect your own Supabase project
      </Text>
      <View style={[styles.steps, { backgroundColor: t.colors.surfaceContainerLow }]}>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.step}>
            <View style={[styles.num, { backgroundColor: t.colors.primaryContainer }]}>
              <Text variant="labelLarge" style={{ color: t.colors.onPrimaryContainer }}>
                {i + 1}
              </Text>
            </View>
            <Text variant="bodyMedium" style={{ flex: 1, color: t.colors.onSurface }}>
              {s}
            </Text>
          </View>
        ))}
      </View>
      <TextInput
        mode="outlined"
        label="Project URL"
        placeholder="https://abcd.supabase.co"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        left={<TextInput.Icon icon="web" />}
      />
      <TextInput
        mode="outlined"
        label="Publishable key"
        value={key}
        onChangeText={setKey}
        autoCapitalize="none"
        autoCorrect={false}
        left={<TextInput.Icon icon="key-variant" />}
      />
      {error && (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      )}
      <Button mode="contained" icon="connection" onPress={() => connect()} loading={busy} disabled={!valid || busy} contentStyle={{ height: 52 }}>
        Connect
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, gap: space.md },
  local: { borderRadius: 24, padding: space.lg, gap: space.xs },
  steps: { borderRadius: 24, padding: space.lg, gap: space.md, marginBottom: space.sm },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
