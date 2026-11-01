import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { ReactNode } from 'react';

import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';

/** green under 75%, orange up to 100%, red when over */
export function budgetColor(ratio: number) {
  if (ratio > 1) return palette.red;
  if (ratio >= 0.75) return palette.orange;
  return palette.green;
}

type RingProps = {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: ReactNode;
};

export function ProgressRing({ progress, size = 72, stroke = 9, color, children }: RingProps) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? colors.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ progress, color, height = 16 }: { progress: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  return (
    <View style={[styles.track, { height, backgroundColor: colors.border }]}>
      {pct > 0 && (
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color ?? colors.primary }]}>
          {/* glossy highlight, like a candy bar */}
          <View style={styles.shine} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: 999, overflow: 'hidden', width: '100%' },
  fill: { height: '100%', borderRadius: 999, minWidth: 16 },
  shine: {
    position: 'absolute',
    top: 3,
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
