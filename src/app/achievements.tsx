import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { Header } from '@/components/bits';
import { Mascot } from '@/components/Mascot';
import { ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { useProfile } from '@/data/hooks';
import { BADGES, levelFor, liveStreak } from '@/gamification/engine';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, space } from '@/theme/tokens';

export default function Achievements() {
  const { colors } = useTheme();
  const profile = useProfile().data;
  const xp = profile?.xp ?? 0;
  const level = levelFor(xp);
  const streak = profile ? liveStreak(profile) : 0;
  const owned = new Set(profile?.badges ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title="Achievements" />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }}>
        <View style={{ alignItems: 'center', gap: space.xs }}>
          <Mascot size={120} mood={streak ? 'celebrate' : 'happy'} />
          <AppText variant="title">Level {level.level}</AppText>
          <AppText muted>{xp} XP total</AppText>
        </View>

        <Card style={{ gap: space.sm }}>
          <View style={styles.between}>
            <AppText variant="label">Next level</AppText>
            <AppText variant="caption" muted>
              {level.intoLevel} / {level.levelSize} XP
            </AppText>
          </View>
          <ProgressBar progress={level.intoLevel / level.levelSize} color={palette.yellow} />
        </Card>

        <View style={styles.statRow}>
          <Card style={styles.stat}>
            <MaterialCommunityIcons name="fire" size={34} color={streak ? colors.streak : colors.tabInactive} />
            <AppText variant="title">{streak}</AppText>
            <AppText variant="caption" muted>
              Day streak
            </AppText>
          </Card>
          <Card style={styles.stat}>
            <MaterialCommunityIcons name="crown" size={34} color={palette.yellow} />
            <AppText variant="title">{profile?.longest_streak ?? 0}</AppText>
            <AppText variant="caption" muted>
              Best streak
            </AppText>
          </Card>
        </View>

        <AppText variant="heading">Badges</AppText>
        <View style={styles.grid}>
          {BADGES.map((b) => {
            const has = owned.has(b.id);
            return (
              <View key={b.id} style={[styles.badge, { borderColor: colors.border, opacity: has ? 1 : 0.45 }]}>
                <AppText style={{ fontSize: 36, lineHeight: 44 }}>{has ? b.emoji : '🔒'}</AppText>
                <AppText variant="label" center>
                  {b.title}
                </AppText>
                <AppText variant="caption" muted center>
                  {b.description}
                </AppText>
              </View>
            );
          })}
        </View>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between' },
  statRow: { flexDirection: 'row', gap: space.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  badge: { width: '47%', borderWidth: 2, borderBottomWidth: 4, borderRadius: radius.lg, padding: space.md, alignItems: 'center', gap: 4 },
});
