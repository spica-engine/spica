import {useCallback} from "react";

export type InsetValue = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type PopoverStackEntry = {
  id: string;
  inset: InsetValue;
};

const STACK_OFFSET = 20;
const MIN_MARGIN = 8;

const stackState: {
  stack: PopoverStackEntry[];
  idCounter: number;
} = {
  stack: [],
  idCounter: 0
};


const clampAxis = (
  viewportSize: number,
  requiredSize: number,
  startInset: number,
  endInset: number
): {start: number; end: number} => {
  const availableSize = viewportSize - startInset - endInset;

  if (availableSize >= requiredSize) {
    return {
      start: Math.max(MIN_MARGIN, startInset),
      end: Math.max(MIN_MARGIN, endInset)
    };
  }

  const adjustedEnd = viewportSize - startInset - requiredSize;
  if (adjustedEnd >= MIN_MARGIN) {
    return {
      start: Math.max(MIN_MARGIN, startInset),
      end: adjustedEnd
    };
  }

  const adjustedStart = viewportSize - endInset - requiredSize;
  if (adjustedStart >= MIN_MARGIN) {
    return {
      start: adjustedStart,
      end: Math.max(MIN_MARGIN, endInset)
    };
  }

  const centeredStart = Math.max(MIN_MARGIN, (viewportSize - requiredSize) / 2);
  const calculatedEnd = viewportSize - centeredStart - requiredSize;

  return {
    start: centeredStart,
    end: Math.max(MIN_MARGIN, calculatedEnd)
  };
};

export const usePopoverStack = () => {
  const clampInsetToViewport = useCallback(
    (inset: InsetValue, popoverWidth: number = 400, popoverHeight: number = 600): InsetValue => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      const horizontal = clampAxis(viewportWidth, popoverWidth, inset.left, inset.right);

      const vertical = clampAxis(viewportHeight, popoverHeight, inset.top, inset.bottom);

      return {
        top: vertical.start,
        right: horizontal.end,
        bottom: vertical.end,
        left: horizontal.start
      };
    },
    []
  );

  const getDefaultInset = (): InsetValue => ({
    top: 142,
    right: 1120,
    bottom: 529,
    left: 920
  });

  const calculateStackedInset = (lastInset: InsetValue): InsetValue => ({
    top: lastInset.top + STACK_OFFSET,
    right: lastInset.right + STACK_OFFSET,
    bottom: lastInset.bottom - STACK_OFFSET,
    left: lastInset.left - STACK_OFFSET
  });

  const registerPopover = useCallback(
    (
      baseInset?: InsetValue,
      popoverWidth: number = 400,
      popoverHeight: number = 600
    ): {popoverId: string; inset: InsetValue} => {
      const popoverId = `popover-${++stackState.idCounter}`;
      const currentStack = stackState.stack;

      const initialInset: InsetValue = (() => {
        if (baseInset) {
          return baseInset;
        }
        if (currentStack.length === 0) {
          return getDefaultInset();
        }
        const lastInset = currentStack.at(-1)?.inset;
        if (!lastInset) {
          return getDefaultInset();
        }
        return calculateStackedInset(lastInset);
      })();

      const calculatedInset = clampInsetToViewport(initialInset, popoverWidth, popoverHeight);

      stackState.stack = [...currentStack, {id: popoverId, inset: calculatedInset}];

      return {popoverId, inset: calculatedInset};
    },
    [clampInsetToViewport]
  );

  const unregisterPopover = useCallback((popoverId: string) => {
    stackState.stack = stackState.stack.filter(entry => entry.id !== popoverId);
  }, []);

  const getInset = useCallback((popoverId: string): InsetValue | undefined => {
    const entry = stackState.stack.find(e => e.id === popoverId);
    return entry?.inset;
  }, []);

  const formatInset = useCallback((inset: InsetValue): string => {
    return `${inset.top}px ${inset.right}px ${inset.bottom}px ${inset.left}px`;
  }, []);

  return {
    registerPopover,
    unregisterPopover,
    getInset,
    formatInset,
    stackSize: stackState.stack.length
  };
};

