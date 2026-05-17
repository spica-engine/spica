/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from 'react'
import type { CellRendererProps } from "../types";
import styles from "./Cells.module.scss";
import { ObjectMinimizedInput } from "oziko-ui-kit";
import type { TypeProperties } from "oziko-ui-kit/dist/custom-hooks/useInputRepresenter";

export const ObjectCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  property,
}) => {
  const properties: TypeProperties = React.useMemo(() => {
    if (!property?.properties) {
      return {};
    }

    return property.properties as unknown as TypeProperties;
  }, [property?.properties]);

  return (
    <ObjectMinimizedInput
      value={value ?? {}}
      properties={properties}
      onChange={onChange}
      dimensionX="fill"
      dimensionY={30}
      className={styles.objectCell}
    />
  );
};

