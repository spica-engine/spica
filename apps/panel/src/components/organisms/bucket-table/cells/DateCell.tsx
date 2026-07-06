import React, { useEffect, useRef, useState } from "react";
import type { CellRendererProps } from "../types";
import { DatePicker } from "oziko-ui-kit";
import { useCellState } from "../useCellSelection";
import styles from "./Cells.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

// The oziko/antd DatePicker may hand back a formatted string, a dayjs object
// (exposes `.toDate()`), a native Date, or an array. Normalize whatever it
// emits to an ISO string so the commit effect fires with a real value instead
// of silently dropping the pick.
const toIso = (raw: unknown): string | null => {
  if (raw == null || raw === "") return null;
  if (Array.isArray(raw)) return toIso(raw[0]);

  let date: Date;
  if (typeof raw === "object" && typeof (raw as {toDate?: unknown}).toDate === "function") {
    date = (raw as {toDate: () => Date}).toDate();
  } else if (raw instanceof Date) {
    date = raw;
  } else {
    date = new Date(raw as string | number);
  }

  return isNaN(date.getTime()) ? null : date.toISOString();
};

const formatDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
};

export const DateCell: React.FC<CellRendererProps> = React.memo(
  ({ value, onChange, propertyKey, rowId }) => {
    const { isSelected, isEditing, select, requestEdit, exitEdit } = useCellState(rowId, propertyKey);

    const [editValue, setEditValue] = useState<string | null>(value ?? null);
    const [open, setOpen] = useState(true);
    const cancelledRef = useRef(false);
    const prevEditingRef = useRef(isEditing);
    // Antd fires a spurious onOpenChange(false) synchronously with the click that
    // mounts the picker, which used to tear edit mode down instantly. Swallow any
    // close until the picker has settled one frame after entering edit.
    const settledRef = useRef(false);

    useEffect(() => {
      if (!isEditing) setEditValue(value ?? null);
    }, [value, isEditing]);

    useEffect(() => {
      if (isEditing) {
        setEditValue(value ?? null);
        setOpen(true);
        settledRef.current = false;
        const id = requestAnimationFrame(() => {
          settledRef.current = true;
        });
        return () => cancelAnimationFrame(id);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isEditing]);

    useEffect(() => {
      const was = prevEditingRef.current;
      prevEditingRef.current = isEditing;
      if (was && !isEditing) {
        if (!cancelledRef.current && editValue !== (value ?? null)) onChange(editValue);
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
          {formatDate(value ?? null)}
        </span>
      );
    }

    return (
      <DatePicker
        value={editValue}
        open={open}
        onChange={(newValue) => {
          setEditValue(toIso(newValue));
          setOpen(false);
          exitEdit();
        }}
        onOpenChange={(next) => {
          if (next) {
            setOpen(true);
            return;
          }
          // Ignore the transient close that arrives with the opening click.
          if (!settledRef.current) return;
          setOpen(false);
          exitEdit();
        }}
        autoFocus
        format="YYYY-MM-DD HH:mm:ss"
        placeholder="Invalid Date"
        className={styles.dateInput}
        showTime
      />
    );
  }
);

DateCell.displayName = "DateCell";
