import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { BottomSheet, Host, RNHostView } from '@expo/ui';
import { Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCollection } from '../state/collection';
import { Action } from './ui';
import { Feedback } from './feedback';
import { radius, type } from '../theme';

export function DeleteSheet({
  open,
  title,
  description,
  confirmLabel = 'Delete',
  onDismiss,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onDismiss: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { colors, dark } = useCollection();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setLocalError] = useState('');
  const inFlight = useRef(false);
  const confirm = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLocalError('');
    setBusy(true);
    try {
      await onConfirm();
      onDismiss();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not delete. Please try again.';
      setLocalError(message);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <Host colorScheme={dark ? 'dark' : 'light'} style={{ position: 'absolute' }}>
      <BottomSheet
        isPresented={open}
        onDismiss={onDismiss}
        containerColor={colors.paper}
        shouldDismissOnBackPress={!busy}
        shouldDismissOnClickOutside={!busy}
        contentPadding={{ left: 24, right: 24, top: 8, bottom: Math.max(insets.bottom, 20) }}
      >
        <RNHostView matchContents={{ vertical: true }}>
          <View style={{ gap: 18, paddingBottom: 8 }}>
            <Trash2 size={25} strokeWidth={1.5} color={colors.danger} />
            <Text
              allowFontScaling={false}
              accessibilityRole="header"
              style={{ color: colors.ink, fontSize: 26, lineHeight: 32, letterSpacing: -0.7 }}
            >
              {title}
            </Text>
            <Text allowFontScaling={false} style={{ color: colors.muted, ...type.body }}>
              {description}
            </Text>
            {!!error && <Feedback message={error} error onDismiss={() => setLocalError('')} />}
            <View style={{ gap: 8, marginTop: 6 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                onPress={() => void confirm()}
                style={{
                  minHeight: 52,
                  borderRadius: radius.pill,
                  padding: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.danger,
                  opacity: busy ? 0.65 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color={colors.paper} />
                ) : (
                  <Text
                    allowFontScaling={false}
                    style={{ color: colors.paper, fontSize: 15, fontWeight: '600' }}
                  >
                    {confirmLabel}
                  </Text>
                )}
              </Pressable>
              <Action title="Cancel" secondary disabled={busy} onPress={onDismiss} />
            </View>
          </View>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}
