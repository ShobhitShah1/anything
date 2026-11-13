import { memo, useRef, type ComponentRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import Image from 'react-native-fast-image';
import { CardFrame, MotionPosition } from './collection-motion';
import { AdaptiveImage } from './adaptive-image';
import { MarkdownContent } from './markdown-content';
import {
  Pin,
  ArrowUpRight,
  LockKeyhole,
  Check,
  Circle,
  Link2,
  FileText,
} from 'lucide-react-native';
import { router } from 'expo-router';
import type { SavedItem } from '../shared/types';
import { getItemTitle } from '../shared/utils/itemTitle';
import { imageSet, itemImage, itemText, typeLabel } from '../utils/item';
import { cardWidths } from '../utils/card-widths';
import { codePreviewMarkdown, languageFromPath } from '../utils/code-format';
import { useCollection } from '../state/collection';
import { fonts, radius, type } from '../theme';

export type CardAnchor = {
  id: string;
  rect: { x: number; y: number; width: number; height: number };
  list: boolean;
};

export const SaveCard = memo(function SaveCard({
  item,
  width,
  list = false,
  onMenu,
  hidden = false,
  onPreviewReady,
  selecting = false,
  selected = false,
  onSelect,
}: {
  item: SavedItem;
  width: number;
  list?: boolean;
  onMenu: (anchor: CardAnchor) => void;
  hidden?: boolean;
  onPreviewReady?: () => void;
  selecting?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
}) {
  const anchorRef = useRef<ComponentRef<typeof View>>(null);
  const showMenu = () =>
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) onMenu({ id: item.id, rect: { x, y, width, height }, list });
    });
  const { colors } = useCollection();
  const mediaHeight = 124;
  const image = itemImage(item);
  const gallery = imageSet(item);
  const groupedImages = !list && gallery.length > 1;
  const listImageColumns =
    gallery.length === 2
      ? gallery.map((entry) => [entry])
      : gallery.length === 3
        ? [gallery.slice(0, 1), gallery.slice(1, 3)]
        : [gallery.slice(0, 2), gallery.slice(2, 4)];
  const { width: cardWidth, contentWidth } = cardWidths(width, list, !!image);
  const title = getItemTitle(item) || typeLabel(item);
  const codeFile =
    item.type === 'code'
      ? item.files?.find((file) => file.code.trim()) ||
        item.files?.[0] || { path: item.title, code: item.code, language: item.language }
      : undefined;
  const generatedCodeTitle =
    item.type === 'code' &&
    (title === codeFile?.path.split(/[\\/]/).pop() ||
      title === codeFile?.code.split('\n')[0].slice(0, 90));
  const showTitle =
    (item.type !== 'markdown' ||
      (!!item.title.trim() && !/^#{1,6}\s/.test(item.content.trimStart()))) &&
    !(item.type === 'secret' && title.trim().toLowerCase() === typeLabel(item).toLowerCase()) &&
    !generatedCodeTitle;
  const note = item.type === 'note';
  const social =
    item.type === 'x_post' || item.type === 'instagram_post' || item.type === 'reddit_post';
  const text = item.type === 'secret' ? '' : itemText(item);
  const source =
    item.type === 'link'
      ? item.domain
      : item.type === 'x_post'
        ? `@${item.authorHandle.replace(/^@+/, '')}`
        : item.type === 'code'
          ? item.files?.length && item.files.length > 1
            ? `Code · ${item.files.length} files`
            : 'Code'
          : item.type === 'note' && item.checklist?.length
            ? `${item.checklist.filter((check) => check.completed).length}/${item.checklist.length} done`
            : typeLabel(item);
  const date = new Date(item.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  const content = (
    <MotionPosition
      identity={item.id}
      style={{
        // FlashList measures columns in a later commit; do not wrap text at the old column width.
        width: contentWidth,
        padding: list ? 0 : groupedImages ? 12 : 16,
        ...(list && image ? { paddingVertical: 14, paddingRight: 16 } : {}),
      }}
    >
      <View style={{ gap: list ? 6 : 10 }}>
        {(!image || list) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            {item.isPinned ? (
              <Pin size={11} color={colors.muted} />
            ) : item.type === 'link' ? (
              <Link2 size={11} color={colors.muted} />
            ) : (
              <FileText size={11} color={colors.muted} />
            )}
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{ ...type.caption, color: colors.muted, flex: 1 }}
            >
              {item.isPinned && !list ? 'Pinned' : source}
              {list && item.type !== 'link' && !social && !!item.tags.length
                ? ` · #${item.tags[0]}`
                : ''}
            </Text>
            {list && (
              <Text
                allowFontScaling={false}
                style={{ ...type.caption, color: colors.muted, letterSpacing: 0 }}
              >
                {date}
              </Text>
            )}
            {list && (item.type === 'link' || social) && (
              <ArrowUpRight size={11} color={colors.muted} />
            )}
          </View>
        )}
        {showTitle && !(item.type === 'image' && !item.caption && image && !list) && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            {item.type === 'x_post' && !!item.authorAvatar && (
              <Image
                source={{ uri: item.authorAvatar }}
                objectFit="cover"

                transition={0}
                style={{ width: list ? 18 : 22, height: list ? 18 : 22, borderRadius: 11 }}
              />
            )}
            <Text
              allowFontScaling={false}
              numberOfLines={list ? 2 : 3}
              style={{
                color: colors.ink,
                fontSize: list ? 16 : note ? 22 : 15,
                lineHeight: list ? 22 : note ? 28 : 21,
                fontFamily: note && !list ? fonts.editorial : undefined,
                fontWeight: note && !list ? '400' : '500',
                letterSpacing: list ? -0.25 : -0.35,
                flex: 1,
              }}
            >
              {item.type === 'image'
                ? item.caption || title
                : item.type === 'x_post'
                  ? item.authorName || title
                  : title}
            </Text>
          </View>
        )}
        {item.type === 'code' ? (
          <View style={{ gap: 8 }}>
            {item.description && (
              <Text
                allowFontScaling={false}
                style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}
              >
                {item.description}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{ ...type.caption, color: colors.ink, fontFamily: fonts.mono, flex: 1 }}
              >
                {codeFile?.path || 'snippet'}
              </Text>
              {!!item.files && item.files.length > 1 && (
                <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                  {item.files.length} files
                </Text>
              )}
            </View>
            <MarkdownContent
              text={codePreviewMarkdown(
                item.files?.length ? languageFromPath(codeFile?.path || '') : item.language,
                codeFile?.code || item.code,
              )}
              previewLines={list ? 4 : 6}
            />
          </View>
        ) : item.type === 'secret' || item.type === 'credential' ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: list ? 0 : 8,
            }}
          >
            <LockKeyhole size={list ? 16 : 20} color={colors.muted} />
            <Text
              allowFontScaling={false}
              style={{ color: colors.muted, fontSize: list ? 15 : 19, letterSpacing: 3 }}
            >
              ••••••••
            </Text>
          </View>
        ) : item.type === 'markdown' ? (
          <MarkdownContent text={item.content} previewLines={list ? 3 : 6} />
        ) : (
          !!text &&
          text.trim() !== title.trim() &&
          item.type !== 'image' && (
            <Text
              allowFontScaling={false}
              numberOfLines={list ? 1 : image ? 3 : 5}
              style={{
                color: colors.muted,
                fontSize: 13,
                lineHeight: list ? 19 : 21,
              }}
            >
              {text}
            </Text>
          )
        )}
        {note &&
          !list &&
          item.checklist?.slice(0, 3).map((check) => (
            <View key={check.id} style={{ flexDirection: 'row', gap: 7, alignItems: 'flex-start' }}>
              {check.completed ? (
                <Check size={14} color={colors.accent} />
              ) : (
                <Circle size={13} color={colors.muted} />
              )}
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={{
                  flex: 1,
                  color: colors.muted,
                  fontSize: 12,
                  lineHeight: 17,
                  textDecorationLine: check.completed ? 'line-through' : 'none',
                }}
              >
                {check.text}
              </Text>
            </View>
          ))}
        {!list && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              paddingTop: 3,
            }}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{ ...type.caption, color: colors.muted, flex: 1 }}
            >
              {image && !list ? source : date}
            </Text>
            {item.type === 'link' || social ? (
              <ArrowUpRight size={12} color={colors.muted} />
            ) : (
              !!item.tags.length && (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{ ...type.caption, color: colors.muted, maxWidth: '55%' }}
                >
                  #{item.tags[0]}
                </Text>
              )
            )}
          </View>
        )}
      </View>
    </MotionPosition>
  );

  return (
    <CardFrame hidden={hidden} identity={item.id} width={cardWidth} backgroundColor={colors.paper}>
      <Pressable
        ref={anchorRef}
        onLayout={!image ? onPreviewReady : undefined}
        accessibilityRole={selecting ? 'checkbox' : 'button'}
        accessibilityState={selecting ? { checked: selected } : undefined}
        accessibilityLabel={
          selecting
            ? `Select ${title}`
            : `Open ${title}${item.isPinned ? ', pinned' : ''}${
                item.type === 'image' && item.additionalImages?.length
                  ? `, ${item.additionalImages.length + 1} images`
                  : ''
              }`
        }
        onPress={() =>
          selecting
            ? onSelect?.(item.id)
            : router.push({ pathname: '/item/[id]', params: { id: item.id } })
        }
        accessibilityHint={selecting ? 'Tap to toggle selection' : 'Long press for save actions'}
        accessibilityActions={selecting ? [] : [{ name: 'longpress', label: 'Show save actions' }]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'longpress') showMenu();
        }}
        delayLongPress={350}
        onLongPress={() => (selecting ? onSelect?.(item.id) : showMenu())}
        style={{
          width: cardWidth,

          ...(list
            ? {
                flexDirection: 'row',
                paddingHorizontal: image ? 0 : 16,
                paddingVertical: image ? 0 : 12,
                gap: list && image ? 12 : 16,
                alignItems: 'center',
                minHeight: image ? mediaHeight : 100,
              }
            : {}),
        }}
      >
        {!!image && (
          <MotionPosition
            identity={item.id}
            style={
              list
                ? {
                    width: 104,
                    height: mediaHeight,
                    backgroundColor: colors.paper,
                  }
                : undefined
            }
          >
            {list && item.type === 'image' && gallery.length > 1 ? (
              <View
                style={{
                  width: 104,
                  height: mediaHeight,
                  flexDirection: 'row',
                  gap: 2,
                  overflow: 'hidden',
                  backgroundColor: colors.paper,
                }}
              >
                {listImageColumns.map((column, columnIndex) => (
                  <View key={columnIndex} style={{ flex: 1, gap: 2 }}>
                    {column.map(({ uri }, imageIndex) => (
                      <View
                        key={`${uri.slice(-24)}-${imageIndex}`}
                        style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}
                      >
                        <Image
                          source={{ uri }}
                          objectFit="cover"
                          transition={0}
                          style={{ width: '100%', height: '100%' }}
                        />
                        {gallery.length > 4 && columnIndex === 1 && imageIndex === 1 && (
                          <View
                            style={{
                              position: 'absolute',
                              inset: 0,
                              alignItems: 'center',
                              justifyContent: 'center',
                              backgroundColor: '#00000066',
                            }}
                          >
                            <Text
                              allowFontScaling={false}
                              style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}
                            >
                              +{gallery.length - 4}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : groupedImages ? (
              <View
                style={{
                  width: cardWidth,
                  height: cardWidth * 1.18,
                  flexDirection: 'row',
                  gap: 4,
                  overflow: 'hidden',
                  borderRadius: radius.card,
                  backgroundColor: colors.canvas,
                }}
              >
                <Image
                  source={{ uri: gallery[0].uri }}
                  objectFit="cover"
                  transition={0}
                  style={{ flex: 1.45 }}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  {gallery.slice(1, 3).map(({ uri }, index) => (
                    <View key={`${uri.slice(-24)}-${index}`} style={{ flex: 1, minHeight: 0 }}>
                      <Image
                        source={{ uri }}
                        objectFit="cover"
                        transition={0}
                        style={{ width: '100%', height: '100%' }}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : (
              <AdaptiveImage
                key={image}
                width={list ? 104 : cardWidth}
                thumbnailHeight={mediaHeight}
                onReady={onPreviewReady}
                uri={image}
                ratio={item.mediaAspectRatio}
                objectFit={list ? 'cover' : 'contain'}
                animateLayout={false}
                thumbnail={list}
                style={{
                  backgroundColor: colors.paper,
                }}
              />
            )}
            {item.isPinned && !list && (
              <View
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  backgroundColor: colors.overlay,
                  borderRadius: radius.pill,
                  padding: 7,
                }}
              >
                <Pin size={12} color={colors.ink} />
              </View>
            )}
          </MotionPosition>
        )}
        {content}
        {selecting && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              inset: 0,
              borderWidth: selected ? 2 : 0,
              borderColor: colors.accent,
              borderRadius: radius.card,
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                width: 26,
                height: 26,
                borderRadius: 13,
                backgroundColor: selected ? colors.ink : colors.paper,
                borderWidth: selected ? 0 : 1,
                borderColor: colors.muted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected && <Check size={17} color={colors.paper} strokeWidth={2.2} />}
            </View>
          </View>
        )}
      </Pressable>
    </CardFrame>
  );
});
