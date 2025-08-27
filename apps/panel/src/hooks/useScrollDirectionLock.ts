import {useCallback, useEffect, useRef} from "react";

type ScrollDirection = "horizontal" | "vertical" | null;

type ScrollDirectionLockOptions = {
  directionThreshold?: number;
  resetDelay?: number;
};

function useScrollDirectionLock(options: ScrollDirectionLockOptions = {}) {
  const {directionThreshold = 2.0, resetDelay = 250} = options;

  const directionRef = useRef<ScrollDirection>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollTimeRef = useRef<number>(0);
  const elementRef = useRef<HTMLElement | null>(null);

  const isScrollable = useCallback((el: HTMLElement, axis: "x" | "y"): boolean => {
    const style = getComputedStyle(el);
    const canScrollX =
      (style.overflowX === "auto" || style.overflowX === "scroll") &&
      el.scrollWidth > el.clientWidth + 10;
    const canScrollY =
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight + 10;

    return axis === "x" ? canScrollX : canScrollY;
  }, []);

  const resetDirectionLock = useCallback(() => {
    const el = elementRef.current;
    if (!el) return;

    const atEndX = el.scrollLeft + el.clientWidth >= el.scrollWidth;
    const atEndY = el.scrollTop + el.clientHeight >= el.scrollHeight;

    directionRef.current = null;
    el.style.overflowX = "auto";
    el.style.overflowY = "auto";

    requestAnimationFrame(() => {
      if (atEndX) {
        el.scrollLeft = el.scrollWidth;
      }
      if (atEndY) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const el = elementRef.current;
      if (!el) return;

      const now = Date.now();
      const deltaX = Math.abs(e.deltaX);
      const deltaY = Math.abs(e.deltaY);

      const isHorizontal = deltaX > deltaY * directionThreshold;
      const isVertical = deltaY > deltaX * directionThreshold;

      // Reset lock if opposite scroll is detected
      if (directionRef.current === "horizontal" && isVertical) {
        resetDirectionLock();
      } else if (directionRef.current === "vertical" && isHorizontal) {
        resetDirectionLock();
      }

      if (!directionRef.current) {
        if (isHorizontal && isScrollable(el, "x")) {
          directionRef.current = "horizontal";
          el.style.overflowY = "hidden";
        } else if (isVertical && isScrollable(el, "y")) {
          directionRef.current = "vertical";
          el.style.overflowX = "hidden";
        } else {
          e.preventDefault(); // Block diagonal scroll
          return;
        }
      } else {
        // Lock opposing direction
        if (directionRef.current === "horizontal" && deltaY > 0) {
          e.preventDefault();
        } else if (directionRef.current === "vertical" && deltaX > 0) {
          e.preventDefault();
        }
      }

      lastScrollTimeRef.current = now;

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (Date.now() - lastScrollTimeRef.current >= resetDelay) {
          resetDirectionLock();
        }
      }, resetDelay);
    },
    [directionThreshold, resetDelay, isScrollable, resetDirectionLock]
  );

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    el.addEventListener("wheel", handleWheel, {passive: false});

    return () => {
      el.removeEventListener("wheel", handleWheel);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleWheel]);

  return elementRef;
}

export default useScrollDirectionLock;
