import type { Tabs } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, motion, space, useTheme, R } from '@/theme';
import { haptic } from './Controls';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TABS: Record<string, { label: string; icon: IconName; active: IconName }> = {
  friends: { label: 'Friends', icon: 'account-outline', active: 'account' },
  groups: { label: 'Groups', icon: 'account-group-outline', active: 'account-group' },
  activity: { label: 'Activity', icon: 'lightning-bolt-outline', active: 'lightning-bolt' },
  account: { label: 'Account', icon: 'account-circle-outline', active: 'account-circle' },
};

/** Floating liquid-glass tab bar with a glass indicator that springs between tabs. */
export function NavigationBar({ state, navigation }: TabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const routes = state.routes.filter((r) => TABS[r.name]);
  const index = Math.max(0, routes.findIndex((r) => r.key === state.routes[state.index]?.key));
  const item = width / Math.max(routes.length, 1);
  const x = useSharedValue(0);
  useEffect(() => {
    if (item) x.set(withSpring(index * item, motion.bouncy));
  }, [index, item, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + 10 }]}>
      <Glass variant="chrome" blur contentStyle={styles.bar}>
        <View style={styles.row} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
          {item > 0 && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  width: item - 8,
                  backgroundColor: t.accentSoft,
                  borderColor: t.dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.9)',
                  boxShadow: `inset 0px 1px 0px ${t.rimTop}`,
                },
                indicator,
              ]}
            />
          )}
          {routes.map((route) => {
            const meta = TABS[route.name];
            const focused = state.routes[state.index]?.key === route.key;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={meta.label}
                style={styles.item}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) {
                    haptic.tap();
                    navigation.navigate(route.name);
                  }
                }}
              >
                <Icon name={focused ? meta.active : meta.icon} size={24} color={focused ? t.accentText : t.inkDim} />
                <T variant="caption" style={{ color: focused ? t.accentText : t.inkDim, fontFamily: focused ? font.semibold : font.medium, fontSize: 11 }}>
                  {meta.label}
                </T>
              </Pressable>
            );
          })}
        </View>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg },
  bar: { padding: 4 },
  row: { flexDirection: 'row', height: 56 },
  indicator: { position: 'absolute', left: 4, top: 0, bottom: 0, borderRadius: R - 4, borderWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
});
