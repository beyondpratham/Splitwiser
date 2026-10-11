import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Row, Section } from '@/components/List';
import { CurrencyPicker } from '@/components/Pickers';
import { Field, haptic, Screen, Sheet } from '@/components/ui';
import { useMe, useUpdateProfile } from '@/lib/api';
import { currencyByCode } from '@/lib/currencies';
import { supabase } from '@/lib/supabase';
import { radius, space, useTheme } from '@/theme';

const COLORS = ['#34C759', '#00C7BE', '#007AFF', '#5856D6', '#AF52DE', '#FF2D55', '#FF9500', '#A2845E'];

export default function Account() {
  const t = useTheme();
  const me = useMe().data;
  const update = useUpdateProfile();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [currencyOpen, setCurrencyOpen] = useState(false);

  if (!me) return <Screen>{null}</Screen>;
  const cur = currencyByCode(me.default_currency);

  return (
    <Screen>
      <View style={styles.profile}>
        <Avatar name={me.name} color={me.avatar_color} size={84} />
        <Text style={[styles.name, { color: t.text }]}>{me.name}</Text>
        <Text style={{ color: t.secondary, fontSize: 15 }}>{me.email}</Text>
        <View style={styles.colors}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              hitSlop={4}
              onPress={() => {
                haptic.tap();
                update.mutate({ id: me.id, avatar_color: c });
              }}
              style={[styles.swatch, { backgroundColor: c, borderColor: me.avatar_color === c ? t.text : 'transparent' }]}
            />
          ))}
        </View>
      </View>

      <Section>
        <Row
          left={<RowIcon name="pencil" color="#8E8E93" />}
          title="Name"
          detail={me.name}
          chevron
          onPress={() => {
            setName(me.name);
            setEditing(true);
          }}
        />
        <Row
          left={<RowIcon name="dollarsign.circle.fill" color="#34C759" />}
          title="Default currency"
          detail={`${cur?.flag ?? ''} ${me.default_currency}`}
          chevron
          onPress={() => setCurrencyOpen(true)}
        />
      </Section>

      <Section>
        <Row left={<RowIcon name="chart.pie.fill" color="#5856D6" />} title="Spending insights" chevron onPress={() => router.push('/insights')} />
      </Section>

      <Section footer="SplitWiser is ad-free and has no limits on expenses.">
        <Row
          left={<RowIcon name="rectangle.portrait.and.arrow.right" color="#FF3B30" />}
          title="Sign out"
          destructive
          onPress={() =>
            Alert.alert('Sign out?', undefined, [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
            ])
          }
        />
      </Section>

      <CurrencyPicker
        visible={currencyOpen}
        value={me.default_currency}
        onClose={() => setCurrencyOpen(false)}
        onSelect={(c) => update.mutate({ id: me.id, default_currency: c })}
      />
      <Sheet
        visible={editing}
        title="Your name"
        onClose={() => setEditing(false)}
        doneDisabled={!name.trim()}
        onDone={() => {
          update.mutate({ id: me.id, name: name.trim() });
          setEditing(false);
        }}
      >
        <Section footer="This is how friends see you.">
          <Field value={name} onChangeText={setName} autoFocus placeholder="Name" />
        </Section>
      </Sheet>
    </Screen>
  );
}

function RowIcon({ name, color }: { name: Parameters<typeof Icon>[0]['name']; color: string }) {
  return (
    <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={16} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: 'center', gap: space.xs, marginBottom: space.xl, paddingTop: space.sm },
  name: { fontSize: 24, fontWeight: '700', marginTop: space.md },
  colors: { flexDirection: 'row', gap: 10, marginTop: space.lg },
  swatch: { width: 26, height: 26, borderRadius: radius.md, borderWidth: 2.5 },
});
