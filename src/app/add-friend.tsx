import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Field, haptic } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { parseProfileQr } from '@/components/QrCode';
import { QrScanner } from '@/components/QrScanner';
import { T } from '@/components/Text';
import { useAddFriend, useAddFriendByPhone } from '@/lib/api';
import { friendlyError } from '@/lib/supabase';
import { space, useTheme } from '@/theme';

export default function AddFriend() {
  const t = useTheme();
  const add = useAddFriend();
  const addByPhone = useAddFriendByPhone();
  const { toast, fail } = useFeedback();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const valid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function submit() {
    setError(null);
    try {
      await add.mutateAsync({ email: email.trim(), name: name.trim() || undefined });
      haptic.success();
      toast(`${name.trim() || email.trim()} added`);
      router.back();
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
    }
  }

  async function onScan(data: string) {
    setScanning(false);
    const person = parseProfileQr(data);
    if (!person) {
      haptic.error();
      toast('That isn’t a SplitWiser QR code.');
      return;
    }
    try {
      if (person.email) await add.mutateAsync({ email: person.email, name: person.name });
      else if (person.phone) await addByPhone.mutateAsync(person.phone);
      haptic.success();
      toast(`${person.name ?? 'Friend'} added`);
      router.back();
    } catch (e) {
      fail(e);
    }
  }

  return (
    <Page title="Add friend" variant="dialog" form confirm={{ label: 'Add', onPress: submit, disabled: !valid, loading: add.isPending }}>
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Glass tint={t.accentSoft} contentStyle={styles.heroIcon}>
            <Icon name="account-plus-outline" size={40} color={t.accentText} />
          </Glass>
        </Animated.View>
      </View>

      <View style={styles.section}>
        <Glass variant="pane" onPress={() => setScanning(true)} accessibilityLabel="Scan a QR code" contentStyle={styles.scan}>
          <View style={[styles.scanIcon, { backgroundColor: t.accentSoft }]}>
            <Icon name="qrcode-scan" size={24} color={t.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <T variant="subhead">Scan a QR code</T>
            <T variant="caption" tone="dim">
              Fastest — ask them to tap the QR on their Account page
            </T>
          </View>
          <Icon name="chevron-right" size={22} color={t.inkFaint} />
        </Glass>
      </View>

      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: t.line }]} />
        <T variant="caption" tone="faint">
          or add by email
        </T>
        <View style={[styles.line, { backgroundColor: t.line }]} />
      </View>

      <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
        <Field label="Name" placeholder="Their name" value={name} onChangeText={setName} icon="account-outline" />
        <Field
          label="Email"
          placeholder="name@example.com"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          onSubmitEditing={() => valid && submit()}
          icon="email-outline"
          error={error}
          hint="If they’re not on SplitWiser yet, they’ll see shared expenses as soon as they sign up with this email."
        />
      </View>
      <QrScanner visible={scanning} onClose={() => setScanning(false)} onScan={onScan} />
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: space.xl },
  heroIcon: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
  section: { marginHorizontal: space.lg, marginBottom: space.lg },
  scan: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  scanIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginHorizontal: space.xl, marginBottom: space.lg },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
});
