import React, { useState, useCallback, useMemo } from 'react';
import type { FilterField, FilterConditionRow } from './types';
import { OPERATORS_BY_TYPE, DEFAULT_OPERATOR, operatorNeedsValue, conditionsToMongoFilter } from './filterPanelUtils';
import styles from './FilterPanel.module.scss';
import { StringInput, NumberInput, DateInput, BooleanInput, EnumInput } from 'oziko-ui-kit';

interface FilterPanelProps {
  fields: FilterField[];
  onApply: (filter: Record<string, any> | null) => void;
  onClear: () => void;
  onRequestClose?: () => void;
  className?: string;
}

const createEmptyCondition = (): FilterConditionRow => ({
  id: crypto.randomUUID(),
  logicalOp: 'AND',
  field: '',
  operator: 'contains',
  value: '',
});

// Field type icons (inline SVG paths)
const FieldTypeIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'number':
      return (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
          <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
        </svg>
      );
    case 'date':
      return (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'boolean':
      return (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
          <circle cx="16" cy="12" r="3" fill="currentColor" />
        </svg>
      );
    case 'enum':
      return (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
      );
    default: // string
      return (
        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      );
  }
};

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

const FilterPanel: React.FC<FilterPanelProps> = ({
  fields,
  onApply,
  onClear,
  onRequestClose,
  className,
}) => {
  const [conditions, setConditions] = useState<FilterConditionRow[]>([createEmptyCondition()]);

  const fieldMap = useMemo(() => new Map(fields.map(f => [f.key, f])), [fields]);

  const activeCount = useMemo(
    () =>
      conditions.filter(c => {
        if (!c.field) return false;
        if (!operatorNeedsValue(c.operator)) return true;
        return c.value.trim() !== '';
      }).length,
    [conditions]
  );

  const handleFieldChange = useCallback((id: string, fieldKey: string) => {
    const field = fieldMap.get(fieldKey);
    const newOperator = field ? DEFAULT_OPERATOR[field.type] : 'contains';
    const defaultValue = field?.type === 'boolean' ? 'true' : '';
    setConditions(prev =>
      prev.map(c => c.id === id ? { ...c, field: fieldKey, operator: newOperator, value: defaultValue } : c)
    );
  }, [fieldMap]);

  const handleOperatorChange = useCallback((id: string, operator: string) => {
    setConditions(prev =>
      prev.map(c => c.id === id ? { ...c, operator, value: operatorNeedsValue(operator) ? c.value : '' } : c)
    );
  }, []);

  const handleValueChange = useCallback((id: string, value: string) => {
    setConditions(prev => prev.map(c => c.id === id ? { ...c, value } : c));
  }, []);

  const handleLogicToggle = useCallback((id: string) => {
    setConditions(prev =>
      prev.map(c => c.id === id ? { ...c, logicalOp: c.logicalOp === 'AND' ? 'OR' : 'AND' } : c)
    );
  }, []);

  const handleRemove = useCallback((id: string) => {
    setConditions(prev => prev.length <= 1 ? [createEmptyCondition()] : prev.filter(c => c.id !== id));
  }, []);

  const handleAdd = useCallback(() => {
    setConditions(prev => [...prev, createEmptyCondition()]);
  }, []);

  const handleApply = useCallback(() => {
    onApply(conditionsToMongoFilter(conditions, fields));
    onRequestClose?.();
  }, [conditions, fields, onApply, onRequestClose]);

  const handleClear = useCallback(() => {
    setConditions([createEmptyCondition()]);
    onClear();
    onRequestClose?.();
  }, [onClear, onRequestClose]);

  const handleRemoveTag = useCallback((id: string) => {
    const next = conditions.filter(c => c.id !== id);
    const newConditions = next.length ? next : [createEmptyCondition()];
    setConditions(newConditions);
    onApply(conditionsToMongoFilter(newConditions, fields));
  }, [conditions, fields, onApply]);

  const activeTags = useMemo(
    () =>
      conditions.filter(c => {
        if (!c.field) return false;
        if (!operatorNeedsValue(c.operator)) return true;
        return c.value.trim() !== '';
      }),
    [conditions]
  );

  const panelClass = [
    styles.filterPanel,
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={panelClass}>
      {/* Header */}
      <div className={styles.fpHead}>
        <div className={styles.fpHeadLeft}>
          <span className={styles.fpHeadTitle}>Filters</span>
          {activeCount > 0 && <span className={styles.fpHeadCount}>{activeCount}</span>}
        </div>
        <div className={styles.fpHeadActions}>
          <button className={styles.fpClearBtn} onClick={handleClear} type="button">
            <CloseIcon size={11} />
            Clear
          </button>
          <button className={styles.fpApplyBtn} onClick={handleApply} type="button">
            <CheckIcon />
            Apply
          </button>
        </div>
      </div>

      {/* Rows */}
      <div className={styles.fpRows}>
        {conditions.map((condition, index) => {
          const field = condition.field ? fieldMap.get(condition.field) : undefined;
          const operators = field ? OPERATORS_BY_TYPE[field.type] : OPERATORS_BY_TYPE.string;
          const showValueInput = operatorNeedsValue(condition.operator);

          return (
            <div key={condition.id} className={styles.filterRow}>
              {/* Logic badge or spacer */}
              {index === 0 ? (
                <div />
              ) : (
                <button
                  className={`${styles.logicBadge} ${condition.logicalOp === 'OR' ? styles.logicOr : ''}`}
                  onClick={() => handleLogicToggle(condition.id)}
                  type="button"
                  title="Click to toggle AND / OR"
                >
                  {condition.logicalOp}
                </button>
              )}

              {/* Field select */}
              <div className={styles.fSelectWrap}>
                <div className={styles.fSelectIcon}>
                  <FieldTypeIcon type={field?.type ?? 'string'} />
                </div>
                <select
                  className={styles.fSelect}
                  value={condition.field}
                  onChange={e => handleFieldChange(condition.id, e.target.value)}
                >
                  <option value="">Select field…</option>
                  {fields.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <div className={styles.fSelectArrow}><ChevronDownIcon /></div>
              </div>

              {/* Operator select */}
              <div className={styles.opSelectWrap}>
                <select
                  className={styles.opSelect}
                  value={condition.operator}
                  onChange={e => handleOperatorChange(condition.id, e.target.value)}
                  disabled={!condition.field}
                >
                  {operators.map(op => (
                    <option key={op.value} value={op.value}>{op.label}</option>
                  ))}
                </select>
                <div className={styles.opSelectArrow}><ChevronDownIcon /></div>
              </div>

              {/* Value input */}
              <div className={!showValueInput ? styles.valInputHidden : undefined}>
                {field?.type === 'boolean' ? (
                  <BooleanInput
                    checked={condition.value !== 'false'}
                    onChange={checked => handleValueChange(condition.id, checked ? 'true' : 'false')}
                    className={styles.compactInput}
                  />
                ) : field?.type === 'enum' ? (
                  <EnumInput
                    label="Value"
                    options={(field.enumOptions ?? []).map(o => ({ label: o.label, value: String(o.value) }))}
                    value={condition.value}
                    onChange={v => handleValueChange(condition.id, String(v))}
                    className={styles.compactInput}
                  />
                ) : field?.type === 'number' ? (
                  <NumberInput
                    value={condition.value !== '' ? Number(condition.value) : undefined}
                    onChange={v => handleValueChange(condition.id, v === undefined ? '' : String(v))}
                    inputProps={{ disabled: !condition.field }}
                    className={styles.compactInput}
                  />
                ) : field?.type === 'date' ? (
                  <div className={styles.compactInput}>
                    <DateInput
                      value={condition.value || null}
                      onChange={d => handleValueChange(condition.id, d.toISOString())}
                      datePickerProps={{showTime: true, format: "YYYY-MM-DD HH:mm:ss"}}
                    />
                  </div>
                ) : (
                  <StringInput
                    value={condition.value}
                    onChange={v => handleValueChange(condition.id, v)}
                    inputProps={{ disabled: !condition.field, placeholder: condition.field ? 'Enter value…' : 'Select a field first' }}
                    className={styles.compactInput}
                  />
                )}
              </div>

              {/* Remove button */}
              <button
                className={styles.rowRmBtn}
                onClick={() => handleRemove(condition.id)}
                type="button"
              >
                <CloseIcon size={13} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Footer: add condition + active tags */}
      <div className={styles.fpAddRow}>
        <button className={styles.fpAddBtn} onClick={handleAdd} type="button">
          <PlusIcon />
          Add Condition
        </button>

        {activeTags.length > 0 && (
          <div className={styles.filterTagsRow}>
            {activeTags.map(tag => {
              const f = fieldMap.get(tag.field);
              const displayVal = operatorNeedsValue(tag.operator)
                ? f?.type === 'enum'
                  ? f.enumOptions?.find(o => String(o.value) === tag.value)?.label ?? tag.value
                  : f?.type === 'boolean'
                  ? tag.value === 'true' ? 'True' : 'False'
                  : `"${tag.value}"`
                : '';
              return (
                <div key={tag.id} className={styles.filterTag}>
                  <span className={styles.filterTagField}>{f?.label ?? tag.field}</span>
                  <span className={styles.filterTagOp}>{tag.operator}</span>
                  {displayVal && <span className={styles.filterTagVal}>{displayVal}</span>}
                  <span
                    className={styles.filterTagRm}
                    onClick={() => handleRemoveTag(tag.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && handleRemoveTag(tag.id)}
                  >
                    <CloseIcon size={11} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FilterPanel;
