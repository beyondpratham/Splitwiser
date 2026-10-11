import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { AnimatedFAB, Button, IconButton, Menu, Text } from 'react-native-paper';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { space, useTheme } from '@/theme';
import type { IconName } from './Icon';

export type PageVariant = 'large' | 'small' | 'hero' | 'dialog';

interface Action {
  icon: IconName;
  label: string;
  onPress: () => void;
}

interface MenuItem {
  title: string;
  icon?: IconName;
  onPress: () => void;
}

interface Props {
  title: string;
  variant?: PageVariant;
  back?: boolean;
  actions?: Action[];
  menu?: MenuItem[];
  /** Confirm button on the right of a full-screen dialog. */
  confirm?: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  fab?: { label: string; icon: IconName; onPress: () => void };
  /** Bottom navigation is present below this page (tab screens). */
  inTabs?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Use a keyboard-aware scroll view (forms). */
  form?: boolean;
  children: ReactNode;
}

const BAR = 64;
const HERO_THRESHOLD = 140;

export function Page({ title, variant = 'small', back, actions, menu, confirm, fab, inTabs, refreshing, onRefresh, form, children }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const lastY = useSharedValue(0);
  const fabExtended = useSharedValue(true);
  const [extended, setExtended] = useState(true);

  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    scrollY.set(y);
    const dy = y - lastY.get();
    lastY.set(y);
    const next = y < 48 || dy < -6 ? true : dy > 6 ? false : fabExtended.get();
    if (next !== fabExtended.get()) {
      fabExtended.set(next);
      scheduleOnRN(setExtended, next);
    }
  });

  const topPad = insets.top + BAR;
  const bottomPad = (inTabs ? 0 : insets.bottom) + (fab ? 104 : 32);
  const refresh = onRefresh ? (
    <RefreshControl
      refreshing={!!refreshing}
      onRefresh={onRefresh}
      progressViewOffset={topPad}
      colors={[t.colors.primary]}
      progressBackgroundColor={t.colors.surfaceContainerHigh}
      tintColor={t.colors.primary}
    />
  ) : undefined;

  const content = (
    <>
      {variant === 'large' && <LargeTitle title={title} scrollY={scrollY} />}
      {children}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.surface }}>
      {form ? (
        <KeyboardAwareScrollView
          bottomOffset={24}
          keyboardShouldPersistTaps="handled"
          onScroll={(e) => {
            scrollY.set(e.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad }}
        >
          {content}
        </KeyboardAwareScrollView>
      ) : (
        <Animated.ScrollView
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          refreshControl={refresh}
          contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad }}
        >
          {content}
        </Animated.ScrollView>
      )}

      <TopBar title={title} variant={variant} back={back} actions={actions} menu={menu} confirm={confirm} scrollY={scrollY} insetTop={insets.top} />

      {fab && (
        <AnimatedFAB
          icon={fab.icon}
          label={fab.label}
          extended={extended}
          onPress={fab.onPress}
          animateFrom="right"
          iconMode="dynamic"
          variant="primary"
          style={[styles.fab, { bottom: (inTabs ? 0 : insets.bottom) + space.lg }]}
        />
      )}
    </View>
  );
}

function LargeTitle({ title, scrollY }: { title: string; scrollY: SharedValue<number> }) {
  const t = useTheme();
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 48], [1, 0], 'clamp'),
    transform: [{ translateY: interpolate(scrollY.get(), [-100, 0, 100], [20, 0, 30], 'clamp') }],
  }));
  return (
    <Animated.View style={[styles.largeTitle, style]}>
      <Text variant="headlineLarge" style={{ color: t.colors.onSurface }} numberOfLines={1}>
        {title}
      </Text>
    </Animated.View>
  );
}

function TopBar({
  title,
  variant,
  back,
  actions,
  menu,
  confirm,
  scrollY,
  insetTop,
}: Pick<Props, 'title' | 'back' | 'actions' | 'menu' | 'confirm'> & { variant: PageVariant; scrollY: SharedValue<number>; insetTop: number }) {
  const t = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(scrollY.get(), [0, 24], [t.colors.surface, t.colors.surfaceContainer]),
  }));
  const titleStyle = useAnimatedStyle(() => {
    if (variant === 'small' || variant === 'dialog') return { opacity: 1, transform: [{ translateY: 0 }] };
    const range = variant === 'large' ? [36, 72] : [HERO_THRESHOLD - 40, HERO_THRESHOLD];
    return {
      opacity: interpolate(scrollY.get(), range, [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(scrollY.get(), range, [8, 0], 'clamp') }],
    };
  });

  return (
    <Animated.View style={[styles.bar, { paddingTop: insetTop, height: insetTop + BAR }, barStyle]}>
      {variant === 'dialog' ? (
        <IconButton icon="close" onPress={() => router.back()} accessibilityLabel="Close" />
      ) : back ? (
        <IconButton icon="arrow-left" onPress={() => router.back()} accessibilityLabel="Back" />
      ) : (
        <View style={{ width: space.sm }} />
      )}
      <Animated.View style={[styles.barTitle, titleStyle]}>
        <Text variant={variant === 'dialog' ? 'titleLarge' : 'titleLarge'} numberOfLines={1} style={{ color: t.colors.onSurface }}>
          {title}
        </Text>
      </Animated.View>
      {actions?.map((a) => (
        <IconButton key={a.label} icon={a.icon} onPress={a.onPress} accessibilityLabel={a.label} />
      ))}
      {menu && menu.length > 0 && (
        <Menu
          visible={menuOpen}
          onDismiss={() => setMenuOpen(false)}
          anchor={<IconButton icon="dots-vertical" onPress={() => setMenuOpen(true)} accessibilityLabel="More options" />}
          anchorPosition="bottom"
        >
          {menu.map((m) => (
            <Menu.Item
              key={m.title}
              leadingIcon={m.icon}
              title={m.title}
              onPress={() => {
                setMenuOpen(false);
                m.onPress();
              }}
            />
          ))}
        </Menu>
      )}
      {confirm && (
        <Button
          mode="text"
          onPress={confirm.onPress}
          disabled={confirm.disabled || confirm.loading}
          loading={confirm.loading}
          style={{ marginRight: space.sm }}
          labelStyle={{ fontSize: 15 }}
        >
          {confirm.label}
        </Button>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xs },
  barTitle: { flex: 1, paddingHorizontal: space.sm },
  largeTitle: { paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: space.xl },
  fab: { position: 'absolute', right: space.lg },
});
