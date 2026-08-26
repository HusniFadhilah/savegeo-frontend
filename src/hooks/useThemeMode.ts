import { Chart as ChartJS } from "chart.js";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "savegeo-theme";

function initialTheme(): ThemeMode {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return "light";
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(() => initialTheme());

  useEffect(() => {
    const isDark = theme === "dark";
    const chartText = isDark ? "#cbd5e1" : "#475569";
    const chartGrid = isDark ? "rgba(148, 163, 184, 0.18)" : "rgba(15, 23, 42, 0.08)";

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);

    ChartJS.defaults.color = chartText;
    ChartJS.defaults.borderColor = chartGrid;
    ChartJS.defaults.plugins.legend.labels.color = chartText;
    ChartJS.defaults.scale.ticks.color = chartText;
    ChartJS.defaults.scale.grid.color = chartGrid;

    const instances = (ChartJS as unknown as { instances?: Record<string, { update: (mode?: string) => void }> }).instances;
    Object.values(instances ?? {}).forEach((chart) => chart.update("none"));
  }, [theme]);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme: () => setTheme((value) => (value === "dark" ? "light" : "dark")),
  };
}
