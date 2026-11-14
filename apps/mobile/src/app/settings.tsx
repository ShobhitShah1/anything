import { useState, type ReactNode } from 'react';
import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { cubicBezier, useReducedMotion } from 'react-native-reanimated';
import { BlurTargetView } from 'expo-blur';
import Image from 'react-native-fast-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useCollection } from '../state/collection';
import { parseBackup } from '../utils/backup';
import { DeleteSheet } from '../components/delete-sheet';
import { Action, Section, GoogleMark } from '../components/ui';
import { BrandMark } from '../components/brand-mark';
import { PlusCard } from '../components/plus-card';
import { WebShowcaseCard } from '../components/web-showcase-card';
import { useScrollHeader } from '../components/use-scroll-header';
import { radius, space, type } from '../theme';
import { Crown, LogOut, Trash2 } from 'lucide-react-native';

function SettingsSwitch({
  label,
  value,
  disabled = false,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useCollection();
  const reduced = useReducedMotion();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={{ width: 52, height: 48, alignItems: 'flex-end', justifyContent: 'center' }}
    >
      <Animated.View
        style={[
          {
            width: 48,
            height: 28,
            padding: 3,
            borderRadius: 14,
            justifyContent: 'center',
            backgroundColor: value ? colors.accent : colors.soft,
            opacity: disabled ? 0.45 : 1,
          },
          !reduced && {
            transitionProperty: 'backgroundColor',
            transitionDuration: '180ms',
            transitionTimingFunction: cubicBezier(0.22, 1, 0.36, 1),
          },
        ]}
      >
        <Animated.View
          style={[
            {
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: colors.paper,
              transform: [{ translateX: value ? 20 : 0 }],
            },
            !reduced && {
              transitionProperty: 'transform',
              transitionDuration: '180ms',
              transitionTimingFunction: cubicBezier(0.22, 1, 0.36, 1),
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

function SettingsRow({
  title,
  supportingText,
  trailing,
  onPress,
  divided = false,
}: {
  title: string;
  supportingText?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  divided?: boolean;
}) {
  const { colors } = useCollection();
  const content = (
    <View
      style={{
        minHeight: 76,
        paddingHorizontal: 20,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderTopWidth: divided ? 1 : 0,
        borderTopColor: colors.line,
      }}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <Text allowFontScaling={false} style={{ color: colors.ink, fontSize: 15, lineHeight: 21 }}>
          {title}
        </Text>
        {!!supportingText && (
          <Text
            allowFontScaling={false}
            style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}
          >
            {supportingText}
          </Text>
        )}
      </View>
      {trailing}
    </View>
  );

  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export default function Settings() {
  const { targetRef, topInset, onScroll, options: headerOptions } = useScrollHeader('Settings');
  const reducedMotion = useReducedMotion();
  const state = useCollection();
  const { data, user, colors } = state;
  const [deleting, setDeleting] = useState(false);
  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      state.setError(error instanceof Error ? error.message : 'Could not complete this action.');
    }
  };
  const exportSaves = async () => {
    const text = JSON.stringify(data.items, null, 2);
    const name = `anything-backup-${new Date().toISOString().slice(0, 10)}.json`;

    if (!(await Sharing.isAvailableAsync()))
      throw new Error('File sharing is unavailable on this device.');

    const file = new File(Paths.cache, name);

    file.write(text);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
  };
  const importSaves = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      // File providers can label JSON as text or an unknown binary MIME type.
      type: '*/*',
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    if ((asset.size || 0) > 15_000_000) throw new Error('Import a backup smaller than 15 MB.');

    const file = new File(asset.uri);

    if (file.size > 15_000_000) throw new Error('Import a backup smaller than 15 MB.');

    const text = await file.text();
    const parsed = parseBackup(text);

    await state.commit((value) => ({
      ...value,
      items: [...new Map([...parsed, ...value.items].map((item) => [item.id, item])).values()],
    }));
    state.setNotice('Backup imported');
  };
  const status =
    state.status === 'synced'
      ? 'Everything is up to date'
      : state.status === 'syncing'
        ? 'Saving your changes…'
        : state.status === 'connecting'
          ? 'Connecting to your collection…'
          : state.status === 'error'
            ? 'Connection needs attention'
            : 'Saved on this device';

  return (
    <BlurTargetView ref={targetRef} style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen options={headerOptions} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={onScroll}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ top: topInset }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          padding: space.lg,
          paddingTop: topInset + 8,
          gap: space.lg,
          paddingBottom: 60,
          maxWidth: 720,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <View
          style={{
            backgroundColor: colors.paper,
            padding: 16,
            borderRadius: radius.group,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                borderWidth: state.pro ? 2 : 0,
                borderColor: '#E8B849',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {user?.photoURL ? (
                <Image
                  source={{ uri: user.photoURL }}
                  style={{
                    width: state.pro ? 40 : 44,
                    height: state.pro ? 40 : 44,
                    borderRadius: 22,
                  }}
                />
              ) : (
                <BrandMark size={state.pro ? 40 : 44} />
              )}
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={{
                    color: colors.ink,
                    fontSize: 18,
                    lineHeight: 23,
                    fontWeight: '600',
                    flexShrink: 1,
                  }}
                >
                  {user?.displayName || 'Your space, anywhere.'}
                </Text>
                {state.pro && (
                  <Crown
                    size={17}
                    color="#C18C20"
                    fill="#F2C35B"
                    strokeWidth={1.4}
                    accessible
                    accessibilityLabel="Pro member"
                  />
                )}
              </View>
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                selectable
                style={{ fontSize: 13, lineHeight: 18, color: colors.muted }}
              >
                {user?.email || 'Sign in to keep your finds in sync.'}
              </Text>
            </View>
            {user && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                accessibilityState={{ disabled: state.busy }}
                disabled={state.busy}
                onPress={() => void state.signOut()}
                style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
              >
                <LogOut size={20} color={colors.muted} strokeWidth={1.6} />
              </Pressable>
            )}
          </View>
          {!user && (
            <Action
              title={state.busy ? 'Connecting…' : 'Continue with Google'}
              leading={<GoogleMark />}
              disabled={state.busy}
              onPress={() => void state.signIn()}
            />
          )}
        </View>
        <PlusCard />

        <View
          style={{ backgroundColor: colors.paper, borderRadius: radius.group, overflow: 'hidden' }}
        >
          <View style={{ padding: 16, gap: 12 }}>
            <Text
              allowFontScaling={false}
              style={{ color: colors.ink, fontSize: 15, fontWeight: '500' }}
            >
              Appearance
            </Text>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Appearance"
              style={{
                flexDirection: 'row',
                backgroundColor: colors.canvas,
                padding: 4,
                borderRadius: 12,
              }}
            >
              {(
                [
                  ['system', 'System'],
                  ['light', 'Light'],
                  ['dark', 'Dark'],
                ] as const
              ).map(([theme, label]) => (
                <Pressable
                  key={theme}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: data.theme === theme }}
                  onPress={() => void run(() => state.commit((current) => ({ ...current, theme })))}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 9,
                    position: 'relative',
                  }}
                >
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFill,
                      {
                        borderRadius: 9,
                        backgroundColor: data.theme === theme ? colors.paper : 'transparent',
                      },
                      !reducedMotion && {
                        transitionProperty: 'backgroundColor',
                        transitionDuration: '180ms',
                        transitionTimingFunction: cubicBezier(0.22, 1, 0.36, 1),
                      },
                    ]}
                  />
                  <Animated.Text
                    allowFontScaling={false}
                    style={{
                      color: data.theme === theme ? colors.ink : colors.muted,
                      fontSize: 13,
                      fontWeight: data.theme === theme ? '600' : '400',
                    }}
                  >
                    {label}
                  </Animated.Text>
                </Pressable>
              ))}
            </View>
          </View>
          <SettingsRow
            title="Clipboard capture"
            supportingText="Only while Anything is open"
            trailing={
              <SettingsSwitch
                label="Clipboard capture"
                value={data.autoClipboard}
                onChange={(value) =>
                  void run(() => state.commit((current) => ({ ...current, autoClipboard: value })))
                }
              />
            }
          />
        </View>
        <Section title="Your collection">
          <View
            style={{
              backgroundColor: colors.paper,
              borderRadius: radius.group,
              overflow: 'hidden',
            }}
          >
            <SettingsRow
              title="Cloud sync"
              supportingText={status}
              trailing={
                <SettingsSwitch
                  label="Cloud sync"
                  disabled={!user || state.busy}
                  value={state.enabled}
                  onChange={() => void run(state.toggleSync)}
                />
              }
            />
            {state.status === 'error' && (
              <SettingsRow
                divided
                title="Try connecting again"
                supportingText="Check your connection and Firebase setup"
                onPress={state.retrySync}
              />
            )}
            <SettingsRow
              divided
              title="Export collection"
              supportingText={`${data.items.length} saves · JSON backup`}
              onPress={() => void run(exportSaves)}
            />
            <SettingsRow
              divided
              title="Import saves"
              supportingText="Bring in an existing backup"
              onPress={() => void run(importSaves)}
            />
          </View>
        </Section>
        <WebShowcaseCard />
        <View style={{ paddingHorizontal: 6, paddingTop: 4 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setDeleting(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 }}
          >
            <Trash2 size={15} color={colors.danger} />
            <Text allowFontScaling={false} style={{ ...type.small, color: colors.danger }}>
              Delete all saves
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <DeleteSheet
        open={deleting}
        title="Clear your collection?"
        description={`${data.items.length} ${data.items.length === 1 ? 'save' : 'saves'} will be deleted. ${state.enabled ? 'This also removes them from your synced account. ' : ''}Export a backup first; this cannot be undone.`}
        confirmLabel="Delete all saves"
        onDismiss={() => setDeleting(false)}
        onConfirm={() => state.commit((value) => ({ ...value, items: [], autoClipboard: false }))}
      />
    </BlurTargetView>
  );
}
