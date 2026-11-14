import { ChipRow } from './chip-row';

const homeFilters = [
  { value: 'all', label: 'All finds' },
  { value: 'pinned', label: 'Pinned' },
  { value: 'link', label: 'Links' },
  { value: 'note', label: 'Notes' },
  { value: 'image', label: 'Images' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'code', label: 'Code' },
  { value: 'secret', label: 'Secrets' },
  { value: 'credential', label: 'Credentials' },
];

export function FilterChips<T extends string>({
  value,
  onSelect,
  edgeInset,
  options,
}: {
  value: T;
  onSelect: (value: T) => void;
  edgeInset: number;
  options?: readonly { value: T; label: string }[];
}) {
  return (
    <ChipRow<T>
      edgeInset={edgeInset}
      value={value}
      onSelect={onSelect}
      options={options ?? (homeFilters as readonly { value: T; label: string }[])}
    />
  );
}
