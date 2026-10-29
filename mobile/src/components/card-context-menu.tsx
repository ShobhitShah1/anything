import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ComponentRef,
  type ComponentProps,
} from 'react';
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  interpolate,
  Easing,
  withTiming,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckSquare,
  Copy,
  Folder,
  Pencil,
  Pin,
  PinOff,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SavedItem } from '../shared/types';
import { useCollection } from '../state/collection';
import { itemText, itemUrl } from '../utils/item';
import { contextMenuPhase } from '../utils/context-menu-state';
import { contextGeometry } from '../utils/context-geometry';
import { SaveCard, type CardAnchor } from './save-card';
import { radius, type } from '../theme';

function MenuRow({
  label,
  icon: Icon,
  onPress,
  danger,
  selected,
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  onPress: () => void;
  danger?: boolean;
  selected?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useCollection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 49,
        paddingHorizontal: 17,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'transparent',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Icon size={18} color={danger ? colors.danger : colors.muted} strokeWidth={1.6} />
      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={{ flex: 1, color: danger ? colors.danger : colors.ink, fontSize: 15 }}
      >
        {label}
      </Text>
      {selected && <Check size={16} color={colors.accent} />}
    </Pressable>
  );
}
export function CardContextMenu({
  item,
  anchor,
  ready,
  onReady,
  blurTarget,
  onClose,
  beforeDelete,
  onSelect,
  liftedId,
}: {
  item: SavedItem;
  anchor: CardAnchor;
  ready: boolean;
  onReady: () => void;
  blurTarget: ComponentProps<typeof BlurView>['blurTarget'];
  onClose: () => void;
  beforeDelete?: () => void;
  onSelect?: (id: string) => void;
  liftedId: SharedValue<string | null>;
}) {
  const { colors, dark, data, commit, pin, remove, setNotice, setError } = useCollection();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const itemId = item.id;
  const closing = useRef(false);
  const afterClose = useRef<(() => unknown) | undefined>(undefined);
  const [phase, dispatch] = useReducer(contextMenuPhase, 'loading');
  const [shown, setShown] = useState(false);
  const [previewLoaded, setPreviewLoaded] = useState(false);
  const mounted = useRef(true);
  const disabled = phase === 'closing' || phase === 'finished';
  const previewReady = useCallback(() => {
    if (mounted.current && !closing.current) setPreviewLoaded(true);
  }, []);
  useEffect(() => {
    // Cached images can load before the native modal window is visible.
    if (shown && previewLoaded && mounted.current && !closing.current) {
      dispatch('ready');
      onReady();
    }
  }, [shown, previewLoaded, onReady]);
  const [page, setPage] = useState<'actions' | 'folders' | 'delete'>('actions');
  const [actionsHeight, setActionsHeight] = useState(0);
  const [subpageHeight, setSubpageHeight] = useState(0);
  const menuTarget = useRef<ComponentRef<typeof View>>(null);
  const [subpage, setSubpage] = useState<'folders' | 'delete'>('folders');
  const pageProgress = useSharedValue(0);
  const navigate = (next: typeof page) => {
    if (next !== 'actions') setSubpage(next);
    setPage(next);
    pageProgress.set(
      withTiming(next === 'actions' ? 0 : 1, {
        duration: reduced ? 0 : 280,
        easing: Easing.bezier(0.23, 1, 0.32, 1),
      }),
    );
  };
  const url = itemUrl(item);
  const copy = item.type === 'secret' ? '' : url || itemText(item);
  const editable = ['note', 'image', 'markdown', 'code', 'secret', 'link'].includes(item.type);
  const actionCount = 4 + Number(!!onSelect) + Number(!!copy) + Number(editable);
  const target = contextGeometry(
    anchor.rect,
    width,
    height,
    insets.top,
    insets.bottom,
    46 + actionCount * 49,
  );

  useEffect(() => {
    if (phase === 'open' && ready && !closing.current)
      progress.set(reduced ? 1 : withSpring(1, { duration: 400, dampingRatio: 1 }));
  }, [phase, ready, reduced, progress]);
  useEffect(() => {
    mounted.current = true;
    const timer = setTimeout(previewReady, 250);
    return () => {
      mounted.current = false;
      clearTimeout(timer);
    };
  }, [previewReady]);
  useEffect(() => {
    if (phase !== 'finished') return;
    // The UI thread has already handed visibility back to the source card.
    onClose();
    const action = afterClose.current;
    afterClose.current = undefined;
    Promise.resolve()
      .then(() => action?.())
      .catch((error) =>
        setError(error instanceof Error ? error.message : 'Could not update this find.'),
      );
  }, [phase, onClose, setError]);
  const finish = () => dispatch('finished');
  const close = (action?: () => unknown) => {
    if (closing.current) return;
    closing.current = true;
    afterClose.current = action;
    dispatch('close');
    if (reduced || !ready) {
      progress.set(0);
      liftedId.set(null);
      finish();
      return;
    }
    progress.set(
      withSpring(0, { duration: 400, dampingRatio: 1 }, (finished) => {
        if (finished) {
          liftedId.set(null);
          scheduleOnRN(finish);
        }
      }),
    );
  };
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.get() }));
  const previewStyle = useAnimatedStyle(() => ({
    opacity: liftedId.get() === itemId ? 1 : 0,
    transform: [
      { translateX: anchor.rect.x + (target.x - anchor.rect.x) * progress.get() },
      { translateY: anchor.rect.y + (target.y - anchor.rect.y) * progress.get() },
      { scale: 1 + (target.scale - 1) * progress.get() },
    ],
  }));
  const menuStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.3, 1], [0, 0, 1], 'clamp'),
    transform: [{ translateY: (1 - progress.get()) * -8 }],
  }));
  const contentHeight = Math.min(
    page === 'actions' ? actionsHeight || actionCount * 49 + 1 : subpageHeight,
    Math.max(49, height - insets.bottom - target.menuY - 60),
  );
  const viewportStyle = useAnimatedStyle(() => ({
    height: withTiming(contentHeight, {
      duration: reduced ? 0 : 280,
      easing: Easing.bezier(0.23, 1, 0.32, 1),
    }),
  }));
  const pageBlurStyle = useAnimatedStyle(() => ({
    opacity: reduced ? 0 : interpolate(pageProgress.get(), [0, 0.5, 1], [0, 1, 0]),
  }));
  const pageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pageProgress.get(), [0, 0.5, 1], [1, 0.65, 1]),
    transform: [{ translateX: -target.menuWidth * pageProgress.get() }],
  }));
  const move = (folderId?: string) =>
    close(() =>
      commit((value) => {
        if (folderId && !value.folders.some((folder) => folder.id === folderId))
          throw new Error('That folder was removed. Choose another one.');
        return {
          ...value,
          items: value.items.map((saved) =>
            saved.id === item.id ? { ...saved, folderId } : saved,
          ),
        };
      }),
    );
  return (
    <Modal
      transparent
      visible={phase !== 'finished'}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => setShown(true)}
      onRequestClose={() => (page === 'actions' ? close() : navigate('actions'))}
    >
      <View accessibilityViewIsModal style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', inset: 0 }, backdropStyle]}
        >
          {ready && (
            <BlurView
              blurTarget={blurTarget}
              blurMethod="dimezisBlurViewSdk31Plus"
              intensity={35}
              tint={dark ? 'dark' : 'light'}
              style={{ flex: 1, backgroundColor: dark ? '#00000044' : '#26282e11' }}
            />
          )}
        </Animated.View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss save actions"
          onPress={() => close()}
          style={{ position: 'absolute', inset: 0 }}
        />
        {phase !== 'finished' && (
          <Animated.View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                width: anchor.rect.width,
                height: anchor.rect.height,
                transformOrigin: 'top left',
              },
              previewStyle,
            ]}
          >
            <View style={{ margin: -6 }}>
              <SaveCard
                item={item}
                width={anchor.rect.width + 12}
                list={anchor.list}
                onMenu={() => {}}
                onPreviewReady={previewReady}
              />
            </View>
          </Animated.View>
        )}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: (width - target.menuWidth) / 2,
              top: target.menuY,
              width: target.menuWidth,
              backgroundColor: colors.paper,
              borderRadius: radius.card,
              borderWidth: 0.5,
              borderColor: colors.line,
              overflow: 'hidden',
            },
            menuStyle,
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingLeft: 17,
              borderBottomWidth: 0.5,
              borderBottomColor: colors.line,
            }}
          >
            <Text
              allowFontScaling={false}
              accessibilityRole="header"
              style={{ ...type.caption, color: colors.muted, flex: 1 }}
            >
              {page === 'folders'
                ? 'MOVE TO FOLDER'
                : page === 'delete'
                  ? 'DELETE SAVE?'
                  : 'YOUR FIND'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close save actions"
              disabled={disabled}
              onPress={() => close()}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} color={colors.muted} />
            </Pressable>
          </View>
          <Animated.View style={[{ overflow: 'hidden' }, viewportStyle]}>
            <BlurTargetView ref={menuTarget}>
              <Animated.View
                style={[{ flexDirection: 'row', width: target.menuWidth * 2 }, pageStyle]}
              >
                <ScrollView
                  style={{ width: target.menuWidth, height: contentHeight, flexShrink: 0 }}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={(_, contentHeight) => setActionsHeight(contentHeight)}
                  pointerEvents={page === 'actions' ? 'auto' : 'none'}
                  accessibilityElementsHidden={page !== 'actions'}
                  importantForAccessibility={page === 'actions' ? 'auto' : 'no-hide-descendants'}
                >
                  <>
                    <MenuRow
                      label="Open find"
                      icon={ArrowUpRight}
                      disabled={disabled}
                      onPress={() =>
                        close(() =>
                          router.push({ pathname: '/item/[id]', params: { id: item.id } }),
                        )
                      }
                    />
                    {onSelect && (
                      <MenuRow
                        label="Select finds"
                        icon={CheckSquare}
                        disabled={disabled}
                        onPress={() => close(() => onSelect(item.id))}
                      />
                    )}
                    <MenuRow
                      label={item.isPinned ? 'Unpin find' : 'Pin find'}
                      icon={item.isPinned ? PinOff : Pin}
                      disabled={disabled}
                      onPress={() => close(() => pin(item.id))}
                    />
                    <MenuRow
                      label="Move to folder"
                      icon={Folder}
                      disabled={disabled}
                      onPress={() => navigate('folders')}
                    />
                    {!!copy && (
                      <MenuRow
                        label={url ? 'Copy link' : 'Copy text'}
                        icon={Copy}
                        disabled={disabled}
                        onPress={() =>
                          close(async () => {
                            await Clipboard.setStringAsync(copy);
                            setNotice(url ? 'Link copied' : 'Text copied');
                          })
                        }
                      />
                    )}
                    {editable && (
                      <MenuRow
                        label="Edit find"
                        icon={Pencil}
                        disabled={disabled}
                        onPress={() =>
                          close(() =>
                            router.push({ pathname: '/capture', params: { id: item.id } }),
                          )
                        }
                      />
                    )}
                    <View style={{ height: 0.5, backgroundColor: colors.line }} />
                    <MenuRow
                      label="Delete find"
                      icon={Trash2}
                      danger
                      disabled={disabled}
                      onPress={() => navigate('delete')}
                    />
                  </>
                </ScrollView>
                <ScrollView
                  style={{ width: target.menuWidth, height: target.menuHeight - 44 }}
                  keyboardShouldPersistTaps="handled"
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={(_, contentHeight) => setSubpageHeight(contentHeight)}
                  pointerEvents={page === 'actions' ? 'none' : 'auto'}
                  accessibilityElementsHidden={page === 'actions'}
                  importantForAccessibility={page === 'actions' ? 'no-hide-descendants' : 'auto'}
                >
                  <MenuRow
                    label="Back to actions"
                    icon={ArrowLeft}
                    disabled={disabled}
                    onPress={() => navigate('actions')}
                  />
                  {subpage === 'folders' && (
                    <>
                      <MenuRow
                        label="No folder"
                        icon={Folder}
                        disabled={disabled}
                        selected={!item.folderId}
                        onPress={() => move()}
                      />
                      {data.folders.map((folder) => (
                        <MenuRow
                          key={folder.id}
                          label={folder.name}
                          icon={Folder}
                          disabled={disabled}
                          selected={item.folderId === folder.id}
                          onPress={() => move(folder.id)}
                        />
                      ))}
                      {!data.folders.length && (
                        <Text
                          allowFontScaling={false}
                          style={{ ...type.small, color: colors.muted, padding: 17 }}
                        >
                          Create a folder from your collection to start organizing.
                        </Text>
                      )}
                    </>
                  )}
                  {subpage === 'delete' && (
                    <>
                      <Text
                        allowFontScaling={false}
                        style={{ ...type.small, color: colors.muted, padding: 17 }}
                      >
                        This removes the find from your collection and synced devices.
                      </Text>
                      <MenuRow
                        label="Delete this find"
                        icon={Trash2}
                        danger
                        disabled={disabled}
                        onPress={() => close(() => remove(item.id, beforeDelete))}
                      />
                    </>
                  )}
                </ScrollView>
              </Animated.View>
            </BlurTargetView>
            {!reduced && (
              <Animated.View
                pointerEvents="none"
                style={[{ position: 'absolute', inset: 0 }, pageBlurStyle]}
              >
                <BlurView
                  blurTarget={menuTarget}
                  blurMethod="dimezisBlurViewSdk31Plus"
                  intensity={12}
                  tint={dark ? 'dark' : 'light'}
                  style={{ flex: 1 }}
                />
              </Animated.View>
            )}
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}
