import { useEffect } from 'react';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

export type Mood = 'happy' | 'worried' | 'celebrate' | 'sleepy';

/** Fundy: a round green piggy bank with a coin slot. */
export function Mascot({ size = 96, mood = 'happy', bounce = true }: { size?: number; mood?: Mood; bounce?: boolean }) {
  const y = useSharedValue(0);

  useEffect(() => {
    if (!bounce) return;
    const height = mood === 'celebrate' ? -14 : -5;
    const speed = mood === 'celebrate' ? 260 : 900;
    y.value = withRepeat(withSequence(withTiming(height, { duration: speed }), withTiming(0, { duration: speed })), -1);
  }, [bounce, mood, y]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  const body = '#58CC02';
  const belly = '#89E219';
  const dark = '#3C7A00';

  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* legs */}
        <Rect x="26" y="74" width="12" height="16" rx="5" fill={dark} />
        <Rect x="62" y="74" width="12" height="16" rx="5" fill={dark} />
        {/* ears */}
        <Path d="M24 30 L30 12 L42 26 Z" fill={dark} />
        <Path d="M76 30 L70 12 L58 26 Z" fill={dark} />
        {/* body */}
        <Ellipse cx="50" cy="52" rx="38" ry="32" fill={body} />
        <Ellipse cx="50" cy="60" rx="26" ry="18" fill={belly} />
        {/* coin slot + gold ₹ coin (same as the app icon) */}
        <Rect x="40" y="20" width="20" height="5" rx="2.5" fill={dark} />
        <Circle cx="50" cy="10" r="9.5" fill="#FFC800" stroke="#E5A100" strokeWidth="2" />
        <Path
          d="M46.2 5.8 H53.8 M46.2 8.8 H53.8 M46.2 5.8 H48.8 C52.6 5.8 52.6 11.8 48.8 11.8 H46.4 L52.6 16"
          stroke="#9A6A00"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* eyes */}
        {mood === 'sleepy' ? (
          <>
            <Path d="M30 44 q6 5 12 0" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <Path d="M58 44 q6 5 12 0" stroke="#fff" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <Circle cx="36" cy="42" r="9" fill="#fff" />
            <Circle cx="64" cy="42" r="9" fill="#fff" />
            <Circle cx={mood === 'worried' ? 35 : 38} cy={mood === 'worried' ? 44 : 43} r="4.5" fill="#3C3C3C" />
            <Circle cx={mood === 'worried' ? 63 : 66} cy={mood === 'worried' ? 44 : 43} r="4.5" fill="#3C3C3C" />
          </>
        )}
        {mood === 'worried' && (
          <>
            <Path d="M27 31 L43 35" stroke={dark} strokeWidth="3" strokeLinecap="round" />
            <Path d="M73 31 L57 35" stroke={dark} strokeWidth="3" strokeLinecap="round" />
          </>
        )}
        {/* snout */}
        <Ellipse cx="50" cy="56" rx="11" ry="8" fill="#FF86D0" />
        <Circle cx="46" cy="56" r="2.2" fill="#C2408F" />
        <Circle cx="54" cy="56" r="2.2" fill="#C2408F" />
        {/* mouth */}
        {mood === 'worried' ? (
          <Path d="M42 71 q8 -6 16 0" stroke={dark} strokeWidth="3" fill="none" strokeLinecap="round" />
        ) : (
          <Path d="M40 67 q10 9 20 0" stroke={dark} strokeWidth="3" fill="none" strokeLinecap="round" />
        )}
        {/* cheeks */}
        <Circle cx="24" cy="58" r="5" fill="#FF86D0" opacity={0.5} />
        <Circle cx="76" cy="58" r="5" fill="#FF86D0" opacity={0.5} />
      </Svg>
    </Animated.View>
  );
}
