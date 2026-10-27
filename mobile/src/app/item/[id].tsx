import { BlurTargetView } from 'expo-blur';
import { useScrollHeader } from '../../components/use-scroll-header';
import { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import Image from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeleteSheet } from '../../components/delete-sheet';
import { AdaptiveImage } from '../../components/adaptive-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MarkdownContent } from '../../components/markdown-content';
import {
  Check,
  Circle,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  Pin,
  Share2,
  Trash2,
} from 'lucide-react-native';
import { useCollection } from '../../state/collection';
import { Action, IconButton } from '../../components/ui';
import { itemImage, itemText, itemUrl, typeLabel } from '../../utils/item';
import { getItemTitle } from '../../shared/utils/itemTitle';
import { openLink } from '../../utils/open-link';
import { fonts, radius, space, type } from '../../theme';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useCollection();
  const { colors, data } = state;
  const item = data.items.find((item) => item.id === id);
  const {
    targetRef,
    topInset,
    onScroll,
    options: headerOptions,
  } = useScrollHeader(item ? typeLabel(item) : 'Your find');
  const [deleting, setDeleting] = useState(false);
  const [revealedId, setRevealedId] = useState<string>();
  const revealed = revealedId === id;
  const insets = useSafeAreaInsets();
  if (!item)
    return (
      <View style={{ padding: 30, gap: 18 }}>
        <Text allowFontScaling={false} style={{ color: colors.ink }}>
          This save is no longer in your collection.
        </Text>
        <Action title="Back to collection" onPress={() => router.replace('/')} />
      </View>
    );
  const image = itemImage(item);
  const url = itemUrl(item);
  const title = getItemTitle(item);
  const text = item.type === 'secret' ? '' : itemText(item);
  const social =
    item.type === 'x_post' || item.type === 'instagram_post' || item.type === 'reddit_post';
  const heading =
    item.type === 'markdown' ? item.content.trimStart().match(/^#{1,6}\s+(.+)/)?.[1] : undefined;
  const showTitle =
    !social && (item.type !== 'image' || !!item.caption) && heading?.trim() !== title.trim();
  const copy = async () => {
    try {
      await Clipboard.setStringAsync(url || itemText(item) || item.title);
      state.setNotice('Copied');
    } catch (error) {
      state.setError((error as Error).message);
    }
  };
  return (
    <BlurTargetView ref={targetRef} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen
        options={{
          ...headerOptions,
          title: typeLabel(item),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconButton
                label="Edit find"
                icon={Edit3}
                onPress={() => router.push({ pathname: '/capture', params: { id } })}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete find"
                onPress={() => setDeleting(true)}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <Trash2 size={19} color={colors.danger} strokeWidth={1.6} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: topInset }}
        contentContainerStyle={{
          padding: space.lg,
          paddingTop: topInset + 8,
          gap: space.lg,
          paddingBottom: 112 + insets.bottom,
          maxWidth: 720,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            {item.type === 'x_post' && !!item.authorAvatar && (
              <Image
                source={{ uri: item.authorAvatar }}
                objectFit="cover"
                style={{ width: 38, height: 38, borderRadius: 19 }}
              />
            )}
            <View style={{ gap: 4, flex: 1 }}>
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{ color: colors.ink, fontSize: 14, fontWeight: '500' }}
              >
                {item.type === 'x_post'
                  ? item.authorName || `@${item.authorHandle}`
                  : item.type === 'link'
                    ? item.domain
                    : typeLabel(item)}
              </Text>
              <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                Saved{' '}
                {new Date(item.createdAt).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <IconButton
              label={item.isPinned ? 'Unpin' : 'Pin'}
              icon={Pin}
              active={item.isPinned}
              onPress={() =>
                void state.pin(item.id).catch((error) => state.setError(error.message))
              }
            />
          </View>
        </View>
        {!!image && (
          <AdaptiveImage
            key={image}
            uri={image}
            ratio={item.mediaAspectRatio}

            priority="high"
            style={{ borderRadius: radius.card, backgroundColor: colors.paper, overflow: 'hidden' }}
          />
        )}
        {(showTitle || (text && text.trim() !== title.trim()) || item.tags.length > 0) && (
          <View
            style={{
              gap: 16,
            }}
          >
            {showTitle && (
              <Text
                allowFontScaling={false}
                selectable
                style={{
                  color: colors.ink,
                  fontSize: item.type === 'note' ? 32 : 26,
                  fontFamily: item.type === 'note' ? fonts.editorial : undefined,
                  fontWeight: item.type === 'note' ? '400' : '500',
                  letterSpacing: -0.8,
                  lineHeight: item.type === 'note' ? 40 : 34,
                }}
              >
                {title}
              </Text>
            )}
            {item.type === 'secret' ? (
              <View
                style={{
                  padding: 20,
                  borderRadius: radius.group,
                  backgroundColor: colors.paper,
                  gap: 14,
                }}
              >
                <Text allowFontScaling={false} selectable style={{ color: colors.muted }}>
                  {item.username}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    allowFontScaling={false}
                    selectable={revealed}
                    style={{ flex: 1, color: colors.ink, fontFamily: fonts.mono, fontSize: 17 }}
                  >
                    {revealed ? item.secretValue : '••••••••••••'}
                  </Text>
                  <IconButton
                    label={revealed ? 'Hide secret' : 'Reveal secret'}
                    icon={revealed ? EyeOff : Eye}
                    onPress={() => setRevealedId(revealed ? undefined : id)}
                  />
                </View>
                <Text
                  allowFontScaling={false}
                  selectable
                  style={{ color: colors.muted, lineHeight: 22 }}
                >
                  {item.notes}
                </Text>
              </View>
            ) : item.type === 'markdown' ? (
              <MarkdownContent text={item.content} />
            ) : (
              !!text &&
              text.trim() !== title.trim() && (
                <Text
                  allowFontScaling={false}
                  selectable
                  style={{
                    color: colors.ink,
                    fontSize: item.type === 'code' ? 13 : 17,
                    lineHeight: item.type === 'code' ? 23 : 29,
                    fontFamily: item.type === 'code' ? fonts.mono : undefined,
                    backgroundColor: item.type === 'code' ? colors.paper : 'transparent',
                    padding: item.type === 'code' ? 16 : 0,
                    borderRadius: 16,
                  }}
                >
                  {text}
                </Text>
              )
            )}
            {item.type === 'note' &&
              item.checklist?.map((check) => (
                <Pressable
                  key={check.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: check.completed }}
                  onPress={() =>
                    void state
                      .save({
                        ...item,
                        checklist: item.checklist!.map((value) =>
                          value.id === check.id ? { ...value, completed: !value.completed } : value,
                        ),
                      })
                      .catch((error) => state.setError(error.message))
                  }
                  style={{
                    flexDirection: 'row',
                    gap: 12,
                    paddingVertical: 10,
                    minHeight: 48,
                    alignItems: 'center',
                  }}
                >
                  {check.completed ? (
                    <Check size={20} color={colors.accent} />
                  ) : (
                    <Circle size={20} color={colors.muted} />
                  )}
                  <Text
                    allowFontScaling={false}
                    style={{
                      flex: 1,
                      color: colors.ink,
                      fontSize: 16,
                      textDecorationLine: check.completed ? 'line-through' : 'none',
                    }}
                  >
                    {check.text}
                  </Text>
                </Pressable>
              ))}
            {!!item.tags.length && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {item.tags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: radius.pill,
                      backgroundColor: colors.soft,
                    }}
                  >
                    <Text allowFontScaling={false} style={{ color: colors.muted, ...type.small }}>
                      #{tag}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
      <View
        style={{
          position: 'absolute',
          boxShadow: '0 8px 28px rgba(0,0,0,0.16)',
          bottom: Math.max(insets.bottom, 14),
          width: '92%',
          maxWidth: 680,
          alignSelf: 'center',
          borderRadius: radius.pill,
          backgroundColor: colors.paper,
          borderWidth: 0.5,
          borderColor: colors.line,
          padding: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <IconButton label="Copy" icon={Copy} onPress={() => void copy()} />
        <IconButton
          label="Share"
          icon={Share2}
          onPress={() => {
            void Share.share({ message: url || itemText(item) || item.title }).catch((error) =>
              state.setError(error.message),
            );
          }}
        />
        <View style={{ flex: 1 }}>
          <Action
            title={url ? 'Open original' : 'Edit find'}
            icon={url ? ExternalLink : Edit3}
            onPress={() => {
              if (!url) {
                router.push({ pathname: '/capture', params: { id } });
                return;
              }
              void openLink(url).catch((error) => state.setError(error.message));
            }}
          />
        </View>
      </View>
      <DeleteSheet
        open={deleting}
        title="Let this find go?"
        description={
          state.enabled
            ? 'This also deletes it from your synced collection. This cannot be undone.'
            : 'This save will be deleted from this device. This cannot be undone.'
        }
        onDismiss={() => setDeleting(false)}
        onConfirm={async () => {
          await state.remove(item.id);
          router.back();
        }}
      />
    </BlurTargetView>
  );
}
