/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type {FilterInputHandlerProps} from "./FilterInputHandlerRegistry";
import {ArrayMinimizedInput} from "oziko-ui-kit";
import styles from "../Filter.module.scss";

const ArrayInputHandler: React.FC<FilterInputHandlerProps> = ({value, onChange, property}) => {
  // Type guard to ensure we have an array property with items
  const arrayProperty = property as any;
  const items = arrayProperty?.items;

  return (
    <ArrayMinimizedInput
      propertyKey={property.key}
      value={value}
      onChange={onChange}
      items={items}
      popoverProps={{
         childrenProps:{
            dimensionY: "fill",
            dimensionX: "fill",
         },
         containerProps:{
            dimensionY: 23,
            dimensionX: "fill",
         }
      }}
      buttonsContainerProps={{
        dimensionY: "fill",
        dimensionX: "fill",
        alignment: "leftCenter",
        className: styles.arrayInputButtons,
      }}
    />
  );
};

export default ArrayInputHandler;
