import React from "react";
import type {CellRendererProps} from "../types";
import {LocationMinimizedInput} from "oziko-ui-kit";
import styles from "./Cells.module.scss";

export type TypeCoordinates = {
  lat: number;
  lng: number;
};

export const LocationCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
}) => {
  return (
    <LocationMinimizedInput
      containerProps={{ dimensionY: 30 }}
      childrenProps={{
        className: styles.locationCellContainer,
        dimensionY: 30
      }}
      mapProps={{
        coordinates: value,
        onChange(coordinates) {
          onChange(coordinates);
        }
      }}
    />
  );
};
