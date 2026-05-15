import React, { useEffect, useState } from "react";
import type { CellRendererProps } from "../types";
import { StringMinimizedInput } from "oziko-ui-kit";

export const StringCell: React.FC<CellRendererProps> = ({ value, onChange }) => {
  const [editValue, setEditValue] = useState<string>(value ?? "");

  useEffect(() => {
    setEditValue(value ?? "");
  }, [value]);

  return (
    <StringMinimizedInput
      value={editValue}
      inputProps={{
        onChange: (e) => setEditValue(e.target.value),
        onBlur: () => {
          if (editValue !== (value ?? "")) {
            onChange(editValue);
          }
        },
        onKeyDown: (e) => {
          if (e.key === "Enter") {
            (e.target as HTMLInputElement).blur();
          }
        },
      }}
      onClear={() => {
        setEditValue("");
        onChange("");
      }}
    />
  );
};




