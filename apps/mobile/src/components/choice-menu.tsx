import { Text, View } from 'react-native';
import { MenuView } from '@expo/ui/community/menu';
import { ChevronDown, type LucideIcon } from 'lucide-react-native';
import { useCollection } from '../state/collection';

export function ChoiceMenu<T extends string>({
  label,
  value,
  options,
  onSelect,
  icon: Icon,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onSelect: (value: T) => void;
  icon?: LucideIcon;
}) {
  const { colors, dark } = useCollection();
  const selected = options.find((option) => option.value === value);
  return (
    <MenuView
      colorScheme={dark ? 'dark' : 'light'}
      actions={options.map((option) => ({
        id: option.value,
        title: option.label,
        titleColor: colors.ink,
        state: option.value === value ? 'on' : 'off',
      }))}
      onPressAction={({ nativeEvent }) => {
        const option = options.find((option) => option.value === nativeEvent.event);
        if (option) onSelect(option.value);
      }}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label || ''}`}
        accessibilityHint="Opens choices"
        style={{
          minHeight: 44,
          paddingHorizontal: 4,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 9,
        }}
      >
        {Icon && <Icon size={17} strokeWidth={1.6} color={colors.muted} />}
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{ fontSize: 15, color: colors.ink, flexShrink: 1 }}
        >
          {selected?.label}
        </Text>
        <ChevronDown size={13} color={colors.muted} />
      </View>
    </MenuView>
  );
}
