import { useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Pressable, Text, View } from 'react-native';
import { BottomSheet, Host, RNHostView } from '@expo/ui';
import {
  Archive,
  Check,
  ChevronDown,
  ChevronLeft,
  Folder,
  FolderOpen,
  FolderPlus,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Folder as FolderRecord, SavedItem } from '../shared/types';
import { useCollection } from '../state/collection';
import { fonts, radius, type } from '../theme';
import { Action, Field, IconButton } from './ui';
import { Feedback } from './feedback';

export function FolderDestination({
  folders,
  items,
  selectedId,
  onSelect,
  onCreate,
}: {
  folders: FolderRecord[];
  items: SavedItem[];
  selectedId?: string;
  onSelect: (id?: string) => void;
  onCreate: (name: string, parentId?: string) => Promise<string>;
}) {
  const { colors, dark } = useCollection();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState<'folder' | 'subfolder' | null>(null);
  const [createParentId, setCreateParentId] = useState<string>();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const hierarchy = useMemo(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const findCounts = new Map<string, number>();
    const childCounts = new Map<string, number>();

    for (const item of items)
      if (item.folderId) findCounts.set(item.folderId, (findCounts.get(item.folderId) || 0) + 1);
    for (const folder of folders)
      if (folder.parentId)
        childCounts.set(folder.parentId, (childCounts.get(folder.parentId) || 0) + 1);

    return folders
      .map((folder) => {
        const path = [folder.name];
        const seen = new Set([folder.id]);
        let parent = folder.parentId ? byId.get(folder.parentId) : undefined;

        while (parent && !seen.has(parent.id)) {
          seen.add(parent.id);
          path.unshift(parent.name);
          parent = parent.parentId ? byId.get(parent.parentId) : undefined;
        }

        return {
          folder,
          path: path.join(' / '),
          parentPath: path.slice(0, -1).join(' / '),
          depth: path.length - 1,
          finds: findCounts.get(folder.id) || 0,
          children: childCounts.get(folder.id) || 0,
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path));
  }, [folders, items]);
  const selected = hierarchy.find(({ folder }) => folder.id === selectedId);
  const createParent = hierarchy.find(({ folder }) => folder.id === createParentId);
  const mainCount = items.filter((item) => !item.folderId).length;
  const dismiss = () => {
    if (inFlight.current) return;
    setOpen(false);
    setCreating(null);
    setCreateParentId(undefined);
    setError('');
  };
  const choose = (id?: string) => {
    onSelect(id);
    setOpen(false);
  };
  const beginCreate = (mode: 'folder' | 'subfolder', parentId?: string) => {
    setName('');
    setError('');
    setCreateParentId(parentId);
    setCreating(mode);
  };
  const create = async () => {
    const cleanName = name.trim();

    if (!cleanName || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      const id = await onCreate(cleanName, creating === 'subfolder' ? createParentId : undefined);

      onSelect(id);
      setOpen(false);
      setCreating(null);
      setCreateParentId(undefined);
      setName('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create this folder.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Save in ${selected?.path || 'your main collection'}`}
        accessibilityHint="Choose a folder or create a subfolder"
        onPress={() => {
          Keyboard.dismiss();
          setCreating(null);
          setOpen(true);
        }}
        style={({ pressed }) => ({
          minHeight: 48,
          flex: 1,
          minWidth: 0,
          flexDirection: 'row',
          alignItems: 'center',
          opacity: pressed ? 0.64 : 1,
        })}
      >
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text
            allowFontScaling={false}
            style={{ ...type.caption, color: colors.muted, letterSpacing: 0.8 }}
          >
            SAVE TO
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{ color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: '600' }}
          >
            {selected?.folder.name || 'Main collection'}
          </Text>
        </View>
        <ChevronDown size={16} color={colors.muted} />
      </Pressable>
      <Host colorScheme={dark ? 'dark' : 'light'} style={{ position: 'absolute' }}>
        <BottomSheet
          isPresented={open}
          snapPoints={['full']}
          onDismiss={dismiss}
          containerColor={colors.paper}
          shouldDismissOnBackPress={!busy}
          shouldDismissOnClickOutside={!busy}
          contentPadding={{ left: 20, right: 20, top: 8, bottom: Math.max(insets.bottom, 8) }}
        >
          <RNHostView matchContents={false}>
            <View style={{ flex: 1, gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {creating && (
                  <FolderSheetBackButton
                    label="Back to folders"
                    disabled={busy}
                    onPress={() => {
                      setCreating(null);
                      setCreateParentId(undefined);
                    }}
                    colors={colors}
                  />
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    allowFontScaling={false}
                    accessibilityRole="header"
                    style={{
                      ...type.title,
                      color: colors.ink,
                      fontFamily: fonts.editorial,
                      fontSize: 20,
                      lineHeight: 25,
                      letterSpacing: -0.4,
                      fontWeight: '400',
                    }}
                  >
                    {creating
                      ? creating === 'subfolder'
                        ? 'New subfolder'
                        : 'New folder'
                      : 'Choose a destination'}
                  </Text>
                  <Text allowFontScaling={false} style={{ ...type.small, color: colors.muted }}>
                    {creating === 'subfolder' && createParent
                      ? `Inside ${createParent.path}`
                      : creating
                        ? 'Give related finds a place together.'
                        : 'Tap any folder to save there.'}
                  </Text>
                </View>
                <IconButton
                  label="Close folder picker"
                  icon={X}
                  disabled={busy}
                  onPress={dismiss}
                />
              </View>
              {creating ? (
                <View style={{ gap: 12 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 14,
                      borderRadius: radius.card,
                      backgroundColor: colors.canvas,
                    }}
                  >
                    <FolderPlus size={21} color={colors.accent} strokeWidth={1.6} />
                    <Text
                      allowFontScaling={false}
                      numberOfLines={1}
                      style={{ color: colors.ink, flex: 1 }}
                    >
                      {creating === 'subfolder' && createParent
                        ? createParent.path
                        : 'Main collection'}
                    </Text>
                  </View>
                  <Field
                    autoFocus
                    accessibilityLabel={creating === 'subfolder' ? 'Subfolder name' : 'Folder name'}
                    placeholder={
                      creating === 'subfolder' ? 'Name this subfolder' : 'Name this folder'
                    }
                    value={name}
                    onChangeText={setName}
                    maxLength={80}
                    editable={!busy}
                    returnKeyType="done"
                    onSubmitEditing={() => void create()}
                    style={{ backgroundColor: colors.canvas, borderRadius: radius.card }}
                  />
                  {!!error && <Feedback message={error} error />}
                  <Action
                    title={
                      busy
                        ? 'Creating…'
                        : creating === 'subfolder'
                          ? 'Create subfolder'
                          : 'Create folder'
                    }
                    disabled={!name.trim() || busy || (creating === 'subfolder' && !createParent)}
                    onPress={() => void create()}
                  />
                </View>
              ) : (
                <>
                  <FlatList
                    style={{ flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 8 }}
                    data={hierarchy}
                    keyExtractor={({ folder }) => folder.id}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    ListHeaderComponent={
                      <FolderBrowserRow
                        label="Main collection"
                        detail={`${mainCount} ${mainCount === 1 ? 'unfiled find' : 'unfiled finds'}`}
                        selected={!selectedId}
                        colors={colors}
                        icon={Archive}
                        onPress={() => choose(undefined)}
                      />
                    }
                    renderItem={({ item }) => (
                      <FolderBrowserRow
                        label={item.folder.name}
                        detail={`${item.finds} ${item.finds === 1 ? 'find' : 'finds'} · ${item.children} ${item.children === 1 ? 'subfolder' : 'subfolders'}`}
                        selected={item.folder.id === selectedId}
                        depth={item.depth}
                        colors={colors}
                        icon={item.folder.id === selectedId ? FolderOpen : Folder}
                        onPress={() => choose(item.folder.id)}
                        onCreateSubfolder={() => beginCreate('subfolder', item.folder.id)}
                      />
                    )}
                  />
                  <View
                    style={{
                      paddingTop: 10,
                      borderTopWidth: 0.5,
                      borderTopColor: colors.line,
                    }}
                  >
                    <PickerAction
                      title="New folder"
                      fill
                      colors={colors}
                      onPress={() => beginCreate('folder')}
                    />
                  </View>
                </>
              )}
            </View>
          </RNHostView>
        </BottomSheet>
      </Host>
    </>
  );
}

function FolderSheetBackButton({
  label,
  disabled,
  onPress,
  colors,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useCollection>['colors'];
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        minHeight: 44,
        marginLeft: -8,
        marginRight: -4,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.62 : 1,
      })}
    >
      <ChevronLeft size={26} color={colors.ink} strokeWidth={1.8} />
    </Pressable>
  );
}

function FolderBrowserRow({
  label,
  detail,
  selected,
  depth = 0,
  colors,
  icon: Icon = Folder,
  onPress,
  onCreateSubfolder,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  depth?: number;
  colors: ReturnType<typeof useCollection>['colors'];
  icon?: typeof Folder;
  onPress: () => void;
  onCreateSubfolder?: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 62,
        paddingLeft: 4 + Math.min(depth, 4) * 20,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.line,
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={`${selected ? 'Current destination. ' : ''}${label}${detail ? `, ${detail}` : ''}`}
        onPress={onPress}
        style={({ pressed }) => ({
          flex: 1,
          minWidth: 0,
          minHeight: 62,
          paddingRight: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 11,
          opacity: pressed ? 0.66 : 1,
        })}
      >
        <Icon size={20} color={selected ? colors.accent : colors.muted} strokeWidth={1.5} />
        <View style={{ flex: 1, gap: 1 }}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={{
              color: colors.ink,
              fontSize: 15,
              lineHeight: 20,
              fontWeight: selected ? '600' : '400',
            }}
          >
            {label}
          </Text>
          {!!detail && (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={{ ...type.caption, color: colors.muted }}
            >
              {detail}
            </Text>
          )}
        </View>
        {selected && <Check size={18} color={colors.accent} strokeWidth={2} />}
      </Pressable>
      {onCreateSubfolder && (
        <IconButton
          label={`Create a subfolder inside ${label}`}
          icon={FolderPlus}
          onPress={onCreateSubfolder}
        />
      )}
    </View>
  );
}

function PickerAction({
  title,
  fill = false,
  colors,
  onPress,
}: {
  title: string;
  fill?: boolean;
  colors: ReturnType<typeof useCollection>['colors'];
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: fill ? 1 : undefined,
        minHeight: 54,
        paddingHorizontal: 16,
        borderRadius: radius.group,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.soft,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Text
        allowFontScaling={false}
        style={{
          color: colors.ink,
          fontSize: 15,
          fontWeight: '600',
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
