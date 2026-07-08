import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps } from "../types";
import { useCellState } from "../useCellSelection";
import styles from "./Cells.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

export const StringCell: React.FC<CellRendererProps> = React.memo(
  ({ value, onChange, propertyKey, rowId }) => {
    const { isSelected, isEditing, editSeed, select, requestEdit, exitEdit, moveSelection } =
      useCellState(rowId, propertyKey);

    const [editValue, setEditValue] = useState<string>(value ?? "");
    const cancelledRef = useRef(false);
    const prevEditingRef = useRef(isEditing);

    useEffect(() => {
      if (!isEditing) setEditValue(value ?? "");
    }, [value, isEditing]);

    // Seed edit buffer once when entering edit; typed char (editSeed) wins over stored value.
    useEffect(() => {
      if (isEditing) setEditValue(editSeed != null ? editSeed : value ?? "");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);

    // Centralized commit: fires on the edit true->false transition so Enter/Tab/blur/click-away all agree.
    useEffect(() => {
      const was = prevEditingRef.current;
      prevEditingRef.current = isEditing;
      if (was && !isEditing) {
        if (!cancelledRef.current && editValue !== (value ?? "")) onChange(editValue);
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
          {value ?? ""}
        </span>
      );
    }

    return (
      <input
        type="text"
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
            setEditValue(value ?? "");
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

StringCell.displayName = "StringCell";
