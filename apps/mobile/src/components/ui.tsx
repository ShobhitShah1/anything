import type { ReactNode, Ref } from 'react';
import {
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';
import { padding as composePadding } from '@expo/ui/jetpack-compose/modifiers';
import { padding as swiftPadding } from '@expo/ui/swift-ui/modifiers';
import { Host, Column, ListItem, Text as NativeText } from '@expo/ui';
import type { ListItemProps } from '@expo/ui';
import Svg, { Path } from 'react-native-svg';
import { ArrowLeft, Search, X, type LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCollection } from '../state/collection';
import { fonts, radius } from '../theme';

export function HeaderBackTitle({ title }: { title: string }) {
  const { colors } = useCollection();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: 240 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        hitSlop={{ left: 10, right: 10 }}
        style={{ width: 24, height: 44, alignItems: 'center', justifyContent: 'center' }}
      >
        <ArrowLeft size={21} color={colors.ink} strokeWidth={1.7} />
      </Pressable>
      <Text
        allowFontScaling={false}
        accessibilityRole="header"
        numberOfLines={1}
        style={{
          flexShrink: 1,
          color: colors.ink,
          fontSize: 18,
          fontWeight: '500',
          lineHeight: 24,
          includeFontPadding: false,
        }}
      >
        {title}
      </Text>
    </View>
  );
}
export function Action({
  title,
  onPress,
  secondary,
  disabled,
  icon: Icon,
  leading,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  leading?: ReactNode;
}) {
  const { colors } = useCollection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 52,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        flexDirection: 'row',
        gap: 9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: secondary ? colors.soft : colors.ink,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {leading || (Icon && <Icon size={18} color={secondary ? colors.ink : colors.canvas} />)}
      <Text
        allowFontScaling={false}
        style={{
          color: secondary ? colors.ink : colors.canvas,
          fontSize: 15,
          fontWeight: '600',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function IconButton({
  label,
  icon: Icon,
  onPress,
  active,
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useCollection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 44,
        minHeight: 44,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: active ? colors.soft : 'transparent',
      }}
    >
      <Icon size={20} color={active ? colors.ink : colors.muted} strokeWidth={1.7} />
    </Pressable>
  );
}
export function CollectionSearch({
  value,
  onChangeText,
  label,
  placeholder,
  trailing,
}: {
  value: string;
  onChangeText: (value: string) => void;
  label: string;
  placeholder: string;
  trailing?: ReactNode;
}) {
  const { colors } = useCollection();
  const { width } = useWindowDimensions();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 }}>
      <Search size={22} color={colors.searchPlaceholder} strokeWidth={1.3} />
      <TextInput
        allowFontScaling={false}
        accessibilityLabel={label}
        placeholder={placeholder}
        placeholderTextColor={colors.searchPlaceholder}
        selectionColor={colors.accent}
        autoCapitalize="none"
        autoCorrect={false}
        value={value}
        onChangeText={onChangeText}
        returnKeyType="search"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 52,
          fontFamily: fonts.editorial,
          fontStyle: 'italic',
          fontSize: width < 360 ? 24 : 29,
          letterSpacing: -0.9,
          color: colors.ink,
          paddingVertical: 4,
        }}
      />
      {!!value && <IconButton label="Clear search" icon={X} onPress={() => onChangeText('')} />}
      {trailing}
    </View>
  );
}

export function Field({ ref, ...props }: TextInputProps & { ref?: Ref<TextInputInstance> }) {
  const { colors } = useCollection();
  return (
    <TextInput
      allowFontScaling={false}
      ref={ref}
      placeholderTextColor={colors.muted}
      selectionColor={colors.accent}
      {...props}
      style={[
        {
          color: colors.ink,
          backgroundColor: colors.paper,
          borderRadius: radius.sm,
          padding: 15,
          fontSize: 16,
          minHeight: 50,
        },
        props.style,
      ]}
    />
  );
}
export function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useCollection();
  return (
    <View style={{ gap: 10 }}>
      <Text
        allowFontScaling={false}
        style={{
          color: colors.muted,
          fontSize: 13,
          fontWeight: '600',
          letterSpacing: 0.1,
          marginLeft: 4,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}
export function Chip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
}) {
  const { colors } = useCollection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        paddingHorizontal: 0,
        paddingVertical: 5,
        minHeight: 44,
        justifyContent: 'center',
        borderRadius: radius.pill,
        backgroundColor: 'transparent',
      }}
    >
      <View
        collapsable={false}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 13,
          borderRadius: radius.pill,
          overflow: 'hidden',
          backgroundColor: selected ? colors.ink : 'transparent',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: radius.pill,
            backgroundColor: colors.ink,
            opacity: selected ? 1 : 0,
          }}
        />
        <Text
          allowFontScaling={false}
          style={{
            color: selected ? colors.canvas : colors.muted,
            fontSize: 13,
            fontWeight: selected ? '600' : '400',
          }}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}

export function NativeGroup({ children }: { children: ReactNode }) {
  const { colors, dark } = useCollection();
  return (
    <View style={{ borderRadius: radius.group, overflow: 'hidden', backgroundColor: colors.paper }}>
      <Host
        matchContents={{ vertical: true }}
        colorScheme={dark ? 'dark' : 'light'}
        seedColor={colors.accent}
        style={{ width: '100%' }}
      >
        <Column>{children}</Column>
      </Host>
    </View>
  );
}

export function SettingRow({ children, supportingText, ...props }: ListItemProps) {
  const { colors } = useCollection();
  const { fontScale } = useWindowDimensions();
  const scale = Platform.OS === 'android' ? fontScale : 1;
  return (
    <ListItem
      {...props}
      colors={{
        containerColor: colors.paper,
        contentColor: colors.ink,
        supportingContentColor: colors.muted,
      }}
      supportingText={
        typeof supportingText === 'string' ? (
          <NativeText
            modifiers={
              Platform.OS === 'ios' ? [swiftPadding({ top: 4 })] : [composePadding(0, 4, 0, 0)]
            }
            textStyle={{ fontSize: 13 / scale, lineHeight: 18 / scale, color: colors.muted }}
          >
            {supportingText}
          </NativeText>
        ) : (
          supportingText
        )
      }
    >
      {typeof children === 'string' ? (
        <NativeText textStyle={{ fontSize: 15 / scale, lineHeight: 21 / scale, color: colors.ink }}>
          {children}
        </NativeText>
      ) : (
        children
      )}
    </ListItem>
  );
}

export function GoogleMark() {
  return (
    <Svg
      width={19}
      height={19}
      viewBox="0 0 48 48"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <Path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.86 46.98 24.55Z"
      />
      <Path
        fill="#FBBC05"
        d="M10.53 28.59a14.41 14.41 0 0 1 0-9.18l-7.98-6.19a23.99 23.99 0 0 0 0 21.56l7.98-6.19Z"
      />
      <Path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </Svg>
  );
}
