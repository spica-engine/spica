import {useCallback, useEffect, useRef} from "react";

type ScrollDirectionLockOptions = {
  directionThreshold?: number;
  resetDelay?: number;
};

function useScrollDirectionLock(options: ScrollDirectionLockOptions = {}) {
  const {directionThreshold = 2.0, resetDelay = 100} = options;

  const scrollDirection = useRef<"horizontal" | "vertical">(null);
  const scrollTimeout = useRef<NodeJS.Timeout>(null);
  const elementRef = useRef<HTMLElement>(null);

  const isScrollable = useCallback((element: HTMLElement, axis: "x" | "y") => {
    if (!(element instanceof HTMLElement)) return false;

    const style = window.getComputedStyle(element);
    const overflowX = style.overflowX;
    const overflowY = style.overflowY;

    const canScrollX =
      (overflowX === "auto" || overflowX === "scroll") && element.scrollWidth > element.clientWidth + 10;

    const canScrollY =
      (overflowY === "auto" || overflowY === "scroll") &&
      element.scrollHeight > element.clientHeight + 10;

    if (axis === "x") return canScrollX;
    if (axis === "y") return canScrollY;
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const deltaX = Math.abs(e.deltaX);
      const deltaY = Math.abs(e.deltaY);

      if (!scrollDirection.current) {
        if (deltaX > deltaY * directionThreshold) {
          // Check if horizontal scrolling is actually possible
          if (elementRef.current && isScrollable(elementRef.current, "x")) {
            scrollDirection.current = "horizontal";
            elementRef.current.style.overflowY = "hidden";
          }
        } else if (deltaY > deltaX * directionThreshold) {
          // Check if vertical scrolling is actually possible
          if (elementRef.current && isScrollable(elementRef.current, "y")) {
            scrollDirection.current = "vertical";
            elementRef.current.style.overflowX = "hidden";
          }
        } else {
          // Block diagonal scrolling only if neither axis is clearly dominant
          e.preventDefault();
          return;
        }
      } else {
        // Direction is locked - prevent opposite axis
        if (scrollDirection.current === "horizontal" && deltaY > 0) {
          e.preventDefault();
        } else if (scrollDirection.current === "vertical" && deltaX > 0) {
          e.preventDefault();
        }
      }

      // Reset after scroll stops
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        scrollDirection.current = null;
        if (elementRef.current) {
          elementRef.current.style.overflowX = "auto";
          elementRef.current.style.overflowY = "auto";
        }
      }, resetDelay);
    },
    [directionThreshold, resetDelay, isScrollable]
  );

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener("wheel", handleWheel, {passive: false});

    return () => {
      element.removeEventListener("wheel", handleWheel);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, [handleWheel]);

  return elementRef;
}

export default useScrollDirectionLock;
