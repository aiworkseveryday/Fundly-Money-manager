import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COLORS = ['#58CC02', '#1CB0F6', '#FF9600', '#FF4B4B', '#CE82FF', '#FFC800'];

/** Deterministic pseudo-random in [0, 1) so renders stay pure. */
function rand(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function Piece({ seed, x, delay, color, height }: { seed: number; x: number; delay: number; color: string; height: number }) {
  const t = useSharedValue(0);
  const drift = (rand(seed + 0.1) - 0.5) * 160;
  const spin = 360 + rand(seed + 0.2) * 720;
  const size = 8 + rand(seed + 0.3) * 8;

  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }));
  }, [delay, t]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value * 0.8,
    transform: [
      { translateX: x + drift * t.value },
      { translateY: -40 + t.value * (height + 80) },
      { rotate: `${spin * t.value}deg` },
    ],
  }));

  return <Animated.View style={[styles.piece, { width: size, height: size * 0.6, backgroundColor: color }, style]} />;
}

/** One-shot confetti burst covering the screen. Remount (change key) to replay. */
export function Confetti({ count = 60 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        x: rand(i + 1) * width,
        delay: rand(i + 0.5) * 400,
        color: COLORS[i % COLORS.length],
      })),
    [count, width],
  );
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p) => (
        <Piece key={p.id} seed={p.id + 1} x={p.x} delay={p.delay} color={p.color} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', top: 0, left: 0, borderRadius: 2 },
});
