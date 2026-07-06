import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  DEFAULT_BRUSH_RANGE,
  MIN_BRUSH_SIZE,
  clampBrush,
  clampRatio,
  type BrushRange,
  type DragMode,
} from "../utils/functionLogUtils";

type DragState = {
  mode: DragMode;
  startRatio: number;
  endRatio: number;
  pointerRatio: number;
  anchorRatio: number;
};

const DEFAULT_DRAG_STATE: DragState = {
  mode: null,
  startRatio: 0,
  endRatio: 1,
  pointerRatio: 0,
  anchorRatio: 0,
};

// A brush wider than this is treated as "no active selection" so a fresh
// pointer-down starts a new range instead of panning the full track.
const FULL_RANGE_EPSILON = MIN_BRUSH_SIZE;

// Below this drag width a create gesture is a click, which clears the selection.
const CLICK_THRESHOLD = MIN_BRUSH_SIZE;

export function useFunctionLogChartDrag() {
  const [brushRange, setBrushRange] = useState<BrushRange>(DEFAULT_BRUSH_RANGE);
  const chartTrackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState>(DEFAULT_DRAG_STATE);
  const rafRef = useRef<number | null>(null);
  const latestClientXRef = useRef(0);

  const getRatioFromClientX = useCallback((clientX: number) => {
    if (!chartTrackRef.current) {
      return 0;
    }

    const rect = chartTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) {
      return 0;
    }

    return clampRatio((clientX - rect.left) / rect.width);
  }, []);

  const applyDragMove = useCallback(() => {
    rafRef.current = null;

    const dragState = dragStateRef.current;
    if (!dragState.mode) {
      return;
    }

    const ratio = getRatioFromClientX(latestClientXRef.current);

    if (dragState.mode === "create") {
      const start = Math.min(dragState.anchorRatio, ratio);
      const end = Math.max(dragState.anchorRatio, ratio);
      setBrushRange({startRatio: clampRatio(start), endRatio: clampRatio(end)});
      return;
    }

    if (dragState.mode === "start") {
      setBrushRange(clampBrush(Math.min(ratio, dragState.endRatio - MIN_BRUSH_SIZE), dragState.endRatio));
      return;
    }

    if (dragState.mode === "end") {
      setBrushRange(clampBrush(dragState.startRatio, Math.max(ratio, dragState.startRatio + MIN_BRUSH_SIZE)));
      return;
    }

    const delta = ratio - dragState.pointerRatio;
    const width = dragState.endRatio - dragState.startRatio;
    const startRatio = clampRatio(Math.min(1 - width, Math.max(0, dragState.startRatio + delta)));
    setBrushRange({startRatio, endRatio: startRatio + width});
  }, [getRatioFromClientX]);

  // Throttle pointermove to one update per animation frame to keep dragging smooth.
  const handleDragMove = useCallback(
    (event: PointerEvent) => {
      if (!dragStateRef.current.mode) {
        return;
      }

      latestClientXRef.current = event.clientX;

      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(applyDragMove);
      }
    },
    [applyDragMove]
  );

  const stopDragging = useCallback(() => {
    const dragState = dragStateRef.current;
    if (!dragState.mode) {
      return;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    // A create gesture with no meaningful drag is a click that clears the selection.
    if (dragState.mode === "create") {
      setBrushRange(current =>
        current.endRatio - current.startRatio < CLICK_THRESHOLD ? DEFAULT_BRUSH_RANGE : current
      );
    }

    dragState.mode = null;
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", stopDragging);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [handleDragMove, stopDragging]);

  const beginDragging = useCallback(
    (mode: Exclude<DragMode, null>, clientX: number, range: BrushRange) => {
      const pointerRatio = getRatioFromClientX(clientX);
      dragStateRef.current = {
        mode,
        startRatio: range.startRatio,
        endRatio: range.endRatio,
        pointerRatio,
        anchorRatio: pointerRatio,
      };
      document.body.style.userSelect = "none";
    },
    [getRatioFromClientX]
  );

  const handleChartPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const ratio = getRatioFromClientX(event.clientX);
      const threshold = 0.02;
      const hasSelection = brushRange.endRatio - brushRange.startRatio < 1 - FULL_RANGE_EPSILON;

      if (hasSelection) {
        if (Math.abs(ratio - brushRange.startRatio) <= threshold) {
          beginDragging("start", event.clientX, brushRange);
          return;
        }

        if (Math.abs(ratio - brushRange.endRatio) <= threshold) {
          beginDragging("end", event.clientX, brushRange);
          return;
        }

        if (ratio > brushRange.startRatio && ratio < brushRange.endRatio) {
          beginDragging("range", event.clientX, brushRange);
          return;
        }
      }

      // No active selection (or pointer landed outside it): anchor a fresh range.
      setBrushRange({startRatio: ratio, endRatio: ratio});
      beginDragging("create", event.clientX, {startRatio: ratio, endRatio: ratio});
    },
    [beginDragging, brushRange, getRatioFromClientX]
  );

  return {
    brushRange,
    setBrushRange,
    chartTrackRef,
    handleChartPointerDown,
  };
}
