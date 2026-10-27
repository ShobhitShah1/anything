import { memo, useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Mic, Pencil, Eye, Sparkles, ArrowUp, Check, X } from 'lucide-react-native';
import { useCollection } from '../state/collection';
import type { useQuickAi } from './use-quick-ai';

export const QuickCaptureToolbar = memo(function QuickCaptureToolbar({
  ai,
  hasText,
  saving,
  onSave,
  rendered,
  onEdit,
}: {
  ai: ReturnType<typeof useQuickAi>;
  hasText: boolean;
  saving: boolean;
  onSave: () => void;
  rendered: boolean;
  onEdit: () => void;
}) {
  const { colors, busy } = useCollection();
  const listening = ai.phase === 'listening';
  const { voiceLevel } = ai;
  const reduced = useReducedMotion();
  const mode = useSharedValue(ai.enabled ? 1 : 0);
  useEffect(() => {
    mode.set(withTiming(ai.enabled ? 1 : 0, { duration: reduced ? 0 : 160 }));
  }, [ai.enabled, reduced, mode]);
  const modeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: mode.get() * 36 }] }));
  const micHaloStyle = useAnimatedStyle(() => ({
    opacity: listening ? 0.08 + voiceLevel.get() * 0.18 : 0,
    transform: [{ scale: reduced ? 1 : 1 + voiceLevel.get() * 0.16 }],
  }));
  const voiceBusy = ai.phase === 'starting' || ai.phase === 'finishing';
  const working = ai.phase !== 'idle';
  const disabled = saving || (!working && (busy || !hasText));
  const micDisabled = saving || (working && !listening);
  const result = !!ai.generated && !ai.enabled;
  const label = listening ? 'Done' : working ? 'Stop' : ai.enabled ? 'Generate' : 'Save';
  const EditorIcon = rendered ? Pencil : Eye;
  const ActionIcon = listening ? Check : working ? X : ai.enabled ? ArrowUp : Check;
  const status =
    ai.voiceError ||
    (listening
      ? 'Listening…'
      : ai.phase === 'starting'
        ? 'Starting…'
        : ai.phase === 'finishing'
          ? 'Finishing…'
          : result && ai.generated?.truncated
            ? 'Length limit reached. Edit or undo to continue.'
            : '');

  return (
    <View style={styles.toolbar}>
      <View style={styles.statusRow}>
        <Text
          allowFontScaling={false}
          accessibilityLiveRegion="polite"
          numberOfLines={1}
          style={{ flex: 1, color: colors.muted, fontSize: 12, lineHeight: 18 }}
        >
          {status}
        </Text>
      </View>
      <View style={styles.row}>
        <View style={styles.side}>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={
              ai.enabled
                ? 'Generate mode. Switch to capture mode'
                : 'Capture mode. Switch to generate mode'
            }
            accessibilityState={{ checked: ai.enabled, disabled: saving || working }}
            disabled={saving || working}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              ai.setEnabled(!ai.enabled);
            }}
            style={({ pressed }) => [
              styles.mode,
              {
                backgroundColor: colors.soft,
                opacity: saving || working ? 0.5 : pressed ? 0.75 : 1,
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.modeThumb, { backgroundColor: colors.ink }, modeStyle]}
            />
            <View style={styles.modeIcon}>
              <Pencil
                size={17}
                color={!ai.enabled ? colors.paper : colors.muted}
                strokeWidth={1.8}
              />
            </View>
            <View style={styles.modeIcon}>
              <Sparkles
                size={18}
                color={ai.enabled ? colors.paper : colors.muted}
                strokeWidth={1.8}
              />
            </View>
          </Pressable>
        </View>
        <View style={styles.micSlot}>
          <Animated.View
            pointerEvents="none"
            style={[styles.micHalo, { backgroundColor: colors.ink }, micHaloStyle]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Finish dictation' : 'Dictate voice'}
            accessibilityState={{ busy: voiceBusy, disabled: micDisabled }}
            disabled={micDisabled}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => {});
              void ai.voice();
            }}
            style={({ pressed }) => [
              styles.button,
              styles.mic,
              {
                backgroundColor: listening ? colors.ink : colors.soft,
                opacity: micDisabled ? 0.5 : pressed ? 0.7 : 1,
              },
            ]}
          >
            {voiceBusy ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : listening ? (
              <View style={styles.waveform}>
                {[10, 19, 27, 19, 10].map((height, index) => (
                  <VoiceBar
                    key={index}
                    height={height}
                    level={voiceLevel}
                    color={colors.paper}
                    reduced={reduced}
                  />
                ))}
              </View>
            ) : (
              <Mic size={26} color={colors.ink} strokeWidth={1.7} />
            )}
          </Pressable>
        </View>
        <View
          style={[
            styles.side,
            { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
          ]}
        >
          {result && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={rendered ? 'Edit Markdown' : 'Preview Markdown'}
              disabled={saving}
              accessibilityState={{ disabled: saving }}
              onPress={onEdit}
              style={styles.preview}
            >
              <EditorIcon size={17} color={colors.muted} strokeWidth={1.8} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled, busy: saving || busy }}
            disabled={disabled}
            onPress={() => {
              if (listening) void ai.voice();
              else if (working) ai.cancel();
              else if (ai.enabled) void ai.ask();
              else onSave();
            }}
            style={({ pressed }) => [
              styles.button,
              styles.primary,
              {
                backgroundColor: disabled ? colors.soft : colors.ink,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            {saving || busy ? (
              <ActivityIndicator size="small" color={disabled ? colors.muted : colors.paper} />
            ) : (
              <ActionIcon
                size={22}
                color={disabled ? colors.muted : colors.paper}
                strokeWidth={2}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
});

const VoiceBar = memo(function VoiceBar({
  height,
  level,
  color,
  reduced,
}: {
  height: number;
  level: SharedValue<number>;
  color: string;
  reduced: boolean;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: reduced ? 0.7 : 0.3 + level.get() * 0.7 }],
  }));
  return (
    <Animated.View
      style={[{ width: 3.5, height, borderRadius: 2, backgroundColor: color }, style]}
    />
  );
});

const styles = StyleSheet.create({
  toolbar: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  statusRow: { height: 28, flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  side: { flex: 1 },
  button: {
    width: 72,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mic: { width: 64, height: 64, borderRadius: 32, paddingHorizontal: 0, paddingVertical: 0 },
  primary: { width: 48, minHeight: 48, borderRadius: 24, paddingHorizontal: 0, paddingVertical: 0 },
  mode: { width: 80, height: 44, borderRadius: 22, padding: 4, flexDirection: 'row' },
  modeThumb: { position: 'absolute', left: 4, top: 4, width: 36, height: 36, borderRadius: 18 },
  modeIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  micSlot: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center' },
  micHalo: { position: 'absolute', width: 80, height: 80, borderRadius: 40 },
  waveform: {
    height: 28,
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
