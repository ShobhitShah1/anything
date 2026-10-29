import { BlurTargetView } from 'expo-blur';
import { useScrollHeader } from '../components/use-scroll-header';
import { useState } from 'react';
import { Stack } from 'expo-router';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Switch } from '@expo/ui';
import { semantics } from '@expo/ui/jetpack-compose/modifiers';
import { accessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import Image from 'react-native-fast-image';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { useCollection } from '../state/collection';
import { parseBackup } from '../utils/backup';
import { DeleteSheet } from '../components/delete-sheet';
import { Action, Section, NativeGroup, SettingRow, GoogleMark } from '../components/ui';
import { BrandMark } from '../components/brand-mark';
import { PlusCard } from '../components/plus-card';
import { radius, space, type } from '../theme';
import { Crown, LogOut, Trash2 } from 'lucide-react-native';

export default function Settings() {
  const { targetRef, topInset, onScroll, options: headerOptions } = useScrollHeader('Settings');
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
                    backgroundColor: data.theme === theme ? colors.paper : 'transparent',
                  }}
                >
                  <Text
                    allowFontScaling={false}
                    style={{
                      color: data.theme === theme ? colors.ink : colors.muted,
                      fontSize: 13,
                      fontWeight: data.theme === theme ? '600' : '400',
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <NativeGroup>
            <SettingRow
              supportingText="Only while Anything is open"
              trailing={
                <Switch
                  value={data.autoClipboard}
                  modifiers={
                    Platform.OS === 'ios'
                      ? [accessibilityLabel('Clipboard capture')]
                      : [semantics({ contentDescription: 'Clipboard capture' })]
                  }
                  onValueChange={(value) =>
                    void run(() =>
                      state.commit((current) => ({ ...current, autoClipboard: value })),
                    )
                  }
                />
              }
            >
              Clipboard capture
            </SettingRow>
          </NativeGroup>
        </View>
        <Section title="Your collection">
          <NativeGroup>
            <SettingRow
              supportingText={status}
              trailing={
                <Switch
                  modifiers={
                    Platform.OS === 'ios'
                      ? [accessibilityLabel('Cloud sync')]
                      : [semantics({ contentDescription: 'Cloud sync' })]
                  }
                  disabled={!user || state.busy}
                  value={state.enabled}
                  onValueChange={() => void run(state.toggleSync)}
                />
              }
            >
              Cloud sync
            </SettingRow>
            {state.status === 'error' && (
              <SettingRow
                onPress={state.retrySync}
                supportingText="Check your connection and Firebase setup"
              >
                Try connecting again
              </SettingRow>
            )}
            <SettingRow
              onPress={() => void run(exportSaves)}
              supportingText={`${data.items.length} saves · JSON backup`}
            >
              Export collection
            </SettingRow>
            <SettingRow
              onPress={() => void run(importSaves)}
              supportingText="Bring in an existing backup"
            >
              Import saves
            </SettingRow>
          </NativeGroup>
        </Section>
        <View style={{ gap: 16, paddingHorizontal: 6 }}>
          <Text
            allowFontScaling={false}
            style={{ color: colors.muted, fontSize: 12, lineHeight: 20 }}
          >
            Your device always keeps a local copy. Cloud sync is optional and includes saved
            secrets; masking is not encryption. Large images stay local. Export a backup before
            uninstalling.
          </Text>
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
