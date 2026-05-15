import { FlexElement } from "oziko-ui-kit";
import React from "react";
import styles from "./Cells.module.scss";

export const BaseCellRenderer: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ children, onClick, className }) => {
  return (
    <FlexElement
      dimensionX={"fill"}
      alignment={"leftTop"}
      onClick={onClick}
      className={`${styles.baseCellRenderer} ${className ?? ""}`}
    >
      {children}
    </FlexElement>
  );
};

