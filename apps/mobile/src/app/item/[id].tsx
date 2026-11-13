import { BlurTargetView } from 'expo-blur';
import { useScrollHeader } from '../../components/use-scroll-header';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, Share, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';
import Image from 'react-native-fast-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DeleteSheet } from '../../components/delete-sheet';
import { AdaptiveImage } from '../../components/adaptive-image';
import { ImageCarousel } from '../../components/image-carousel';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { MarkdownContent } from '../../components/markdown-content';
import {
  Check,
  Circle,
  Copy,
  Download,
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
import { imageSet, itemImage, itemText, itemUrl, linkPlatform, typeLabel } from '../../utils/item';
import { getItemTitle } from '../../shared/utils/itemTitle';
import { openLink } from '../../utils/open-link';
import { linkifyText } from '../../utils/linkify-text';
import { downloadImage } from '../../utils/download-image';
import { captureScroll } from '../../utils/capture-scroll';
import { fonts, radius, space, type } from '../../theme';
import { codePreviewMarkdown, languageFromPath } from '../../utils/code-format';
import { readLocalCredential, type LocalCredential } from '../../utils/local-credentials';

export default function ItemDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useCollection();
  const { colors, data } = state;
  const enrich = state.enrich;
  const item = data.items.find((item) => item.id === id);
  const {
    targetRef,
    topInset,
    onScroll,
    options: headerOptions,
  } = useScrollHeader(item ? typeLabel(item) : 'Your find');
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [revealedId, setRevealedId] = useState<string>();
  const [actionsHidden, setActionsHidden] = useState(false);
  const [activeCodePath, setActiveCodePath] = useState('');
  const [credentialDetails, setCredentialDetails] = useState<LocalCredential | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const galleryWidth = Math.min(windowWidth, 720) - space.lg * 2;
  const hasGallery = item?.type === 'image' && !!item.additionalImages?.length;
  const scrollState = useRef({ offset: 0, travel: 0, hidden: false });
  const requestedRedditPreview = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  const revealed = revealedId === id;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (item?.type === 'code')
      setActiveCodePath(
        item.files?.find((file) => file.code.trim())?.path || item.files?.[0]?.path || '',
      );
  }, [item?.id]);
  useEffect(() => {
    if (item?.type !== 'credential') {
      setCredentialDetails(null);
      return;
    }
    let active = true;
    void readLocalCredential(item.id)
      .then((record) => {
        if (!active) return;
        setCredentialDetails(record);
        if (!record) state.setError('This on-device credential could not be found.');
      })
      .catch((error: unknown) => {
        if (active)
          state.setError(error instanceof Error ? error.message : 'Could not open credential.');
      });
    return () => {
      active = false;
    };
  }, [item?.id, item?.type, state.setError]);
  useEffect(() => {
    if (
      item?.type !== 'reddit_post' ||
      item.content.trim() ||
      item.imageUrl ||
      requestedRedditPreview.current === item.id
    )
      return;

    requestedRedditPreview.current = item.id;
    void enrich([item]);
  }, [item, enrich]);
  const handleScroll = useCallback(
    (event: Parameters<typeof onScroll>[0]) => {
      onScroll(event);

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const next = captureScroll(
        scrollState.current,
        contentOffset.y,
        contentSize.height - layoutMeasurement.height,
      );

      if (next.hidden !== scrollState.current.hidden) setActionsHidden(next.hidden);
      scrollState.current = next;
    },
    [onScroll],
  );
  const actionBarStyle = useAnimatedStyle(
    () => ({
      opacity: withTiming(actionsHidden ? 0 : 1, { duration: reducedMotion ? 0 : 150 }),
      transform: [
        {
          translateY: withTiming(actionsHidden ? insets.bottom + 84 : 0, {
            duration: reducedMotion ? 0 : 180,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
        },
      ],
    }),
    [actionsHidden, insets.bottom, reducedMotion],
  );

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
  const images = imageSet(item);
  const url = itemUrl(item);
  const platform = url ? linkPlatform(url) : undefined;
  const title = getItemTitle(item);
  const text = item.type === 'secret' ? '' : itemText(item);
  const codeFiles =
    item.type === 'code'
      ? item.files?.length
        ? item.files.map((file) => ({ ...file, language: languageFromPath(file.path) }))
        : [{ path: 'snippet', code: item.code, language: item.language }]
      : [];
  const activeCodeFile = codeFiles.find((file) => file.path === activeCodePath) || codeFiles[0];
  const social =
    item.type === 'x_post' || item.type === 'instagram_post' || item.type === 'reddit_post';
  const heading =
    item.type === 'markdown'
      ? item.content
          .replace(/^\uFEFF/, '')
          .trimStart()
          .match(/^#{1,6}\s+(.+)/)?.[1]
      : undefined;
  const markdownTitle = title.replace(/^#{1,6}\s+/, '').trim();
  const showTitle =
    (item.type === 'reddit_post' || !social) &&
    (item.type !== 'image' ||
      (!!item.title.trim() &&
        item.title.trim().toLowerCase() !== 'image' &&
        item.title.trim() !== item.caption?.trim())) &&
    (item.type !== 'markdown' || !heading || heading.trim() !== markdownTitle) &&
    !(item.type === 'secret' && title.trim().toLowerCase() === typeLabel(item).toLowerCase());
  const copy = async () => {
    try {
      if (item.type === 'credential' && !credentialDetails?.password)
        throw new Error('This credential is unavailable on this device.');
      await Clipboard.setStringAsync(
        item.type === 'credential'
          ? credentialDetails!.password
          : url || (item.type === 'code' ? activeCodeFile?.code : itemText(item)) || item.title,
      );
      state.setNotice('Copied');
    } catch (error) {
      state.setError((error as Error).message);
    }
  };
  const renderLinkedText = (value: string, style: ComponentProps<typeof Text>['style']) => (
    <Text allowFontScaling={false} selectable style={style}>
      {linkifyText(value).map((segment, index) =>
        segment.href ? (
          <Text
            key={`${segment.href}-${index}`}
            allowFontScaling={false}
            accessibilityRole="link"
            onPress={() =>
              void openLink(segment.href!).catch((error) => state.setError(error.message))
            }
            style={{ color: colors.ink, textDecorationLine: 'underline' }}
          >
            {segment.text}
          </Text>
        ) : (
          segment.text
        ),
      )}
    </Text>
  );

  return (
    <BlurTargetView ref={targetRef} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen
        options={{
          ...headerOptions,
          title: typeLabel(item),
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
        onScroll={handleScroll}
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
                  : item.type === 'reddit_post'
                    ? `${item.subreddit}${item.author ? ` · u/${item.author.replace(/^u\//, '')}` : ''}`
                    : item.type === 'link'
                      ? item.domain
                      : item.type === 'secret'
                        ? 'Protected value'
                        : item.type === 'image'
                          ? `${images.length} ${images.length === 1 ? 'photo' : 'photos'}`
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
        {!!image && images.length > 1 ? (
          <ImageCarousel key={id} photos={images} width={galleryWidth} />
        ) : !!image ? (
          <AdaptiveImage
            key={image}
            uri={image}
            ratio={item.mediaAspectRatio}

            priority="high"
            style={{ borderRadius: radius.card, backgroundColor: colors.paper, overflow: 'hidden' }}
          />
        ) : null}
        {(showTitle ||
          (text && text.trim() !== title.trim()) ||
          item.type === 'secret' ||
          item.tags.length > 0) && (
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
            {item.type === 'image' ? (
              !!text && (
                <View style={{ gap: 7, paddingTop: 2 }}>
                  <Text
                    allowFontScaling={false}
                    style={{ ...type.caption, color: colors.muted, letterSpacing: 0.8 }}
                  >
                    CAPTION
                  </Text>
                  {renderLinkedText(text, {
                    color: colors.ink,
                    fontSize: 17,
                    lineHeight: 26,
                  })}
                </View>
              )
            ) : item.type === 'credential' ? (
              <View style={{ gap: 20 }}>
                <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                  STORED ONLY ON THIS DEVICE · NEVER SYNCED OR SENT TO AI
                </Text>
                {credentialDetails ? (
                  <>
                    <View style={{ gap: 6 }}>
                      <Text
                        allowFontScaling={false}
                        style={{ ...type.caption, color: colors.muted }}
                      >
                        WEBSITE
                      </Text>
                      <Text
                        allowFontScaling={false}
                        accessibilityRole="link"
                        onPress={() =>
                          void openLink(credentialDetails.website).catch((error) =>
                            state.setError(error.message),
                          )
                        }
                        style={{ color: colors.ink, textDecorationLine: 'underline' }}
                      >
                        {credentialDetails.website}
                      </Text>
                    </View>
                    {!!credentialDetails.username && (
                      <View style={{ gap: 6 }}>
                        <Text
                          allowFontScaling={false}
                          style={{ ...type.caption, color: colors.muted }}
                        >
                          USERNAME
                        </Text>
                        <Text allowFontScaling={false} selectable style={{ color: colors.ink }}>
                          {credentialDetails.username}
                        </Text>
                      </View>
                    )}
                    <View style={{ gap: 6 }}>
                      <Text
                        allowFontScaling={false}
                        style={{ ...type.caption, color: colors.muted }}
                      >
                        PASSWORD
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text
                          allowFontScaling={false}
                          selectable={revealed}
                          accessibilityLabel={
                            revealed ? credentialDetails.password : 'Hidden password'
                          }
                          style={{
                            flex: 1,
                            color: colors.ink,
                            fontFamily: fonts.mono,
                            fontSize: 17,
                            letterSpacing: revealed ? 0 : 2.5,
                          }}
                        >
                          {revealed ? credentialDetails.password : '••••••••••••'}
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={revealed ? 'Hide password' : 'Reveal password'}
                          accessibilityState={{ expanded: revealed }}
                          onPress={() => setRevealedId(revealed ? undefined : id)}
                          style={{
                            minHeight: 44,
                            minWidth: 44,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {revealed ? (
                            <EyeOff size={16} color={colors.ink} />
                          ) : (
                            <Eye size={16} color={colors.ink} />
                          )}
                        </Pressable>
                      </View>
                    </View>
                    {!!credentialDetails.notes && (
                      <View style={{ gap: 6 }}>
                        <Text
                          allowFontScaling={false}
                          style={{ ...type.caption, color: colors.muted }}
                        >
                          NOTE
                        </Text>
                        <Text allowFontScaling={false} selectable style={{ color: colors.ink }}>
                          {credentialDetails.notes}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <Text allowFontScaling={false} style={{ color: colors.muted }}>
                    Loading this device’s credential…
                  </Text>
                )}
              </View>
            ) : item.type === 'secret' ? (
              <View
                style={{
                  padding: 20,
                  borderRadius: radius.group,
                  backgroundColor: colors.paper,
                  gap: 16,
                }}
              >
                <Text
                  allowFontScaling={false}
                  style={{ ...type.caption, color: colors.muted, letterSpacing: 1.1 }}
                >
                  SECRET VALUE
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    padding: 8,
                    paddingLeft: 14,
                    borderRadius: 16,
                    backgroundColor: colors.canvas,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    selectable={revealed}
                    accessibilityLabel={revealed ? item.secretValue : 'Hidden secret'}
                    style={{
                      flex: 1,
                      color: colors.ink,
                      fontFamily: fonts.mono,
                      fontSize: 17,
                      lineHeight: 25,
                      letterSpacing: revealed ? 0 : 2.5,
                    }}
                  >
                    {revealed ? item.secretValue : '••••••••••••'}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={revealed ? 'Hide secret' : 'Reveal secret'}
                    accessibilityState={{ expanded: revealed }}
                    onPress={() => setRevealedId(revealed ? undefined : id)}
                    style={{
                      minHeight: 44,
                      minWidth: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {revealed ? (
                      <EyeOff size={16} color={colors.ink} strokeWidth={1.7} />
                    ) : (
                      <Eye size={16} color={colors.ink} strokeWidth={1.7} />
                    )}
                  </Pressable>
                </View>
                {item.username && (
                  <View style={{ gap: 5 }}>
                    <Text
                      allowFontScaling={false}
                      style={{ ...type.caption, color: colors.muted, letterSpacing: 0.8 }}
                    >
                      USERNAME
                    </Text>
                    <Text allowFontScaling={false} selectable style={{ color: colors.ink }}>
                      {item.username}
                    </Text>
                  </View>
                )}
                {!!item.notes && (
                  <View style={{ gap: 5 }}>
                    <Text
                      allowFontScaling={false}
                      style={{ ...type.caption, color: colors.muted, letterSpacing: 0.8 }}
                    >
                      NOTES
                    </Text>
                    <Text
                      allowFontScaling={false}
                      selectable
                      style={{ color: colors.ink, lineHeight: 22 }}
                    >
                      {item.notes}
                    </Text>
                  </View>
                )}
              </View>
            ) : item.type === 'code' ? (
              <View style={{ gap: 12 }}>
                {codeFiles.length > 1 && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{
                      gap: 4,
                      borderBottomWidth: 0.5,
                      borderBottomColor: colors.line,
                    }}
                  >
                    {codeFiles.map((file) => (
                      <Pressable
                        key={file.path}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: file.path === activeCodeFile.path }}
                        onPress={() => setActiveCodePath(file.path)}
                        style={{
                          minHeight: 42,
                          justifyContent: 'center',
                          paddingHorizontal: 10,
                          borderBottomWidth: file.path === activeCodeFile.path ? 2 : 0,
                          borderBottomColor: colors.accent,
                        }}
                      >
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={{
                            color: file.path === activeCodeFile.path ? colors.ink : colors.muted,
                            fontFamily: fonts.mono,
                            fontSize: 11,
                          }}
                        >
                          {file.path}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
                <MarkdownContent
                  text={codePreviewMarkdown(activeCodeFile.language, activeCodeFile.code)}
                />
              </View>
            ) : item.type === 'markdown' ? (
              <MarkdownContent text={item.content} />
            ) : (
              !!text &&
              text.trim() !== title.trim() &&
              renderLinkedText(text, {
                color: colors.ink,
                fontSize: 17,
                lineHeight: 29,
              })
            )}
            {item.type === 'reddit_post' && !text.trim() && !image && (
              <Text
                allowFontScaling={false}
                style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}
              >
                Post details are unavailable in the preview. Open Reddit to view the full post.
              </Text>
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
      <Animated.View
        pointerEvents={actionsHidden ? 'none' : 'auto'}
        style={[
          {
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: colors.paper,
            borderTopWidth: 0.5,
            borderTopColor: colors.line,
            paddingHorizontal: 12,
            paddingTop: 10,
            paddingBottom: insets.bottom + 10,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          },
          actionBarStyle,
        ]}
      >
        <IconButton
          label={
            item.type === 'credential'
              ? 'Copy password'
              : item.type === 'secret'
                ? 'Copy secret'
                : 'Copy'
          }
          icon={Copy}
          onPress={() => void copy()}
        />
        {!!image && (
          <IconButton
            label="Download image"
            icon={Download}
            disabled={downloading}
            onPress={() => {
              setDownloading(true);
              void downloadImage(image)
                .then((saved) => {
                  if (saved) state.setNotice('Image saved to folder');
                })
                .catch((error) => state.setError(error.message))
                .finally(() => setDownloading(false));
            }}
          />
        )}
        {item.type !== 'secret' && item.type !== 'credential' && (
          <IconButton
            label="Share"
            icon={Share2}
            onPress={() => {
              void Share.share({ message: url || itemText(item) || item.title }).catch((error) =>
                state.setError(error.message),
              );
            }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Action
            title={
              url
                ? platform
                  ? `Open in ${platform}`
                  : 'Open link'
                : item.type === 'credential'
                  ? 'Edit credential'
                  : item.type === 'secret'
                    ? 'Edit secret'
                    : 'Edit find'
            }
            secondary
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
      </Animated.View>
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
