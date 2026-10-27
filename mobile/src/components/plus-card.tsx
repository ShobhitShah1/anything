import { Pressable, Text, View } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useCollection } from '../state/collection';
import { fonts } from '../theme';
import { MembershipBackdrop } from './membership-backdrop';

export function PlusCard({ compact = false }: { compact?: boolean }) {
  const { colors } = useCollection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Explore Anything Pro. 100 AI responses each month."
      onPress={() => router.push('/subscription')}
      style={({ pressed }) => ({
        minHeight: compact ? 44 : 72,
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
        flexShrink: 0,
      })}
    >
      {compact ? (
        <View
          style={{
            width: 76,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            paddingVertical: 8,
            borderRadius: 99,
            backgroundColor: colors.soft,
          }}
        >
          <Text
            allowFontScaling={false}
            maxFontSizeMultiplier={1.1}
            numberOfLines={1}
            style={{ color: colors.ink, fontSize: 12, lineHeight: 18, fontWeight: '600' }}
          >
            Go Pro
          </Text>
          <ArrowUpRight size={12} color={colors.accent} />
        </View>
      ) : (
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 18,
            backgroundColor: colors.paper,
            borderRadius: 22,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: colors.line,
            overflow: 'hidden',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <MembershipBackdrop compact />
          <View style={{ flex: 1, gap: 10 }}>
            <Text
              allowFontScaling={false}
              style={{
                color: colors.ink,
                fontSize: 18,
                lineHeight: 24,
                fontWeight: '600',
                letterSpacing: -0.5,
              }}
            >
              Anything Pro
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text
                allowFontScaling={false}
                style={{ flexShrink: 1, color: colors.accent, fontSize: 12, lineHeight: 18 }}
              >
                Explore membership
              </Text>
              <ArrowUpRight size={13} strokeWidth={1.7} color={colors.accent} />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 1 }}>
            <Text
              allowFontScaling={false}
              style={{
                color: colors.ink,
                fontSize: 37,
                lineHeight: 41,
                fontFamily: fonts.editorial,
                letterSpacing: -1.5,
              }}
            >
              100
            </Text>
            <Text
              allowFontScaling={false}
              style={{ color: colors.muted, fontSize: 10, lineHeight: 15 }}
            >
              AI responses / month
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}
