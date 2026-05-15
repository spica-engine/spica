import React, { useEffect, useState } from "react";
import type { CellRendererProps } from "../types";
import { NumberMinimizedInput } from "oziko-ui-kit";

export const NumberCell: React.FC<CellRendererProps> = ({ value, onChange }) => {
  const [editValue, setEditValue] = useState<string>(value != null ? String(value) : "");

  useEffect(() => {
    setEditValue(value != null ? String(value) : "");
  }, [value]);

  return (
    <NumberMinimizedInput
      value={value ?? undefined}
      inputProps={{
        value: editValue,
        onChange: (e) => setEditValue(e.target.value),
        onBlur: () => {
          const num = editValue === "" ? null : Number(editValue);
          if (num !== value) onChange(num);
        },
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        },
      }}
      onClear={() => {
        setEditValue("");
        onChange(null);
      }}
    />
  );
};

