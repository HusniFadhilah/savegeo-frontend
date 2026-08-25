import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const STORAGE_KEY = "savegeo-theme";

function initialTheme(): ThemeMode {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(() => initialTheme());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return {
    theme,
    isDark: theme === "dark",
    toggleTheme: () => setTheme((value) => (value === "dark" ? "light" : "dark")),
  };
}

