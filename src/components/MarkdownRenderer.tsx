import React, { useMemo } from 'react';
import { marked } from 'marked';

interface MarkdownRendererProps {
  content: string;
  isDark?: boolean;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  isDark = false,
  className = '',
}) => {
  const htmlContent = useMemo(() => {
    try {
      return marked.parse(content || '', { breaks: true, gfm: true }) as string;
    } catch (e) {
      console.error('Failed to parse markdown:', e);
      return `<p>${content}</p>`;
    }
  }, [content]);

  return (
    <div
      className={`markdown-body ${
        isDark ? 'text-zinc-200' : 'text-zinc-850'
      } ${className}`}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
};
