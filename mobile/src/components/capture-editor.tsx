import { BlurTargetView } from 'expo-blur';
import { useScrollHeader } from './use-scroll-header';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Image from 'react-native-fast-image';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { randomUUID } from 'expo-crypto';
import {
  Clipboard as ClipboardIcon,
  ImagePlus,
  Pin,
  Check,
  ChevronDown,
  ChevronUp,
  Folder,
  Tags,
} from 'lucide-react-native';
import { useCollection } from '../state/collection';
import { Field, IconButton } from './ui';
import { draftItem, type DraftKind } from '../utils/draft';
import { itemText, itemUrl } from '../utils/item';
import { createQuickCaptures } from '../shared/utils/quickCapture';
import type { SavedItem } from '../shared/types';
import { FeedbackHost } from './feedback';
import { ChoiceMenu } from './choice-menu';
import { fonts, space, type } from '../theme';

export function CaptureEditor() {
  const { id, folder } = useLocalSearchParams<{ id?: string; folder?: string }>();
  const close = () => router.back();
  const state = useCollection();
  const { data, colors } = state;
  const existing = data.items.find((item) => item.id === id);
  const {
    targetRef,
    topInset,
    onScroll,
    options: headerOptions,
  } = useScrollHeader(existing ? 'Edit find' : 'Keep something');
  const initialKind: DraftKind =
    existing?.type === 'note' && existing.checklist?.length
      ? 'checklist'
      : existing && ['note', 'image', 'markdown', 'code', 'secret', 'link'].includes(existing.type)
        ? (existing.type as DraftKind)
        : 'auto';
  const [kind, setKind] = useState<DraftKind>(initialKind);
  const [text, setText] = useState(
    existing?.type === 'note' && existing.checklist?.length
      ? existing.checklist.map((check) => check.text).join('\n')
      : existing
        ? existing.type === 'image'
          ? existing.imageUrl
          : itemUrl(existing) || itemText(existing)
        : '',
  );
  const [title, setTitle] = useState(existing?.title || '');
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
  const { setError } = state;
  const insets = useSafeAreaInsets();
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        base64: true,
        quality: 0.8,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image.base64 || image.base64.length > 12_000_000)
        throw new Error('Choose an image smaller than 9 MB, or use an image link.');
      setText(`data:${image.mimeType || 'image/jpeg'};base64,${image.base64}`);
      setKind('image');
      if (image.width > 0 && image.height > 0) setMediaRatio(image.width / image.height);
      if (!title) setTitle(image.fileName?.replace(/\.[^.]+$/, '') || 'Image');
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
          mediaAspectRatio: mediaRatio,
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
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <ChoiceMenu
            label="Save as"
            value={kind}
            options={(
              [
                'auto',
                'note',
                'checklist',
                'link',
                'image',
                'markdown',
                'code',
                'secret',
              ] as DraftKind[]
            ).map((value) => ({
              value,
              label: value === 'auto' ? 'Anything' : value[0].toUpperCase() + value.slice(1),
            }))}
            onSelect={setKind}
          />
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
          {kind === 'image' && /^data:image\//.test(text) ? (
            <Image
              source={{ uri: text }}
              objectFit="contain"
              style={{ width: '100%', height: 280, backgroundColor: colors.paper }}
            />
          ) : (
            <Field
              accessibilityLabel="Content"
              placeholder={
                kind === 'checklist'
                  ? 'One thing per line...'
                  : kind === 'secret'
                    ? 'Enter your secret'
                    : kind === 'link' || kind === 'image'
                      ? 'Paste a link here...'
                      : kind === 'code'
                        ? 'Keep a useful snippet...'
                        : 'Paste a link or write a thought...'
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a photo"
              disabled={busy}
              onPress={() => void pickImage()}
              style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 }}
            >
              <ImagePlus size={17} color={colors.muted} strokeWidth={1.6} />
              <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                {kind === 'image' && text.startsWith('data:') ? 'Change photo' : 'Photo'}
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
        <View style={{ borderTopWidth: 0.5, borderTopColor: colors.line, paddingTop: 12, gap: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <View style={{ flex: 1 }}>
              <ChoiceMenu
                label="Folder"
                icon={Folder}
                value={folderId || ''}
                options={[
                  { value: '', label: 'No folder' },
                  ...data.folders.map((folder) => ({ value: folder.id, label: folder.name })),
                ]}
                onSelect={(value) => setFolderId(value || undefined)}
              />
            </View>
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
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/folders')}
            style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
          >
            <Text allowFontScaling={false} style={{ ...type.small, color: colors.accent }}>
              Create a folder
            </Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollView>
      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom,
          backgroundColor: colors.paper,
          borderTopWidth: 0.5,
          borderTopColor: colors.line,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={existing ? 'Save changes' : 'Save find'}
          accessibilityState={{ disabled: !text.trim() || busy, busy }}
          disabled={!text.trim() || busy}
          onPress={() => void submit()}
          style={{
            minHeight: 60,
            padding: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 9,
            backgroundColor: text.trim() ? colors.ink : colors.soft,
            opacity: busy ? 0.65 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator color={colors.canvas} />
          ) : (
            <Check size={19} color={text.trim() ? colors.canvas : colors.muted} />
          )}
          <Text
            allowFontScaling={false}
            style={{
              color: text.trim() ? colors.canvas : colors.muted,
              fontSize: 15,
              fontWeight: '600',
            }}
          >
            {busy ? 'Saving...' : existing ? 'Save changes' : 'Save find'}
          </Text>
        </Pressable>
      </KeyboardStickyView>
      <FeedbackHost />
    </BlurTargetView>
  );
}
