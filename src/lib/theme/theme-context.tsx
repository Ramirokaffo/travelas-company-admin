"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_THEME,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  themeClassName,
  type Theme,
} from "@/lib/theme/theme";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applique le thème au document.
 *
 * `<html>` ne porte une classe que pour un choix explicite : « Système » n'en
 * pose aucune, ce qui rend la main à `prefers-color-scheme` — la logique est la
 * même côté serveur (`themeClassName`) et côté CSS (`globals.css`).
 */
function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");

  const className = themeClassName(theme);
  if (className) root.classList.add(className);
}

/**
 * Le cookie est écrit depuis le navigateur, sans aller-retour serveur : la
 * bascule est instantanée. `SameSite=Lax` suffit — il ne s'agit que d'une
 * préférence d'affichage, jamais d'un jeton (voir `lib/theme/theme.ts`).
 */
function persistTheme(theme: Theme): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

export function ThemeProvider({
  initialTheme = DEFAULT_THEME,
  children,
}: {
  initialTheme?: Theme;
  children: ReactNode;
}) {
  // Valeur initiale fournie par le serveur d'après le cookie : le premier rendu
  // client est identique au HTML reçu, donc pas de divergence d'hydratation.
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyTheme(next);
    persistTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme doit être utilisé à l'intérieur de <ThemeProvider>.");
  }
  return context;
}
