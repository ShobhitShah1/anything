import React from 'react';
import { ItemType, Folder } from '../types';
import { sound } from '../utils/sound';
import { FolderDropdown } from './FolderDropdown';

export type FilterCategory = 'all' | 'pinned' | ItemType;
export type SortOption = 'newest' | 'oldest' | 'title';

interface FilterBarProps {
  folders: Folder[];
  selectedFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  onCreateFolder?: (name: string) => Folder;
  totalCount: number;
  folderCounts: Record<string, number>;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;

  selectedFilter: FilterCategory;
  onFilterChange: (cat: FilterCategory) => void;
  itemCounts: Record<string, number>;
  isDark?: boolean;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  totalCount,
  folderCounts, sortOption, onSortChange,
  selectedFilter,
  onFilterChange,
  itemCounts,
  isDark = false,
}) => {
  if (totalCount === 0 && folders.length === 0) return null;

  const categories: { id: FilterCategory; label: string }[] = [
    { id: 'all', label: 'Everything' },
    { id: 'pinned', label: 'Pinned' },
    { id: 'markdown', label: 'Markdown' },
    { id: 'note', label: 'Notes' },
    { id: 'link', label: 'Links' },
    { id: 'x_post', label: 'Posts' },
    { id: 'reddit_post', label: 'Reddit' },
    { id: 'instagram_post', label: 'Instagram' },
    { id: 'code', label: 'Code' },
    { id: 'secret', label: 'Secrets' },
    { id: 'image', label: 'Images' },
  ];

  return (
    <section aria-label="Collection controls" className="collection-controls collection-toolbar w-full max-w-[1600px] mx-auto px-5 sm:px-9">
      <div className="collection-folder relative z-20">
        <FolderDropdown
          folders={folders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
          onCreateFolder={onCreateFolder}
          isDark={isDark}
          emptyLabel="All folders"
          folderCounts={folderCounts}
          totalCount={totalCount}
        />

      </div>
      <div className="collection-types flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Filter by type">
        {categories.map((cat) => {
          const count = itemCounts[cat.id] ?? 0;
          const isActive = selectedFilter === cat.id;

          if (count === 0 && cat.id !== 'all' && !isActive) return null;

          return (
            <button
              key={cat.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => {
                sound.click();
                onFilterChange(cat.id);
              }}
              className="mind-filter"
            >
              <span className="relative z-10 flex items-center gap-1.5">
                <span>{cat.label}</span>
                <span className="mind-filter-count tabular-nums">
                  {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <select aria-label="Sort saves" value={sortOption} onChange={event => onSortChange(event.target.value as SortOption)} className="collection-sort">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="title">Title A-Z</option>
      </select>
    </section>
  );
};
