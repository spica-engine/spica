import {useState, useCallback} from "react";

type InsetValue = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type PopoverStackEntry = {
  id: string;
  inset: InsetValue;
};

const STACK_OFFSET = 20; // Offset between stacked popovers in pixels

// Module-level singleton for the stack to share across all popover instances
const stackState: {
  stack: PopoverStackEntry[];
  idCounter: number;
} = {
  stack: [],
  idCounter: 0
};

/**
 * Hook to manage a stack of popovers with calculated inset values
 * Creates a nested frame effect where each popover is offset from the previous one
 * Uses a module-level singleton to share stack state across all popover instances
 */
export const usePopoverStack = () => {
  const [, forceUpdate] = useState({});

  /**
   * Register a new popover and get its calculated inset
   * @param baseInset - Optional base inset to start from (for first popover)
   * @returns Object with popoverId and calculated inset
   */
  const registerPopover = useCallback((baseInset?: InsetValue): {popoverId: string; inset: InsetValue} => {
    const popoverId = `popover-${++stackState.idCounter}`;
    const currentStack = stackState.stack;

    let calculatedInset: InsetValue;
    if (currentStack.length === 0) {
      // First popover - use base inset or default
      calculatedInset =
        baseInset ||
        ({
          top: 142,
          right: 1120,
          bottom: 529,
          left: 920
        } as InsetValue);
    } else {
      // Calculate inset based on the last popover in stack
      const lastInset = currentStack[currentStack.length - 1].inset;
      calculatedInset = {
        top: lastInset.top + STACK_OFFSET,
        right: lastInset.right - STACK_OFFSET,
        bottom: lastInset.bottom - STACK_OFFSET,
        left: lastInset.left + STACK_OFFSET
      };
    }

    stackState.stack = [...currentStack, {id: popoverId, inset: calculatedInset}];
    forceUpdate({}); // Trigger re-render for any components using the stack

    return {popoverId, inset: calculatedInset};
  }, []);

  /**
   * Unregister a popover from the stack
   * @param popoverId - The ID of the popover to remove
   */
  const unregisterPopover = useCallback((popoverId: string) => {
    stackState.stack = stackState.stack.filter(entry => entry.id !== popoverId);
    forceUpdate({}); // Trigger re-render for any components using the stack
  }, []);

  /**
   * Get the current inset for a registered popover
   * @param popoverId - The ID of the popover
   * @returns The inset value or undefined if not found
   */
  const getInset = useCallback((popoverId: string): InsetValue | undefined => {
    const entry = stackState.stack.find(e => e.id === popoverId);
    return entry?.inset;
  }, []);

  /**
   * Format inset value as CSS string
   * @param inset - The inset value
   * @returns CSS inset string like "142px 1120px 529px 920px"
   */
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

