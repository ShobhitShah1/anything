const extensionLanguages: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  hpp: 'cpp',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  markdown: 'markdown',
  txt: 'text',
};

export function languageFromPath(path: string) {
  const filename = path.trim().split(/[\\/]/).pop()?.toLowerCase() || '';
  return extensionLanguages[filename.split('.').pop() || filename] || 'text';
}

export function hasSupportedCodeExtension(path: string) {
  const filename = path.trim().split(/[\\/]/).pop()?.toLowerCase() || '';
  const extension = filename.includes('.') ? filename.split('.').pop() || '' : '';
  return Boolean(extension && extensionLanguages[extension]);
}

export function codePreviewMarkdown(language: string, code: string) {
  const languageId = /^[a-z0-9_+-]+$/i.test(language) ? language.toLowerCase() : 'text';
  let longestFence = 2;

  for (const [run] of code.matchAll(/`+/g)) longestFence = Math.max(longestFence, run.length);

  const fence = '`'.repeat(longestFence + 1);
  return `${fence}${languageId}\n${code}\n${fence}`;
}
