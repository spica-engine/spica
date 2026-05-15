import React from "react";
import { ColorPicker } from "oziko-ui-kit";
import type { CellRendererProps } from "../types";

export const ColorCell: React.FC<CellRendererProps> = ({ value, onChange }) => {
  const normalizedValue = value ?? "#000000";

  const handleColorChange = (newColor: any) => {
    const colorString = typeof newColor === "string"
      ? newColor
      : (newColor?.hex || newColor?.value || String(newColor || "#000000"));
    onChange(colorString);
  };

  return (
    <ColorPicker
      value={normalizedValue}
      onChange={handleColorChange}
    />
  );
};


