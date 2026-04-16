import {useCallback, useState} from "react";

export function useCopyToClipboard(resetDelay = 1000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    (text: string) => {
      if (!text) return;
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), resetDelay);
        })
        .catch(err => {
          console.error("Failed to copy:", err);
        });
    },
    [resetDelay]
  );

  return {copied, copy};
}
