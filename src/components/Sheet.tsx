import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Button, Text } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { motion, space, useTheme } from '@/theme';

const SheetContext = createContext<{ close: () => void }>({ close: () => {} });

/** Inside a Sheet: animate it closed (then the parent's onClose runs). */
export const useSheet = () => useContext(SheetContext);

/** Material 3 modal bottom sheet with drag-to-dismiss. */
export function Sheet({
  visible,
  title,
  onClose,
  action,
  children,
  scroll = true,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  action?: { label: string; onPress: () => void; disabled?: boolean };
  children: ReactNode;
  scroll?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const offset = useSharedValue(height);
  const scrim = useSharedValue(0);

  const open = useCallback(() => {
    offset.set(height);
    offset.set(withSpring(0, motion.standard));
    scrim.set(withTiming(1, { duration: 250 }));
  }, [height, offset, scrim]);

  const close = useCallback(() => {
    scrim.set(withTiming(0, { duration: 200 }));
    offset.set(withTiming(height, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) scheduleOnRN(onClose);
    }));
  }, [height, offset, scrim, onClose]);

  useEffect(() => {
    if (visible) open();
  }, [visible, open]);

  const drag = Gesture.Pan()
    .onChange((e) => {
      offset.set(Math.max(0, offset.get() + e.changeY));
    })
    .onEnd((e) => {
      if (offset.get() > 140 || e.velocityY > 900) {
        scrim.set(withTiming(0, { duration: 200 }));
        offset.set(withTiming(height, { duration: 200 }, (done) => {
          if (done) scheduleOnRN(onClose);
        }));
      } else {
        offset.set(withSpring(0, motion.fast));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SheetContext.Provider value={{ close }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.colors.backdrop }, scrimStyle]}>
            <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close sheet" />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: t.colors.surfaceContainerLow, maxHeight: height * 0.88, paddingBottom: insets.bottom + space.lg },
              sheetStyle,
            ]}
          >
            <GestureDetector gesture={drag}>
              <View collapsable={false}>
                <View style={styles.handleArea}>
                  <View style={[styles.handle, { backgroundColor: t.colors.onSurfaceVariant }]} />
                </View>
                {(title || action) && (
                  <View style={styles.header}>
                    <Text variant="titleLarge" style={{ flex: 1, color: t.colors.onSurface }}>
                      {title}
                    </Text>
                    {action && (
                      <Button mode="contained" onPress={action.onPress} disabled={action.disabled} compact style={{ paddingHorizontal: space.sm }}>
                        {action.label}
                      </Button>
                    )}
                  </View>
                )}
              </View>
            </GestureDetector>
            {scroll ? (
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: space.sm }}>
                {children}
              </ScrollView>
            ) : (
              children
            )}
          </Animated.View>
        </SheetContext.Provider>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleArea: { alignItems: 'center', paddingTop: 16, paddingBottom: 12 },
  handle: { width: 32, height: 4, borderRadius: 2, opacity: 0.4 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.md },
});
