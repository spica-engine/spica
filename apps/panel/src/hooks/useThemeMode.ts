import {useEffect, useState} from "react";

export type ThemeMode = "light" | "dark";

const readThemeMode = (): ThemeMode =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";

// Mirrors the panel's active theme so canvas-style widgets (React Flow, charts)
// can follow the same light/dark toggle the rest of the UI uses.
export const useThemeMode = (): ThemeMode => {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode);

  useEffect(() => {
    const observer = new MutationObserver(() => setMode(readThemeMode()));
    observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
    return () => observer.disconnect();
  }, []);

  return mode;
};
