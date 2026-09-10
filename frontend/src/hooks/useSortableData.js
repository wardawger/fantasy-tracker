import { useMemo, useState } from 'react';

export function useSortableData(items, defaultKey = null, defaultDirection = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDirection, setSortDirection] = useState(defaultDirection);

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    const copy = [...items].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal);
      }
      return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    });
    return sortDirection === 'asc' ? copy : copy.reverse();
  }, [items, sortKey, sortDirection]);

  const requestSort = (key) => {
    if (sortKey === key) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return { items: sorted, sortKey, sortDirection, requestSort };
}
