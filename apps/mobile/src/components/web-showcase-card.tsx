import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  ArrowDownUp,
  ArrowUpRight,
  Folder,
  LayoutGrid,
  List,
  Pin,
  Search,
} from 'lucide-react-native';
import { useCollection } from '../state/collection';
import { openLink } from '../utils/open-link';
import { BrandMark } from './brand-mark';
import { radius } from '../theme';

const WEB_URL = 'https://shobhitshah1.github.io/anything/';

export const WebShowcaseCard = memo(function WebShowcaseCard() {
  const { colors, data } = useCollection();
  const handlePress = () => {
    void Haptics.selectionAsync();
    void openLink(WEB_URL);
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Open Anything on the Web to view your collection in a desktop browser"
      onPress={handlePress}
      style={({ pressed }) => ({
        padding: 14,
        gap: 14,
        backgroundColor: colors.paper,
        borderColor: colors.line,
        borderRadius: radius.group,
        borderCurve: 'continuous',
        borderWidth: 1,
        opacity: pressed ? 0.78 : 1,
      })}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          height: 134,
          flexDirection: 'row',
          backgroundColor: colors.canvas,
          borderRadius: 15,
        }}
      >
        <View
          style={{
            width: 29,
            alignItems: 'center',
            paddingTop: 9,
            gap: 10,
            borderRightWidth: 0.5,
            borderRightColor: colors.line,
          }}
        >
          <BrandMark size={14} />
          <LayoutGrid size={10} color={colors.accent} />
          <Pin size={10} color={colors.muted} />
          <Folder size={10} color={colors.muted} />
        </View>
        <View style={{ flex: 1, minWidth: 0, padding: 9, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View
              style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 }}
            >
              <Search size={12} color={colors.muted} />
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={{
                  color: colors.muted,
                  fontFamily: 'Georgia',
                  fontStyle: 'italic',
                  fontSize: 9,
                }}
              >
                Find something you saved…
              </Text>
            </View>
            <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 7 }}>
              {data.items.length} saves
            </Text>
            <LayoutGrid size={9} color={colors.ink} />
            <List size={9} color={colors.muted} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Folder size={8} color={colors.muted} />
              <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 7 }}>
                All folders
              </Text>
            </View>
            <View style={{ width: 0.5, height: 13, backgroundColor: colors.line }} />
            <View
              style={{
                paddingHorizontal: 5,
                paddingVertical: 3,
                borderRadius: 5,
                backgroundColor: colors.soft,
              }}
            >
              <Text
                allowFontScaling={false}
                style={{ color: colors.ink, fontSize: 7, fontWeight: '600' }}
              >
                Everything
              </Text>
            </View>
            <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 7 }}>
              Pinned
            </Text>
            <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 7 }}>
              Links
            </Text>
            <View style={{ flex: 1 }} />
            <ArrowDownUp size={9} color={colors.muted} />
          </View>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 7 }}>
            <View
              style={{
                flex: 1,
                padding: 7,
                gap: 5,
                borderRadius: 8,
                borderWidth: 0.5,
                borderColor: colors.line,
                backgroundColor: colors.paper,
              }}
            >
              <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 6 }}>
                NOTE
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={{ color: colors.ink, fontFamily: 'Georgia', fontSize: 8, lineHeight: 10 }}
              >
                Aesthetic Interface Principles
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                padding: 7,
                gap: 5,
                borderRadius: 8,
                borderWidth: 0.5,
                borderColor: colors.line,
                backgroundColor: colors.paper,
              }}
            >
              <Text allowFontScaling={false} style={{ color: colors.muted, fontSize: 6 }}>
                LINK · WITHANIMATION.APP
              </Text>
              <View
                style={{
                  width: '92%',
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.ink,
                  opacity: 0.65,
                }}
              />
              <View
                style={{
                  width: '64%',
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colors.muted,
                  opacity: 0.45,
                }}
              />
            </View>
          </View>
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <Text
            allowFontScaling={false}
            style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}
          >
            Anything on the Web
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Text
              allowFontScaling={false}
              style={{ color: colors.accent, fontSize: 13, fontWeight: '600' }}
            >
              Open
            </Text>
            <ArrowUpRight size={15} color={colors.accent} strokeWidth={1.8} />
          </View>
        </View>
        <Text
          allowFontScaling={false}
          style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}
        >
          Pick up your collection from any computer. Your finds stay in sync.
        </Text>
      </View>
    </Pressable>
  );
});
