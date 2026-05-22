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
};

const DEFAULT_DRAG_STATE: DragState = {
  mode: null,
  startRatio: 0,
  endRatio: 1,
  pointerRatio: 0,
};

export function useFunctionLogChartDrag() {
  const [brushRange, setBrushRange] = useState<BrushRange>(DEFAULT_BRUSH_RANGE);
  const chartTrackRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState>(DEFAULT_DRAG_STATE);

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

  const handleDragMove = useCallback(
    (event: PointerEvent) => {
      const dragState = dragStateRef.current;
      if (!dragState.mode) {
        return;
      }

      const ratio = getRatioFromClientX(event.clientX);

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
    },
    [getRatioFromClientX]
  );

  const stopDragging = useCallback(() => {
    if (!dragStateRef.current.mode) {
      return;
    }

    dragStateRef.current.mode = null;
    document.body.style.userSelect = "";
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", handleDragMove);
    window.addEventListener("pointerup", stopDragging);

    return () => {
      window.removeEventListener("pointermove", handleDragMove);
      window.removeEventListener("pointerup", stopDragging);
    };
  }, [handleDragMove, stopDragging]);

  const beginDragging = useCallback(
    (mode: Exclude<DragMode, null>, clientX: number, range: BrushRange) => {
      dragStateRef.current = {
        mode,
        startRatio: range.startRatio,
        endRatio: range.endRatio,
        pointerRatio: getRatioFromClientX(clientX),
      };
      document.body.style.userSelect = "none";
    },
    [getRatioFromClientX]
  );

  const handleChartPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const ratio = getRatioFromClientX(event.clientX);
      const threshold = 0.02;

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

      const nextRange = clampBrush(ratio, Math.min(1, ratio + 0.16));
      setBrushRange(nextRange);
      beginDragging("end", event.clientX, nextRange);
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