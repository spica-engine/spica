import { useMemo } from "react";
import { TypeFlexContainer, TypeFlexDimension } from "../utils/interface";

export function useFlexStyles<T extends Partial<TypeFlexContainer & TypeFlexDimension>>(
  options = {
    alignment: "center",
    direction: "horizontal",
    dimensionX: "hug",
    dimensionY: "hug",
    gap: 5,
  } as T
) {
  return useMemo(() => {
    const { alignment, direction, dimensionX, dimensionY, gap } = options;

    const classes = [
      "flexElement",
      alignment ? alignment : "",
      direction && direction === "vertical" ? "vertical" : "horizontal",
      direction && direction === "wrap" ? "wrap" : "noWrap",
      typeof dimensionX === "number" ? "" : dimensionX && `dimensionX${dimensionX}`,
      typeof dimensionY === "number" ? "" : dimensionY && `dimensionY${dimensionY}`,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    const inlineStyles = {
      gap: `${gap}px`,
      width: typeof dimensionX === "number" ? `${dimensionX}px` : undefined,
      height: typeof dimensionY === "number" ? `${dimensionY}px` : undefined,
    };

    return { classes, inlineStyles };
  }, [options]);
}
