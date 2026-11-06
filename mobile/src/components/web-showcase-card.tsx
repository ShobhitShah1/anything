import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { ArrowUpRight } from 'lucide-react-native';
import { useCollection } from '../state/collection';
import { openLink } from '../utils/open-link';
import { radius } from '../theme';

const WEB_URL = 'https://shobhitshah1.github.io/anything/';

export const WebShowcaseCard = memo(function WebShowcaseCard() {
  const { colors } = useCollection();

  const handlePress = () => {
    void Haptics.selectionAsync();
    void openLink(WEB_URL);
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="Anything on the Web. Open your collection in any desktop browser at shobhitshah1.github.io/anything"
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.paper,
          borderColor: colors.line,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <Text allowFontScaling={false} style={[styles.title, { color: colors.ink }]}>
          Anything on the Web
        </Text>
        <View style={styles.action}>
          <Text allowFontScaling={false} style={[styles.actionText, { color: colors.accent }]}>
            Open
          </Text>
          <ArrowUpRight size={14} color={colors.accent} strokeWidth={1.8} />
        </View>
      </View>

      <Text allowFontScaling={false} style={[styles.description, { color: colors.muted }]}>
        Access your collection from any computer. Your links, notes, and finds stay in sync across
        your phone and browser.
      </Text>

      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.url, { color: colors.muted }]}
      >
        shobhitshah1.github.io/anything
      </Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    borderWidth: 1,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  url: {
    fontSize: 11.5,
    opacity: 0.65,
    marginTop: 2,
  },
});
