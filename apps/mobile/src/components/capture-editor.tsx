import { BlurTargetView } from 'expo-blur';
import { useScrollHeader } from './use-scroll-header';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { NavigationBar } from 'expo-navigation-bar';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  EyeOff,
  Pencil,
  Tags,
  Hash,
  Plus,
  X,
  Sparkles,
} from 'lucide-react-native';
import { useCollection } from '../state/collection';
import { Field, IconButton } from './ui';
import { FilterChips } from './filter-chips';
import { ImageCarousel } from './image-carousel';
import { draftItem, type DraftKind } from '../utils/draft';
import { autoDetectClipboardContent, suggestClipboardTags } from '../shared/utils/clipboard';
import { itemText, itemUrl } from '../utils/item';
import { createQuickCaptures } from '../shared/utils/quickCapture';
import type { SavedItem } from '../shared/types';
import { getItemTitle } from '../shared/utils/itemTitle';
import { FeedbackHost } from './feedback';
import { FolderDestination } from './folder-destination';
import { MarkdownContent } from './markdown-content';
import { fonts, radius, space, type } from '../theme';
import { hasSupportedCodeExtension, languageFromPath } from '../utils/code-format';
import { normalizeUrl } from '../shared/utils/fetchPreview';
import {
  readLocalCredential,
  saveLocalCredential,
  deleteLocalCredential,
} from '../utils/local-credentials';

const saveKinds: DraftKind[] = [
  'auto',
  'note',
  'checklist',
  'link',
  'image',
  'markdown',
  'code',
  'secret',
  'credential',
];

type CodeFileDraft = { id: string; path: string; code: string; language: string };
const codeExtension: Record<string, string> = {
  typescript: 'ts',
  javascript: 'js',
  python: 'py',
  swift: 'swift',
  kotlin: 'kt',
  html: 'html',
  css: 'css',
  sql: 'sql',
  bash: 'sh',
  json: 'json',
  text: 'txt',
};

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
    ? existing.attachments?.length
      ? 'auto'
      : existing.type === 'note' && existing.checklist?.length
        ? 'checklist'
        : ['note', 'image', 'markdown', 'code', 'secret', 'credential', 'link'].includes(
              existing.type,
            )
          ? (existing.type as DraftKind)
          : 'auto'
    : saveKinds.includes(requestedKind as DraftKind)
      ? (requestedKind as DraftKind)
      : 'auto';
  const primaryCodeFile =
    existing?.type === 'code'
      ? existing.files?.find((file) => file.code.trim()) || existing.files?.[0]
      : undefined;
  const [kind, setKind] = useState<DraftKind>(initialKind);
  const [text, setText] = useState(
    existing?.type === 'note' && existing.checklist?.length
      ? existing.checklist.map((check) => check.text).join('\n')
      : existing
        ? existing.type === 'image'
          ? ''
          : itemUrl(existing) ||
            (existing.type === 'code' ? primaryCodeFile?.code || existing.code : itemText(existing))
        : '',
  );
  const [images, setImages] = useState<{ uri: string; ratio?: number }[]>(
    existing?.attachments?.length
      ? existing.attachments.map(({ url, aspectRatio }) => ({ uri: url, ratio: aspectRatio }))
      : existing?.type === 'image'
        ? [
            { uri: existing.imageUrl, ratio: existing.mediaAspectRatio },
            ...(existing.additionalImages || []).map(({ url, aspectRatio }) => ({
              uri: url,
              ratio: aspectRatio,
            })),
          ]
        : [],
  );
  const [title, setTitle] = useState(
    existing?.type === 'note' ? getItemTitle(existing) : existing?.title || '',
  );
  const [codeDescription, setCodeDescription] = useState(
    existing?.type === 'code' ? existing.description || '' : '',
  );
  const [imageCaption, setImageCaption] = useState(
    existing?.type === 'image' ? existing.caption || '' : '',
  );
  const [tags, setTags] = useState<string[]>(() => [...new Set(existing?.tags || [])]);
  const [tagDraft, setTagDraft] = useState('');
  const [folderId, setFolderId] = useState<string | undefined>(
    existing?.folderId || (data.folders.some((value) => value.id === folder) ? folder : undefined),
  );
  const [pinned, setPinned] = useState(existing?.isPinned || false);
  const [mediaRatio, setMediaRatio] = useState(existing?.mediaAspectRatio);
  const [language, setLanguage] = useState(
    existing?.type === 'code'
      ? languageFromPath(primaryCodeFile?.path || 'snippet.txt')
      : 'typescript',
  );
  const [codeFiles, setCodeFiles] = useState<CodeFileDraft[]>(() =>
    existing?.type === 'code' && existing.files?.length
      ? existing.files.map((file) => ({
          ...file,
          language: languageFromPath(file.path),
          id: randomUUID(),
        }))
      : [
          {
            id: randomUUID(),
            path: `snippet.${codeExtension[existing?.type === 'code' ? existing.language : 'typescript'] || 'ts'}`,
            code: existing?.type === 'code' ? existing.code : '',
            language: languageFromPath(
              `snippet.${codeExtension[existing?.type === 'code' ? existing.language : 'typescript'] || 'ts'}`,
            ),
          },
        ],
  );
  const [activeCodeFileId, setActiveCodeFileId] = useState(
    () => codeFiles.find((file) => file.code.trim())?.id || codeFiles[0].id,
  );
  const [username, setUsername] = useState(
    existing?.type === 'secret' ? existing.username || '' : '',
  );
  const [notes, setNotes] = useState(existing?.type === 'secret' ? existing.notes || '' : '');
  const [credentialWebsite, setCredentialWebsite] = useState('');
  const [credentialUsername, setCredentialUsername] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [credentialNotes, setCredentialNotes] = useState('');
  const [credentialReady, setCredentialReady] = useState(existing?.type !== 'credential');
  const [showCredentialPassword, setShowCredentialPassword] = useState(false);
  const [details, setDetails] = useState(Boolean(existing?.tags.length));
  const [busy, setBusy] = useState(false);
  const [markdownPreview, setMarkdownPreview] = useState(false);
  const { setError } = state;

  useEffect(() => {
    if (existing?.type !== 'credential') return;
    let active = true;
    void readLocalCredential(existing.id)
      .then((record) => {
        if (!active) return;
        if (!record) throw new Error('This on-device credential could not be found.');
        setCredentialWebsite(record.website);
        setCredentialUsername(record.username);
        setCredentialPassword(record.password);
        setCredentialNotes(record.notes);
        setCredentialReady(true);
      })
      .catch((error: unknown) => {
        if (active) setError(error instanceof Error ? error.message : 'Could not open credential.');
      });
    return () => {
      active = false;
    };
  }, [existing?.id, existing?.type, setError]);
  const insets = useSafeAreaInsets();
  const [imageViewportWidth, setImageViewportWidth] = useState(0);
  const wordCount = text.trim() ? text.trim().split(/\s+/u).length : 0;
  const hasInput =
    kind === 'credential'
      ? credentialReady && !!credentialWebsite.trim() && !!credentialPassword
      : kind === 'image'
        ? images.length > 0
        : kind === 'auto'
          ? !!text.trim() || images.length > 0
          : !!text.trim();
  const tagCount = tags.length;
  const detectedInfo = kind === 'auto' && text.trim() ? autoDetectClipboardContent(text) : null;
  const detectedLabel = detectedInfo
    ? detectedInfo.type === 'x_post'
      ? 'X post'
      : detectedInfo.type
          .split('_')
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join(' ')
    : '';
  const renderKind: DraftKind =
    kind !== 'auto'
      ? kind
      : detectedInfo?.type === 'code'
        ? 'code'
        : detectedInfo?.type === 'markdown'
          ? 'markdown'
          : detectedInfo?.type === 'secret'
            ? 'secret'
            : detectedInfo?.type === 'link' ||
                ['x_post', 'reddit_post', 'instagram_post'].includes(detectedInfo?.type || '')
              ? 'link'
              : 'auto';
  const suggestedTags = detectedInfo
    ? suggestClipboardTags(text).filter((tag) => !tags.includes(tag) && tag !== tagDraft.trim())
    : [];
  const tagActionLabel = tagCount
    ? `Edit ${tagCount} ${tagCount === 1 ? 'tag' : 'tags'}`
    : kind === 'auto' && suggestedTags.length
      ? `Review ${suggestedTags.length} suggestions`
      : 'Add tags';
  const tagActionText = tagCount
    ? `${tagCount} ${tagCount === 1 ? 'tag' : 'tags'}`
    : kind === 'auto' && suggestedTags.length
      ? `${suggestedTags.length} to add`
      : 'Add tags';
  const updateTagDraft = (value: string) => {
    const parts = value.split(',');
    const added = parts
      .slice(0, -1)
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (added.length) setTags((current) => [...new Set([...current, ...added])].slice(0, 30));
    setTagDraft(parts[parts.length - 1] || '');
  };
  const commitTagDraft = () => {
    const value = tagDraft.trim();
    if (!value) return;
    setTags((current) => [...new Set([...current, value])].slice(0, 30));
    setTagDraft('');
  };
  const activeCodeFile = codeFiles.find((file) => file.id === activeCodeFileId) || codeFiles[0];
  const changeCode = (value: string) => {
    setText(value);
    setCodeFiles((files) =>
      files.map((file) => (file.id === activeCodeFileId ? { ...file, code: value } : file)),
    );
  };
  const selectCodeFile = (file: CodeFileDraft) => {
    setActiveCodeFileId(file.id);
    setText(file.code);
    setLanguage(file.language);
  };
  const addCodeFile = () => {
    const extension = activeCodeFile.path.match(/\.([^.\/\\]+)$/)?.[1] || 'txt';
    let index = codeFiles.length + 1;
    let path = `file-${index}.${extension}`;
    while (codeFiles.some((file) => file.path === path)) path = `file-${++index}.${extension}`;
    const file = { id: randomUUID(), path, code: '', language: languageFromPath(path) };
    setCodeFiles((files) => [...files, file]);
    selectCodeFile(file);
  };
  const removeCodeFile = () => {
    if (codeFiles.length < 2) return;
    const nextFiles = codeFiles.filter((file) => file.id !== activeCodeFileId);
    setCodeFiles(nextFiles);
    selectCodeFile(nextFiles[0]);
  };
  const renameCodeFile = (path: string) => {
    setCodeFiles((files) =>
      files.map((file) =>
        file.id === activeCodeFileId ? { ...file, path, language: languageFromPath(path) } : file,
      ),
    );
    setLanguage(languageFromPath(path));
  };
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
      if (kind !== 'auto') {
        setText('');
        setKind('image');
      }
      const image = picked[0].image;
      if (picked.length === 1 && picked[0].ratio) setMediaRatio(picked[0].ratio);
      if (!title && picked.length === 1)
        setTitle(image.fileName?.replace(/\.[^.]+$/, '') || 'Image');
    } catch (error) {
      setError((error as Error).message);
    }
  };
  const createImageEntry = (target?: SavedItem): SavedItem => {
    const [cover, ...additionalImages] = images;
    const imageItem = draftItem('image', cover.uri, title, target, randomUUID);
    if (imageItem.type !== 'image') throw new Error('Could not prepare these images.');
    return {
      ...imageItem,
      caption: imageCaption.trim() || undefined,
      mediaAspectRatio: cover.ratio,
      additionalImages: additionalImages.length
        ? additionalImages.map(({ uri, ratio }) => ({ url: uri, aspectRatio: ratio }))
        : undefined,
    };
  };
  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      let items: SavedItem[];

      if (kind === 'auto') {
        items = text.trim()
          ? createQuickCaptures(
              text,
              existing ? data.items.filter((item) => item.id !== id) : data.items,
            ).items
          : existing && images.length
            ? [existing]
            : [];
        if (existing)
          items = items
            .slice(0, 1)
            .map((item) =>
              item.type === existing.type && itemUrl(item) && itemUrl(item) === itemUrl(existing)
                ? existing
                : { ...item, id: existing.id, createdAt: existing.createdAt },
            );
        if (images.length && items.length === 1) {
          items = [
            {
              ...items[0],
              attachments: images.map(({ uri, ratio }) => ({ url: uri, aspectRatio: ratio })),
            },
          ];
        } else if (images.length) items.push(createImageEntry());
        if (!items.length) throw new Error('This is already in your collection.');
      } else if (kind === 'image' && images.length) {
        items = [createImageEntry(existing)];
      } else if (kind === 'credential') {
        if (!credentialReady) throw new Error('Wait for this on-device credential to load.');
        if (!credentialWebsite.trim()) throw new Error('Enter the website for this credential.');
        if (!credentialPassword) throw new Error('Enter the password for this credential.');
        const website = normalizeUrl(credentialWebsite.trim());
        const parsedWebsite = new URL(website);
        if (!['http:', 'https:'].includes(parsedWebsite.protocol))
          throw new Error('Enter a website that starts with http or https.');
        items = [draftItem('credential', parsedWebsite.hostname, title, existing, randomUUID)];
      } else {
        const code =
          kind === 'code' && !text.trim()
            ? codeFiles.find((file) => file.code.trim())?.code || ''
            : text;
        items = [draftItem(kind, code, title, existing, randomUUID)];
      }

      const cleanTags = [
        ...new Set([...tags, tagDraft].map((tag) => tag.trim()).filter(Boolean)),
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

        if (item.type === 'code') {
          const files = codeFiles.map((file) => ({
            path: (file.id === activeCodeFileId ? activeCodeFile.path : file.path).trim(),
            code: file.id === activeCodeFileId ? text : file.code,
            language: languageFromPath(
              file.id === activeCodeFileId ? activeCodeFile.path : file.path,
            ),
          }));
          if (
            files.some((file) => !file.path) ||
            new Set(files.map((file) => file.path)).size !== files.length
          )
            throw new Error('Give every code file a unique path.');
          const primaryFile = files.find((file) => file.code.trim()) || files[0];
          item = {
            ...item,
            title: title.trim() || primaryFile.path.split(/[\\/]/).pop() || 'Code snippet',
            code: primaryFile.code,
            language: primaryFile.language,
            description: codeDescription.trim() || undefined,
            files,
          };
        }
        if (item.type === 'secret') item = { ...item, username, notes };
        if (item.type === 'credential') {
          await saveLocalCredential(item.id, {
            website: normalizeUrl(credentialWebsite.trim()),
            username: credentialUsername,
            password: credentialPassword,
            notes: credentialNotes,
          });
        }
        await state.save(item);
        if (existing?.type === 'credential' && item.type !== 'credential')
          await deleteLocalCredential(existing.id);
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
        options={{
          ...headerOptions,
          title: existing ? 'Edit find' : 'Keep something',
          headerRight: () => (
            <IconButton
              label={pinned ? 'Unpin save' : 'Pin save'}
              icon={Pin}
              active={pinned}
              onPress={() => setPinned((value) => !value)}
            />
          ),
        }}
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
          paddingTop: topInset + 4,
          gap: 12,
          paddingBottom: insets.bottom + 110,
          maxWidth: 720,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {!existing && (
          <FilterChips
            edgeInset={space.lg}
            value={kind}
            onSelect={setKind}
            options={saveKinds.map((value) => ({
              value,
              label: value === 'auto' ? 'Anything' : value[0].toUpperCase() + value.slice(1),
            }))}
          />
        )}
        <View
          style={{
            borderRadius: 24,
            backgroundColor: colors.paper,
            borderWidth: 0.5,
            borderColor: colors.line,
            overflow: 'hidden',
          }}
        >
          {detectedInfo && !existing && (
            <View
              style={{
                minHeight: 42,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 18,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.line,
              }}
            >
              <Sparkles size={14} color={colors.accent} strokeWidth={1.7} />
              <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                DETECTED AS
              </Text>
              <Text
                allowFontScaling={false}
                style={{ ...type.small, color: colors.ink, fontWeight: '600' }}
              >
                {detectedLabel}
              </Text>
            </View>
          )}
          {kind === 'auto' && images.length > 0 && (
            <View
              onLayout={({ nativeEvent }) => setImageViewportWidth(nativeEvent.layout.width)}
              style={{ paddingTop: 10 }}
            >
              <ImageCarousel
                photos={images}
                width={imageViewportWidth}
                onRemove={(index) => setImages((current) => current.filter((_, i) => i !== index))}
              />
            </View>
          )}
          {kind === 'auto' && renderKind === 'code' ? (
            <View style={{ padding: 16, gap: 8 }}>
              <Field
                accessibilityLabel="Detected code content"
                placeholder="Write or paste code…"
                value={text}
                onChangeText={setText}
                editable={!busy}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  minHeight: 230,
                  textAlignVertical: 'top',
                  fontFamily: fonts.mono,
                  fontSize: 14,
                  lineHeight: 23,
                  color: colors.ink,
                  backgroundColor: colors.canvas,
                  padding: 14,
                  borderRadius: 12,
                }}
              />
              <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                {text ? `${text.split('\n').length} lines of code` : 'Code detected'}
              </Text>
            </View>
          ) : kind === 'image' ? (
            <View
              onLayout={({ nativeEvent }) => setImageViewportWidth(nativeEvent.layout.width)}
              style={{ paddingVertical: 12 }}
            >
              {images.length > 0 && (
                <ImageCarousel
                  photos={images}
                  width={imageViewportWidth}
                  onRemove={(index) =>
                    setImages((current) => current.filter((_, i) => i !== index))
                  }
                />
              )}
              {!images.length && (
                <Text
                  allowFontScaling={false}
                  style={{ ...type.small, color: colors.muted, padding: 10 }}
                >
                  Choose one or more images to keep.
                </Text>
              )}
            </View>
          ) : renderKind === 'markdown' && markdownPreview ? (
            <View style={{ minHeight: 190, padding: 18 }}>
              {text.trim() ? (
                <MarkdownContent text={text} />
              ) : (
                <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                  Your Markdown preview will appear here.
                </Text>
              )}
            </View>
          ) : kind === 'checklist' ? (
            <View style={{ padding: 18, gap: 8 }}>
              {text.split('\n').map((line, index, lines) => (
                <View
                  key={index}
                  style={{
                    minHeight: 48,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    borderBottomWidth: 0.5,
                    borderBottomColor: colors.line,
                  }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      borderWidth: 1,
                      borderColor: colors.line,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Field
                    accessibilityLabel={`Checklist task ${index + 1}`}
                    placeholder={index === 0 ? 'First thing to do' : 'Add another task'}
                    value={line}
                    onChangeText={(value) =>
                      setText(lines.map((entry, row) => (row === index ? value : entry)).join('\n'))
                    }
                    editable={!busy}
                    onSubmitEditing={() => setText((value) => `${value}\n`)}
                    returnKeyType="next"
                    style={{
                      flex: 1,
                      minHeight: 46,
                      backgroundColor: 'transparent',
                      paddingHorizontal: 0,
                    }}
                  />
                  {lines.length > 1 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove task ${index + 1}`}
                      onPress={() => setText(lines.filter((_, row) => row !== index).join('\n'))}
                      hitSlop={8}
                    >
                      <X size={16} color={colors.muted} />
                    </Pressable>
                  )}
                </View>
              ))}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add checklist task"
                onPress={() => setText((value) => `${value}${value.endsWith('\n') ? '' : '\n'}`)}
                style={{ minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9 }}
              >
                <Plus size={17} color={colors.accent} />
                <Text allowFontScaling={false} style={{ ...type.small, color: colors.accent }}>
                  Add task
                </Text>
              </Pressable>
            </View>
          ) : kind === 'code' ? (
            <View style={{ padding: 16, gap: 4 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: 34,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                    FILES
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{ ...type.caption, color: colors.accent, fontFamily: fonts.mono }}
                  >
                    {String(codeFiles.length).padStart(2, '0')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {codeFiles.length > 1 && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${activeCodeFile.path}`}
                      onPress={removeCodeFile}
                      style={{
                        width: 36,
                        height: 36,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={16} color={colors.muted} />
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add code file"
                    onPress={addCodeFile}
                    style={{ minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5 }}
                  >
                    <Plus size={16} color={colors.accent} />
                    <Text allowFontScaling={false} style={{ ...type.small, color: colors.accent }}>
                      New file
                    </Text>
                  </Pressable>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{
                  height: 40,
                  maxHeight: 40,
                  flexGrow: 0,
                  flexShrink: 0,
                  marginBottom: 6,
                }}
                contentContainerStyle={{
                  height: 40,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.line,
                }}
              >
                {codeFiles.map((file) =>
                  file.id === activeCodeFileId ? (
                    <Field
                      key={file.id}
                      accessibilityLabel={`Filename, ${file.path}`}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: true }}
                      value={file.path}
                      onChangeText={renameCodeFile}
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!busy}
                      selectTextOnFocus
                      style={{
                        width: Math.min(
                          220,
                          Math.max(96, file.path.split(/[\\/]/).pop()!.length * 7 + 20),
                        ),
                        minHeight: 40,
                        height: 40,
                        padding: 0,
                        paddingVertical: 0,
                        borderRadius: 0,
                        backgroundColor: 'transparent',
                        borderBottomWidth: 2,
                        borderBottomColor: hasSupportedCodeExtension(file.path)
                          ? colors.accent
                          : colors.danger,
                        color: hasSupportedCodeExtension(file.path) ? colors.ink : colors.danger,
                        fontFamily: fonts.mono,
                        fontSize: 12,
                        textAlign: 'center',
                        includeFontPadding: false,
                      }}
                    />
                  ) : (
                    <Pressable
                      key={file.id}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: false }}
                      onPress={() => selectCodeFile(file)}
                      style={{ minHeight: 40, justifyContent: 'center', paddingHorizontal: 12 }}
                    >
                      <Text
                        allowFontScaling={false}
                        numberOfLines={1}
                        style={{
                          color: hasSupportedCodeExtension(file.path)
                            ? colors.muted
                            : colors.danger,
                          fontFamily: fonts.mono,
                          fontSize: 12,
                        }}
                      >
                        {file.path.split(/[\\/]/).pop()}
                      </Text>
                    </Pressable>
                  ),
                )}
              </ScrollView>
              <Field
                accessibilityLabel="Code file contents"
                placeholder="Write or paste code…"
                value={text}
                onChangeText={changeCode}
                editable={!busy}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                style={{
                  minHeight: 260,
                  textAlignVertical: 'top',
                  fontFamily: fonts.mono,
                  fontSize: 14,
                  lineHeight: 23,
                  color: colors.ink,
                  backgroundColor: colors.canvas,
                  padding: 14,
                  borderRadius: 12,
                }}
              />
              <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                {text ? `${text.split('\n').length} lines` : 'Empty file'} · {language} from the
                file extension
              </Text>
            </View>
          ) : kind === 'credential' ? (
            <View style={{ gap: 8, paddingHorizontal: 18, paddingVertical: 14 }}>
              <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                LOCAL ONLY · NEVER SYNCED OR SENT TO AI
              </Text>
              <Field
                accessibilityLabel="Website"
                placeholder="Website (example.com)"
                value={credentialWebsite}
                onChangeText={setCredentialWebsite}
                editable={!busy && credentialReady}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={{
                  minHeight: 44,
                  paddingHorizontal: 4,
                  paddingVertical: 4,
                  borderRadius: 0,
                  backgroundColor: 'transparent',
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.line,
                }}
              />
              <Field
                accessibilityLabel="Username or email"
                placeholder="Username or email (optional)"
                value={credentialUsername}
                onChangeText={setCredentialUsername}
                editable={!busy && credentialReady}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={{
                  minHeight: 44,
                  paddingHorizontal: 4,
                  paddingVertical: 4,
                  borderRadius: 0,
                  backgroundColor: 'transparent',
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.line,
                }}
              />
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.line,
                }}
              >
                <Field
                  accessibilityLabel="Password"
                  placeholder="Password"
                  value={credentialPassword}
                  onChangeText={setCredentialPassword}
                  editable={!busy && credentialReady}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={!showCredentialPassword}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    paddingHorizontal: 4,
                    paddingVertical: 4,
                    borderRadius: 0,
                    backgroundColor: 'transparent',
                  }}
                />
                <IconButton
                  label={showCredentialPassword ? 'Hide password' : 'Show password'}
                  icon={showCredentialPassword ? EyeOff : Eye}
                  onPress={() => setShowCredentialPassword((value) => !value)}
                />
              </View>
              <Field
                accessibilityLabel="Private credential note"
                placeholder="Note (optional)"
                value={credentialNotes}
                onChangeText={setCredentialNotes}
                editable={!busy && credentialReady}
                multiline
                style={{
                  minHeight: 52,
                  paddingHorizontal: 4,
                  paddingVertical: 8,
                  borderRadius: 0,
                  backgroundColor: 'transparent',
                  textAlignVertical: 'center',
                }}
              />
            </View>
          ) : (
            <Field
              accessibilityLabel="Content"
              placeholder={
                renderKind === 'secret'
                  ? 'Enter your secret'
                  : renderKind === 'link'
                    ? 'Paste a link here...'
                    : renderKind === 'note'
                      ? 'Write a thought worth keeping...'
                      : renderKind === 'markdown'
                        ? 'Paste or write Markdown...'
                        : 'Paste a link, note, or idea...'
              }
              value={text}
              onChangeText={setText}
              editable={!busy}
              multiline={renderKind !== 'secret'}
              secureTextEntry={renderKind === 'secret'}
              autoCapitalize={
                ['link', 'image', 'code', 'secret'].includes(renderKind) ? 'none' : 'sentences'
              }
              autoCorrect={!['link', 'image', 'code', 'secret'].includes(renderKind)}
              style={{
                minHeight: renderKind === 'secret' ? 76 : 190,
                fontFamily: renderKind === 'code' ? fonts.mono : undefined,
                fontSize: renderKind === 'code' ? 14 : 18,
                lineHeight: renderKind === 'code' ? 23 : 28,
                textAlignVertical: 'top',
                backgroundColor: renderKind === 'code' ? colors.canvas : 'transparent',
                padding: 18,
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
            {renderKind === 'markdown' && (
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
                    .then((value) => (kind === 'code' ? changeCode(value) : setText(value)))
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
            {kind !== 'code' && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose a photo"
                disabled={busy}
                onPress={() => void pickImage()}
                style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 7 }}
              >
                <ImagePlus size={17} color={colors.muted} strokeWidth={1.6} />
                <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                  {images.length ? 'Add photos' : 'Photo'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
            TITLE
          </Text>
          <Field
            accessibilityLabel="Title"
            placeholder={kind === 'code' ? 'Code title (optional)' : 'Add a title (optional)'}
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
          <View style={{ gap: 6 }}>
            <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
              WHAT IT DOES · OPTIONAL
            </Text>
            <Field
              accessibilityLabel="Code description"
              placeholder="A short note about what this code does"
              value={codeDescription}
              onChangeText={setCodeDescription}
              editable={!busy}
              multiline
              style={{ minHeight: 66, textAlignVertical: 'top' }}
            />
          </View>
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tagActionLabel}
              accessibilityHint="Review suggested tags or add your own"
              accessibilityState={{ expanded: details }}
              onPress={() => setDetails((value) => !value)}
              style={({ pressed }) => ({
                minHeight: 50,
                width: 108,
                justifyContent: 'center',
                gap: 3,
                opacity: pressed ? 0.64 : 1,
              })}
            >
              <Text
                allowFontScaling={false}
                style={{ ...type.caption, color: colors.accent, fontSize: 10, letterSpacing: 1.1 }}
              >
                TAGS
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Tags
                  size={15}
                  color={tagCount || details ? colors.accent : colors.muted}
                  strokeWidth={1.6}
                />
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{
                    flexShrink: 1,
                    ...type.small,
                    color: tagCount || details ? colors.ink : colors.muted,
                    fontWeight: tagCount ? '600' : '400',
                  }}
                >
                  {tagActionText}
                </Text>
                {details ? (
                  <ChevronUp size={14} color={colors.accent} />
                ) : (
                  <ChevronDown size={14} color={colors.muted} />
                )}
              </View>
            </Pressable>
          </View>
          {details && (
            <View
              style={{
                minHeight: 58,
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 8,
                padding: 10,
                borderRadius: radius.card,
                borderWidth: 0.5,
                borderColor: colors.line,
                backgroundColor: colors.paper,
              }}
            >
              {tags.map((tag, index) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove tag ${tag}`}
                  disabled={busy}
                  onPress={() => setTags((current) => current.filter((_, i) => i !== index))}
                  key={`${tag}-${index}`}
                  style={{
                    minHeight: 40,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 7,
                    paddingLeft: 11,
                    paddingRight: 10,
                    borderRadius: radius.pill,
                    backgroundColor: colors.soft,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={{ ...type.small, color: colors.ink, maxWidth: 190 }}
                  >
                    {tag}
                  </Text>
                  <X size={14} color={colors.muted} strokeWidth={1.8} />
                </Pressable>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flexGrow: 1 }}>
                <Hash size={16} color={colors.accent} strokeWidth={1.7} />
                <Field
                  accessibilityLabel="Add a tag"
                  placeholder={tags.length ? 'Add another' : 'Add a tag'}
                  value={tagDraft}
                  onChangeText={updateTagDraft}
                  onSubmitEditing={commitTagDraft}
                  returnKeyType="done"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!busy}
                  style={{
                    flex: 1,
                    minWidth: 120,
                    minHeight: 38,
                    padding: 0,
                    fontSize: 15,
                    backgroundColor: 'transparent',
                  }}
                />
              </View>
              {kind === 'auto' && suggestedTags.length > 0 && (
                <View style={{ width: '100%', gap: 7, paddingTop: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={13} color={colors.accent} strokeWidth={1.7} />
                    <Text
                      allowFontScaling={false}
                      style={{ ...type.caption, color: colors.muted, letterSpacing: 0.8 }}
                    >
                      SUGGESTED TAGS
                    </Text>
                    <Text allowFontScaling={false} style={{ ...type.caption, color: colors.muted }}>
                      · tap to add
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {suggestedTags.map((tag) => (
                      <Pressable
                        key={tag}
                        accessibilityRole="button"
                        accessibilityLabel={`Add suggested tag ${tag}`}
                        disabled={busy || tags.length >= 30}
                        onPress={() =>
                          setTags((current) => [...new Set([...current, tag])].slice(0, 30))
                        }
                        style={{
                          minHeight: 36,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          paddingHorizontal: 11,
                          borderRadius: radius.pill,
                          borderWidth: 0.5,
                          borderColor: colors.line,
                          opacity: busy || tags.length >= 30 ? 0.5 : 1,
                        }}
                      >
                        <Plus size={13} color={colors.accent} strokeWidth={1.8} />
                        <Text allowFontScaling={false} style={{ ...type.small, color: colors.ink }}>
                          {tag}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
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
            disabled: !hasInput || busy,
            busy,
          }}
          disabled={!hasInput || busy}
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
      <FeedbackHost placement="bottom" />
    </BlurTargetView>
  );
}
