import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { Button, Field, haptic } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { CurrencyPicker } from '@/components/Pickers';
import { T } from '@/components/Text';
import { Tile } from '@/components/Tile';
import { useMe, useUpdateProfile } from '@/lib/api';
import { currencyByCode } from '@/lib/currencies';
import { space, useTheme } from '@/theme';

const COLORS = ['#10A66B', '#0F766E', '#2563EB', '#4F46E5', '#7C3AED', '#DB2777', '#EA580C', '#57534E'];

export default function Profile() {
  const t = useTheme();
  const me = useMe().data;
  const update = useUpdateProfile();
  const { toast, fail } = useFeedback();
  const [draft, setDraft] = useState<string | null>(null);
  const [currencyOpen, setCurrencyOpen] = useState(false);

  if (!me) return <Page title="Edit profile" back>{null}</Page>;
  const name = draft ?? me.name;
  const changed = name.trim() && name.trim() !== me.name;

  return (
    <Page title="Edit profile" back variant="large" form>
      <View style={styles.hero}>
        <Animated.View key={me.avatar_color} entering={ZoomIn.springify().damping(12)}>
          <Avatar name={name || me.name} color={me.avatar_color} size={96} />
        </Animated.View>
        <View style={styles.colors}>
          {COLORS.map((c) => (
            <Pressable
              key={c}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={`Avatar colour ${c}`}
              accessibilityState={{ selected: me.avatar_color === c }}
              onPress={() => {
                haptic.tap();
                update.mutateAsync({ id: me.id, avatar_color: c }).catch(fail);
              }}
              style={[styles.swatch, { backgroundColor: c, borderColor: me.avatar_color === c ? t.ink : 'transparent' }]}
            />
          ))}
        </View>
      </View>

      <Glass variant="pane" style={styles.section} contentStyle={{ padding: space.lg, gap: space.md }}>
        <Field label="Name" value={name} onChangeText={setDraft} icon="account-outline" autoComplete="name" />
        <Field label="Email" value={me.email ?? ''} editable={false} icon="email-outline" />
        <Button
          title="Save name"
          disabled={!changed}
          loading={update.isPending}
          onPress={() =>
            update
              .mutateAsync({ id: me.id, name: name.trim() })
              .then(() => {
                setDraft(null);
                haptic.success();
                toast('Name updated');
              })
              .catch(fail)
          }
        />
      </Glass>

      <ListGroup title="Preferences">
        <ListItem
          left={<Tile icon="currency-usd" />}
          title="Default currency"
          detail={`${currencyByCode(me.default_currency)?.flag ?? ''} ${me.default_currency}`}
          chevron
          onPress={() => setCurrencyOpen(true)}
        />
      </ListGroup>
      <T variant="caption" tone="dim" style={styles.note}>
        Your email is how friends add you. To change it, create a new account with the new email.
      </T>

      <CurrencyPicker visible={currencyOpen} value={me.default_currency} onClose={() => setCurrencyOpen(false)} onSelect={(c) => update.mutateAsync({ id: me.id, default_currency: c }).catch(fail)} />
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.lg, marginBottom: space.xl },
  colors: { flexDirection: 'row', gap: 10 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 3 },
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  note: { marginHorizontal: space.xl, marginTop: -space.md },
});
