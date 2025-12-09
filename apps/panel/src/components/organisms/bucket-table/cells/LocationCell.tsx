import React, {useEffect, useRef, useState} from "react";
import type {CellRendererProps, CellKeyboardHandler} from "../types";
import {BaseCellRenderer} from "./BaseCellRenderer";
import {LocationMinimizedInput} from "oziko-ui-kit";
import styles from "./Cells.module.scss";

export type TypeCoordinates = {
  lat: number;
  lng: number;
};



export const LocationCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur
}) => {

  const [coordinates, setCoordinates] = useState<TypeCoordinates>(value);
  useEffect(() => {
    setCoordinates(value);
  }, [value]);

  const handleLocationChange = (newCoordinates: TypeCoordinates) => {
    setCoordinates(newCoordinates);
  };

  useEffect(() => {
    if (!isFocused) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const preventAndStop = () => {
        e.preventDefault();
        e.stopPropagation();
      };

      switch (e.key) {
        case "Enter":
          preventAndStop();
          onChange(coordinates);
          onRequestBlur();
          break;
        
        case "Escape":
          preventAndStop();
          setCoordinates(value);
          onRequestBlur();
          break;
        
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight":
          e.stopPropagation();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isFocused, coordinates, value, onChange, onRequestBlur]);

  return (
    <BaseCellRenderer isFocused={isFocused}>
      <LocationMinimizedInput
       containerProps={{
        dimensionY: 30,
       }}
       childrenProps={{
        className: styles.locationCellContainer,
        dimensionY: 30
       }}
        mapProps={{
          coordinates: coordinates,
          onChange(coordinates){
            handleLocationChange(coordinates);
          }
        }}

        
      />
    </BaseCellRenderer>
  );
};

export const LocationCellKeyboardHandler: CellKeyboardHandler = {
  handleKeyDown: (event, context) => {
    if (event.key === "Enter") {
      return true;
    }

    return false;
  }
};
