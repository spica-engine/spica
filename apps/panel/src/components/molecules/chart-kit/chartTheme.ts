import {useEffect, useState} from "react";
import type {ChartOptions} from "chart.js";

// Categorical palette chosen for adequate contrast on BOTH the light (#fff) and
// dark (~#1b2130) kit surfaces and for hue separation that survives the common
// colorblind types (deuteranopia/protanopia). Ordered to maximise adjacent-hue
// distance so neighbouring chart segments never collide.
export const CATEGORICAL_PALETTE = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#ef4444"
] as const;

export type ChartTheme = {
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  gridColor: string;
  accent: string;
  danger: string;
  success: string;
  surface: string;
  track: string;
  categorical: readonly string[];
};

const readVar = (styles: CSSStyleDeclaration, name: string, fallback: string) => {
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
};

// The ui-kit's createTheme() writes semantic tokens (--color-text-primary,
// --color-surface, --color-accent …) onto <html> and flips data-theme="dark".
// Reading the resolved values keeps chart.js datasets in lock-step with whatever
// theme the user toggled, instead of hardcoding a single palette.
function readChartTheme(): ChartTheme {
  if (typeof document === "undefined") {
    return {
      isDark: false,
      textColor: "#525252",
      mutedColor: "#727272",
      gridColor: "rgba(0,0,0,0.06)",
      accent: "#3b82f6",
      danger: "#ef4444",
      success: "#10b981",
      surface: "#ffffff",
      track: "rgba(0,0,0,0.08)",
      categorical: CATEGORICAL_PALETTE
    };
  }

  const root = document.documentElement;
  const isDark = root.getAttribute("data-theme") === "dark";
  const styles = getComputedStyle(root);

  return {
    isDark,
    textColor: readVar(styles, "--color-text-primary", isDark ? "#e6e6e6" : "#525252"),
    mutedColor: readVar(styles, "--color-text-muted", isDark ? "#9aa4b2" : "#727272"),
    gridColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
    accent: readVar(styles, "--color-accent", "#3b82f6"),
    danger: readVar(styles, "--color-red", "#ef4444"),
    success: readVar(styles, "--color-green", "#10b981"),
    surface: readVar(styles, "--color-surface", isDark ? "#1b2130" : "#ffffff"),
    track: isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
    categorical: CATEGORICAL_PALETTE
  };
}

// A shallow signature over the fields that actually drive chart.js styling. Used
// to skip no-op state commits so the returned `theme` object keeps a stable
// identity — otherwise every observer tick would hand back a fresh object and
// force each chart's `data`/`options` memo to rebuild, remounting chart.js and
// producing the visible dashboard flicker.
const themeSignature = (theme: ChartTheme) =>
  `${theme.isDark}|${theme.textColor}|${theme.mutedColor}|${theme.accent}|${theme.surface}|${theme.track}`;

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readChartTheme);

  useEffect(() => {
    // Only the `data-theme` flip changes colors; the initial value is already
    // captured by the lazy useState initializer, so we do NOT re-read on mount.
    const observer = new MutationObserver(() => {
      setTheme(prev => {
        const next = readChartTheme();
        return themeSignature(prev) === themeSignature(next) ? prev : next;
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });
    return () => observer.disconnect();
  }, []);

  return theme;
}

export const formatBytes = (bytes: number): string => {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
};

export const formatCount = (input: number): string => {
  const n = input ?? 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
};

// Shared axis/legend/tooltip styling so every panel reads correctly in either
// theme without each chart re-deriving the same option tree.
export const buildAxisOptions = (theme: ChartTheme): ChartOptions<"bar" | "line"> => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: {mode: "index", intersect: false},
  plugins: {
    legend: {
      display: true,
      labels: {color: theme.textColor, boxWidth: 12, boxHeight: 12, usePointStyle: true}
    },
    tooltip: {
      backgroundColor: theme.isDark ? "rgba(17,22,33,0.95)" : "rgba(33,33,33,0.95)",
      titleColor: "#ffffff",
      bodyColor: "#ffffff",
      padding: 8,
      cornerRadius: 6
    }
  },
  scales: {
    x: {
      grid: {display: false},
      ticks: {color: theme.mutedColor, font: {size: 11}, maxRotation: 45}
    },
    y: {
      beginAtZero: true,
      grid: {color: theme.gridColor},
      ticks: {color: theme.mutedColor, font: {size: 11}, precision: 0}
    }
  }
});
