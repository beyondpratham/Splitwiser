import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { R, space, useTheme } from '@/theme';
import { Button, IconButton } from './Controls';
import { Backdrop } from './Glass';
import { T } from './Text';

/** Full-screen camera that reports the first QR code it sees. */
export function QrScanner({ visible, onClose, onScan }: { visible: boolean; onClose: () => void; onScan: (data: string) => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose} onShow={() => (handled.current = false)}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;
              handled.current = true;
              onScan(data);
            }}
          />
        ) : (
          <View style={styles.center}>
            <Backdrop />
            <T variant="heading" style={{ textAlign: 'center' }}>
              Camera access needed
            </T>
            <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
              SplitWiser uses the camera only to scan a friend’s QR code.
            </T>
            <Button title="Allow camera" icon="camera-outline" onPress={requestPermission} />
          </View>
        )}
        {permission?.granted && (
          <Animated.View entering={FadeIn} pointerEvents="none" style={styles.center}>
            <View style={[styles.frame, { borderColor: t.accent }]} />
            <T variant="bodyStrong" style={{ color: '#fff', marginTop: space.lg }}>
              Point at a SplitWiser QR code
            </T>
          </Animated.View>
        )}
        <View style={[styles.close, { top: insets.top + space.md }]}>
          <IconButton icon="close" label="Close scanner" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  frame: { width: 240, height: 240, borderRadius: R + 10, borderWidth: 3 },
  close: { position: 'absolute', left: space.lg },
});
