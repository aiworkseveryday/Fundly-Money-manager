import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'home' | 'activity' | 'insights' | 'goals' | 'more';

type Props = { name: TabIconName; color: string; focused: boolean; size?: number };

/**
 * Hand-drawn SVG tab icons. Focused = solid shape in the tab's colour with white details;
 * unfocused = outline only. SVG needs no icon font, so it always renders.
 */
export function TabIcon({ name, color, focused, size = 26 }: Props) {
  const stroke = focused ? 'none' : color;
  const fill = focused ? color : 'none';
  const detail = focused ? '#FFFFFF' : color;
  const sw = 2.2;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && (
        <>
          <Path
            d="M3.5 10.6 L12 3.6 L20.5 10.6 V19.4 A1.6 1.6 0 0 1 18.9 21 H5.1 A1.6 1.6 0 0 1 3.5 19.4 Z"
            fill={fill}
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Rect x="9.5" y="13.5" width="5" height="7.5" rx="1.4" fill={focused ? '#FFFFFF' : 'none'} stroke={detail} strokeWidth={focused ? 0 : sw} />
        </>
      )}

      {name === 'activity' && (
        <>
          <Rect x="4" y="3" width="16" height="18" rx="3.5" fill={fill} stroke={stroke} strokeWidth={sw} />
          {[8, 12, 16].map((y) => (
            <Path key={y} d={`M8 ${y} H16`} stroke={detail} strokeWidth={sw} strokeLinecap="round" />
          ))}
        </>
      )}

      {name === 'insights' && (
        <>
          <Rect x="3.5" y="12" width="4.5" height="9" rx="1.6" fill={fill} stroke={stroke} strokeWidth={sw} />
          <Rect x="9.75" y="4" width="4.5" height="17" rx="1.6" fill={fill} stroke={stroke} strokeWidth={sw} />
          <Rect x="16" y="8.5" width="4.5" height="12.5" rx="1.6" fill={fill} stroke={stroke} strokeWidth={sw} />
        </>
      )}

      {name === 'goals' && (
        <>
          <Circle cx="12" cy="12" r="9" fill={fill} stroke={stroke} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="5" fill="none" stroke={detail} strokeWidth={sw} />
          <Circle cx="12" cy="12" r="1.8" fill={detail} />
        </>
      )}

      {name === 'more' && (
        <>
          {[
            [3.5, 3.5],
            [13, 3.5],
            [3.5, 13],
            [13, 13],
          ].map(([x, y]) => (
            <Rect key={`${x}-${y}`} x={x} y={y} width="7.5" height="7.5" rx="2.2" fill={fill} stroke={stroke} strokeWidth={sw} />
          ))}
        </>
      )}
    </Svg>
  );
}
