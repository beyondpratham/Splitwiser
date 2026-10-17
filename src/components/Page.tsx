import { BlurTargetView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { font, motion, space, useTheme, PILL } from '@/theme';
import { Button, haptic, IconButton } from './Controls';
import { Backdrop, BlurTargetContext, Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { ActionSheet, type SheetAction } from './Sheet';
import { T } from './Text';

export type PageVariant = 'large' | 'small' | 'hero' | 'dialog';

/** Vertical space the floating tab bar occupies (bar + gap). */
export const TAB_BAR_SPACE = 64 + 14;

interface Action {
  icon: IconName;
  label: string;
  onPress: () => void;
}

/** A search icon beside the large title that expands into a search bar. */
export interface PageSearch {
  value: string;
  onChange: (query: string) => void;
  placeholder: string;
  /** accessibility label of the search button, e.g. "Search friends" */
  label: string;
}

interface Props {
  title: string;
  search?: PageSearch;
  variant?: PageVariant;
  back?: boolean;
  actions?: Action[];
  menu?: SheetAction[];
  /** Confirm button on the right of a full-screen dialog. */
  confirm?: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  fab?: { label: string; icon: IconName; onPress: () => void };
  /** The floating tab bar sits below this page (tab screens). */
  inTabs?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Keyboard-aware scrolling (forms). */
  form?: boolean;
  children: ReactNode;
}

const BAR = 60;
const HERO_THRESHOLD = 150;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Page({ title, variant = 'small', back, actions, search, menu, confirm, fab, inTabs, refreshing, onRefresh, form, children }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const lastY = useSharedValue(0);
  const collapsed = useSharedValue(0); // FAB: 0 = extended, 1 = icon only
  const target = useRef<View | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const onScroll = useAnimatedScrollHandler((e) => {
    const y = e.contentOffset.y;
    scrollY.set(y);
    const dy = y - lastY.get();
    lastY.set(y);
    if (y < 48 || dy < -6) collapsed.set(withSpring(0, motion.snappy));
    else if (dy > 6) collapsed.set(withSpring(1, motion.snappy));
  });

  const bottomChrome = inTabs ? TAB_BAR_SPACE : 0;
  const topPad = insets.top + BAR;
  const bottomPad = insets.bottom + bottomChrome + (fab ? 96 : 40);
  const refresh = onRefresh ? (
    <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} progressViewOffset={topPad} colors={[t.accent]} tintColor={t.accent} progressBackgroundColor={t.solid} />
  ) : undefined;

  const content = (
    <>
      {variant === 'large' && <LargeTitle title={title} scrollY={scrollY} actions={actions} search={search} />}
      {children}
    </>
  );

  const scroller = form ? (
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
    <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" refreshControl={refresh} contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad }}>
      {content}
    </Animated.ScrollView>
  );

  return (
    <BlurTargetContext.Provider value={Platform.OS === 'android' ? target : null}>
      <View style={{ flex: 1 }}>
        <Backdrop />
        {Platform.OS === 'android' ? (
          <BlurTargetView ref={target} style={{ flex: 1 }}>
            {scroller}
          </BlurTargetView>
        ) : (
          scroller
        )}

        <TopBar
          title={title}
          variant={variant}
          back={back}
          actions={variant === 'large' ? undefined : actions}
          hasMenu={!!menu?.length}
          onMenu={() => setMenuOpen(true)}
          confirm={confirm}
          scrollY={scrollY}
          insetTop={insets.top}
        />

        {fab && <Fab {...fab} collapsed={collapsed} bottom={insets.bottom + bottomChrome + 18} />}
        {menu && <ActionSheet visible={menuOpen} actions={menu} onClose={() => setMenuOpen(false)} />}
      </View>
    </BlurTargetContext.Provider>
  );
}

const HEADER_BUTTON = 44;

/** The page title, with its actions and an expanding search bar on the right. */
function LargeTitle({ title, scrollY, actions, search }: { title: string; scrollY: SharedValue<number>; actions?: Action[]; search?: PageSearch }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [rowWidth, setRowWidth] = useState(0);
  const progress = useSharedValue(0);

  const toggle = (next: boolean) => {
    haptic.tap();
    setOpen(next);
    progress.set(withSpring(next ? 1 : 0, motion.smooth));
    if (!next) search?.onChange('');
  };

  const fadeOut = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0, 0.5], [1, 0], 'clamp') }));
  const bar = useAnimatedStyle(() => ({ width: interpolate(progress.get(), [0, 1], [HEADER_BUTTON, Math.max(rowWidth, HEADER_BUTTON)]) }));
  const inner = useAnimatedStyle(() => ({ opacity: interpolate(progress.get(), [0.3, 1], [0, 1], 'clamp') }));

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.get(), [0, 44], [1, 0], 'clamp'),
    transform: [
      { translateY: interpolate(scrollY.get(), [-100, 0, 100], [16, 0, 24], 'clamp') },
      { scale: interpolate(scrollY.get(), [-120, 0], [1.06, 1], 'clamp') },
    ],
    transformOrigin: 'left',
  }));
  return (
    <Animated.View style={[styles.largeTitle, style]}>
      <View style={styles.headerRow} onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.headerTitle, fadeOut]} pointerEvents={open ? 'none' : 'auto'}>
          <T variant="display" numberOfLines={1} style={{ flexShrink: 1 }}>
            {title}
          </T>
          <View style={styles.headerActions}>
            {actions?.map((a) => <IconButton key={a.label} icon={a.icon} label={a.label} size={HEADER_BUTTON} onPress={a.onPress} />)}
            {search && <View style={{ width: HEADER_BUTTON }} />}
          </View>
        </Animated.View>

        {search && (
          <Animated.View style={[styles.searchBar, bar]}>
            <Glass variant="pill" blur={open} style={{ flex: 1 }} contentStyle={styles.searchInner} tint={open ? t.accentSoft : undefined}>
              <Pressable onPress={() => !open && toggle(true)} accessibilityRole="button" accessibilityLabel={open ? 'Search' : search.label} style={styles.searchIcon}>
                <Icon name="magnify" size={22} color={open ? t.accentText : t.ink} />
              </Pressable>
              {open && (
                <Animated.View style={[styles.searchField, inner]}>
                  <TextInput
                    autoFocus
                    value={search.value}
                    onChangeText={search.onChange}
                    placeholder={search.placeholder}
                    placeholderTextColor={t.inkFaint}
                    selectionColor={t.accent}
                    cursorColor={t.accent}
                    autoCorrect={false}
                    returnKeyType="search"
                    style={[styles.searchInput, { color: t.ink, fontFamily: font.regular }]}
                  />
                  <Pressable onPress={() => toggle(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close search" style={styles.searchIcon}>
                    <Icon name="close" size={20} color={t.inkDim} />
                  </Pressable>
                </Animated.View>
              )}
            </Glass>
          </Animated.View>
        )}
      </View>
    </Animated.View>
  );
}

function TopBar({
  title,
  variant,
  back,
  actions,
  hasMenu,
  onMenu,
  confirm,
  scrollY,
  insetTop,
}: Pick<Props, 'title' | 'back' | 'actions' | 'confirm'> & {
  variant: PageVariant;
  hasMenu: boolean;
  onMenu: () => void;
  scrollY: SharedValue<number>;
  insetTop: number;
}) {
  const t = useTheme();
  const chrome = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.get(), [0, 28], [0, 1], 'clamp') }));
  const titleStyle = useAnimatedStyle(() => {
    if (variant === 'small' || variant === 'dialog') return { opacity: 1, transform: [{ translateY: 0 }] };
    const range = variant === 'large' ? [30, 64] : [HERO_THRESHOLD - 40, HERO_THRESHOLD];
    return {
      opacity: interpolate(scrollY.get(), range, [0, 1], 'clamp'),
      transform: [{ translateY: interpolate(scrollY.get(), range, [8, 0], 'clamp') }],
    };
  });

  return (
    <View style={[styles.bar, { paddingTop: insetTop, height: insetTop + BAR }]} pointerEvents="box-none">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, chrome]}>
        {/* frosted, dense bar so scrolled content reads as clearly behind it */}
        <Glass variant="chrome" blur strong radius={0} style={StyleSheet.absoluteFill} contentStyle={{ flex: 1 }} />
        <View style={[styles.barLine, { backgroundColor: t.line }]} />
        <LinearGradient colors={[t.bg, 'transparent']} style={styles.barFade} />
      </Animated.View>
      <View style={styles.barRow}>
        {variant === 'dialog' ? (
          <IconButton icon="close" label="Close" onPress={() => router.back()} />
        ) : back ? (
          <IconButton icon="arrow-left" label="Back" onPress={() => router.back()} />
        ) : null}
        <Animated.View style={[styles.barTitle, titleStyle]}>
          <T variant="subhead" numberOfLines={1}>
            {title}
          </T>
        </Animated.View>
        {actions?.map((a) => <IconButton key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} />)}
        {hasMenu && <IconButton icon="dots-horizontal" label="More options" onPress={onMenu} />}
        {confirm && <Button title={confirm.label} size="sm" onPress={confirm.onPress} disabled={confirm.disabled} loading={confirm.loading} />}
      </View>
    </View>
  );
}

function Fab({ label, icon, onPress, collapsed, bottom }: { label: string; icon: IconName; onPress: () => void; collapsed: SharedValue<number>; bottom: number }) {
  const t = useTheme();
  const press = useSharedValue(0);
  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: 1 - press.get() * 0.04 }] }));
  const labelStyle = useAnimatedStyle(() => ({
    maxWidth: interpolate(collapsed.get(), [0, 1], [160, 0]),
    opacity: interpolate(collapsed.get(), [0, 0.6], [1, 0], 'clamp'),
    marginLeft: interpolate(collapsed.get(), [0, 1], [8, 0]),
  }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      onPressIn={() => press.set(withSpring(1, motion.press))}
      onPressOut={() => press.set(withSpring(0, motion.press))}
      style={[styles.fab, { bottom, backgroundColor: t.accent, boxShadow: `0px 10px 24px -8px ${t.accent}, 0px 2px 6px rgba(0,0,0,0.18)` }, wrap]}
    >
      <View style={[StyleSheet.absoluteFill, styles.fabSheen]} />
      <Icon name={icon} size={24} color={t.accentInk} />
      <Animated.View style={[{ overflow: 'hidden' }, labelStyle]}>
        <T variant="bodyStrong" numberOfLines={1} style={{ color: t.accentInk }}>
          {label}
        </T>
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  bar: { position: 'absolute', top: 0, left: 0, right: 0 },
  barLine: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  barFade: { position: 'absolute', left: 0, right: 0, bottom: -18, height: 18, opacity: 0.6 },
  barRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  barTitle: { flex: 1, paddingHorizontal: space.xs },
  largeTitle: { paddingLeft: space.xl, paddingRight: space.lg, paddingTop: space.xs, paddingBottom: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', minHeight: HEADER_BUTTON },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerActions: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: space.sm },
  searchBar: { position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center' },
  searchInner: { flexDirection: 'row', alignItems: 'center', height: HEADER_BUTTON, overflow: 'hidden' },
  searchIcon: { width: HEADER_BUTTON, height: HEADER_BUTTON, alignItems: 'center', justifyContent: 'center' },
  searchField: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0, height: HEADER_BUTTON, outlineStyle: 'none' } as never,
  fab: {
    position: 'absolute',
    right: space.lg,
    height: 56,
    minWidth: 56,
    paddingHorizontal: 16,
    borderRadius: PILL,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  fabSheen: { backgroundColor: 'rgba(255,255,255,0.14)', bottom: '50%' },
});
