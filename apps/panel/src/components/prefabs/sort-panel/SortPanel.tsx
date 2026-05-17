import React, { useState, useCallback, useMemo } from 'react';
import type { SortField, SortRow } from '../filter-panel/types';
import styles from './SortPanel.module.scss';

interface SortPanelProps {
  fields: SortField[];
  onApply: (sort: Record<string, 1 | -1> | null) => void;
  onClear: () => void;
  className?: string;
}

const createEmptySortRow = (fields: SortField[]): SortRow => ({
  id: crypto.randomUUID(),
  field: fields[0]?.key ?? '',
  direction: 'asc',
});

const ChevronDownIcon = () => (
  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CloseIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = () => (
  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const PlusIcon = () => (
  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

const AscIcon = () => (
  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="5 12 12 5 19 12" />
  </svg>
);

const DescIcon = () => (
  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
  </svg>
);

const SortPanel: React.FC<SortPanelProps> = ({
  fields,
  onApply,
  onClear,
  className,
}) => {
  const [rows, setRows] = useState<SortRow[]>([createEmptySortRow(fields)]);

  const activeCount = useMemo(() => rows.filter(r => r.field).length, [rows]);

  const handleFieldChange = useCallback((id: string, field: string) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, field } : r));
  }, []);

  const handleDirectionToggle = useCallback((id: string, direction: 'asc' | 'desc') => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, direction } : r));
  }, []);

  const handleRemove = useCallback((id: string) => {
    setRows(prev => prev.length <= 1 ? [createEmptySortRow(fields)] : prev.filter(r => r.id !== id));
  }, [fields]);

  const handleAdd = useCallback(() => {
    setRows(prev => [...prev, createEmptySortRow(fields)]);
  }, [fields]);

  const handleApply = useCallback(() => {
    const validRows = rows.filter(r => r.field);
    if (!validRows.length) {
      onApply(null);
      return;
    }
    const sort: Record<string, 1 | -1> = {};
    validRows.forEach(r => {
      sort[r.field] = r.direction === 'asc' ? 1 : -1;
    });
    onApply(sort);
  }, [rows, onApply]);

  const handleClear = useCallback(() => {
    setRows([createEmptySortRow(fields)]);
    onClear();
  }, [fields, onClear]);

  const fieldMap = useMemo(() => new Map(fields.map(f => [f.key, f])), [fields]);

  const panelClass = [
    styles.sortPanel,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className={styles.spHead}>
        <div className={styles.spHeadLeft}>
          <span className={styles.spHeadTitle}>Sort</span>
          {activeCount > 0 && <span className={styles.spHeadCount}>{activeCount}</span>}
        </div>
        <div className={styles.spHeadActions}>
          <button className={styles.spClearBtn} onClick={handleClear} type="button">
            <CloseIcon size={11} />
            Clear
          </button>
          <button className={styles.spApplyBtn} onClick={handleApply} type="button">
            <CheckIcon />
            Apply
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className={styles.spRows}>
        {rows.map((row, index) => (
          <div key={row.id} className={styles.sortRow}>
            {/* Priority number */}
            <div className={styles.sortNum}>{index + 1}</div>

            {/* Field select */}
            <div className={styles.fSelectWrap}>
              <div className={styles.fSelectIcon}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <polyline points="4 7 4 4 20 4 20 7" />
                  <line x1="9" y1="20" x2="15" y2="20" />
                  <line x1="12" y1="4" x2="12" y2="20" />
                </svg>
              </div>
              <select
                className={styles.fSelect}
                value={row.field}
                onChange={e => handleFieldChange(row.id, e.target.value)}
              >
                <option value="">Select field…</option>
                {fields.map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
              <div className={styles.fSelectArrow}><ChevronDownIcon /></div>
            </div>

            {/* Direction toggle */}
            <div className={styles.dirToggle}>
              <button
                className={`${styles.dirBtn} ${row.direction === 'asc' ? styles.dirBtnActive : ''}`}
                onClick={() => handleDirectionToggle(row.id, 'asc')}
                type="button"
              >
                <AscIcon />
                ASC
              </button>
              <button
                className={`${styles.dirBtn} ${row.direction === 'desc' ? styles.dirBtnActive : ''}`}
                onClick={() => handleDirectionToggle(row.id, 'desc')}
                type="button"
              >
                <DescIcon />
                DESC
              </button>
            </div>

            {/* Remove button */}
            <button
              className={styles.rowRmBtn}
              onClick={() => handleRemove(row.id)}
              type="button"
            >
              <CloseIcon size={13} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className={styles.spAddRow}>
        <button className={styles.spAddBtn} onClick={handleAdd} type="button">
          <PlusIcon />
          Add Sort
        </button>

        {rows.filter(r => r.field).length > 0 && (
          <div className={styles.sortTagsRow}>
            {rows
              .filter(r => r.field)
              .map(r => (
                <div key={r.id} className={styles.sortTag}>
                  {r.direction === 'asc' ? <AscIcon /> : <DescIcon />}
                  <span className={styles.sortTagField}>{fieldMap.get(r.field)?.label ?? r.field}</span>
                  <span className={styles.sortTagDir}>{r.direction.toUpperCase()}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SortPanel;
