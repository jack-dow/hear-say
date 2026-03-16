import * as React from "react";
import { Monitor, Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useDarkMode, type Theme } from "@/hooks/useDarkMode";

const CYCLE: Theme[] = ["system", "light", "dark"];

const ICONS: Record<Theme, React.ReactNode> = {
  system: <Monitor weight="thin" />,
  light: <Sun weight="thin" />,
  dark: <Moon weight="thin" />,
};

const LABELS: Record<Theme, string> = {
  system: "System theme",
  light: "Light mode",
  dark: "Dark mode",
};

export function ThemeToggle() {
  const { theme, setTheme } = useDarkMode();

  const next = () => {
    const idx = CYCLE.indexOf(theme);
    setTheme(CYCLE[(idx + 1) % CYCLE.length]);
  };

  return (
    <Button
      aria-label={LABELS[theme]}
      size="icon-sm"
      variant="ghost"
      onClick={next}
    >
      {ICONS[theme]}
    </Button>
  );
}
