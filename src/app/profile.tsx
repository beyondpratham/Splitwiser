import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { Button, Field, haptic } from '@/components/Controls';
import { useFeedback } from '@/components/Feedback';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { CurrencyPicker } from '@/components/Pickers';
import { ActionSheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { Tile } from '@/components/Tile';
import { useMe, useUpdateProfile } from '@/lib/api';
import { AVATARS, isPhoto } from '@/lib/avatars';
import { currencySymbol } from '@/lib/currencies';
import { normalizePhone } from '@/lib/phone';
import { R, space, useTheme } from '@/theme';

/** Square-crop and shrink a picked photo to a small JPEG data URI (fits in the profile row). */
async function toAvatarDataUri(uri: string) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 256, height: 256 });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, base64: true, compress: 0.7 });
  return `data:image/jpeg;base64,${result.base64}`;
}

export default function Profile() {
  const t = useTheme();
  const me = useMe().data;
  const update = useUpdateProfile();
  const { toast, fail } = useFeedback();
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!me) return <Page title="Profile" back>{null}</Page>;
  const nameValue = name ?? me.name;
  const phoneValue = phone ?? me.phone ?? '';
  const normalized = phoneValue.trim() ? normalizePhone(phoneValue) : null;
  const phoneError = phoneValue.trim() && !normalized ? 'Include the country code, like +91 98765 43210' : null;
  const dirty = (nameValue.trim() && nameValue.trim() !== me.name) || (phone !== null && normalized !== (me.phone ?? null) && !phoneError);

  const setAvatar = (avatar: string | null) =>
    update
      .mutateAsync({ id: me.id, avatar })
      .then(() => haptic.success())
      .catch(fail);

  const pickPhoto = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera' && Platform.OS !== 'web') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return toast('Allow camera access in your phone’s settings to take a photo.');
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;
      setBusy(true);
      await setAvatar(await toAvatarDataUri(result.assets[0].uri));
      toast('Profile photo updated');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    update
      .mutateAsync({ id: me.id, name: nameValue.trim(), phone: phoneValue.trim() ? normalized : null })
      .then(() => {
        setName(null);
        setPhone(null);
        haptic.success();
        toast('Profile saved');
      })
      .catch(fail);

  return (
    <Page title="Profile" back variant="large" form>
      <View style={styles.hero}>
        <Pressable onPress={() => setPhotoMenu(true)} accessibilityRole="button" accessibilityLabel="Change profile photo">
          <Animated.View key={me.avatar ?? me.avatar_color} entering={ZoomIn.springify().damping(12)}>
            <Avatar name={nameValue || me.name} color={me.avatar_color} avatar={me.avatar} size={112} />
          </Animated.View>
          <View style={[styles.badge, { backgroundColor: t.accent, borderColor: t.bg }]}>
            <Icon name={busy ? 'progress-upload' : 'camera'} size={18} color={t.accentInk} />
          </View>
        </Pressable>
        <T variant="caption" tone="dim">
          Tap to take or upload a photo
        </T>
      </View>

      <View style={styles.section}>
        <T variant="overline" tone="dim" style={styles.label}>
          Or pick an avatar
        </T>
        <Glass variant="pane" contentStyle={styles.avatarGrid}>
          {AVATARS.map((a) => {
            const on = me.avatar === `emoji:${a.id}`;
            return (
              <Pressable
                key={a.id}
                onPress={() => setAvatar(`emoji:${a.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`${a.id} avatar`}
                accessibilityState={{ selected: on }}
                style={[styles.avatarCell, { backgroundColor: a.bg, borderColor: on ? t.accent : 'transparent' }]}
              >
                <Text style={{ fontSize: 26 }}>{a.emoji}</Text>
              </Pressable>
            );
          })}
        </Glass>
      </View>

      <Glass variant="pane" style={styles.section} contentStyle={{ padding: space.lg, gap: space.md }}>
        <Field label="Name" value={nameValue} onChangeText={setName} icon="account-outline" autoComplete="name" />
        <Field
          label="Phone number"
          value={phoneValue}
          onChangeText={setPhone}
          placeholder="+91 98765 43210"
          keyboardType="phone-pad"
          autoComplete="tel"
          icon="phone-outline"
          error={phoneError}
          hint="Friends can find you by this number. One number per account."
        />
        <Field label="Email" value={me.email ?? ''} editable={false} icon="email-outline" hint="Your email is your login and can’t be changed here." />
        <Button title="Save changes" disabled={!dirty} loading={update.isPending && !busy} onPress={save} />
      </Glass>

      <ListGroup title="Preferences">
        <ListItem left={<Tile icon="currency-usd" />} title="Default currency" detail={`${currencySymbol(me.default_currency)}  ${me.default_currency}`} chevron onPress={() => setCurrencyOpen(true)} />
      </ListGroup>

      <ActionSheet
        visible={photoMenu}
        title="Profile photo"
        onClose={() => setPhotoMenu(false)}
        actions={[
          { label: 'Take a photo', icon: 'camera-outline', onPress: () => pickPhoto('camera') },
          { label: 'Choose from gallery', icon: 'image-outline', onPress: () => pickPhoto('library') },
          ...(isPhoto(me.avatar) || me.avatar ? [{ label: 'Remove photo', icon: 'delete-outline' as const, destructive: true, onPress: () => setAvatar(null) }] : []),
        ]}
      />
      <CurrencyPicker visible={currencyOpen} value={me.default_currency} onClose={() => setCurrencyOpen(false)} onSelect={(c) => update.mutateAsync({ id: me.id, default_currency: c }).catch(fail)} />
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.sm, marginBottom: space.xl },
  badge: { position: 'absolute', right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  label: { marginBottom: space.sm, marginLeft: space.sm },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, padding: space.md, justifyContent: 'center' },
  avatarCell: { width: 52, height: 52, borderRadius: R, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5 },
});
