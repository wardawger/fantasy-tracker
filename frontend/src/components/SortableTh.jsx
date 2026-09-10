import React from 'react';

export default function SortableTh({ label, sortKey, currentKey, direction, onSort, className = '' }) {
  const isActive = currentKey === sortKey;
  return (
    <th
      className={`py-2 select-none cursor-pointer hover:text-slate-200 whitespace-nowrap ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[10px] text-slate-500">{isActive ? (direction === 'asc' ? '▲' : '▼') : '⇅'}</span>
      </span>
    </th>
  );
}
