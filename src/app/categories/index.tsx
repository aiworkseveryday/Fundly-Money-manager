import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button3D } from '@/components/Button3D';
import { Card } from '@/components/Card';
import { Header, ListRow, Segmented } from '@/components/bits';
import { Screen } from '@/components/Screen';
import { useCategories } from '@/data/hooks';
import type { CategoryKind } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';
import { space } from '@/theme/tokens';

export default function Categories() {
  const { colors } = useTheme();
  const [kind, setKind] = useState<CategoryKind>('expense');
  const categories = (useCategories().data ?? []).filter((c) => c.kind === kind);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header
        title="Categories"
        right={<Button3D title="Add" icon="plus" small onPress={() => router.push({ pathname: '/categories/edit', params: { kind } })} />}
      />
      <Screen edges={['bottom']} contentStyle={{ paddingTop: 0 }}>
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'expense', label: 'Expense', color: colors.expense },
            { value: 'income', label: 'Income', color: colors.income },
          ]}
        />
        <Card style={{ paddingVertical: space.sm }}>
          {categories.map((c) => (
            <ListRow key={c.id} icon={c.icon} color={c.color} title={c.name} onPress={() => router.push({ pathname: '/categories/edit', params: { id: c.id } })} />
          ))}
        </Card>
      </Screen>
    </View>
  );
}
