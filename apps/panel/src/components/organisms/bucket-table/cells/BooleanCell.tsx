import React from "react";
import type { CellRendererProps } from "../types";
import { BooleanMinimizedInput } from "oziko-ui-kit";

export const BooleanCell: React.FC<CellRendererProps> = ({ value, onChange }) => {
  return (
    <BooleanMinimizedInput
      checked={value ?? false}
      onChange={onChange}
    />
  );
};
