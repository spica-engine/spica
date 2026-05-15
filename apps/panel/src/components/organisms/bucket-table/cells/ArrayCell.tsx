/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import {ArrayMinimizedInput} from "oziko-ui-kit";
import React from "react";
import type {CellRendererProps} from "../types";

export const ArrayCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
  propertyKey,
}) => {
  const normalizedItems = React.useMemo(() => {
    if (!property.items) return undefined;

    if (property.items.type && !('properties' in property.items)) {
      return {
        type: property.items.type,
        title: property.items.title,
        properties: property.items.properties,
      };
    }

    return property.items;
  }, [property.items]);

  return (
    <ArrayMinimizedInput
      value={value ?? []}
      onChange={onChange}
      items={normalizedItems}
      propertyKey={propertyKey}
      popoverProps={{
        childrenProps: {
          dimensionY: 30
        }
      }}
      buttonsContainerProps={{
        dimensionY: "fill"
      }}
    />
  );
};

