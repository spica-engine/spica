import {useEffect, useRef} from "react";

const controllerIndex = 0
function useSyncedScroll(elementCount: number) {
  const elementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const syncingRef = useRef(false);

  useEffect(() => {
    const els = elementsRef.current;
    const controller = els[controllerIndex];
    if (!controller) return;

    const forwardWheel = (e: WheelEvent) => {
      e.preventDefault();
      controller.scrollTop += e.deltaY;
    };

    const handleControllerScroll = () => {
      if (syncingRef.current) return;
      syncingRef.current = true;

      const scrollTop = controller.scrollTop;
      els.forEach((el, i) => {
        if (i !== controllerIndex && el) {
          el.scrollTop = scrollTop;
        }
      });

      syncingRef.current = false;
    };

    els.forEach((el, i) => {
      if (!el) return;
      if (i === controllerIndex) {
        el.addEventListener("scroll", handleControllerScroll);
      } else {
        el.addEventListener("wheel", forwardWheel, {passive: false});
      }
    });

    return () => {
      els.forEach((el, i) => {
        if (!el) return;
        if (i === controllerIndex) {
          el.removeEventListener("scroll", handleControllerScroll);
        } else {
          el.removeEventListener("wheel", forwardWheel);
        }
      });
    };
  }, [elementCount, controllerIndex]);

  const setRef = (el: HTMLDivElement | null, index: number) => {
    elementsRef.current[index] = el;
  };

  return setRef;
}

export default useSyncedScroll;
