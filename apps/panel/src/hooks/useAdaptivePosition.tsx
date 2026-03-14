import { useState, useCallback, RefObject } from "react";

export type Placement =
  | "topStart"
  | "top"
  | "topEnd"
  | "rightStart"
  | "right"
  | "rightEnd"
  | "bottomStart"
  | "bottom"
  | "bottomEnd"
  | "leftStart"
  | "left"
  | "leftEnd";

type AdaptivePositionProps = {
  containerRef: RefObject<HTMLElement | null>;
  targetRef: RefObject<HTMLElement | null>;
  initialPlacement?: Placement;
};

type PositionStyle = {
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};

const useAdaptivePosition = ({
  containerRef,
  targetRef,
  initialPlacement = "bottom",
}: AdaptivePositionProps) => {
  const [targetPosition, setTargetPosition] = useState<PositionStyle | null>(null);
  const GAP = 4;
  const calculatePosition = useCallback(() => {
    if (!containerRef.current || !targetRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const targetHeight = targetRef.current.offsetHeight;
    const targetWidth = targetRef.current.offsetWidth;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const topGap = rect.top - targetHeight + window.scrollY - GAP;
    const bottomGap = rect.bottom + window.scrollY + GAP;
    const leftGap = rect.left - targetWidth + window.scrollX - GAP;
    const rightGap = rect.right + window.scrollX + GAP;

    const placements: Record<Placement, PositionStyle> = {
      topStart: {
        top: topGap,
        left: rect.left + window.scrollX,
        bottom: rect.top + window.scrollY,
        right: rect.left + targetWidth + window.scrollX,
      },
      top: {
        top: topGap,
        left: rect.left + rect.width / 2 - targetWidth / 2 + window.scrollX,
        bottom: rect.top + window.scrollY,
        right: rect.left + rect.width / 2 + targetWidth / 2 + window.scrollX,
      },
      topEnd: {
        top: topGap,
        left: rect.right - targetWidth + window.scrollX,
        bottom: rect.top + window.scrollY,
        right: rect.right + window.scrollX,
      },
      rightStart: {
        top: rect.top + window.scrollY,
        left: rightGap,
        bottom: rect.top + targetHeight + window.scrollY,
        right: rect.right + targetWidth + window.scrollX,
      },
      right: {
        top: rect.top + rect.height / 2 - targetHeight / 2 + window.scrollY,
        left: rightGap,
        bottom: rect.top + rect.height / 2 + targetHeight / 2 + window.scrollY,
        right: rect.right + targetWidth + window.scrollX,
      },
      rightEnd: {
        top: rect.bottom - targetHeight + window.scrollY,
        left: rightGap,
        bottom: rect.bottom + window.scrollY,
        right: rect.right + targetWidth + window.scrollX,
      },
      bottomStart: {
        top: bottomGap,
        left: rect.left + window.scrollX,
        bottom: rect.bottom + targetHeight + window.scrollY,
        right: rect.left + targetWidth + window.scrollX,
      },
      bottom: {
        top: bottomGap,
        left: rect.left + rect.width / 2 - targetWidth / 2 + window.scrollX,
        bottom: rect.bottom + targetHeight + window.scrollY,
        right: rect.left + rect.width / 2 + targetWidth / 2 + window.scrollX,
      },
      bottomEnd: {
        top: bottomGap,
        left: rect.right - targetWidth + window.scrollX,
        bottom: rect.bottom + targetHeight + window.scrollY,
        right: rect.right + window.scrollX,
      },
      leftStart: {
        top: rect.top + window.scrollY,
        left: leftGap,
        bottom: rect.top + targetHeight + window.scrollY,
        right: rect.left + window.scrollX,
      },
      left: {
        top: rect.top + rect.height / 2 - targetHeight / 2 + window.scrollY,
        left: leftGap,
        bottom: rect.top + rect.height / 2 + targetHeight / 2 + window.scrollY,
        right: rect.left + window.scrollX,
      },
      leftEnd: {
        top: rect.bottom - targetHeight + window.scrollY,
        left: leftGap,
        bottom: rect.bottom + window.scrollY,
        right: rect.left + window.scrollX,
      },
    };

    const checkPositionFit = (position: PositionStyle): boolean => {
      const { top, left, bottom, right } = position;
      const fitsVertically =
        (top === undefined || top >= 0) && (bottom === undefined || bottom <= viewportHeight);

      const fitsHorizontally =
        (left === undefined || left >= 0) && (right === undefined || right <= viewportWidth);

      return fitsVertically && fitsHorizontally;
    };

    const getBestPlacement = (): Placement => {
      const alternativePlacements: Record<Placement, Placement[]> = {
        top: ["topStart", "topEnd", "bottom", "bottomStart", "bottomEnd"],
        bottom: ["bottomStart", "bottomEnd", "top", "topStart", "topEnd"],
        left: ["leftStart", "leftEnd", "right", "rightStart", "rightEnd"],
        right: ["rightStart", "rightEnd", "left", "leftStart", "leftEnd"],
        topStart: ["top", "topEnd", "bottom", "bottomStart", "bottomEnd"],
        topEnd: ["bottom", "bottomEnd", "top", "topStart", "topEnd"],
        rightStart: ["right", "rightEnd", "left", "leftStart", "leftEnd"],
        rightEnd: ["right", "rightStart", "left", "leftStart", "leftEnd"],
        bottomStart: ["bottom", "bottomEnd", "top", "topStart", "topEnd"],
        bottomEnd: ["bottom", "bottomStart", "top", "topStart", "topEnd"],
        leftStart: ["left", "leftEnd", "right", "rightStart", "rightEnd"],
        leftEnd: ["left", "leftStart", "right", "rightStart", "rightEnd"],
      };

      if (checkPositionFit(placements[initialPlacement])) {
        return initialPlacement;
      }

      if (initialPlacement === "bottom" && !checkPositionFit(placements.bottom)) {
        if (checkPositionFit(placements.top)) {
          return "top";
        }
      }

      const alternatives = alternativePlacements[initialPlacement];

      for (let placement of alternatives) {
        if (checkPositionFit(placements[placement])) {
          return placement;
        }
      }

      return initialPlacement;
    };

    const bestPlacement = getBestPlacement();
    setTargetPosition(placements[bestPlacement]);
  }, [containerRef, targetRef, initialPlacement]);

  return { targetPosition, calculatePosition };
};

export default useAdaptivePosition;
