import { memo, useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { useReducedMotion } from 'react-native-reanimated';
import { useCollection } from '../state/collection';
import { fonts } from '../theme';
import { openLink } from '../utils/open-link';

export const MarkdownContent = memo(function MarkdownContent({
  text,
  streaming = false,
  previewLines,
}: {
  text: string;
  streaming?: boolean;
  previewLines?: number;
}) {
  const { colors, dark, setError } = useCollection();
  const reduced = useReducedMotion();
  const preview = !!previewLines;
  const body = useMemo(
    () => ({ color: colors.ink, fontSize: preview ? 13 : 16, lineHeight: preview ? 20 : 26 }),
    [colors.ink, preview],
  );
  const handleLinkPress = useCallback(
    ({ url }: { url: string }) => {
      void openLink(url).catch((error) => setError(error.message));
    },
    [setError],
  );
  const markdownStyle = useMemo(
    () => ({
      paragraph: { ...body, marginBottom: preview ? 6 : 14 },
      h1: {
        ...body,
        fontSize: preview ? 18 : 28,
        lineHeight: preview ? 24 : 35,
        fontWeight: '700' as const,
        marginBottom: preview ? 6 : 16,
      },
      h2: {
        ...body,
        fontSize: preview ? 16 : 23,
        lineHeight: preview ? 22 : 30,
        fontWeight: '600' as const,
        marginBottom: preview ? 6 : 12,
      },
      h3: {
        ...body,
        fontSize: preview ? 14 : 19,
        lineHeight: preview ? 20 : 27,
        fontWeight: '600' as const,
      },
      h4: body,
      h5: body,
      h6: body,
      list: {
        ...body,
        bulletColor: colors.accent,
        markerColor: colors.muted,
        itemSpacing: preview ? 2 : 5,
      },
      link: { color: colors.accent, underline: true },
      strong: { color: colors.ink },
      blockquote: {
        ...body,
        borderColor: colors.accent,
        backgroundColor: colors.soft,
        borderRadius: 8,
        padding: preview ? 8 : 12,
      },
      code: {
        color: colors.ink,
        backgroundColor: colors.soft,
        fontFamily: fonts.mono,
        fontSize: preview ? 11 : 14,
      },
      codeBlock: {
        color: colors.ink,
        backgroundColor: colors.canvas,
        borderColor: colors.line,
        borderRadius: 12,
        fontFamily: fonts.mono,
        fontSize: preview ? 11 : 13,
        lineHeight: preview ? 16 : 21,
        padding: preview ? 8 : 14,
        syntaxColors: {
          keyword: dark ? '#c5a5fa' : '#7045b0',
          string: dark ? '#aed3b0' : '#37714c',
          number: dark ? '#efbe8c' : '#965520',
          comment: colors.muted,
          function: dark ? '#a3c8f4' : '#345b9e',
          type: dark ? '#e5c68e' : '#886519',
        },
      },
      table: {
        ...body,
        fontSize: preview ? 11 : 14,
        borderColor: colors.line,
        borderRadius: 12,
        headerBackgroundColor: colors.soft,
        headerTextColor: colors.ink,
        rowEvenBackgroundColor: colors.paper,
        rowOddBackgroundColor: colors.canvas,
        cellPaddingHorizontal: preview ? 6 : 14,
        cellPaddingVertical: preview ? 5 : 10,
      },
      taskList: {
        checkedColor: colors.accent,
        borderColor: colors.muted,
        checkmarkColor: colors.paper,
        checkedTextColor: colors.muted,
      },
      thematicBreak: { color: colors.line },
      image: { maxHeight: preview ? 80 : 320, resizeMode: 'contain' as const, borderRadius: 12 },
      math: { color: colors.ink, backgroundColor: colors.soft },
      inlineMath: { color: colors.ink },
    }),
    [body, colors, dark, preview],
  );
  const content = (
    <EnrichedMarkdownText
      allowFontScaling={false}
      markdown={text}
      flavor="github"
      selectable={!preview && !streaming}
      streamingAnimation={streaming && !reduced}
      streamingConfig={{ tableMode: 'progressive', codeBlockMode: 'progressive' }}
      enableTaskListItemToggle={false}
      enableLinkPreview={false}
      onLinkPress={preview ? undefined : handleLinkPress}
      markdownStyle={markdownStyle}
    />
  );
  // GitHub-flavored native Markdown ignores numberOfLines, so clip previews at the container.
  return previewLines ? (
    <View
      pointerEvents="none"
      style={{ maxHeight: previewLines * body.lineHeight, overflow: 'hidden' }}
    >
      {content}
    </View>
  ) : (
    content
  );
});
