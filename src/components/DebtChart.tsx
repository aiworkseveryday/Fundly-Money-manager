import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { addMonths, formatMonth } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';
import { AppText } from './AppText';

const HEIGHT = 150;
const PAD_Y = 8;

/**
 * "Total owed" month by month, from today to debt-free. One series, so no legend; touch and drag
 * to read any month. Point 0 is today; point i is the balance after the i-th EMI, paid in
 * `firstEmi` + (i - 1) months.
 */
export function DebtChart({ values, firstEmi = new Date() }: { values: number[]; firstEmi?: Date }) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const n = values.length;

  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * width);
  const y = (v: number) => PAD_Y + (1 - v / max) * (HEIGHT - PAD_Y * 2);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${HEIGHT} L0,${HEIGHT} Z`;

  const pick = (e: GestureResponderEvent) => {
    if (!width || n < 2) return;
    const i = Math.round((Math.min(Math.max(e.nativeEvent.locationX, 0), width) / width) * (n - 1));
    setActive(i);
  };

  const shown = active ?? 0;

  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.readout}>
        <AppText variant="caption" muted>
          {!shown ? 'Today' : `After ${formatMonth(addMonths(firstEmi, shown - 1))} EMI`}
        </AppText>
        <AppText variant="label">{formatINR(Math.round(values[shown] ?? 0))} owed</AppText>
      </View>
      <View
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: HEIGHT }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setActive(null)}
        accessibilityLabel={`Total owed goes from ${formatINR(Math.round(values[0] ?? 0))} today to zero in ${n - 1} EMIs`}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {[0.25, 0.5, 0.75].map((f) => (
              <Line key={f} x1={0} x2={width} y1={y(max * f)} y2={y(max * f)} stroke={colors.border} strokeWidth={1} />
            ))}
            <Path d={area} fill={colors.info} fillOpacity={0.12} />
            <Path d={line} stroke={colors.info} strokeWidth={2} fill="none" strokeLinejoin="round" />
            {active != null && (
              <>
                <Line x1={x(active)} x2={x(active)} y1={0} y2={HEIGHT} stroke={colors.textMuted} strokeWidth={1} />
                <Circle cx={x(active)} cy={y(values[active])} r={5} fill={colors.info} stroke={colors.surface} strokeWidth={2} />
              </>
            )}
          </Svg>
        )}
      </View>
      <View style={styles.axis}>
        <AppText variant="caption" muted>
          Today
        </AppText>
        <AppText variant="caption" muted>
          Last EMI {formatMonth(addMonths(firstEmi, Math.max(0, n - 2)))}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
});
