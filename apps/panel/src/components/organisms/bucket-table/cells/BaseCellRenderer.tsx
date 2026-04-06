import { FlexElement } from "oziko-ui-kit";
import React from "react";
import styles from "./Cells.module.scss";

export const BaseCellRenderer: React.FC<{
  children: React.ReactNode;
  isFocused: boolean;
  onClick?: () => void;
  className?: string;
}> = ({ children, isFocused, onClick, className }) => {
  const handleClick = () => {
    onClick?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <FlexElement
      dimensionX={"fill"}
      alignment={"leftTop"}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={`${styles.baseCellRenderer} ${className}`}
    >
      {children}
    </FlexElement>
  );
};

