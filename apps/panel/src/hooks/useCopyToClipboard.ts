import {useCallback, useEffect, useRef, useState} from "react";

export function useCopyToClipboard(resetDelay = 1000) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copy = useCallback(
    (text: string) => {
      if (!text) return;
      navigator.clipboard
        .writeText(text)
        .then(() => {
          if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
          }
          setCopied(true);
          timeoutRef.current = setTimeout(() => {
            setCopied(false);
            timeoutRef.current = null;
          }, resetDelay);
        })
        .catch(err => {
          console.error("Failed to copy:", err);
        });
    },
    [resetDelay]
  );

  return {copied, copy};
}
