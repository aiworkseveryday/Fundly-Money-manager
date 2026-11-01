import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { AppText } from '@/components/AppText';
import { Button3D } from '@/components/Button3D';
import { Confetti } from '@/components/Confetti';
import { Mascot } from '@/components/Mascot';
import { qk } from '@/data/hooks';
import type { Profile } from '@/data/types';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme/ThemeProvider';
import { palette, radius, space } from '@/theme/tokens';
import { applyActivity, type ActivityResult, type XpEvent } from './engine';

type RewardFn = (event: XpEvent) => Promise<void>;
const RewardContext = createContext<RewardFn | null>(null);

/** Grants XP for an action, persists streak/badges, and pops a celebration when something new happens. */
export function CelebrationProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { colors } = useTheme();
  const [shown, setShown] = useState<(ActivityResult & { streak: number }) | null>(null);

  const reward = useCallback<RewardFn>(
    async (event) => {
      let profile = qc.getQueryData<Profile>(qk('profile'));
      if (!profile) {
        const { data } = await supabase.from('profiles').select('*').single();
        if (!data) return;
        profile = data as Profile;
      }
      const result = applyActivity(profile, event);
      qc.setQueryData(qk('profile'), { ...profile, ...result.patch });
      await supabase.from('profiles').update(result.patch).eq('id', profile.id);

      if (result.newBadges.length || result.streakIncreased) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShown({ ...result, streak: result.patch.streak_count });
      }
    },
    [qc],
  );

  const badge = shown?.newBadges[0];

  return (
    <RewardContext.Provider value={reward}>
      {children}
      <Modal visible={!!shown} transparent animationType="fade" onRequestClose={() => setShown(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Mascot mood="celebrate" size={130} />
            {badge ? (
              <>
                <AppText variant="caption" upper color={palette.purple}>
                  New badge unlocked
                </AppText>
                <AppText style={{ fontSize: 56, lineHeight: 64 }}>{badge.emoji}</AppText>
                <AppText variant="title" center>
                  {badge.title}
                </AppText>
                <AppText muted center>
                  {badge.description}
                </AppText>
              </>
            ) : (
              <>
                <AppText style={{ fontSize: 56, lineHeight: 64 }}>🔥</AppText>
                <AppText variant="title" center color={colors.streak}>
                  {shown?.streak} day streak!
                </AppText>
                <AppText muted center>
                  {shown?.streak === 1 ? 'Day one. Come back tomorrow to keep it going!' : 'You logged money again today. Keep the fire alive!'}
                </AppText>
              </>
            )}
            <View style={[styles.xpPill, { backgroundColor: colors.xp }]}>
              <AppText variant="label" color="#7A5A00">
                +{shown?.xpGained} XP
              </AppText>
            </View>
            <Button3D title="Continue" onPress={() => setShown(null)} style={{ alignSelf: 'stretch' }} />
          </View>
          {shown && <Confetti key={String(shown.patch.xp)} />}
        </View>
      </Modal>
    </RewardContext.Provider>
  );
}

export function useReward() {
  const ctx = useContext(RewardContext);
  if (!ctx) throw new Error('useReward must be used inside CelebrationProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: space.xl },
  sheet: { borderRadius: radius.lg, borderWidth: 2, padding: space.xl, alignItems: 'center', gap: space.sm },
  xpPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: radius.pill, marginVertical: space.sm },
});
