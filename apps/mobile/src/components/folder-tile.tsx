import { MenuView } from '@expo/ui/community/menu';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Image from 'react-native-fast-image';
import { MoreHorizontal } from 'lucide-react-native';
import type { Folder as FolderRecord, SavedItem } from '../shared/types';
import { getItemTitle } from '../shared/utils/itemTitle';
import { imageSet, itemImage, itemText } from '../utils/item';
import { useCollection } from '../state/collection';
import { MarkdownContent } from './markdown-content';
import { BrandMark } from './brand-mark';
import { fonts, type } from '../theme';

export function FolderTile({
  folder,
  saves,
  childCount = 0,
  width,
  onPress,
  onRename,
  onDelete,
}: {
  folder: FolderRecord;
  saves: SavedItem[];
  childCount?: number;
  width: number;
  onPress: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { colors, dark } = useCollection();
  const images = saves
    .flatMap((item) =>
      item.type === 'image' ? imageSet(item).map(({ uri }) => uri) : [itemImage(item)],
    )
    .filter((uri): uri is string => !!uri)
    .slice(0, 3);

  const thought = saves.find((item) => item.type !== 'secret');

  return (
    <View style={{ width, marginBottom: 18 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open folder ${folder.name}`}
        onPress={onPress}
      >
        <View style={{ height: 152, marginBottom: 12 }}>
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 12,
              width: 58,
              height: 22,
              borderTopLeftRadius: 10,
              borderTopRightRadius: 10,
              backgroundColor: colors.soft,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 8,
              left: 5,
              right: 5,
              bottom: 4,
              borderRadius: 17,
              backgroundColor: colors.soft,
            }}
          />
          <View
            style={{
              position: 'absolute',
              top: 16,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 18,
              padding: 10,
              backgroundColor: colors.paper,
              borderWidth: 0.5,
              borderColor: colors.line,
              flexDirection: 'row',
              gap: 6,
              overflow: 'hidden',
            }}
          >
            {images.length ? (
              <>
                <Image
                  source={{ uri: images[0] }}
                  objectFit="cover"
                  transition={0}
                  style={{ flex: 1, borderRadius: 10, backgroundColor: colors.canvas }}
                />
                {images.length > 1 && (
                  <View style={{ flex: 0.65, gap: 6 }}>
                    {images.slice(1).map((uri, index) => (
                      <Image
                        key={index}
                        source={{ uri }}
                        objectFit="cover"
                        transition={0}
                        style={{ flex: 1, borderRadius: 8, backgroundColor: colors.canvas }}
                      />
                    ))}
                  </View>
                )}
              </>
            ) : thought ? (
              <View style={{ flex: 1, justifyContent: 'center', gap: 9, padding: 5 }}>
                {thought.type === 'markdown' ? (
                  <MarkdownContent text={thought.content} previewLines={3} />
                ) : (
                  <Text
                    allowFontScaling={false}
                    numberOfLines={3}
                    style={{
                      fontFamily: fonts.editorial,
                      color: colors.ink,
                      fontSize: 19,
                      lineHeight: 25,
                    }}
                  >
                    {itemText(thought) || getItemTitle(thought)}
                  </Text>
                )}
                <View style={{ height: 2, width: 26, backgroundColor: colors.line }} />
              </View>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <BrandMark size={30} />
                <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                  {childCount
                    ? `${childCount} subfolders`
                    : saves.length
                      ? 'Kept just for you'
                      : 'Room for a good find'}
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text
          allowFontScaling={false}
          pointerEvents="none"
          numberOfLines={2}
          style={{
            color: colors.ink,
            fontSize: 16,
            lineHeight: 21,
            fontWeight: '500',
            paddingRight: 38,
          }}
        >
          {folder.name}
        </Text>
        <Text
          allowFontScaling={false}
          pointerEvents="none"
          style={{ ...type.caption, color: colors.muted, marginTop: 4 }}
        >
          {childCount ? `${childCount} subfolders · ` : ''}
          {saves.length} {saves.length === 1 ? 'find' : 'finds'}
        </Text>
      </Pressable>
      <MenuView
        colorScheme={dark ? 'dark' : 'light'}
        style={{ position: 'absolute', right: -6, bottom: 0 }}
        actions={[
          { id: 'rename', title: 'Rename folder' },
          { id: 'delete', title: 'Remove folder', attributes: { destructive: true } },
        ]}
        onPressAction={({ nativeEvent }) =>
          nativeEvent.event === 'rename' ? onRename() : onDelete()
        }
      >
        <View
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Options for ${folder.name}`}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <MoreHorizontal size={20} color={colors.muted} />
        </View>
      </MenuView>
    </View>
  );
}

export function FolderCreateButton({
  title,
  onPress,
  positioned = false,
}: {
  title: string;
  onPress: () => void;
  positioned?: boolean;
}) {
  const { colors } = useCollection();
  const insets = useSafeAreaInsets();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        position: positioned ? 'absolute' : undefined,
        bottom: positioned ? 0 : undefined,
        width: '100%',
        maxWidth: 720,
        alignSelf: 'center',
        minHeight: 58 + insets.bottom,
        paddingBottom: insets.bottom,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0,
        backgroundColor: colors.paper,
        borderTopWidth: 0.5,
        borderTopColor: colors.line,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: colors.ink,
          fontFamily: fonts.editorial,
          fontSize: 22,
          lineHeight: 28,
          fontWeight: '700',
          letterSpacing: -0.4,
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
