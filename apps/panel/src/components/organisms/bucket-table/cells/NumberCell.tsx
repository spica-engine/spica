import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps } from "../types";
import { useCellState } from "../useCellSelection";
import styles from "./Cells.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

const toBuffer = (value: any) => (value != null ? String(value) : "");

export const NumberCell: React.FC<CellRendererProps> = React.memo(
  ({ value, onChange, propertyKey, rowId }) => {
    const { isSelected, isEditing, editSeed, select, requestEdit, exitEdit, moveSelection } =
      useCellState(rowId, propertyKey);

    const [editValue, setEditValue] = useState<string>(toBuffer(value));
    const cancelledRef = useRef(false);
    const prevEditingRef = useRef(isEditing);

    useEffect(() => {
      if (!isEditing) setEditValue(toBuffer(value));
    }, [value, isEditing]);

    useEffect(() => {
      if (isEditing) setEditValue(editSeed != null ? editSeed : toBuffer(value));
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);

    useEffect(() => {
      const was = prevEditingRef.current;
      prevEditingRef.current = isEditing;
      if (was && !isEditing) {
        if (!cancelledRef.current) {
          const num = editValue === "" ? null : Number(editValue);
          if (num !== value) onChange(num);
        }
        cancelledRef.current = false;
      }
    }, [isEditing, editValue, value, onChange]);

    if (!isEditing) {
      return (
        <span
          className={cx(styles.readDisplay, isSelected && styles.cellSelected)}
          onClick={(e) => {
            e.stopPropagation();
            isSelected ? requestEdit() : select();
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            requestEdit();
          }}
        >
          {value != null ? String(value) : ""}
        </span>
      );
    }

    return (
      <input
        type="text"
        inputMode="decimal"
        className={styles.editInput}
        value={editValue}
        autoFocus
        onFocus={(e) => {
          const input = e.currentTarget;
          if (editSeed != null) {
            const len = input.value.length;
            input.setSelectionRange(len, len);
          } else {
            input.select();
          }
        }}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => exitEdit()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            exitEdit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancelledRef.current = true;
            setEditValue(toBuffer(value));
            exitEdit();
          } else if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            exitEdit();
            moveSelection(e.shiftKey ? "left" : "right");
          }
        }}
      />
    );
  }
);

NumberCell.displayName = "NumberCell";
