import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps } from "../types";
import { Popover } from "oziko-ui-kit";
import { useCellState } from "../useCellSelection";
import styles from "./Cells.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

export const TextareaCell: React.FC<CellRendererProps> = React.memo(
  ({ value, onChange, propertyKey, rowId }) => {
    const normalizedValue = value ?? "";
    const { isSelected, isEditing, editSeed, select, requestEdit, exitEdit } = useCellState(
      rowId,
      propertyKey
    );

    const [editValue, setEditValue] = useState<string>(normalizedValue);
    const cancelledRef = useRef(false);
    const prevEditingRef = useRef(isEditing);

    useEffect(() => {
      if (!isEditing) setEditValue(value ?? "");
    }, [value, isEditing]);

    useEffect(() => {
      if (isEditing) setEditValue(editSeed != null ? editSeed : value ?? "");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);

    useEffect(() => {
      const was = prevEditingRef.current;
      prevEditingRef.current = isEditing;
      if (was && !isEditing) {
        if (!cancelledRef.current && editValue !== (value ?? "")) onChange(editValue);
        cancelledRef.current = false;
      }
    }, [isEditing, editValue, value, onChange]);

    return (
      <div className={styles.textareaCellContainer}>
        <Popover
          open={isEditing}
          onClose={() => exitEdit()}
          content={
            <textarea
              className={styles.textareaEdit}
              value={editValue}
              autoFocus
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => exitEdit()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  exitEdit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  cancelledRef.current = true;
                  setEditValue(value ?? "");
                  exitEdit();
                }
              }}
            />
          }
          contentProps={{ className: styles.textAreaContent }}
          containerProps={{
            dimensionX: "fill",
            dimensionY: "fill",
            className: styles.cellShellContainer,
          }}
          childrenProps={{ dimensionX: "fill", dimensionY: "fill" }}
        >
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
            {normalizedValue}
          </span>
        </Popover>
      </div>
    );
  }
);

TextareaCell.displayName = "TextareaCell";
