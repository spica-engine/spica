/**
 * @owner Kanan Gasimov
 * email: rio.kenan@gmail.com
 */

import React from "react";
import type {CellRendererProps} from "../types";
import {BaseCellRenderer} from "./BaseCellRenderer";
import {RichTextMinimizedInput} from "oziko-ui-kit";
import styles from "./Cells.module.scss";

export const RichTextCell: React.FC<CellRendererProps> = ({
  value,
  onChange,
  isFocused,
  onRequestBlur
}) => {
  const handleSave = (value: string) => {
    onChange(value);
    onRequestBlur();
  };
  return (
    <BaseCellRenderer isFocused={isFocused}>
      <RichTextMinimizedInput
        value={value}
        dimensionX="fill"
        dimensionY={30}
        className={styles.richtextCell}
        onSave={handleSave}
      />
    </BaseCellRenderer>
  );
};
