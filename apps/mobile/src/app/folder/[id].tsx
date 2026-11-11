import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type TextInputInstance,
  type ViewProps,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import Image from 'react-native-fast-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Folder, Plus, X } from 'lucide-react-native';
import { BlurTargetView } from 'expo-blur';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutDown,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useScrollHeader } from '../../components/use-scroll-header';
import { useCollection } from '../../state/collection';
import { Action, Field, IconButton } from '../../components/ui';
import { CardContextMenu } from '../../components/card-context-menu';
import { DeleteSheet } from '../../components/delete-sheet';
import { FolderCreateButton, FolderTile } from '../../components/folder-tile';
import { SaveCard, type CardAnchor } from '../../components/save-card';
import { CollectionCell, CollectionMotion } from '../../components/collection-motion';
import type { Folder as FolderRecord, SavedItem } from '../../shared/types';
import { fonts, space, type } from '../../theme';
import { captureScroll } from '../../utils/capture-scroll';
import { itemImage } from '../../utils/item';

const SHEET_TRANSITION = LinearTransition.springify().dampingRatio(0.82).duration(320);

export default function FolderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useCollection();
  const { data, colors, addFolder, commit } = state;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const folder = data.folders.find((value) => value.id === id);
  const { targetRef, topInset, onScroll, options: headerOptions } = useScrollHeader(folder?.name);
  const [sheet, setSheet] = useState<null | 'folder' | 'existing'>(null);
  const [name, setName] = useState('');
  const [existingQuery, setExistingQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<FolderRecord>();
  const [deleting, setDeleting] = useState<FolderRecord>();
  const fieldRef = useRef<TextInputInstance>(null);
  const liftedId = useSharedValue<string | null>(null);
  const [context, setContext] = useState<CardAnchor | null>(null);
  const [contextItem, setContextItem] = useState<SavedItem>();
  const [contextReady, setContextReady] = useState(false);
  const scrollState = useRef({ offset: 0, travel: 0, hidden: false });
  const actionsHidden = useSharedValue(false);
  const motionEnabled = useSharedValue(false);
  const children = useMemo(
    () =>
      data.folders
        .filter((value) => value.parentId === id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [data.folders, id],
  );
  const items = useMemo(
    () =>
      data.items
        .filter((item) => item.folderId === id)
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt - a.createdAt),
    [data.items, id],
  );
  const rows = useMemo(() => (folder ? items : []), [folder, items]);
  const availableItems = useMemo(
    () =>
      data.items
        .filter((item) => item.folderId !== id)
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt - a.createdAt),
    [data.items, id],
  );
  const filteredExisting = useMemo(() => {
    const query = existingQuery.trim().toLowerCase();

    return query
      ? availableItems.filter((item) =>
          `${item.title} ${item.tags.join(' ')} ${item.type}`.toLowerCase().includes(query),
        )
      : availableItems;
  }, [availableItems, existingQuery]);
  const gridContentWidth = Math.min(width, 720) - space.md * 2;
  const gridColumns = width >= 800 ? 3 : width >= 350 ? 2 : 1;
  const columns = rows.length === 1 ? 1 : gridColumns;
  const contextReadyCallback = useCallback(() => {
    if (context) liftedId.set(context.id);
    setContextReady(true);
  }, [context, liftedId]);
  const handleScroll = useCallback(
    (event: Parameters<typeof onScroll>[0]) => {
      onScroll(event);

      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const next = captureScroll(
        scrollState.current,
        contentOffset.y,
        contentSize.height - layoutMeasurement.height,
      );

      if (next.hidden !== scrollState.current.hidden) actionsHidden.set(next.hidden);
      scrollState.current = next;
    },
    [actionsHidden, onScroll],
  );
  const actionBarStyle = useAnimatedStyle(() => {
    const hidden = actionsHidden.get() && !reduced;

    return {
      opacity: withTiming(hidden ? 0 : 1, { duration: reduced ? 0 : 150 }),
      transform: [
        {
          translateY: withTiming(hidden ? 100 + insets.bottom : 0, {
            duration: reduced ? 0 : 180,
            easing: Easing.bezier(0.23, 1, 0.32, 1),
          }),
        },
      ],
    };
  }, [actionsHidden, insets.bottom, reduced]);
  const actionBarProps = useAnimatedProps<ViewProps>(() => {
    const hidden = actionsHidden.get() && !reduced;

    return {
      pointerEvents: hidden ? 'none' : 'auto',
      accessibilityElementsHidden: hidden,
      importantForAccessibility: hidden ? 'no-hide-descendants' : 'auto',
    };
  });
  const collectionMotion = useMemo(
    () => ({ enabled: motionEnabled, ids: rows.map((item) => item.id), liftedId }),
    [motionEnabled, rows, liftedId],
  );

  useEffect(() => {
    if (sheet !== 'folder') return;
    const timer = setTimeout(() => fieldRef.current?.focus(), 300);

    return () => clearTimeout(timer);
  }, [sheet]);

  const openForm = (value?: FolderRecord) => {
    setEditing(value);
    setName(value?.name || '');
    setSheet('folder');
  };
  const saveFolder = async () => {
    if (!name.trim() || saving || !folder) return;
    setSaving(true);
    try {
      if (editing)
        await commit((value) => ({
          ...value,
          folders: value.folders.map((entry) =>
            entry.id === editing.id ? { ...entry, name: name.trim() } : entry,
          ),
        }));
      else await addFolder(name, folder.id);
      setSheet(null);
      setName('');
      setEditing(undefined);
    } catch (error) {
      state.setError(error instanceof Error ? error.message : 'Could not save this folder.');
    } finally {
      setSaving(false);
    }
  };
  const showContext = (anchor: CardAnchor) => {
    setContextItem(data.items.find((item) => item.id === anchor.id));
    setContext(anchor);
    setContextReady(false);
  };
  const toggleExisting = (itemId: string) =>
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((value) => value !== itemId) : [...current, itemId],
    );
  const addExisting = async () => {
    if (!folder || !selectedIds.length || saving) return;
    const selected = new Set(selectedIds);
    setSaving(true);
    try {
      await commit((value) => ({
        ...value,
        items: value.items.map((item) =>
          selected.has(item.id) ? { ...item, folderId: folder.id } : item,
        ),
      }));
      setSelectedIds([]);
      setSheet(null);
      state.setNotice(`Added ${selected.size} ${selected.size === 1 ? 'find' : 'finds'}`);
    } catch (error) {
      state.setError(error instanceof Error ? error.message : 'Could not add those finds.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlurTargetView ref={targetRef} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={{ ...headerOptions, title: folder?.name || 'Folder' }} />
      <CollectionMotion value={collectionMotion}>
        <FlashList
          data={rows}
          masonry
          numColumns={columns}
          keyExtractor={(item) => item.id}
          getItemType={(item) => item.type}
          contentInsetAdjustmentBehavior="never"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          scrollIndicatorInsets={{ top: topInset }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: space.md,
            paddingTop: topInset + 8,
            paddingBottom: insets.bottom + 96,
            maxWidth: 720,
            width: '100%',
            alignSelf: 'center',
          }}
          ListHeaderComponent={
            folder ? (
              <View style={{ paddingHorizontal: space.lg - space.md }}>
                {!!children.length && (
                  <>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 12,
                      }}
                    >
                      <Text
                        allowFontScaling={false}
                        style={{
                          color: colors.muted,
                          fontSize: 14,
                          lineHeight: 20,
                          fontWeight: '600',
                        }}
                      >
                        SUBFOLDERS
                      </Text>
                      <Text
                        allowFontScaling={false}
                        style={{
                          color: colors.muted,
                          fontSize: 13,
                          lineHeight: 20,
                          fontWeight: '500',
                        }}
                      >
                        {children.length}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: Math.min(width, 720) - space.lg * 2,
                        maxWidth: 720 - space.lg * 2,
                        alignSelf: 'center',
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        columnGap: 16,
                      }}
                    >
                      {children.map((child) => {
                        const grandchildCount = data.folders.filter(
                          (value) => value.parentId === child.id,
                        ).length;

                        return (
                          <FolderTile
                            key={child.id}
                            folder={child}
                            saves={data.items.filter((item) => item.folderId === child.id)}
                            childCount={grandchildCount}
                            width={(Math.min(width, 720) - space.lg * 2 - 16) / 2}
                            onPress={() =>
                              router.push({ pathname: '/folder/[id]', params: { id: child.id } })
                            }
                            onRename={() => openForm(child)}
                            onDelete={() => setDeleting(child)}
                          />
                        );
                      })}
                    </View>
                  </>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{ color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '600' }}
                  >
                    SAVES · {items.length}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setSelectedIds([]);
                        setExistingQuery('');
                        setSheet('existing');
                      }}
                      style={{
                        minHeight: 40,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 8,
                      }}
                    >
                      <Folder size={15} color={colors.accent} />
                      <Text
                        allowFontScaling={false}
                        style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}
                      >
                        Add existing
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push({ pathname: '/capture', params: { folder: id } })}
                      style={{
                        minHeight: 40,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        paddingHorizontal: 8,
                      }}
                    >
                      <Plus size={16} color={colors.accent} />
                      <Text
                        allowFontScaling={false}
                        style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}
                      >
                        New find
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ) : undefined
          }
          ListHeaderComponentStyle={{ width: '100%' }}
          CellRendererComponent={CollectionCell}
          renderItem={({ item }) => (
            <View style={{ alignItems: 'center' }}>
              <SaveCard item={item} width={gridContentWidth / columns} onMenu={showContext} />
            </View>
          )}
          ListEmptyComponent={
            <View
              style={{
                flexGrow: folder && !children.length ? 1 : 0,
                minHeight: folder && !children.length ? 360 : undefined,
                justifyContent: folder && !children.length ? 'center' : 'flex-start',
                alignItems: folder && !children.length ? 'center' : 'flex-start',
                paddingHorizontal: folder && !children.length ? 16 : 0,
                paddingVertical: folder && !children.length ? 36 : 20,
                gap: 14,
              }}
            >
              {folder && !children.length ? (
                <>
                  <View style={{ width: 32, height: 2, backgroundColor: colors.line }} />
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: colors.ink,
                      fontFamily: fonts.editorial,
                      fontSize: 32,
                      lineHeight: 38,
                      letterSpacing: -0.8,
                      textAlign: 'center',
                      maxWidth: 300,
                    }}
                  >
                    A place for your next find.
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={{
                      ...type.body,
                      color: colors.muted,
                      textAlign: 'center',
                      maxWidth: 290,
                    }}
                  >
                    Save a find here or add a subfolder to keep related things together.
                  </Text>
                </>
              ) : (
                <Text
                  allowFontScaling={false}
                  style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}
                >
                  {folder ? 'No finds here yet' : 'Folder not found'}
                </Text>
              )}
            </View>
          }
        />
      </CollectionMotion>
      <KeyboardStickyView
        pointerEvents="box-none"
        offset={{ closed: 0, opened: insets.bottom }}
        enabled={sheet !== 'existing'}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      >
        {sheet ? (
          <>
            <Animated.View
              entering={reduced ? undefined : FadeIn.duration(180)}
              exiting={reduced ? undefined : FadeOut.duration(160)}
              style={{
                position: 'absolute',
                top: sheet === 'existing' ? topInset : 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: '#00000055',
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss folder sheet"
                onPress={() => setSheet(null)}
                style={{ flex: 1 }}
              />
            </Animated.View>
            <Animated.View
              entering={
                reduced ? undefined : FadeInDown.duration(240).easing(Easing.out(Easing.cubic))
              }
              exiting={
                reduced ? undefined : FadeOutDown.duration(180).easing(Easing.in(Easing.cubic))
              }
              layout={sheet === 'folder' && !reduced ? SHEET_TRANSITION : undefined}
              style={{
                position: 'absolute',
                top: sheet === 'existing' ? topInset : undefined,
                bottom: 0,
                width: '100%',
                maxWidth: 720,
                alignSelf: 'center',
                borderTopLeftRadius: sheet === 'existing' ? 22 : 28,
                borderTopRightRadius: sheet === 'existing' ? 22 : 28,
                backgroundColor: colors.paper,
                borderTopWidth: 0.5,
                borderTopColor: colors.line,
                overflow: 'hidden',
              }}
            >
              {sheet === 'existing' ? (
                <View
                  style={{
                    flex: 1,
                    minHeight: 0,
                    paddingHorizontal: 20,
                    paddingTop: 14,
                    paddingBottom: 8,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text
                        allowFontScaling={false}
                        accessibilityRole="header"
                        style={{ ...type.title, color: colors.ink, fontWeight: '600' }}
                      >
                        Add existing finds
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close add existing finds"
                      onPress={() => setSheet(null)}
                      style={{
                        width: 44,
                        height: 44,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={20} color={colors.muted} />
                    </Pressable>
                  </View>
                  <Field
                    accessibilityLabel="Search existing finds"
                    value={existingQuery}
                    onChangeText={setExistingQuery}
                    placeholder="Search your finds"
                    returnKeyType="search"
                    style={{ backgroundColor: colors.canvas, borderRadius: 16 }}
                  />
                  <FlashList
                    data={filteredExisting}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    style={{ flex: 1, minHeight: 0 }}
                    contentContainerStyle={{ paddingBottom: 84 }}
                    renderItem={({ item }) => {
                      const selected = selectedIds.includes(item.id);
                      const image = itemImage(item);

                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          accessibilityLabel={`Add ${item.title || 'untitled find'}`}
                          onPress={() => toggleExisting(item.id)}
                          style={{
                            minHeight: 68,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 14,
                            paddingHorizontal: 6,
                          }}
                        >
                          <View
                            style={{
                              width: 21,
                              height: 21,
                              borderRadius: 11,
                              borderWidth: selected ? 6 : 1.5,
                              borderColor: selected ? colors.accent : colors.muted,
                            }}
                          />
                          {!!image && (
                            <Image
                              source={{ uri: image }}
                              objectFit="cover"
                              transition={0}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: 10,
                                backgroundColor: colors.canvas,
                              }}
                            />
                          )}
                          <View style={{ flex: 1, gap: 3 }}>
                            <Text
                              allowFontScaling={false}
                              numberOfLines={1}
                              style={{ color: colors.ink, fontSize: 15, fontWeight: '500' }}
                            >
                              {item.title || 'Untitled find'}
                            </Text>
                            <Text
                              allowFontScaling={false}
                              style={{
                                ...type.caption,
                                color: colors.muted,
                                textTransform: 'capitalize',
                              }}
                            >
                              {item.type.replace('_', ' ')}
                              {item.isPinned ? ' · Pinned' : ''}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }}
                    ListEmptyComponent={
                      <View style={{ paddingTop: 28, gap: 6 }}>
                        <Text
                          allowFontScaling={false}
                          style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}
                        >
                          {availableItems.length
                            ? 'No finds match that search'
                            : 'No finds to add yet'}
                        </Text>
                        <Text
                          allowFontScaling={false}
                          style={{ ...type.small, color: colors.muted }}
                        >
                          {availableItems.length
                            ? 'Try a different name or clear your search.'
                            : 'Finds already in this folder are kept here.'}
                        </Text>
                      </View>
                    }
                  />
                  <KeyboardStickyView
                    pointerEvents="box-none"
                    offset={{ closed: 0, opened: 8 }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: '100%',
                        maxWidth: 720,
                        paddingHorizontal: 20,
                        paddingTop: 12,
                        paddingBottom: insets.bottom + 12,
                        backgroundColor: colors.paper,
                        borderTopWidth: 0.5,
                        borderTopColor: colors.line,
                      }}
                    >
                      <Action
                        title={
                          saving
                            ? 'Adding…'
                            : `Add ${selectedIds.length || ''} ${selectedIds.length === 1 ? 'find' : 'finds'}`.trim()
                        }
                        disabled={!selectedIds.length || saving}
                        onPress={() => void addExisting()}
                      />
                    </View>
                  </KeyboardStickyView>
                </View>
              ) : (
                <View style={{ padding: 20, paddingBottom: 20 + insets.bottom, gap: 16 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      allowFontScaling={false}
                      accessibilityRole="header"
                      style={{ ...type.title, color: colors.ink, fontWeight: '600' }}
                    >
                      {editing ? 'Rename subfolder' : 'New subfolder'}
                    </Text>
                    <IconButton
                      label="Close subfolder form"
                      icon={X}
                      onPress={() => setSheet(null)}
                    />
                  </View>
                  {sheet === 'folder' ? (
                    <>
                      <Field
                        ref={fieldRef}
                        autoFocus
                        accessibilityLabel="Subfolder name"
                        editable={!saving}
                        value={name}
                        onChangeText={setName}
                        placeholder="Give it a name"
                        maxLength={80}
                        returnKeyType="done"
                        onSubmitEditing={() => void saveFolder()}
                        style={{ backgroundColor: colors.canvas, borderRadius: 16 }}
                      />
                      <Action
                        title={saving ? 'Saving...' : editing ? 'Save name' : 'Create folder'}
                        disabled={!name.trim() || saving}
                        onPress={() => void saveFolder()}
                      />
                    </>
                  ) : null}
                </View>
              )}
            </Animated.View>
          </>
        ) : folder ? (
          <Animated.View
            collapsable={false}
            animatedProps={actionBarProps}
            style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, actionBarStyle]}
          >
            <FolderCreateButton title="New subfolder" onPress={() => openForm()} />
          </Animated.View>
        ) : null}
      </KeyboardStickyView>
      <DeleteSheet
        open={!!deleting}
        title="Remove this folder?"
        description="Its finds and subfolders will move up one level."
        confirmLabel="Remove folder"
        onDismiss={() => setDeleting(undefined)}
        onConfirm={async () => {
          if (!deleting) return;
          await commit((value) => ({
            ...value,
            folders: value.folders
              .filter((entry) => entry.id !== deleting.id)
              .map((entry) =>
                entry.parentId === deleting.id ? { ...entry, parentId: deleting.parentId } : entry,
              ),
            items: value.items.map((item) =>
              item.folderId === deleting.id ? { ...item, folderId: deleting.parentId } : item,
            ),
          }));
          if (deleting.id === id) router.back();
        }}
      />
      {context && contextItem && (
        <CardContextMenu
          key={contextItem.id}
          item={contextItem}
          anchor={context}
          ready={contextReady}
          liftedId={liftedId}
          onReady={contextReadyCallback}
          blurTarget={targetRef}
          onClose={() => {
            setContext(null);
            setContextItem(undefined);
            setContextReady(false);
          }}
        />
      )}
    </BlurTargetView>
  );
}
