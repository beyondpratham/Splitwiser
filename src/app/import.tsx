import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { Button, Check, Field, haptic } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { Sheet, useSheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { useCreateGroup, useFriends, useMe, useSaveExpense } from '@/lib/api';
import { formatMoney, fromMinor, toMinor } from '@/lib/money';
import { parseSplitwiseExport, sharesFromNets, type ParsedExport } from '@/lib/splitwise-import';
import type { Profile } from '@/lib/types';
import { space, useTheme } from '@/theme';

const STEPS = ['Open the group in Splitwise', 'Tap the gear (Settings) → Export as spreadsheet', 'Save the CSV file, then choose it here'];

async function readText(uri: string) {
  if (Platform.OS === 'web') return (await fetch(uri)).text();
  const { File } = await import('expo-file-system');
  return new File(uri).text();
}

export default function ImportScreen() {
  const t = useTheme();
  const me = useMe().data;
  const { friends } = useFriends();
  const createGroup = useCreateGroup();
  const save = useSaveExpense();
  const { toast, fail } = useFeedback();
  const [data, setData] = useState<ParsedExport | null>(null);
  const [groupName, setGroupName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({}); // CSV name → profile id
  const [picking, setPicking] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const people = useMemo(() => (me ? [me, ...friends] : friends), [me, friends]);

  async function choose() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const parsed = parseSplitwiseExport(await readText(asset.uri));
      // match names automatically: you first, then friends by full or first name
      const auto: Record<string, string> = {};
      for (const name of parsed.people) {
        const n = name.toLowerCase();
        const hit =
          (me && me.name.toLowerCase() === n ? me : null) ??
          friends.find((f) => f.name.toLowerCase() === n) ??
          friends.find((f) => f.name.split(' ')[0].toLowerCase() === n.split(' ')[0]);
        if (hit && !Object.values(auto).includes(hit.id)) auto[name] = hit.id;
      }
      if (me && !Object.values(auto).includes(me.id)) {
        const first = parsed.people.find((p) => !auto[p]);
        if (first && first.split(' ')[0].toLowerCase() === me.name.split(' ')[0].toLowerCase()) auto[first] = me.id;
      }
      setMapping(auto);
      setGroupName(asset.name.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').replace(/\b\d{4}.*$/, '').trim() || 'Imported group');
      setData(parsed);
      haptic.success();
    } catch (e) {
      fail(e);
    }
  }

  const allMapped = data ? data.people.every((p) => mapping[p]) : false;
  const includesMe = !!me && Object.values(mapping).includes(me.id);
  const expenses = data?.rows.filter((r) => !r.isPayment).length ?? 0;
  const payments = data ? data.rows.length - expenses : 0;

  async function runImport() {
    if (!data || !me) return;
    try {
      setProgress(0);
      const memberIds = [...new Set(Object.values(mapping))].filter((id) => id !== me.id);
      const groupId = await createGroup.mutateAsync({ name: groupName.trim() || 'Imported group', emoji: '📥', kind: 'other', currency: data.currencies[0], memberIds });
      let failed = 0;
      for (let i = 0; i < data.rows.length; i++) {
        const r = data.rows[i];
        const cost = toMinor(r.cost, r.currency);
        const nets = r.nets.map((n) => toMinor(n, r.currency));
        const shares = sharesFromNets(cost, nets);
        try {
          await save.mutateAsync({
            group_id: groupId,
            description: r.isPayment ? 'Payment' : r.description,
            amount: fromMinor(cost, r.currency),
            currency: r.currency,
            category: r.isPayment ? 'payment' : r.category,
            split_type: 'exact',
            is_payment: r.isPayment,
            spent_on: r.date,
            shares: data.people
              .map((p, k) => ({ profile_id: mapping[p], paid: fromMinor(shares[k].paid, r.currency), owed: fromMinor(shares[k].owed, r.currency) }))
              .filter((s) => s.paid > 0 || s.owed > 0),
          });
        } catch {
          failed++;
        }
        setProgress((i + 1) / data.rows.length);
      }
      haptic.success();
      toast(failed ? `Imported with ${failed} row${failed === 1 ? '' : 's'} skipped` : `Imported ${data.rows.length} items`);
      router.replace({ pathname: '/group/[id]', params: { id: groupId } });
    } catch (e) {
      setProgress(null);
      fail(e);
    }
  }

  return (
    <Page title="Import" back variant="large" form>
      {!data ? (
        <>
          <View style={styles.section}>
            <Glass variant="pane" contentStyle={styles.intro}>
              <Glass tint={t.accentSoft} contentStyle={styles.introIcon}>
                <Icon name="import" size={34} color={t.accentText} />
              </Glass>
              <T variant="heading" style={{ textAlign: 'center' }}>
                Bring your groups from Splitwise
              </T>
              <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
                Every expense and payment comes across with the same balances.
              </T>
            </Glass>
          </View>
          <ListGroup title="How to export from Splitwise">
            {STEPS.map((s, i) => (
              <ListItem
                key={s}
                left={
                  <View style={[styles.num, { backgroundColor: t.accentSoft }]}>
                    <T variant="label" tone="accent">
                      {i + 1}
                    </T>
                  </View>
                }
                title={<T variant="body">{s}</T>}
              />
            ))}
          </ListGroup>
          <View style={styles.section}>
            <Button title="Choose CSV file" icon="file-document-outline" size="lg" onPress={choose} />
          </View>
          <T variant="caption" tone="faint" style={{ textAlign: 'center', marginHorizontal: space.xl }}>
            Tricount and Settle Up imports are coming next.
          </T>
        </>
      ) : (
        <Animated.View entering={FadeIn}>
          <View style={styles.section}>
            <Glass variant="pane" contentStyle={styles.summary}>
              <Stat value={String(expenses)} label="expenses" />
              <Stat value={String(payments)} label="payments" />
              <Stat value={String(data.people.length)} label="people" />
            </Glass>
          </View>
          <View style={styles.section}>
            <Field label="Group name" value={groupName} onChangeText={setGroupName} icon="account-group-outline" />
          </View>
          <ListGroup title="Who is who?" footer={!includesMe ? 'Pick which name is you.' : !allMapped ? 'Match every name to you or a friend. Add missing friends first.' : 'All set.'}>
            {data.people.map((p) => {
              const who = people.find((x) => x.id === mapping[p]);
              return (
                <ListItem
                  key={p}
                  left={who ? <Avatar name={who.name} color={who.avatar_color} avatar={who.avatar} /> : <Icon name="help-circle-outline" size={34} color={t.inkFaint} />}
                  title={p}
                  subtitle={who ? (who.id === me?.id ? 'You' : who.name) : 'Tap to choose'}
                  chevron
                  onPress={() => setPicking(p)}
                />
              );
            })}
          </ListGroup>
          {progress != null && <ProgressBar value={progress} />}
          <View style={[styles.section, { gap: space.md }]}>
            <Button
              title={progress == null ? `Import ${data.rows.length} items` : `Importing… ${Math.round(progress * 100)}%`}
              icon="check"
              size="lg"
              disabled={!allMapped || !includesMe || progress != null}
              onPress={runImport}
            />
            <Button title="Choose a different file" variant="ghost" onPress={() => setData(null)} disabled={progress != null} />
          </View>
          <T variant="caption" tone="faint" style={{ textAlign: 'center', marginHorizontal: space.xl }}>
            Totals: {data.currencies.map((c) => formatMoney(data.rows.filter((r) => r.currency === c && !r.isPayment).reduce((s, r) => s + r.cost, 0), c)).join(' · ')}
          </T>
        </Animated.View>
      )}

      <Sheet visible={!!picking} title={picking ? `Who is “${picking}”?` : ''} onClose={() => setPicking(null)}>
        <PersonList
          people={people}
          meId={me?.id}
          taken={Object.entries(mapping).filter(([k]) => k !== picking).map(([, v]) => v)}
          selected={picking ? mapping[picking] : undefined}
          onPick={(id) => picking && setMapping({ ...mapping, [picking]: id })}
        />
      </Sheet>
    </Page>
  );
}

function PersonList({ people, meId, taken, selected, onPick }: { people: Profile[]; meId?: string; taken: string[]; selected?: string; onPick: (id: string) => void }) {
  const { close } = useSheet();
  return (
    <ListGroup>
      {people.map((p) => (
        <ListItem
          key={p.id}
          left={<Avatar name={p.name} color={p.avatar_color} avatar={p.avatar} />}
          title={p.id === meId ? `${p.name} (you)` : p.name}
          subtitle={taken.includes(p.id) ? 'Already matched' : p.email ?? undefined}
          disabled={taken.includes(p.id)}
          right={<Check radio checked={selected === p.id} />}
          onPress={() => {
            haptic.tap();
            onPick(p.id);
            close();
          }}
        />
      ))}
    </ListGroup>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <T variant="title" tone="accent">
        {value}
      </T>
      <T variant="caption" tone="dim">
        {label}
      </T>
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  const t = useTheme();
  const style = useAnimatedStyle(() => ({ width: withTiming(`${Math.round(value * 100)}%`, { duration: 200 }) }));
  return (
    <View style={[styles.track, { backgroundColor: t.accentSoft }]}>
      <Animated.View style={[styles.fill, { backgroundColor: t.accent }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  intro: { alignItems: 'center', gap: space.md, padding: space.xl },
  introIcon: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  num: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', padding: space.lg },
  track: { height: 8, borderRadius: 4, marginHorizontal: space.lg, marginBottom: space.lg, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});

