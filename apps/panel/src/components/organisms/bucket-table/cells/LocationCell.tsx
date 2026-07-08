import React from "react";
import type {CellRendererProps} from "../types";
import {LocationInput, Popover} from "oziko-ui-kit";
import {useCellState} from "../useCellSelection";
import styles from "./Cells.module.scss";

const cx = (...classes: (string | false | undefined)[]) => classes.filter(Boolean).join(" ");

export type TypeCoordinates = {
  lat: number;
  lng: number;
};

const formatCoordinates = (value: any): string | null => {
  if (value && typeof value === "object" && value.lat != null && value.lng != null) {
    return `${value.lat}, ${value.lng}`;
  }
  return null;
};

export const LocationCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  propertyKey,
  rowId,
}) => {
  const {isSelected, isEditing, select, requestEdit, exitEdit} = useCellState(rowId, propertyKey);

  const label = formatCoordinates(value);

  return (
    <Popover
      open={isEditing}
      onClose={exitEdit}
      content={
        <div className={styles.complexEditorPopover} onClick={e => e.stopPropagation()}>
          <LocationInput coordinates={value ?? undefined} onChange={coordinates => onChange(coordinates)} />
        </div>
      }
      containerProps={{ dimensionX: "fill", dimensionY: "fill", className: styles.cellShellContainer }}
      childrenProps={{ dimensionX: "fill", dimensionY: "fill" }}
    >
      <span
        className={cx(styles.readDisplay, isSelected && styles.cellSelected)}
        onClick={e => {
          e.stopPropagation();
          isSelected ? requestEdit() : select();
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          requestEdit();
        }}
      >
        {label ?? ""}
      </span>
    </Popover>
  );
};
