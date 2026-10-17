import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { qrColor } from '@/lib/avatars';
import type { Profile } from '@/lib/types';
import { R, space, useTheme } from '@/theme';
import { Avatar } from './Avatar';
import { Glass } from './Glass';
import { profileQrValue, QrCode } from './QrCode';
import { T } from './Text';

/** Your QR code, enlarged. Touching anywhere outside the card closes it. */
export function QrViewer({ me, visible, onClose }: { me: Profile; visible: boolean; onClose: () => void }) {
  const t = useTheme();
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {visible && (
        <Pressable style={styles.root} onPress={onClose} accessibilityLabel="Close QR code">
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} />
          <Animated.View entering={ZoomIn.springify().damping(15).stiffness(220)} exiting={ZoomOut.duration(150)}>
            {/* tapping the card itself does nothing */}
            <Pressable onPress={() => {}}>
              <Glass variant="pane" strong blur contentStyle={styles.card}>
                <Avatar name={me.name} color={me.avatar_color} avatar={me.avatar} size={56} />
                <T variant="heading">{me.name}</T>
                <View style={[styles.qr, { borderColor: t.line }]}>
                  <QrCode value={profileQrValue(me)} size={232} color={qrColor(me)} />
                </View>
                <T variant="caption" tone="dim" style={{ textAlign: 'center' }}>
                  Friends can scan this in SplitWiser → Add friend to add you instantly.
                </T>
              </Glass>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { alignItems: 'center', gap: space.md, padding: space.xl, width: 300 },
  qr: { padding: 10, borderRadius: R, backgroundColor: '#FFFFFF', borderWidth: StyleSheet.hairlineWidth },
});
