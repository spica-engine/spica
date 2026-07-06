import React, {useCallback} from "react";
import {ColorPicker, FlexElement} from "oziko-ui-kit";
import type {CellRendererProps} from "../types";
import {useCellState} from "../useCellSelection";
import styles from "./Cells.module.scss";

const normalizeColor = (color: any): string =>
  typeof color === "string" ? color : color?.hex || color?.value || String(color || "#000000");

export const ColorCell: React.FC<CellRendererProps> = ({value, onChange, propertyKey, rowId}) => {
  const {isSelected, isEditing, isEditable, select, requestEdit, exitEdit} = useCellState(rowId, propertyKey);

  const displayColor = normalizeColor(value);

  const handleColorChange = useCallback(
    (newColor: any) => {
      onChange(normalizeColor(newColor));
      exitEdit();
    },
    [onChange, exitEdit]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      if (!isSelected) {
        select();
      } else if (isEditable) {
        requestEdit();
      }
    },
    [isSelected, isEditable, select, requestEdit]
  );

  const className = [styles.colorCellContainer, isSelected && styles.cellSelected]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={className} onClick={handleClick}>
      {isEditing ? (
        <ColorPicker value={displayColor} onChange={handleColorChange} />
      ) : (
        // background-color is per-row data with no design token — inline is unavoidable here.
        <FlexElement dimensionX={20} dimensionY={20} style={{backgroundColor: displayColor}} />
      )}
    </div>
  );
};
