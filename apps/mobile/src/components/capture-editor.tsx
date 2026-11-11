import { BlurTargetView } from 'expo-blur';
import { useScrollHeader } from './use-scroll-header';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import Image from 'react-native-fast-image';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import {
  Clipboard as ClipboardIcon,
  ImagePlus,
  Pin,
  ChevronDown,
  ChevronUp,
  Eye,
  Pencil,
  Tags,
} from 'lucide-react-native';
import { useCollection } from '../state/collection';
import { Chip, Field, IconButton } from './ui';
import { AdaptiveImage } from './adaptive-image';
import { draftItem, type DraftKind } from '../utils/draft';
import { itemText, itemUrl } from '../utils/item';
import { createQuickCaptures } from '../shared/utils/quickCapture';
import type { SavedItem } from '../shared/types';
import { FeedbackHost } from './feedback';
import { FolderDestination } from './folder-destination';
import { MarkdownContent } from './markdown-content';
import { fonts, space, type } from '../theme';

const saveKinds: DraftKind[] = [
  'auto',
  'note',
  'checklist',
  'link',
  'image',
  'markdown',
  'code',
  'secret',
];

export function CaptureEditor() {
  const {
    id,
    folder,
    kind: requestedKind,
  } = useLocalSearchParams<{
    id?: string;
    folder?: string;
    kind?: string;
  }>();
  const close = () => router.back();
  const state = useCollection();
  const { data, colors, dark } = state;
  const existing = data.items.find((item) => item.id === id);
  const {
    targetRef,
    topInset,
    onScroll,
    options: headerOptions,
  } = useScrollHeader(existing ? 'Edit find' : 'Keep something');
  const initialKind: DraftKind = existing
    ? existing.type === 'note' && existing.checklist?.length
      ? 'checklist'
      : ['note', 'image', 'markdown', 'code', 'secret', 'link'].includes(existing.type)
        ? (existing.type as DraftKind)
        : 'auto'
    : saveKinds.includes(requestedKind as DraftKind)
      ? (requestedKind as DraftKind)
      : 'auto';
  const [kind, setKind] = useState<DraftKind>(initialKind);
  const [text, setText] = useState(
    existing?.type === 'note' && existing.checklist?.length
      ? existing.checklist.map((check) => check.text).join('\n')
      : existing
        ? existing.type === 'image'
          ? ''
          : itemUrl(existing) || itemText(existing)
        : '',
  );
  const [images, setImages] = useState<{ uri: string; ratio?: number }[]>(
    existing?.type === 'image'
      ? [
          { uri: existing.imageUrl, ratio: existing.mediaAspectRatio },
          ...(existing.additionalImages || []).map(({ url, aspectRatio }) => ({
            uri: url,
            ratio: aspectRatio,
          })),
        ]
      : [],
  );
  const [title, setTitle] = useState(existing?.title || '');
  const [imageCaption, setImageCaption] = useState(
    existing?.type === 'image' ? existing.caption || '' : '',
  );
  const [tags, setTags] = useState(existing?.tags.join(', ') || '');
  const [folderId, setFolderId] = useState<string | undefined>(
    existing?.folderId || (data.folders.some((value) => value.id === folder) ? folder : undefined),
  );
  const [pinned, setPinned] = useState(existing?.isPinned || false);
  const [mediaRatio, setMediaRatio] = useState(existing?.mediaAspectRatio);
  const [language, setLanguage] = useState(existing?.type === 'code' ? existing.language : 'text');
  const [username, setUsername] = useState(
    existing?.type === 'secret' ? existing.username || '' : '',
  );
  const [notes, setNotes] = useState(existing?.type === 'secret' ? existing.notes || '' : '');
  const [details, setDetails] = useState(Boolean(existing?.tags.length));
  const [busy, setBusy] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState(false);
  const { setError } = state;
  const insets = useSafeAreaInsets();
  const chipScrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const chipRects = useRef<Partial<Record<DraftKind, { x: number; width: number }>>>({});
  const [chipViewportWidth, setChipViewportWidth] = useState(0);
  const reducedMotion = useReducedMotion();
  const centerKind = useCallback(
    (value: DraftKind, animated = true) => {
      const rect = chipRects.current[value];

      if (!rect || !chipViewportWidth) return;
      chipScrollRef.current?.scrollTo({
        x: Math.max(0, rect.x + (rect.width - chipViewportWidth) / 2),
        animated: animated && !reducedMotion,
      });
    },
    [chipViewportWidth, reducedMotion],
  );

  useEffect(() => centerKind(kind), [centerKind, kind]);
  const wordCount = text.trim() ? text.trim().split(/\s+/u).length : 0;

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        base64: true,
        quality: 0.8,
      });

      if (result.canceled) return;

      const picked = result.assets.map((image) => {
        if (!image.base64 || image.base64.length > 12_000_000)
          throw new Error('Choose images smaller than 9 MB each, or use an image link.');
        return {
          uri: `data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`,
          ratio: image.width > 0 && image.height > 0 ? image.width / image.height : undefined,
          image,
        };
      });
      setImages((current) => [...current, ...picked.map(({ uri, ratio }) => ({ uri, ratio }))]);
      setText('');
      setKind('image');
      const image = picked[0].image;
      if (picked.length === 1 && picked[0].ratio) setMediaRatio(picked[0].ratio);
      if (!title && picked.length === 1)
        setTitle(image.fileName?.replace(/\.[^.]+$/, '') || 'Image');
    } catch (error) {
      setError((error as Error).message);
    }
  };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      let items: SavedItem[];

      if (kind === 'auto') {
        items = createQuickCaptures(
          text,
          existing ? data.items.filter((item) => item.id !== id) : data.items,
        ).items;
        if (!items.length) throw new Error('This is already in your collection.');
        if (existing)
          items = items
            .slice(0, 1)
            .map((item) =>
              item.type === existing.type && itemUrl(item) && itemUrl(item) === itemUrl(existing)
                ? existing
                : { ...item, id: existing.id, createdAt: existing.createdAt },
            );
      } else if (kind === 'image' && images.length) {
        const [cover, ...additionalImages] = images;
        const imageItem = draftItem('image', cover.uri, title, existing, randomUUID);
        if (imageItem.type !== 'image') throw new Error('Could not prepare these images.');
        items = [
          {
            ...imageItem,
            caption: imageCaption.trim() || undefined,
            mediaAspectRatio: cover.ratio,
            additionalImages: additionalImages.length
              ? additionalImages.map(({ uri, ratio }) => ({ url: uri, aspectRatio: ratio }))
              : undefined,
          },
        ];
      } else items = [draftItem(kind, text, title, existing, randomUUID)];

      const cleanTags = [
        ...new Set(
          tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ].slice(0, 30);

      for (const entry of items) {
        let item = {
          ...entry,
          title: title.trim() && items.length === 1 ? title.trim() : entry.title,
          tags: cleanTags,
          folderId,
          isPinned: pinned,
          mediaAspectRatio: entry.type === 'image' ? entry.mediaAspectRatio : mediaRatio,
        };

        if (item.type === 'code') item = { ...item, language };
        if (item.type === 'secret') item = { ...item, username, notes };
        await state.save(item);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      state.setNotice(
        existing
          ? 'Changes saved'
          : items.length === 1
            ? 'Saved to your collection'
            : `Saved ${items.length} finds`,
      );
      close();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not save. Your draft is still here.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <BlurTargetView ref={targetRef} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen
        options={{ ...headerOptions, title: existing ? 'Edit find' : 'Keep something' }}
      />
      <KeyboardAwareScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: topInset }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={100}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: topInset + 8,
          gap: 20,
          paddingBottom: insets.bottom + 110,
          maxWidth: 720,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <ScrollView
            ref={chipScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            onLayout={({ nativeEvent }) => setChipViewportWidth(nativeEvent.layout.width)}
            style={{ flex: 1, minWidth: 0 }}
            contentContainerStyle={{ gap: 2 }}
          >
            {saveKinds.map((value) => (
              <View
                key={value}
                onLayout={({ nativeEvent: { layout } }) => {
                  chipRects.current[value] = { x: layout.x, width: layout.width };
                  if (value === kind) centerKind(value, false);
                }}
              >
                <Chip
                  title={value === 'auto' ? 'Anything' : value[0].toUpperCase() + value.slice(1)}
                  selected={kind === value}
                  onPress={() => {
                    centerKind(value);
                    setKind(value);
                  }}
                />
              </View>
            ))}
          </ScrollView>
          <IconButton
            label={pinned ? 'Unpin save' : 'Pin save'}
            icon={Pin}
            active={pinned}
            onPress={() => setPinned((value) => !value)}
          />
        </View>
        <View
          style={{
            borderRadius: 24,
            backgroundColor: colors.paper,
            borderWidth: 0.5,
            borderColor: colors.line,
            overflow: 'hidden',
          }}
        >
          {kind === 'image' ? (
            <View style={{ padding: 12, gap: 12 }}>
              {images.map(({ uri, ratio }, index) => (
                <View
                  key={`${uri.slice(-24)}-${index}`}
                  style={{
                    borderRadius: 18,
                    overflow: 'hidden',
                    backgroundColor: colors.canvas,
                  }}
                >
                  <AdaptiveImage
                    uri={uri}
                    ratio={ratio}
                    style={{ backgroundColor: colors.canvas }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove image ${index + 1}`}
                    onPress={() => {
                      setImages((current) => current.filter((_, i) => i !== index));
                    }}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 36,
                      height: 36,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 18,
                      backgroundColor: colors.overlay,
                    }}
                  >
                    <Text allowFontScaling={false} style={{ color: colors.ink, fontSize: 19 }}>
                      ×
                    </Text>
                  </Pressable>
                </View>
              ))}
              {!images.length && (
                <Text
                  allowFontScaling={false}
                  style={{ ...type.small, color: colors.muted, padding: 10 }}
                >
                  Choose one or more images to keep.
                </Text>
              )}
            </View>
          ) : kind === 'markdown' && markdownPreview ? (
            <View style={{ minHeight: 190, padding: 18 }}>
              {text.trim() ? (
                <MarkdownContent text={text} />
              ) : (
                <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                  Your Markdown preview will appear here.
                </Text>
              )}
            </View>
          ) : (
            <Field
              accessibilityLabel="Content"
              placeholder={
                kind === 'checklist'
                  ? 'One thing per line...'
                  : kind === 'secret'
                    ? 'Enter your secret'
                    : kind === 'link'
                      ? 'Paste a link here...'
                      : kind === 'code'
                        ? 'Keep a useful snippet...'
                        : kind === 'note'
                          ? 'Write a thought worth keeping...'
                          : kind === 'markdown'
                            ? 'Paste or write Markdown...'
                            : 'Paste a link, note, or idea...'
              }
              value={text}
              onChangeText={setText}
              editable={!busy}
              multiline={kind !== 'secret'}
              secureTextEntry={kind === 'secret'}
              autoCapitalize={
                ['link', 'image', 'code', 'secret'].includes(kind) ? 'none' : 'sentences'
              }
              autoCorrect={!['link', 'image', 'code', 'secret'].includes(kind)}
              style={{
                minHeight: kind === 'secret' ? 76 : 190,
                textAlignVertical: 'top',
                fontSize: kind === 'code' ? 15 : 18,
                lineHeight: 28,
                backgroundColor: 'transparent',
                padding: 18,
                fontFamily: kind === 'code' ? fonts.mono : undefined,
              }}
            />
          )}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 20,
              paddingHorizontal: 18,
              borderTopWidth: 0.5,
              borderTopColor: colors.line,
            }}
          >
            {(kind === 'auto' || ['note', 'checklist', 'markdown'].includes(kind)) && (
              <Text
                allowFontScaling={false}
                style={{ ...type.caption, color: colors.muted, marginRight: 'auto' }}
              >
                {wordCount} {wordCount === 1 ? 'word' : 'words'}
              </Text>
            )}
            {kind === 'markdown' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={markdownPreview ? 'Edit Markdown' : 'Preview Markdown'}
                onPress={() => setMarkdownPreview((value) => !value)}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 }}
              >
                {markdownPreview ? (
                  <Pencil size={15} color={colors.muted} strokeWidth={1.6} />
                ) : (
                  <Eye size={16} color={colors.muted} strokeWidth={1.6} />
                )}
                <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                  {markdownPreview ? 'Edit' : 'Preview'}
                </Text>
              </Pressable>
            )}
            {kind !== 'image' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Paste clipboard"
                disabled={busy}
                onPress={() => {
                  void Clipboard.getStringAsync()
                    .then(setText)
                    .catch((error) => setError(error.message));
                }}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 }}
              >
                <ClipboardIcon size={16} color={colors.muted} strokeWidth={1.6} />
                <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                  Paste
                </Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a photo"
              disabled={busy}
              onPress={() => void pickImage()}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <ImagePlus size={17} color={colors.muted} strokeWidth={1.6} />
              <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                {kind === 'image' && images.length ? 'Add photos' : 'Photo'}
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
            TITLE
          </Text>
          <Field
            accessibilityLabel="Title"
            placeholder="Add a title (optional)"
            value={title}
            onChangeText={setTitle}
            editable={!busy}
            maxLength={200}
            style={{
              fontFamily: fonts.editorial,
              fontSize: 23,
              lineHeight: 30,
              letterSpacing: -0.4,
              backgroundColor: 'transparent',
              paddingHorizontal: 0,
              paddingVertical: 6,
            }}
          />
        </View>
        {kind === 'image' && images.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
              CAPTION · OPTIONAL
            </Text>
            <Field
              accessibilityLabel="Photo note"
              placeholder="Add a caption for these photos..."
              value={imageCaption}
              onChangeText={setImageCaption}
              editable={!busy}
              multiline
              style={{ minHeight: 76, textAlignVertical: 'top' }}
            />
          </View>
        )}
        {kind === 'code' && (
          <Field
            accessibilityLabel="Code language"
            placeholder="Language, e.g. javascript"
            value={language}
            onChangeText={setLanguage}
            autoCapitalize="none"
            editable={!busy}
          />
        )}
        {kind === 'secret' && (
          <View style={{ gap: 12 }}>
            <Field
              accessibilityLabel="Username"
              placeholder="Username (optional)"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              editable={!busy}
            />
            <Field
              accessibilityLabel="Secret notes"
              placeholder="A note (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              editable={!busy}
            />
          </View>
        )}
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.line, paddingTop: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <FolderDestination
              folders={data.folders}
              items={data.items}
              selectedId={folderId}
              onSelect={setFolderId}
              onCreate={state.addFolder}
            />
            <View style={{ width: 1, height: 24, backgroundColor: colors.line }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit tags"
              accessibilityState={{ expanded: details }}
              onPress={() => setDetails((value) => !value)}
              style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <Tags size={16} color={colors.muted} strokeWidth={1.6} />
              <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                Tags
              </Text>
              {details ? (
                <ChevronUp size={14} color={colors.muted} />
              ) : (
                <ChevronDown size={14} color={colors.muted} />
              )}
            </Pressable>
          </View>
          {details && (
            <Field
              accessibilityLabel="Tags"
              placeholder="Add tags, separated by commas"
              value={tags}
              onChangeText={setTags}
              autoCapitalize="none"
              editable={!busy}
            />
          )}
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.paper,
          borderTopWidth: 0.5,
          borderTopColor: colors.line,
        }}
      >
        <NavigationBar style={dark || Boolean(text.trim()) ? 'light' : 'dark'} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={existing ? 'Save changes' : 'Save to Anything'}
          accessibilityState={{
            disabled: !(kind === 'image' ? images.length : text.trim()) || busy,
            busy,
          }}
          disabled={!(kind === 'image' ? images.length : text.trim()) || busy}
          onPress={() => void submit()}
          style={{
            minHeight: 58 + insets.bottom,
            padding: 16,
            paddingBottom: 16 + insets.bottom,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            backgroundColor: colors.paper,
            opacity: busy ? 0.65 : 1,
          }}
        >
          {busy && <ActivityIndicator color={colors.accent} />}
          <Text
            allowFontScaling={false}
            style={{
              color: colors.accent,
              fontFamily: fonts.editorial,
              fontSize: 21,
              lineHeight: 26,
              fontWeight: '700',
              letterSpacing: -0.3,
            }}
          >
            {busy ? 'Saving...' : existing ? 'Save changes' : 'Save to Anything'}
          </Text>
        </Pressable>
      </KeyboardStickyView>
      <FeedbackHost />
    </BlurTargetView>
  );
}
