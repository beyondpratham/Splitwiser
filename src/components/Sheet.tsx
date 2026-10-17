import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { motion, space, useTheme, R } from '@/theme';
import { Button, haptic } from './Controls';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

const SheetContext = createContext<{ close: () => void }>({ close: () => {} });

/** Inside a Sheet: animate it closed (then the parent's onClose runs). */
export const useSheet = () => useContext(SheetContext);

/** Frosted-glass bottom sheet with drag-to-dismiss. */
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
    offset.set(withSpring(0, motion.smooth));
    scrim.set(withTiming(1, { duration: 250 }));
  }, [height, offset, scrim]);

  const close = useCallback(() => {
    scrim.set(withTiming(0, { duration: 200 }));
    offset.set(
      withTiming(height, { duration: 220, easing: Easing.in(Easing.cubic) }, (done) => {
        if (done) scheduleOnRN(onClose);
      }),
    );
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
        offset.set(
          withTiming(height, { duration: 200 }, (done) => {
            if (done) scheduleOnRN(onClose);
          }),
        );
      } else {
        offset.set(withSpring(0, motion.snappy));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: offset.get() }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.get() }));

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SheetContext.Provider value={{ close }}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }, scrimStyle]}>
            <Pressable style={{ flex: 1 }} onPress={close} accessibilityLabel="Close sheet" />
          </Animated.View>
          <Animated.View
            style={[
              styles.sheet,
              { maxHeight: height * 0.88, paddingBottom: insets.bottom + space.lg, borderColor: t.rimTop, boxShadow: `0px -12px 40px -16px ${t.drop}` },
              sheetStyle,
            ]}
          >
            {Platform.OS !== 'android' && <BlurView intensity={70} tint={t.blurTint} style={StyleSheet.absoluteFill} />}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'android' ? t.solid : t.glassStrong }]} />
            <LinearGradient pointerEvents="none" colors={[t.sheen, 'transparent']} locations={[0, 0.12]} style={StyleSheet.absoluteFill} />
            <GestureDetector gesture={drag}>
              <View collapsable={false}>
                <View style={styles.handleArea}>
                  <View style={[styles.handle, { backgroundColor: t.inkFaint }]} />
                </View>
                {(title || action) && (
                  <View style={styles.header}>
                    <T variant="heading" style={{ flex: 1 }}>
                      {title}
                    </T>
                    {action && <Button title={action.label} size="sm" onPress={action.onPress} disabled={action.disabled} />}
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

export interface SheetAction {
  label: string;
  icon?: IconName;
  destructive?: boolean;
  onPress: () => void;
}

/** A sheet of actions (used for overflow menus). */
export function ActionSheet({ visible, title, actions, onClose }: { visible: boolean; title?: string; actions: SheetAction[]; onClose: () => void }) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      <ActionList actions={actions} />
    </Sheet>
  );
}

function ActionList({ actions }: { actions: SheetAction[] }) {
  const t = useTheme();
  const { close } = useSheet();
  return (
    <View style={{ paddingHorizontal: space.lg, gap: space.sm, paddingBottom: space.sm }}>
      {actions.map((a) => (
        <Pressable
          key={a.label}
          accessibilityRole="button"
          accessibilityLabel={a.label}
          onPress={() => {
            haptic.tap();
            close();
            setTimeout(a.onPress, 230);
          }}
          style={({ pressed }) => [styles.action, { backgroundColor: pressed ? t.glassPressed : t.glassTint, borderColor: t.rimTop }]}
        >
          {a.icon && <Icon name={a.icon} size={22} color={a.destructive ? t.danger : t.ink} />}
          <T variant="bodyStrong" tone={a.destructive ? 'danger' : 'ink'}>
            {a.label}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: R + 8,
    borderTopRightRadius: R + 8,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
  },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 10 },
  handle: { width: 38, height: 5, borderRadius: 3, opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, height: 56, borderRadius: R, borderWidth: StyleSheet.hairlineWidth },
});
