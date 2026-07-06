import {useEffect, useState} from "react";

export type DiagramColorMode = "light" | "dark";

// The panel flips data-theme on <html> and mirrors it in localStorage; React Flow's
// colorMode must follow the same source so the diagram reads in both themes.
const readColorMode = (): DiagramColorMode => {
  if (typeof document === "undefined") return "light";
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return localStorage.getItem("themeMode") === "dark" ? "dark" : "light";
};

export const useDiagramColorMode = (): DiagramColorMode => {
  const [mode, setMode] = useState<DiagramColorMode>(readColorMode);

  useEffect(() => {
    const update = () => setMode(readColorMode());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    return () => observer.disconnect();
  }, []);

  return mode;
};
