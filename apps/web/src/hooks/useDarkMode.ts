import * as React from "react";

export type Theme = "light" | "dark" | "system";

function getResolved(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function applyTheme(theme: Theme) {
  const resolved = getResolved(theme);
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useDarkMode() {
  const [theme, setThemeState] = React.useState<Theme>(
    () => typeof localStorage !== "undefined" ? ((localStorage.getItem("pref:theme") as Theme | null) ?? "system") : "system",
  );

  React.useEffect(() => {
    applyTheme(theme);

    if (theme !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = (next: Theme) => {
    localStorage.setItem("pref:theme", next);
    setThemeState(next);
  };

  return { theme, setTheme };
}
