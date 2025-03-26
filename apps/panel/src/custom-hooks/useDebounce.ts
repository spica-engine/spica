import { useCallback, useEffect, useRef } from "react";

interface UseDebounceOptions {
  delay?: number;
  dependencies?: unknown[];
}

export const useDebounce = <T extends (...args: unknown[]) => unknown>(
  callback: T,
  { delay = 0, dependencies = [] }: UseDebounceOptions = {}
) => {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay, ...dependencies]
  );
};
