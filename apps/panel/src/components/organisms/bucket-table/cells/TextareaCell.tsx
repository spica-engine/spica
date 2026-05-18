/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React, { useCallback, useState } from 'react'
import type { CellRendererProps } from '../types'
import { Popover, TextAreaMinimizedInput } from 'oziko-ui-kit'
import styles from './Cells.module.scss'

export const TextareaCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
}) => {
  const normalizedValue = value ?? "";
  const [isOpen, setIsOpen] = useState(false);
  const [editValue, setEditValue] = useState(normalizedValue);

  const handleChange = useCallback((newValue: string) => {
    setEditValue(newValue);
  }, []);

  const handleSave = useCallback(() => {
    if (editValue !== normalizedValue) {
      onChange(editValue);
    }
    setIsOpen(false);
  }, [editValue, normalizedValue, onChange]);

  const handleClear = useCallback(() => {
    setEditValue("");
    onChange("");
    setIsOpen(false);
  }, [onChange]);

  return (
    <div className={styles.textareaCellContainer}>
      <Popover
        open={isOpen}
        onClose={handleSave}
        content={
          <TextAreaMinimizedInput
            value={editValue}
            onChange={handleChange}
            onBlur={handleSave}
            root={{ className: styles.textAreaRoot }}
            suffix={{ className: styles.textAreaClearButton }}
            className={styles.textareaInput}
            focusedRows={5}
            rows={5}
            cols={30}
            onClear={handleClear}
          />
        }
        contentProps={{ className: styles.textAreaContent }}
        containerProps={{
          dimensionX: "fill",
          dimensionY: "fill",
          className: styles.textAreaContainer
        }}
      >
        <span
          className={styles.valueCell}
          onClick={() => {
            setEditValue(normalizedValue);
            setIsOpen(true);
          }}
        >
          {normalizedValue}
        </span>
      </Popover>
    </div>
  )
}
