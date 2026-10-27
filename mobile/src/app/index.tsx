import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  BackHandler,
  TextInput,
  type TextInputInstance,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewProps,
} from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import Animated, {
  Easing,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Image from 'react-native-fast-image';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { BlurTargetView } from 'expo-blur';
import { useScrollHeader } from '../components/use-scroll-header';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckSquare,
  Trash2,
  X,
  ArrowUpRight,
  Undo2,
  ArrowDownUp,
  LayoutGrid,
  List,
  Maximize2,
  Clipboard,
  Folder,
  Plus,
  UserRound,
} from 'lucide-react-native';
import * as ClipboardAPI from 'expo-clipboard';
import { useCollection } from '../state/collection';
import { Action, CollectionSearch, GoogleMark, IconButton } from '../components/ui';
import { FilterChips } from '../components/filter-chips';
import { BrandMark } from '../components/brand-mark';
import { PlusCard } from '../components/plus-card';
import { CardContextMenu } from '../components/card-context-menu';
import { SaveCard, type CardAnchor } from '../components/save-card';
import { CollectionCell, CollectionMotion } from '../components/collection-motion';
import { itemText } from '../utils/item';
import { draftItem } from '../utils/draft';
import { captureScroll } from '../utils/capture-scroll';
import { captureFrame } from '../utils/capture-frame';
import { useQuickAi } from '../components/use-quick-ai';
import { DeleteSheet } from '../components/delete-sheet';
import { toggleSelection, toggleVisibleSelection } from '../utils/selection';
import { QuickCaptureToolbar } from '../components/quick-capture-toolbar';
import { AiEditorLight } from '../components/ai-editor-light';
import { MarkdownContent } from '../components/markdown-content';
import type { SavedItem } from '../shared/types';
import { fonts, space, type } from '../theme';

export default function Home() {
  const state = useCollection();
  const { targetRef, topInset, onScroll, options: headerOptions } = useScrollHeader();
  const { colors, data } = state;
  const { folder } = useLocalSearchParams<{ folder?: string }>();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [layout, setLayout] = useState('grid');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [viewHeight, setViewHeight] = useState(0);
  const [quickText, setQuickText] = useState('');
  const quickRef = useRef<TextInputInstance>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const ai = useQuickAi(captureOpen, quickText, setQuickText);
  const hasText = Boolean(quickText.trim());
  const [editingId, setEditingId] = useState<string | null>(null);
  const rendered =
    captureOpen &&
    !!ai.generated &&
    editingId !== ai.generated.id &&
    (!ai.enabled || ai.phase === 'streaming');
  const responseRef = useRef<ScrollViewInstance>(null);
  const followResponse = useRef(true);
  useEffect(() => {
    followResponse.current = true;
  }, [ai.generated?.id]);
  const dismissCapture = useCallback(() => {
    quickRef.current?.blur();
    Keyboard.dismiss();
    setCaptureOpen(false);
  }, []);
  const [saving, setSaving] = useState(false);
  const aiWorking = ai.phase !== 'idle';
  const [controlsHeight, setControlsHeight] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [deleteIds, setDeleteIds] = useState<readonly string[] | null>(null);
  const startSelection = useCallback(
    (ids: string[] = []) => {
      dismissCapture();
      setSelectedIds(ids);
    },
    [dismissCapture],
  );
  const selecting = selectedIds !== null;
  const selectedSet = useMemo(() => new Set(selectedIds || []), [selectedIds]);
  const toggleCard = useCallback((id: string) => {
    setSelectedIds((current) => (current === null ? current : toggleSelection(current, id)));
  }, []);
  useEffect(() => {
    if (!selecting || deleteIds) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSelectedIds(null);
      return true;
    });
    return () => subscription.remove();
  }, [selecting, deleteIds]);
  const [context, setContext] = useState<CardAnchor | null>(null);
  const liftedId = useSharedValue<string | null>(null);
  const [contextReady, setContextReady] = useState(false);
  const showContext = useCallback((anchor: CardAnchor) => {
    setContextReady(false);
    setContext(anchor);
  }, []);
  const previewReady = useCallback(() => {
    if (!context) return;
    liftedId.set(context.id);
    setContextReady(true);
  }, [context, liftedId]);
  const hiddenId = contextReady ? context?.id : undefined;
  const listExtraData = useMemo(
    () => ({ layout, hiddenId, selectedIds }),
    [layout, hiddenId, selectedIds],
  );
  const contextItem = data.items.find((item) => item.id === context?.id);
  const openCapture = () => {
    Keyboard.dismiss();
    router.push({ pathname: '/capture', params: folder ? { folder } : {} });
  };
  const reducedMotion = useReducedMotion();
  const listRef = useRef<FlashListRef<SavedItem>>(null);
  const motionEnabled = useSharedValue(false);
  const prepareTransition = () => {
    if (!reducedMotion) listRef.current?.prepareForLayoutAnimationRender();
    motionEnabled.set(!reducedMotion);
  };
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();
  const captureHeight = 58 + insets.bottom;
  const expanded = useSharedValue(false);
  useEffect(() => {
    expanded.set(captureOpen);
    if (!captureOpen) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissCapture();
      return true;
    });
    return () => subscription.remove();
  }, [captureOpen, dismissCapture, expanded]);
  const scrollState = useRef({ offset: 0, travel: 0, hidden: false });
  const captureHidden = useSharedValue(false);
  const capturePinned = useSharedValue(false);
  useEffect(() => {
    capturePinned.set(saving || captureOpen);
  }, [capturePinned, saving, captureOpen]);
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      onScroll(event);
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const next = captureScroll(
        scrollState.current,
        contentOffset.y,
        contentSize.height - layoutMeasurement.height,
      );
      if (next.hidden !== scrollState.current.hidden) captureHidden.set(next.hidden);
      scrollState.current = next;
    },
    [captureHidden, onScroll],
  );
  const fullPanelHeight = Math.max(captureHeight, (viewHeight || height) - topInset);
  const panelHeight = useDerivedValue(() =>
    withTiming(expanded.get() ? fullPanelHeight : captureHeight, {
      duration: reducedMotion ? 0 : 240,
      easing: Easing.out(Easing.quad),
    }),
  );
  // The reveal clips a fixed-size editor so expansion does not reflow its text each frame.
  const captureBodyStyle = useAnimatedStyle(() => {
    const frame = captureFrame(
      expanded.get() ? fullPanelHeight : captureHeight,
      keyboard.height.get(),
      insets.bottom,
      keyboard.progress.get(),
      expanded.get(),
      0,
    );
    return { height: frame.height, paddingBottom: frame.paddingBottom };
  });
  const expandProgress = useDerivedValue(() =>
    withTiming(expanded.get() ? 1 : 0, {
      duration: reducedMotion ? 0 : 240,
      easing: Easing.out(Easing.quad),
    }),
  );
  const homeHeaderStyle = useAnimatedStyle(() => {
    const p = expandProgress.get();
    return {
      opacity: interpolate(p, [0, 0.45], [1, 0]),
      transform: [{ translateY: interpolate(p, [0, 0.45], [0, -5]) }],
    };
  });
  const captureHeaderStyle = useAnimatedStyle(() => {
    const p = expandProgress.get();
    return {
      opacity: interpolate(p, [0.4, 1], [0, 1]),
      transform: [{ translateY: interpolate(p, [0.4, 1], [5, 0]) }],
    };
  });
  const scrollOffset = useDerivedValue(() =>
    withTiming(
      captureHidden.get() && !capturePinned.get() && !reducedMotion
        ? captureHeight + insets.bottom + 30
        : 0,
      { duration: reducedMotion ? 0 : 180, easing: Easing.bezier(0.23, 1, 0.32, 1) },
    ),
  );
  const captureStyle = useAnimatedStyle(() => {
    const hidden = captureHidden.get() && !capturePinned.get();
    const frame = captureFrame(
      panelHeight.get(),
      keyboard.height.get(),
      insets.bottom,
      keyboard.progress.get(),
      expanded.get(),
      scrollOffset.get(),
    );
    return {
      height: frame.height,
      opacity: withTiming(hidden ? 0 : 1, { duration: reducedMotion ? 0 : 150 }),
      transform: [
        {
          translateY: frame.translateY,
        },
      ],
    };
  });
  const selectionBarStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboard.height.get() + insets.bottom * keyboard.progress.get() }],
  }));
  const captureProps = useAnimatedProps<ViewProps>(() => {
    const hidden = captureHidden.get() && !capturePinned.get();
    return {
      pointerEvents: hidden ? 'none' : 'auto',
      accessibilityElementsHidden: hidden,
      importantForAccessibility: hidden ? 'no-hide-descendants' : 'auto',
    };
  });
  const captureInset = selecting ? insets.bottom + 88 : captureHeight + 20;
  const columns = layout === 'grid' ? (width >= 800 ? 3 : width >= 350 ? 2 : 1) : 1;
  const items = useMemo(
    () =>
      data.items
        .filter((item) => {
          if (folder && item.folderId !== folder) return false;
          if (filter === 'pinned' && !item.isPinned) return false;
          if (
            !['all', 'pinned'].includes(filter) &&
            item.type !== filter &&
            !(filter === 'link' && item.type.endsWith('_post'))
          )
            return false;
          return `${item.title} ${item.tags.join(' ')} ${item.type === 'secret' ? '' : itemText(item)}`
            .toLowerCase()
            .includes(query.toLowerCase());
        })
        .sort(
          (a, b) =>
            Number(b.isPinned) - Number(a.isPinned) ||
            (sort === 'title'
              ? a.title.localeCompare(b.title)
              : sort === 'oldest'
                ? a.createdAt - b.createdAt
                : b.createdAt - a.createdAt),
        ),
    [data.items, folder, filter, query, sort],
  );
  const quickSave = async (draft?: string) => {
    if (saving) return;
    setSaving(true);
    try {
      state.setError('');
      const text = draft ?? (await ClipboardAPI.getStringAsync());
      const generated = ai.generated;
      if (generated && draft !== undefined) {
        const item = draftItem(
          'markdown',
          text,
          text
            .trim()
            .split('\n')[0]
            .replace(/^#{1,6}\s+/, '')
            .slice(0, 90),
          undefined,
          () => generated.id,
        );
        await state.save({ ...item, folderId: folder });
        state.setNotice('Saved to your collection');
      } else await state.capture(text, false, folder);
      ai.reset();
      setQuickText('');
      dismissCapture();
    } catch (error) {
      state.setError(error instanceof Error ? error.message : 'Could not save these links.');
    } finally {
      setSaving(false);
    }
  };
  const quickSaveText = () => void quickSave(quickText);
  const handleEdit = useCallback(() => {
    setEditingId(rendered ? ai.generated!.id : null);
    if (rendered) requestAnimationFrame(() => quickRef.current?.focus());
    else Keyboard.dismiss();
  }, [rendered, ai.generated]);
  const collectionMotion = useMemo(
    () => ({ enabled: motionEnabled, ids: items.map((item) => item.id), liftedId }),
    [motionEnabled, items, liftedId],
  );
  const folderName = data.folders.find((value) => value.id === folder)?.name;
  const controls = (
    <View
      onLayout={({ nativeEvent }) => setControlsHeight(nativeEvent.layout.height)}
      style={{ paddingHorizontal: 6, paddingTop: 6, paddingBottom: 10, gap: 4 }}
    >
      <View style={{ marginBottom: 8 }}>
        <CollectionSearch
          label={folderName ? `Search ${folderName}` : 'Search saves'}
          placeholder={folderName ? `Search ${folderName}\u2026` : 'Find it again\u2026'}
          value={query}
          onChangeText={setQuery}
          trailing={
            <View style={{ flexDirection: 'row' }}>
              <IconButton
                label={selecting ? 'Cancel selection' : 'Select multiple finds'}
                icon={selecting ? X : CheckSquare}
                active={selecting}
                onPress={() => (selecting ? setSelectedIds(null) : startSelection())}
              />
              <IconButton
                label="Browse folders"
                icon={Folder}
                active={!!folder}
                onPress={() => router.push('/folders')}
              />
            </View>
          }
        />
      </View>
      <FilterChips
        edgeInset={space.md + 6}
        value={filter}
        onSelect={(value) => {
          if (value === filter) return;
          prepareTransition();
          setFilter(value);
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change sort order"
          onPress={() => {
            prepareTransition();
            setSort((value) =>
              value === 'newest' ? 'oldest' : value === 'oldest' ? 'title' : 'newest',
            );
          }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 }}
        >
          <ArrowDownUp size={13} color={colors.muted} />
          <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
            {sort === 'newest' ? 'Latest first' : sort === 'oldest' ? 'Oldest first' : 'A to Z'}
          </Text>
        </Pressable>
        <View style={{ flexDirection: 'row' }}>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 5,
              height: 34,
              borderRadius: 10,
              backgroundColor: colors.paper,
              borderWidth: 0.5,
              borderColor: colors.line,
            }}
          />
          {[
            { value: 'grid', label: 'Grid view', Icon: LayoutGrid },
            { value: 'list', label: 'List view', Icon: List },
            { value: 'focus', label: 'Focus view', Icon: Maximize2 },
          ].map(({ value, label, Icon }) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={label}
              accessibilityState={{ selected: layout === value }}
              onPress={() => {
                if (layout !== value) {
                  prepareTransition();
                  setLayout(value);
                }
              }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                overflow: 'hidden',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                collapsable={false}
                style={{
                  width: 40,
                  height: 28,
                  borderRadius: 7,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: layout === value ? colors.ink : 'transparent',
                }}
              >
                <Icon
                  size={17}
                  color={layout === value ? colors.canvas : colors.muted}
                  strokeWidth={layout === value ? 1.9 : 1.5}
                />
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
  const screenOptions = useMemo(
    () => ({
      ...headerOptions,
      title: 'anything.',
      headerTitle: () => null,
      headerLeft: () => (
        <View style={{ height: 44, justifyContent: 'center', minWidth: 160 }}>
          {/* Home Brandmark Title */}
          <Animated.View
            pointerEvents={captureOpen ? 'none' : 'auto'}
            style={[
              { flexDirection: 'row', alignItems: 'center', gap: 8, position: 'absolute', left: 0 },
              homeHeaderStyle,
            ]}
          >
            <BrandMark size={30} />
            <Text
              allowFontScaling={false}
              style={{
                color: colors.ink,
                fontSize: 20,
                fontWeight: '600',
                letterSpacing: -0.8,
              }}
            >
              anything.
            </Text>
          </Animated.View>

          {/* Quick Add Header Title */}
          <Animated.View
            pointerEvents={captureOpen ? 'auto' : 'none'}
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                position: 'absolute',
                left: 0,
              },
              captureHeaderStyle,
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back"
              onPress={dismissCapture}
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
              New find
            </Text>
          </Animated.View>
        </View>
      ),
      headerRight: () => (
        <View style={{ width: 128, height: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* Home Settings Icon */}
          <Animated.View
            pointerEvents={captureOpen ? 'none' : 'auto'}
            style={[
              StyleSheet.absoluteFill,
              { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'flex-end' },
              homeHeaderStyle,
            ]}
          >
            <PlusCard compact />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Account and settings"
              onPress={() => router.push('/settings')}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              {state.user?.photoURL ? (
                <Image
                  source={{ uri: state.user.photoURL }}
                  style={{ width: 32, height: 32, borderRadius: 16 }}
                />
              ) : (
                <UserRound size={21} color={colors.ink} strokeWidth={1.5} />
              )}
            </Pressable>
          </Animated.View>

          {/* Quick Add Undo Icon */}
          {ai.generated && (
            <Animated.View
              pointerEvents={captureOpen ? 'auto' : 'none'}
              style={[
                { position: 'absolute', right: 0, top: 0, width: 44, height: 44 },
                { alignItems: 'center', justifyContent: 'center' },
                captureHeaderStyle,
              ]}
            >
              <IconButton
                label="Restore original request"
                icon={Undo2}
                disabled={saving || aiWorking}
                onPress={ai.undo}
              />
            </Animated.View>
          )}
        </View>
      ),
    }),
    [
      headerOptions,
      captureOpen,
      colors.ink,
      homeHeaderStyle,
      captureHeaderStyle,
      dismissCapture,
      state.user,
      ai.generated,
      saving,
      aiWorking,
      ai.undo,
    ],
  );

  return (
    <BlurTargetView
      ref={targetRef}
      onLayout={({ nativeEvent }) => setViewHeight(nativeEvent.layout.height)}
      style={{ flex: 1, backgroundColor: colors.canvas }}
    >
      <Stack.Screen options={screenOptions} />
      {data.items.length ? (
        <CollectionMotion value={collectionMotion}>
          <View
            style={{ flex: 1 }}
            accessibilityElementsHidden={captureOpen}
            importantForAccessibility={captureOpen ? 'no-hide-descendants' : 'auto'}
          >
            <FlashList
              ref={listRef}
              extraData={listExtraData}
              CellRendererComponent={CollectionCell}
              data={items}
              masonry={layout === 'grid'}
              numColumns={columns}
              optimizeItemArrangement={false}
              keyExtractor={(item) => item.id}
              getItemType={(item) => item.type}
              maintainVisibleContentPosition={{ disabled: true }}
              contentInsetAdjustmentBehavior="never"
              onScroll={handleScroll}
              scrollEventThrottle={16}
              scrollIndicatorInsets={{ top: topInset }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: space.md,
                paddingTop: topInset,
                paddingBottom: captureInset,
              }}
              style={{
                width: '100%',
                alignSelf: 'center',
              }}
              ListHeaderComponent={controls}
              renderItem={({ item }) => (
                <View style={{ alignItems: 'center' }}>
                  <SaveCard
                    item={item}
                    width={
                      (Math.min(width, layout === 'focus' ? 680 : 1200) - space.md * 2) / columns
                    }
                    list={layout === 'list'}
                    hidden={hiddenId === item.id}
                    selecting={selecting}
                    selected={selectedSet.has(item.id)}
                    onSelect={toggleCard}
                    onMenu={showContext}
                  />
                </View>
              )}
              ListEmptyComponent={
                <View
                  style={{
                    minHeight: Math.max(0, height - topInset - controlsHeight - captureInset),
                    paddingVertical: 24,
                    paddingHorizontal: 24,
                    width: '100%',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 16,
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      ...type.caption,
                      letterSpacing: 2,
                      color: colors.muted,
                      textAlign: 'center',
                    }}
                  >
                    {query ? 'SEARCH' : folderName ? 'YOUR FOLDER' : 'YOUR COLLECTION'}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      ...type.title,
                      fontSize: 34,
                      lineHeight: 40,
                      fontFamily: fonts.editorial,
                      color: colors.ink,
                      textAlign: 'center',
                    }}
                  >
                    {query
                      ? 'No matching finds.'
                      : folderName
                        ? 'Your first find goes here.'
                        : filter === 'pinned'
                          ? 'Nothing pinned. Yet.'
                          : filter === 'note'
                            ? 'A thought starts here.'
                            : filter === 'image'
                              ? 'A little room for inspiration.'
                              : 'Your next find goes here.'}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      ...type.small,
                      color: colors.muted,
                      textAlign: 'center',
                      maxWidth: 280,
                    }}
                  >
                    {query
                      ? 'Try a shorter search, or look through all your finds.'
                      : folderName
                        ? `Save something to ${folderName}, or move a find here from your collection.`
                        : filter === 'pinned'
                          ? 'Hold a card and choose Pin find to keep it close.'
                          : filter === 'note'
                            ? 'Save a note, an idea, or a line worth remembering.'
                            : filter === 'image'
                              ? 'Save an image you want to come back to.'
                              : 'Save something here, or try another filter.'}
                  </Text>
                  {!query && filter !== 'pinned' && (
                    <Action
                      title={filter === 'note' ? 'Write a note' : 'Save something'}
                      icon={Plus}
                      onPress={openCapture}
                    />
                  )}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setQuery('');
                      setFilter('all');
                      router.setParams({ folder: '' });
                    }}
                    style={{ padding: 14 }}
                  >
                    <Text allowFontScaling={false} style={{ color: colors.accent }}>
                      See all finds
                    </Text>
                  </Pressable>
                </View>
              }
            />
          </View>
        </CollectionMotion>
      ) : (
        <ScrollView
          accessibilityElementsHidden={captureOpen}
          importantForAccessibility={captureOpen ? 'no-hide-descendants' : 'auto'}
          contentInsetAdjustmentBehavior="never"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: topInset,
            paddingBottom: captureInset,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              flex: 1,
              minHeight: Math.max(500, height - topInset - captureInset),
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.xl,
              paddingVertical: 28,
            }}
          >
            <BrandMark size={156} animate />
            <Text
              allowFontScaling={false}
              style={{
                ...type.hero,
                color: colors.ink,
                textAlign: 'center',
                fontSize: width < 380 ? 38 : 44,
                lineHeight: width < 380 ? 44 : 50,
                letterSpacing: -1.8,
                marginTop: 24,
                marginBottom: 16,
              }}
            >
              {'Keep what\nmoves you.'}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ fontSize: 15, lineHeight: 24, color: colors.muted, textAlign: 'center' }}
            >
              {'A link. An idea. A little inspiration.\nSave it here. Come back anytime.'}
            </Text>
            <View style={{ width: '100%', maxWidth: 360, gap: 12, marginTop: 32 }}>
              <Action
                title={
                  state.user
                    ? 'Save your first find'
                    : state.busy
                      ? 'Connecting…'
                      : 'Continue with Google'
                }
                leading={!state.user ? <GoogleMark /> : undefined}
                disabled={state.busy}
                onPress={() => (state.user ? openCapture() : void state.signIn())}
              />
              <Pressable
                accessibilityRole="button"
                onPress={openCapture}
                style={{
                  minHeight: 48,
                  flexDirection: 'row',
                  gap: 8,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                  {state.user ? 'Or paste a link below' : 'Start on this device'}
                </Text>
                {!state.user && <ArrowUpRight size={14} color={colors.muted} />}
              </Pressable>
            </View>
          </View>
        </ScrollView>
      )}
      {!selecting && (
        <Animated.View
          collapsable={false}
          animatedProps={captureProps}
          accessibilityViewIsModal={captureOpen}
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: captureOpen ? colors.canvas : colors.paper,
              borderTopWidth: captureOpen ? 0 : 0.5,
              borderTopColor: colors.line,
              overflow: 'hidden',
            },
            captureStyle,
          ]}
        >
          <Animated.View
            style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, captureBodyStyle]}
          >
            {captureOpen && (
              <AiEditorLight
                active={ai.enabled || ['listening', 'starting', 'finishing'].includes(ai.phase)}
                working={aiWorking}
              />
            )}
            <View
              style={{
                flex: 1,
                minHeight: 0,
                flexDirection: 'row',
                maxWidth: 720,
                width: '100%',
                alignSelf: 'center',
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open full capture screen"
                disabled={saving}
                onPress={openCapture}
                style={{
                  display: captureOpen ? 'none' : 'flex',
                  width: 54,
                  minHeight: 58,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={22} color={colors.accent} strokeWidth={1.5} />
              </Pressable>
              <TextInput
                allowFontScaling={false}
                ref={quickRef}
                accessibilityLabel={
                  captureOpen && ai.enabled ? 'What should AI make?' : 'Quick add text'
                }
                placeholder={
                  captureOpen && ai.enabled ? 'What should I make?' : 'Keep something...'
                }
                placeholderTextColor={colors.muted}
                value={quickText}
                autoCorrect={false}
                autoCapitalize="none"
                selection={
                  ai.phase === 'streaming' || ai.phase === 'listening' || ai.phase === 'finishing'
                    ? { start: quickText.length, end: quickText.length }
                    : undefined
                }
                onChangeText={setQuickText}
                onFocus={() => setCaptureOpen(true)}
                editable={!saving && !aiWorking}
                multiline={captureOpen}
                numberOfLines={captureOpen ? undefined : 1}
                textAlignVertical={captureOpen ? 'top' : 'center'}
                style={{
                  display: rendered ? 'none' : 'flex',
                  flex: 1,
                  minWidth: 0,
                  paddingHorizontal: captureOpen ? 20 : 0,
                  paddingTop: captureOpen ? 20 : 0,
                  paddingBottom: captureOpen ? 16 : 0,
                  fontSize: 17,
                  lineHeight: 26,
                  color: colors.ink,
                }}
              />
              {rendered && (
                <ScrollView
                  ref={responseRef}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ padding: 24, paddingTop: 28, paddingBottom: 32 }}
                  onScroll={({
                    nativeEvent: { contentOffset, contentSize, layoutMeasurement },
                  }) => {
                    followResponse.current =
                      contentOffset.y + layoutMeasurement.height >= contentSize.height - 64;
                  }}
                  scrollEventThrottle={100}
                  onContentSizeChange={() => {
                    if (ai.phase === 'streaming' && followResponse.current)
                      responseRef.current?.scrollToEnd({ animated: false });
                  }}
                >
                  <MarkdownContent text={quickText} streaming={ai.phase === 'streaming'} />
                </ScrollView>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Paste and save clipboard"
                accessibilityState={{ disabled: saving, busy: saving }}
                disabled={saving}
                onPress={() => void quickSave()}
                style={{
                  display: captureOpen ? 'none' : 'flex',
                  minHeight: 58,
                  paddingHorizontal: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {saving ? (
                  <ActivityIndicator color={colors.accent} />
                ) : (
                  <Clipboard size={19} color={colors.accent} strokeWidth={1.6} />
                )}
              </Pressable>
            </View>
            {captureOpen && (
              <QuickCaptureToolbar
                ai={ai}
                hasText={hasText}
                saving={saving}
                rendered={rendered}
                onEdit={handleEdit}
                onSave={quickSaveText}
              />
            )}
          </Animated.View>
        </Animated.View>
      )}
      {selecting && (
        <Animated.View
          pointerEvents="box-none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: insets.bottom + 12,
              alignItems: 'center',
              paddingHorizontal: 16,
            },
            selectionBarStyle,
          ]}
        >
          <View
            style={{
              width: '100%',
              maxWidth: 520,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              padding: 6,
              borderRadius: 32,
              backgroundColor: colors.paper,
              borderWidth: 0.5,
              borderColor: colors.line,
              boxShadow: colors.editorShadow,
            }}
          >
            <IconButton label="Cancel selection" icon={X} onPress={() => setSelectedIds(null)} />
            <Text
              allowFontScaling={false}
              accessibilityLiveRegion="polite"
              numberOfLines={1}
              style={{ ...type.small, color: colors.ink, flex: 1 }}
            >
              {selectedIds.length} selected
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle selection of all visible finds"
              disabled={!items.length}
              onPress={() =>
                setSelectedIds((current) =>
                  toggleVisibleSelection(
                    current || [],
                    items.map((item) => item.id),
                  ),
                )
              }
              style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}
            >
              <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                {items.length && items.every((item) => selectedSet.has(item.id))
                  ? 'Deselect all'
                  : 'Select all'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Delete ${selectedIds.length} selected finds`}
              accessibilityState={{ disabled: !selectedIds.length }}
              disabled={!selectedIds.length}
              onPress={() => setDeleteIds(selectedIds)}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selectedIds.length ? colors.danger : colors.soft,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Trash2
                size={20}
                color={selectedIds.length ? colors.paper : colors.muted}
                strokeWidth={1.8}
              />
            </Pressable>
          </View>
        </Animated.View>
      )}
      {deleteIds && (
        <DeleteSheet
          open
          title={`Delete ${deleteIds.length} ${deleteIds.length === 1 ? 'find' : 'finds'}?`}
          description="These selected finds will be removed from your collection and synced devices."
          confirmLabel={`Delete ${deleteIds.length} ${deleteIds.length === 1 ? 'find' : 'finds'}`}
          onDismiss={() => setDeleteIds(null)}
          onConfirm={async () => {
            await state.remove(deleteIds, prepareTransition);
            setSelectedIds(null);
            state.setNotice(
              `Deleted ${deleteIds.length} ${deleteIds.length === 1 ? 'find' : 'finds'}`,
            );
          }}
        />
      )}
      {contextItem && context && (
        <CardContextMenu
          key={contextItem.id}
          item={contextItem}
          anchor={context}
          ready={contextReady}
          liftedId={liftedId}
          onReady={previewReady}
          blurTarget={targetRef}
          beforeDelete={prepareTransition}
          onSelect={(id) => startSelection([id])}
          onClose={() => {
            setContext(null);
            setContextReady(false);
          }}
        />
      )}
    </BlurTargetView>
  );
}
