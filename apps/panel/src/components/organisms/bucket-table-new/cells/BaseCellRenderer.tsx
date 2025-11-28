import { FlexElement } from "oziko-ui-kit";
import React from "react";

/**
 * Base wrapper for all cell renderers
 * Provides common functionality and structure
 */
export const BaseCellRenderer: React.FC<{
  children: React.ReactNode;
  isFocused: boolean;
  onClick?: () => void;
}> = ({ children, isFocused, onClick }) => {
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
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "8px",
        cursor: "pointer",
        border: "none",
        background: "transparent",
        textAlign: "left"
      }}
    >
      {children}
    </FlexElement>
  );
};

