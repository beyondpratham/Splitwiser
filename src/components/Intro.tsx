import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

/** Same as the launch screen (app.json splash + scripts/generate-icons.mjs), so the hand-off is seamless. */
const BRAND = '#13B079';
const SPLASH_WIDTH = 200;
const ANGLE = (22 * Math.PI) / 180; // the logo's cut: the halves part along its normal
const TILT = (8 * Math.PI) / 180; // lean of the tear line
const NX = Math.cos(ANGLE);
const NY = Math.sin(ANGLE);

/** The white coin with its "$" cut-out, drawn in the logo's 1024-unit space and centred on (cx, cy). */
function Coin({ cx, cy }: { cx: number; cy: number }) {
  const s = SPLASH_WIDTH / 1024;
  return (
    <G transform={`translate(${cx - 512 * s} ${cy - 512 * s}) scale(${s})`}>
      <Circle cx={512} cy={512} r={290} fill="#FFFFFF" />
      <Path
        d="M598 418 C580 386 548 370 512 370 C458 370 422 398 422 440 C422 486 462 500 512 512 C566 525 604 541 604 586 C604 630 566 656 512 656 C470 656 436 640 416 606"
        fill="none"
        stroke={BRAND}
        strokeWidth={54}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M512 316 V362 M512 664 V710" stroke={BRAND} strokeWidth={54} strokeLinecap="round" />
    </G>
  );
}

/** A ragged line through the centre, tilted like the logo's cut. */
function tearLine(w: number, h: number) {
  const pts: [number, number][] = [];
  let i = 0;
  for (let y = -40; y <= h + 40; i++) {
    // deterministic pseudo-random ragged edge, like torn paper
    const r1 = Math.sin(i * 12.9898) * 43758.5453;
    const r2 = Math.sin(i * 78.233) * 12543.123;
    const jitter = (r1 - Math.floor(r1) - 0.5) * 14;
    pts.push([w / 2 - (y - h / 2) * Math.tan(TILT) + jitter, y]);
    y += 8 + (r2 - Math.floor(r2)) * 16;
  }
  return pts;
}

/**
 * Opening animation: the launch screen's coin gives a little pulse, then the whole screen tears in two
 * down the middle and the halves fly apart, revealing the app underneath.
 */
export function Intro() {
  const reduceMotion = useReducedMotion();
  const { width: w, height: h } = useWindowDimensions();
  const [done, setDone] = useState(false);
  const pulse = useSharedValue(1);
  const crack = useSharedValue(0);
  const fly = useSharedValue(0);

  const { left, right } = useMemo(() => {
    const line = tearLine(w, h);
    const path = line.map(([x, y]) => `${x},${y}`).join(' L');
    const top = line[0][1];
    const bottom = line.at(-1)![1];
    return {
      left: `M-${w},${top} L${path} L-${w},${bottom} Z`,
      right: `M${2 * w},${top} L${path} L${2 * w},${bottom} Z`,
    };
  }, [w, h]);

  useEffect(() => {
    pulse.set(withSequence(withDelay(150, withTiming(1.12, { duration: 220, easing: Easing.out(Easing.quad) })), withTiming(1, { duration: 260, easing: Easing.inOut(Easing.quad) })));
    crack.set(withDelay(620, withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) })));
    fly.set(
      withDelay(820, withTiming(1, { duration: 620, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(setDone, true);
      })),
    );
    // shared values are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // each half moves away from the cut along its normal and spins off a little
  // (shared values are read directly in each style so the styles subscribe to them)
  const leftStyle = useAnimatedStyle(() => {
    const d = crack.get() * 8 + fly.get() * w * 1.1;
    return { transform: [{ translateX: -NX * d }, { translateY: -NY * d }, { rotate: `${-fly.get() * 9}deg` }, { scale: pulse.get() }] };
  });
  const rightStyle = useAnimatedStyle(() => {
    const d = crack.get() * 8 + fly.get() * w * 1.1;
    return { transform: [{ translateX: NX * d }, { translateY: NY * d }, { rotate: `${fly.get() * 9}deg` }, { scale: pulse.get() }] };
  });

  if (reduceMotion || done) return null;

  const layer = (id: string, clip: string) => (
    <Svg width={w} height={h}>
      <Defs>
        <ClipPath id={id}>
          <Path d={clip} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Rect x={-w} y={-h} width={w * 3} height={h * 3} fill={BRAND} />
        <Coin cx={w / 2} cy={h / 2} />
      </G>
    </Svg>
  );

  return (
    <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, leftStyle]}>{layer('intro-left', left)}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, rightStyle]}>{layer('intro-right', right)}</Animated.View>
    </Animated.View>
  );
}
