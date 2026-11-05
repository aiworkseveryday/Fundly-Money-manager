import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { BarChart, PieChart } from 'react-native-gifted-charts';

import { AppText } from '@/components/AppText';
import { Card } from '@/components/Card';
import { EmptyState, IconBubble, SectionTitle } from '@/components/bits';
import { Mascot } from '@/components/Mascot';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { ProgressBar } from '@/components/Progress';
import { Screen } from '@/components/Screen';
import { useCategories, useInvalidate, useMonthlySpend, useTransactions } from '@/data/hooks';
import type { Category } from '@/data/types';
import { analyseOther } from '@/insights/other';
import { addMonths, daysBetween, formatMonth, fromISODate, monthKey, startOfMonth } from '@/lib/dates';
import { formatINR } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { fonts, palette, radius, space } from '@/theme/tokens';

// Blue/orange pair passes colour-blind separation; green/red does not.
const INCOME_COLOR = palette.blue;
const EXPENSE_COLOR = palette.orange;
const MAX_SLICES = 6;

export default function Insights() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const invalidate = useInvalidate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  const monthly = useMonthlySpend(6);
  const categories = useCategories();
  const monthTx = useTransactions({ from: month, to: addMonths(month, 1) });
  const prevTx = useTransactions({ from: addMonths(month, -1), to: month });
  const other = analyseOther(monthTx.data ?? [], prevTx.data ?? []);

  const catById = new Map<string, Category>((categories.data ?? []).map((c) => [c.id, c]));
  const rows = monthly.data ?? [];
  const key = monthKey(month);
  const prevKey = monthKey(addMonths(month, -1));

  // ---- category breakdown for the selected month
  const byCat = rows
    .filter((r) => r.month === key && r.kind === 'expense')
    .map((r) => ({ ...r, cat: r.category_id ? catById.get(r.category_id) : undefined }))
    .sort((a, b) => b.total - a.total);
  const totalSpent = byCat.reduce((s, r) => s + r.total, 0);
  const top = byCat.slice(0, MAX_SLICES - 1);
  const rest = byCat.slice(MAX_SLICES - 1);
  const slices = [
    ...top.map((r) => ({ label: r.cat?.name ?? 'Uncategorised', icon: r.cat?.icon ?? 'help', color: r.cat?.color ?? '#AFAFAF', total: r.total })),
    ...(rest.length ? [{ label: 'Other', icon: 'dots-horizontal', color: '#AFAFAF', total: rest.reduce((s, r) => s + r.total, 0) }] : []),
  ];

  // ---- 6-month trend
  const months = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(new Date()), i - 5));
  const trend = months.map((m) => {
    const k = monthKey(m);
    const sum = (kind: 'income' | 'expense') => rows.filter((r) => r.month === k && r.kind === kind).reduce((s, r) => s + r.total, 0);
    return { key: k, label: formatMonth(m, false), income: sum('income'), expense: sum('expense') };
  });
  const chartWidth = width - space.lg * 2 - space.lg * 2 - 50;
  // 6 months x (2 bars + 2px gap + 1.4-bar spacing) plus the edge spacing must fit, or Nov gets cut off
  const barWidth = Math.max(6, Math.min(18, (chartWidth - 16 - 6 * 2) / (6 * 3.4)));
  const barData = trend.flatMap((t) => [
    {
      value: t.income,
      frontColor: INCOME_COLOR,
      spacing: 2,
      label: t.label,
      labelWidth: barWidth * 2 + 2,
      labelTextStyle: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11 },
      onPress: () => setSelectedBar(t.key),
    },
    { value: t.expense, frontColor: EXPENSE_COLOR, onPress: () => setSelectedBar(t.key) },
  ]);
  const hasTrend = trend.some((t) => t.income || t.expense);
  const selected = trend.find((t) => t.key === (selectedBar ?? key)) ?? trend[trend.length - 1];

  // ---- plain-language insights
  const tips: { icon: string; color: string; text: string }[] = [];
  const prevByCat = new Map(rows.filter((r) => r.month === prevKey && r.kind === 'expense').map((r) => [r.category_id, r.total]));
  const movers = byCat
    .map((r) => ({ name: r.cat?.name ?? 'Uncategorised', now: r.total, prev: prevByCat.get(r.category_id) ?? 0 }))
    .filter((m) => m.prev > 0 && Math.abs(m.now - m.prev) / m.prev >= 0.2 && Math.abs(m.now - m.prev) >= 200)
    .sort((a, b) => Math.abs(b.now - b.prev) - Math.abs(a.now - a.prev));
  for (const m of movers.slice(0, 2)) {
    const pct = Math.round(((m.now - m.prev) / m.prev) * 100);
    tips.push(
      pct > 0
        ? { icon: 'trending-up', color: colors.warning, text: `${m.name} is up ${pct}% vs ${formatMonth(addMonths(month, -1), false)} (${formatINR(m.now - m.prev)} more).` }
        : { icon: 'trending-down', color: colors.income, text: `${m.name} is down ${-pct}% vs last month. Nice saving!` },
    );
  }
  const isCurrentMonth = key === monthKey(new Date());
  const daysElapsed = isCurrentMonth ? daysBetween(month, new Date()) + 1 : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  if (totalSpent > 0) tips.push({ icon: 'calendar-clock', color: colors.info, text: `You spend about ${formatINR(Math.round(totalSpent / daysElapsed))} per day this month.` });
  const monthIncome = rows.filter((r) => r.month === key && r.kind === 'income').reduce((s, r) => s + r.total, 0);
  if (monthIncome > 0) {
    const rate = Math.round(((monthIncome - totalSpent) / monthIncome) * 100);
    tips.push(
      rate >= 0
        ? { icon: 'piggy-bank', color: colors.income, text: `Savings rate: ${rate}% of your income is still with you.` }
        : { icon: 'alert', color: colors.danger, text: `You've spent ${-rate}% more than you earned this month.` },
    );
  }
  const biggest = (monthTx.data ?? []).filter((t) => t.kind === 'expense').sort((a, b) => b.amount - a.amount)[0];
  if (biggest) {
    tips.push({
      icon: 'cash-multiple',
      color: palette.purple,
      text: `Biggest expense: ${formatINR(biggest.amount)} on ${biggest.note || biggest.category?.name || 'something'}.`,
    });
  }

  return (
    <Screen refreshing={monthly.isRefetching} onRefresh={invalidate}>
      <AppText variant="title">Insights</AppText>
      <MonthSwitcher month={month} onChange={setMonth} />

      {/* where the money went */}
      <SectionTitle title="Where your money went" />
      {totalSpent > 0 ? (
        <Card style={{ gap: space.lg }}>
          <View style={{ alignItems: 'center' }}>
            <PieChart
              donut
              data={slices.map((s) => ({ value: s.total, color: s.color }))}
              radius={100}
              innerRadius={66}
              innerCircleColor={colors.surface}
              strokeWidth={2}
              strokeColor={colors.surface}
              centerLabelComponent={() => (
                <View style={{ alignItems: 'center' }}>
                  <AppText variant="caption" muted>
                    Spent
                  </AppText>
                  <AppText variant="heading">{formatINR(totalSpent, { compact: true })}</AppText>
                </View>
              )}
            />
          </View>
          {/* legend + table: identity is never colour-only */}
          <View style={{ gap: space.md }}>
            {slices.map((s) => (
              <View key={s.label} style={styles.legendRow}>
                <IconBubble icon={s.icon} color={s.color} size={34} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.legendTop}>
                    <AppText variant="label" numberOfLines={1} style={{ flex: 1 }}>
                      {s.label}
                    </AppText>
                    <AppText variant="label">{formatINR(s.total)}</AppText>
                  </View>
                  <View style={styles.legendTop}>
                    <View style={{ flex: 1 }}>
                      <ProgressBar progress={s.total / totalSpent} color={s.color} height={8} />
                    </View>
                    <AppText variant="caption" muted style={{ width: 40, textAlign: 'right' }}>
                      {Math.round((s.total / totalSpent) * 100)}%
                    </AppText>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : (
        !monthly.isLoading && <EmptyState title="Nothing spent yet" subtitle={`No expenses in ${formatMonth(month)}.`} mood="sleepy" />
      )}

      {/* tips */}
      {!!tips.length && (
        <>
          <SectionTitle title="Fundy noticed" />
          <View style={styles.tipHeader}>
            <Mascot size={56} bounce={false} />
            <View style={{ flex: 1, gap: space.sm }}>
              {tips.map((t) => (
                <View key={t.text} style={[styles.tip, { borderColor: colors.border }]}>
                  <MaterialCommunityIcons name={t.icon as never} size={22} color={t.color} />
                  <AppText variant="caption" style={{ flex: 1 }}>
                    {t.text}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* what went under Other */}
      <SectionTitle title="Spends under Other" />
      {other.total > 0 ? (
        <Card style={{ gap: space.sm }}>
          <AppText>
            <AppText variant="label">{formatINR(other.total)}</AppText> went under Other this month ({Math.round(other.share * 100)}% of spends)
            {other.prevTotal > 0
              ? `, ${other.total >= other.prevTotal ? 'up' : 'down'} from ${formatINR(other.prevTotal)} last month.`
              : '.'}
          </AppText>
          {other.groups.slice(0, 6).map((g) => (
            <View key={g.label} style={styles.otherRow}>
              <AppText variant="label" style={{ flex: 1 }} numberOfLines={1}>
                {g.label}
                {g.isNew && (
                  <AppText variant="caption" color={colors.info}>
                    {'  '}NEW
                  </AppText>
                )}
              </AppText>
              <AppText variant="caption" muted>
                {g.count}×{'  '}
              </AppText>
              <AppText variant="label">{formatINR(g.total)}</AppText>
            </View>
          ))}
          {other.suggestions.map((g) => (
            <View key={`s-${g.label}`} style={[styles.tip, { borderColor: colors.border }]}>
              <MaterialCommunityIcons name="lightbulb-on-outline" size={22} color={palette.yellowEdge} />
              <AppText variant="caption" style={{ flex: 1 }}>
                {g.count > 1
                  ? `"${g.label}" came up ${g.count} times (${formatINR(g.total)}). If it's a regular thing, give it its own category or add it to your monthly plan.`
                  : `"${g.label}" was a big one-off (${formatINR(g.total)}). Plan for it next time, or keep it in Miscellaneous.`}
              </AppText>
            </View>
          ))}
          {other.unnamed > 0 && (
            <AppText variant="caption" muted>
              {other.unnamed} spend{other.unnamed > 1 ? 's have' : ' has'} no note. Add a note when you log so Fundy can spot patterns.
            </AppText>
          )}
        </Card>
      ) : (
        <Card>
          <AppText muted>Nothing under Other this month. Everything has a home 🎉</AppText>
        </Card>
      )}

      {/* trend */}
      <SectionTitle title="Last 6 months" />
      {hasTrend ? (
        <Card style={{ gap: space.md }}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: INCOME_COLOR }]} />
              <AppText variant="caption">Income</AppText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: EXPENSE_COLOR }]} />
              <AppText variant="caption">Spent</AppText>
            </View>
          </View>
          <BarChart
            data={barData}
            barWidth={barWidth}
            spacing={barWidth * 1.4}
            initialSpacing={8}
            barBorderTopLeftRadius={4}
            barBorderTopRightRadius={4}
            noOfSections={4}
            height={170}
            width={chartWidth}
            endSpacing={8}
            yAxisThickness={0}
            xAxisThickness={2}
            xAxisColor={colors.border}
            rulesColor={colors.border}
            rulesType="dashed"
            yAxisTextStyle={{ color: colors.textMuted, fontFamily: fonts.bold, fontSize: 10 }}
            formatYLabel={(v) => formatINR(Number(v), { compact: true })}
            yAxisLabelWidth={44}
            disableScroll
          />
          {/* tap a month to see exact numbers */}
          <View style={styles.monthPicker}>
            {trend.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setSelectedBar(t.key)}
                style={[styles.monthPill, { borderColor: selected.key === t.key ? colors.info : colors.border }]}>
                <AppText variant="caption" color={selected.key === t.key ? colors.info : colors.textMuted}>
                  {t.label}
                </AppText>
              </Pressable>
            ))}
          </View>
          <View style={[styles.detail, { backgroundColor: colors.surfaceAlt }]}>
            <AppText variant="label">{formatMonth(fromISODate(selected.key))}</AppText>
            <View style={styles.legendTop}>
              <AppText variant="caption" muted>
                Income
              </AppText>
              <AppText variant="label">{formatINR(selected.income)}</AppText>
            </View>
            <View style={styles.legendTop}>
              <AppText variant="caption" muted>
                Spent
              </AppText>
              <AppText variant="label">{formatINR(selected.expense)}</AppText>
            </View>
            <View style={styles.legendTop}>
              <AppText variant="caption" muted>
                Saved
              </AppText>
              <AppText variant="label" color={selected.income - selected.expense >= 0 ? colors.income : colors.danger}>
                {formatINR(selected.income - selected.expense, { signed: true })}
              </AppText>
            </View>
          </View>
        </Card>
      ) : (
        !monthly.isLoading && <EmptyState title="No history yet" subtitle="Your monthly trend appears after you log a few transactions." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  otherRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  legendTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  tipHeader: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 2, borderRadius: radius.md, padding: space.md },
  legend: { flexDirection: 'row', gap: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  monthPicker: { flexDirection: 'row', justifyContent: 'space-between' },
  monthPill: { borderWidth: 2, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  detail: { borderRadius: radius.md, padding: space.md, gap: 4 },
});
