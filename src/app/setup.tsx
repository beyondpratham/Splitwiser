import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui';
import { Section } from '@/components/List';
import { space, useTheme } from '@/theme';

const STEPS = [
  'Create a free project at supabase.com.',
  'From the project folder run: npx supabase login, then npx supabase link, then npm run db:push.',
  'Copy .env.example to .env and fill in the project URL and publishable key (Project Settings → API).',
  'Restart the dev server with npm start.',
];

export default function Setup() {
  const t = useTheme();
  return (
    <Screen contentContainerStyle={{ paddingTop: 100 }}>
      <View style={styles.hero}>
        <Text style={[styles.title, { color: t.text }]}>Connect a backend</Text>
        <Text style={[styles.body, { color: t.secondary }]}>SplitWiser stores groups and expenses in your own Supabase project.</Text>
      </View>
      <Section>
        {STEPS.map((s, i) => (
          <View key={i} style={styles.step}>
            <Text style={[styles.num, { color: t.accent }]}>{i + 1}</Text>
            <Text style={[styles.stepText, { color: t.text }]}>{s}</Text>
          </View>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: space.xl, marginBottom: space.xl, gap: space.sm },
  title: { fontSize: 32, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 23 },
  step: { flexDirection: 'row', gap: space.md, padding: space.lg },
  num: { fontSize: 17, fontWeight: '700', width: 18 },
  stepText: { flex: 1, fontSize: 16, lineHeight: 22 },
});
