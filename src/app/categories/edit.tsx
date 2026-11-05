import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button3D } from '@/components/Button3D';
import { ColorPicker, IconPicker } from '@/components/ColorPicker';
import { Header, IconBubble } from '@/components/bits';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { CATEGORY_ICONS } from '@/data/constants';
import { useCategories, useDeleteCategory, useSaveCategory } from '@/data/hooks';
import type { CategoryKind } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';
import { palette } from '@/theme/tokens';

export default function EditCategory() {
  const params = useLocalSearchParams<{ id?: string; kind?: CategoryKind }>();
  const { colors } = useTheme();
  const category = useCategories().data?.find((c) => c.id === params.id);
  const save = useSaveCategory();
  const remove = useDeleteCategory();

  const kind: CategoryKind = category?.kind ?? (params.kind === 'income' ? 'income' : 'expense');
  const [name, setName] = useState(category?.name ?? '');
  const [icon, setIcon] = useState(category?.icon ?? 'tag');
  const [color, setColor] = useState(category?.color ?? palette.blue);

  const onSave = async () => {
    try {
      await save.mutateAsync({ id: params.id, name: name.trim(), kind, icon, color });
      router.back();
    } catch (e) {
      const msg = (e as Error).message;
      Alert.alert('Could not save', msg.includes('duplicate') ? 'A category with that name already exists.' : msg);
    }
  };

  const onDelete = () =>
    Alert.alert('Delete category?', 'Transactions in it become uncategorised.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(params.id!);
          router.back();
        },
      },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Header title={params.id ? 'Edit category' : `New ${kind} category`} close />
      <Screen
        edges={['bottom']}
        contentStyle={{ paddingTop: 0 }}
        footer={<Button3D title="Save" onPress={onSave} disabled={!name.trim()} loading={save.isPending} />}>
        <View style={{ alignItems: 'center' }}>
          <IconBubble icon={icon} color={color} size={72} />
        </View>
        <Input label="Name" placeholder="e.g. Chai & snacks" value={name} onChangeText={setName} maxLength={30} />
        <ColorPicker value={color} onChange={setColor} />
        <IconPicker icons={CATEGORY_ICONS} value={icon} color={color} onChange={setIcon} />
        {params.id && <Button3D title="Delete category" tone="ghost" onPress={onDelete} />}
      </Screen>
    </View>
  );
}
