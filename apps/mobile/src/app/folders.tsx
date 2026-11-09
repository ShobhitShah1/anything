import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  FlatList,
  Keyboard,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type TextInputInstance,
  type ViewProps,
} from 'react-native';
import { BlurTargetView } from 'expo-blur';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { MenuView } from '@expo/ui/community/menu';
import Image from 'react-native-fast-image';
import { Stack, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Folder, MoreHorizontal, X } from 'lucide-react-native';
import { useScrollHeader } from '../components/use-scroll-header';
import { Feedback } from '../components/feedback';
import { DeleteSheet } from '../components/delete-sheet';
import { MarkdownContent } from '../components/markdown-content';
import type { Folder as FolderRecord, SavedItem } from '../shared/types';
import { useCollection } from '../state/collection';
import { Action, CollectionSearch, Field, HeaderBackTitle, IconButton } from '../components/ui';
import { getItemTitle } from '../shared/utils/itemTitle';
import { itemImage, itemText } from '../utils/item';
import { captureScroll } from '../utils/capture-scroll';
import { fonts, space, type } from '../theme';

const FOLDER_PANEL_TRANSITION = LinearTransition.springify().dampingRatio(0.82).duration(320);

export default function Folders() {
  const { targetRef, topInset, onScroll, options: headerOptions } = useScrollHeader('Folders');
  const { data, colors, dark, addFolder, commit } = useCollection();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(0);
  const tileWidth = (Math.min(width, 720) - space.lg * 2 - 16) / 2;
  const inFlight = useRef(false);
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<FolderRecord>();
  const [deleting, setDeleting] = useState<FolderRecord>();
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const reduced = useReducedMotion();
  const scrollState = useRef({ offset: 0, travel: 0, hidden: false });
  const actionsHidden = useSharedValue(false);
  const actionsPinned = useSharedValue(false);
  const panelWidth = Math.min(width - 40, 460);
  const fieldRef = useRef<TextInputInstance>(null);
  const dismissForm = useCallback(() => {
    if (inFlight.current) return;
    Keyboard.dismiss();
    setFormOpen(false);
  }, []);

  useEffect(() => {
    if (!formOpen) return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissForm();

      return true;
    });

    return () => subscription.remove();
  }, [formOpen, dismissForm]);
  useEffect(() => {
    actionsPinned.set(formOpen);
  }, [actionsPinned, formOpen]);

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
    const hidden = actionsHidden.get() && !actionsPinned.get() && !reduced;

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
  }, [actionsHidden, actionsPinned, insets.bottom, reduced]);
  const actionBarProps = useAnimatedProps<ViewProps>(() => {
    const hidden = actionsHidden.get() && !actionsPinned.get() && !reduced;

    return {
      pointerEvents: hidden ? 'none' : 'auto',
      accessibilityElementsHidden: hidden,
      importantForAccessibility: hidden ? 'no-hide-descendants' : 'auto',
    };
  });
  const grouped = useMemo(() => {
    const groups = new Map<string, SavedItem[]>();

    for (const item of data.items)
      if (item.folderId) {
        const group = groups.get(item.folderId) || [];

        group.push(item);
        groups.set(item.folderId, group);
      }

    return groups;
  }, [data.items]);
  const folders = useMemo(
    () =>
      data.folders.filter((folder) =>
        folder.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [data.folders, query],
  );
  const openForm = (folder?: FolderRecord) => {
    setEditing(folder);
    setName(folder?.name || '');
    setError('');
    setFormOpen(true);
  };
  const save = async () => {
    if (!name.trim() || inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError('');
    try {
      if (editing)
        await commit((value) => ({
          ...value,
          folders: value.folders.map((folder) =>
            folder.id === editing.id ? { ...folder, name: name.trim() } : folder,
          ),
        }));
      else await addFolder(name);
      Keyboard.dismiss();
      setFormOpen(false);
      setName('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save this folder.');
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };

  return (
    <BlurTargetView ref={targetRef} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen
        options={{
          ...headerOptions,
          title: 'Folders',
          headerLeft: () => (
            <HeaderBackTitle
              title="Folders"
              titleStyle={{
                fontFamily: fonts.editorial,
                fontSize: 23,
                lineHeight: 28,
                letterSpacing: -0.6,
                fontWeight: '400',
              }}
            />
          ),
        }}
      />
      <FlatList
        accessibilityElementsHidden={formOpen}
        importantForAccessibility={formOpen ? 'no-hide-descendants' : 'auto'}
        data={folders}
        numColumns={2}
        keyExtractor={(folder) => folder.id}
        contentInsetAdjustmentBehavior="never"
        onScroll={handleScroll}

        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: topInset }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={{ gap: 16 }}
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingTop: topInset + 6,
          paddingBottom: insets.bottom + 100,
          maxWidth: 720,
          width: '100%',
          alignSelf: 'center',
        }}
        ListHeaderComponent={
          <View
            onLayout={({ nativeEvent }) => setHeaderHeight(nativeEvent.layout.height + 20)}
            style={{ marginBottom: 20 }}
          >
            <CollectionSearch
              label="Search folders"
              placeholder={'Find a folder\u2026'}
              value={query}
              onChangeText={setQuery}
            />
          </View>
        }
        renderItem={({ item: folder }) => {
          const saves = grouped.get(folder.id) || [];
          const images = saves
            .map(itemImage)
            .filter((uri): uri is string => !!uri)
            .slice(0, 3);
          const thought = saves.find((item) => item.type !== 'secret');

          return (
            <View style={{ width: tileWidth, marginBottom: 26 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open folder ${folder.name}`}
                onPress={() => router.replace({ pathname: '/', params: { folder: folder.id } })}
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
                          objectFit="contain"

                          transition={0}
                          style={{ flex: 1, borderRadius: 10, backgroundColor: colors.canvas }}
                        />
                        {images.length > 1 && (
                          <View style={{ flex: 0.65, gap: 6 }}>
                            {images.slice(1).map((uri, index) => (
                              <Image
                                key={index}
                                source={{ uri: uri }}
                                objectFit="contain"

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
                      <View
                        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}
                      >
                        <Folder size={30} color={colors.muted} strokeWidth={1} />
                        <Text
                          allowFontScaling={false}
                          style={{ ...type.caption, color: colors.muted }}
                        >
                          {saves.length ? 'Kept just for you' : 'Room for a good find'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <Text
                  allowFontScaling={false}
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
                  style={{ ...type.caption, color: colors.muted, marginTop: 4 }}
                >
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
                  nativeEvent.event === 'rename' ? openForm(folder) : setDeleting(folder)
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
        }}
        ListEmptyComponent={
          <View
            style={{
              minHeight: Math.max(0, height - topInset - 6 - headerHeight - 116 - insets.bottom),
              justifyContent: 'center',
              alignItems: 'center',
              paddingVertical: 24,
              gap: 16,
            }}
          >
            <Text
              allowFontScaling={false}
              style={{ ...type.caption, color: colors.muted, letterSpacing: 2 }}
            >
              A PLACE FOR RELATED FINDS
            </Text>
            <Text
              allowFontScaling={false}
              style={{
                color: colors.ink,
                fontFamily: fonts.editorial,
                fontSize: 26,
                textAlign: 'center',
                letterSpacing: -0.5,
              }}
            >
              {query ? 'No folders named that.' : 'Good finds belong together.'}
            </Text>
            <Text
              allowFontScaling={false}
              style={{ ...type.small, color: colors.muted, textAlign: 'center', maxWidth: 260 }}
            >
              {query
                ? 'Try another word, or start something new.'
                : 'Create a folder for a project, a place, or something you love.'}
            </Text>
            {!!query && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setQuery('')}
                style={{ padding: 14 }}
              >
                <Text allowFontScaling={false} style={{ color: colors.accent }}>
                  Clear search
                </Text>
              </Pressable>
            )}
          </View>
        }
      />
      {formOpen && (
        <Animated.View
          entering={reduced ? undefined : FadeIn.duration(180)}
          exiting={reduced ? undefined : FadeOut.duration(160)}
          style={{ position: 'absolute', inset: 0, backgroundColor: '#00000055' }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss folder form"
            onPress={dismissForm}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
      <KeyboardStickyView
        pointerEvents="box-none"
        offset={{ closed: 0, opened: insets.bottom }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      >
        <Animated.View
          collapsable={false}
          animatedProps={actionBarProps}
          accessibilityViewIsModal={formOpen}
          layout={reduced ? undefined : FOLDER_PANEL_TRANSITION}
          style={[
            {
              position: 'absolute',
              bottom: 0,
              width: '100%',
              maxWidth: 720,
              alignSelf: 'center',
              borderTopLeftRadius: formOpen ? 28 : 0,
              borderTopRightRadius: formOpen ? 28 : 0,
              backgroundColor: colors.soft,
              borderTopWidth: 0.5,
              borderTopColor: colors.line,
              overflow: 'hidden',
            },
            actionBarStyle,
          ]}
        >
          {formOpen ? (
            <Animated.View
              key="folder-form"
              entering={reduced ? undefined : FadeIn.duration(180)}
              exiting={reduced ? undefined : FadeOut.duration(150)}
              style={{
                width: panelWidth,
                maxWidth: 720,
                alignSelf: 'center',
                padding: 20,
                paddingBottom: 20 + insets.bottom,
                gap: 16,
              }}
            >
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
                  style={{
                    fontFamily: fonts.editorial,
                    fontSize: 28,
                    letterSpacing: -0.6,
                    color: colors.ink,
                  }}
                >
                  {editing ? 'Rename folder' : 'New folder'}
                </Text>
                <IconButton label="Close folder form" icon={X} onPress={dismissForm} />
              </View>
              <Field
                ref={fieldRef}
                accessibilityLabel="Folder name"
                onLayout={() => fieldRef.current?.focus()}
                editable={!saving}
                value={name}
                onChangeText={setName}
                placeholder="Give it a name"
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={() => void save()}
                style={{ backgroundColor: colors.canvas, borderRadius: 16 }}
              />
              {!!error && <Feedback message={error} error onDismiss={() => setError('')} />}
              <Action
                title={saving ? 'Saving...' : editing ? 'Save name' : 'Create folder'}
                disabled={!name.trim() || saving}
                onPress={() => void save()}
              />
            </Animated.View>
          ) : (
            <Animated.View
              key="folder-button"
              entering={reduced ? undefined : FadeIn.duration(180)}
              exiting={reduced ? undefined : FadeOut.duration(120)}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="New folder"
                onPress={() => openForm()}
                style={{
                  minHeight: 58 + insets.bottom,
                  paddingTop: 0,
                  paddingBottom: insets.bottom,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 9,
                  backgroundColor: colors.paper,
                }}
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
                  New folder
                </Text>
              </Pressable>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardStickyView>
      <DeleteSheet
        open={!!deleting}
        title="Remove this folder?"
        description="Your finds stay in All finds. Only the folder is removed."
        confirmLabel="Remove folder"
        onDismiss={() => setDeleting(undefined)}
        onConfirm={async () => {
          if (!deleting) return;
          await commit((value) => ({
            ...value,
            folders: value.folders.filter((folder) => folder.id !== deleting.id),
            items: value.items.map((item) =>
              item.folderId === deleting.id ? { ...item, folderId: undefined } : item,
            ),
          }));
        }}
      />
    </BlurTargetView>
  );
}
