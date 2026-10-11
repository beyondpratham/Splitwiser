import type { Tabs } from 'expo-router';
import { useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { motion, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { haptic } from './ui';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_ICONS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  groups: { label: 'Groups', icon: 'account-group-outline', active: 'account-group' },
  friends: { label: 'Friends', icon: 'account-outline', active: 'account' },
  activity: { label: 'Activity', icon: 'lightning-bolt-outline', active: 'lightning-bolt' },
  account: { label: 'Account', icon: 'account-circle-outline', active: 'account-circle' },
};

/** Material 3 navigation bar with a springy active-indicator pill. */
export function NavigationBar({ state, navigation }: TabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: t.colors.surfaceContainer, paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const meta = TAB_ICONS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        return (
          <NavItem
            key={route.key}
            label={meta.label}
            icon={focused ? meta.active : meta.icon}
            focused={focused}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                haptic.tap();
                navigation.navigate(route.name);
              }
            }}
          />
        );
      })}
    </View>
  );
}

function NavItem({ label, icon, focused, onPress }: { label: string; icon: IconName; focused: boolean; onPress: () => void }) {
  const t = useTheme();
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.set(withSpring(focused ? 1 : 0, motion.bouncy));
  }, [focused, progress]);

  const pill = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scaleX: 0.4 + 0.6 * progress.get() }],
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -1.5 * progress.get() }] }));

  return (
    <Pressable onPress={onPress} style={styles.item} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label}>
      <View style={styles.iconWrap}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.pill, { backgroundColor: t.colors.secondaryContainer }, pill]} />
        <Animated.View style={iconStyle}>
          <Icon name={icon} size={24} color={focused ? t.colors.onSecondaryContainer : t.colors.onSurfaceVariant} />
        </Animated.View>
      </View>
      <Text
        variant="labelMedium"
        style={{ color: focused ? t.colors.onSurface : t.colors.onSurfaceVariant, fontWeight: focused ? '700' : '500' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', paddingTop: 12 },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingBottom: 16 },
  iconWrap: { width: 64, height: 32, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 16 },
});
