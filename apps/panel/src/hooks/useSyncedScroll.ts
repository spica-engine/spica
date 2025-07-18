import {useEffect, useRef} from "react";

function useSyncedScroll(elementCount: number) {
  const elementsRef = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const syncingRef = useRef(false);

  useEffect(() => {
    const els = elementsRef.current;
    const keys = Array.from(els.keys());

    const controllerKey = keys[0];
    if (!controllerKey) return;

    const controller = els.get(controllerKey);
    if (!controller) return;

    const forwardWheel = (e: WheelEvent) => {
      e.preventDefault();
      controller.scrollTop += e.deltaY;
    };

    const handleControllerScroll = () => {
      if (syncingRef.current) return;
      syncingRef.current = true;

      const scrollTop = controller.scrollTop;
      keys.forEach(key => {
        if (key !== controllerKey) {
          const el = els.get(key);
          if (el && el.scrollTop !== scrollTop) {
            el.scrollTop = scrollTop;
          }
        }
      });

      syncingRef.current = false;
    };

    keys.forEach((key, i) => {
      const el = els.get(key);
      if (!el) return;
      if (key === controllerKey) {
        el.addEventListener("scroll", handleControllerScroll);
      } else {
        el.addEventListener("wheel", forwardWheel, {passive: false});
      }
    });

    return () => {
      keys.forEach(key => {
        const el = els.get(key);
        if (!el) return;
        if (key === controllerKey) {
          el.removeEventListener("scroll", handleControllerScroll);
        } else {
          el.removeEventListener("wheel", forwardWheel);
        }
      });
    };
  }, [elementCount]);

  const setRef = (el: HTMLDivElement | null, identifier: string) => {
    elementsRef.current.set(identifier, el);
  };

  return setRef;
}

export default useSyncedScroll;
