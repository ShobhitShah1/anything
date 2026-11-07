export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id];
}

export function toggleVisibleSelection(
  selected: readonly string[],
  visible: readonly string[],
): string[] {
  const next = new Set(selected);
  const remove = visible.every((id) => next.has(id));
  for (const id of visible) {
    if (remove) next.delete(id);
    else next.add(id);
  }
  return [...next];
}
