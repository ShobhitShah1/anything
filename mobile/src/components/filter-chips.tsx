import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { Chip } from './ui';
import { space } from '../theme';

export function FilterChips({
  value,
  onSelect,
  edgeInset,
}: {
  value: string;
  onSelect: (value: string) => void;
  edgeInset: number;
}) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const rects = useRef<Record<string, { x: number; width: number }>>({});
  const [viewportWidth, setViewportWidth] = useState(0);
  const reduced = useReducedMotion();
  const center = useCallback(
    (selected: string, animated = true) => {
      const rect = rects.current[selected];
      if (!rect || !viewportWidth) return;
      scrollRef.current?.scrollTo({
        x: Math.max(0, rect.x + (rect.width - viewportWidth) / 2),
        animated: animated && !reduced,
      });
    },
    [viewportWidth, reduced],
  );
  useEffect(() => center(value), [center, value]);
  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      style={{ marginHorizontal: -edgeInset }}
      showsHorizontalScrollIndicator={false}
      onLayout={({ nativeEvent }) => setViewportWidth(nativeEvent.layout.width)}
      contentContainerStyle={{ gap: 2, paddingHorizontal: space.md + 6 }}
    >
      {(
        [
          ['all', 'All finds'],
          ['pinned', 'Pinned'],
          ['link', 'Links'],
          ['note', 'Notes'],
          ['image', 'Images'],
          ['markdown', 'Markdown'],
          ['code', 'Code'],
          ['secret', 'Secrets'],
        ] as const
      ).map(([id, title]) => (
        <View
          key={id}
          onLayout={({ nativeEvent: { layout } }) => {
            rects.current[id] = { x: layout.x, width: layout.width };
            if (id === value) center(id, false);
          }}
        >
          <Chip
            title={title}
            selected={value === id}
            onPress={() => {
              center(id);
              onSelect(id);
            }}
          />
        </View>
      ))}
    </ScrollView>
  );
}
