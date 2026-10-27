import { memo, useCallback, useMemo } from 'react';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { useReducedMotion } from 'react-native-reanimated';
import { useCollection } from '../state/collection';
import { fonts } from '../theme';
import { openLink } from '../utils/open-link';

export const MarkdownContent = memo(function MarkdownContent({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
  const { colors, dark, setError } = useCollection();
  const reduced = useReducedMotion();
  const body = useMemo(() => ({ color: colors.ink, fontSize: 16, lineHeight: 26 }), [colors.ink]);
  const handleLinkPress = useCallback(
    ({ url }: { url: string }) => {
      void openLink(url).catch((error) => setError(error.message));
    },
    [setError],
  );
  const markdownStyle = useMemo(
    () => ({
      paragraph: { ...body, marginBottom: 14 },
      h1: { ...body, fontSize: 28, lineHeight: 35, fontWeight: '700' as const, marginBottom: 16 },
      h2: { ...body, fontSize: 23, lineHeight: 30, fontWeight: '600' as const, marginBottom: 12 },
      h3: { ...body, fontSize: 19, lineHeight: 27, fontWeight: '600' as const },
      h4: body,
      h5: body,
      h6: body,
      list: { ...body, bulletColor: colors.accent, markerColor: colors.muted, itemSpacing: 5 },
      link: { color: colors.accent, underline: true },
      strong: { color: colors.ink },
      blockquote: {
        ...body,
        borderColor: colors.accent,
        backgroundColor: colors.soft,
        borderRadius: 8,
        padding: 12,
      },
      code: {
        color: colors.ink,
        backgroundColor: colors.soft,
        fontFamily: fonts.mono,
        fontSize: 14,
      },
      codeBlock: {
        color: colors.ink,
        backgroundColor: colors.canvas,
        borderColor: colors.line,
        borderRadius: 12,
        fontFamily: fonts.mono,
        fontSize: 13,
        lineHeight: 21,
        padding: 14,
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
        fontSize: 14,
        borderColor: colors.line,
        borderRadius: 12,
        headerBackgroundColor: colors.soft,
        headerTextColor: colors.ink,
        rowEvenBackgroundColor: colors.paper,
        rowOddBackgroundColor: colors.canvas,
        cellPaddingHorizontal: 14,
        cellPaddingVertical: 10,
      },
      taskList: {
        checkedColor: colors.accent,
        borderColor: colors.muted,
        checkmarkColor: colors.paper,
        checkedTextColor: colors.muted,
      },
      thematicBreak: { color: colors.line },
      image: { maxHeight: 320, resizeMode: 'contain' as const, borderRadius: 12 },
      math: { color: colors.ink, backgroundColor: colors.soft },
      inlineMath: { color: colors.ink },
    }),
    [body, colors, dark],
  );
  return (
    <EnrichedMarkdownText
      allowFontScaling={false}
      markdown={text}
      flavor="github"
      selectable={!streaming}
      streamingAnimation={streaming && !reduced}
      streamingConfig={{ tableMode: 'progressive', codeBlockMode: 'progressive' }}
      enableTaskListItemToggle={false}
      enableLinkPreview={false}
      onLinkPress={handleLinkPress}
      markdownStyle={markdownStyle}
    />
  );
});
