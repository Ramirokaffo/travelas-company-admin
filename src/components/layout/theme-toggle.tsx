"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";
import type { LucideIcon } from "lucide-react";

import { useTheme } from "@/lib/theme/theme-context";
import { THEMES, isTheme, type Theme } from "@/lib/theme/theme";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<Theme, LucideIcon> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

/**
 * Sélecteur de thème — contrôle segmenté à trois états.
 *
 * Un simple interrupteur clair/sombre ne saurait pas exprimer « suivre le
 * système », qui est justement le réglage par défaut : les trois options sont
 * donc exposées côte à côte.
 *
 * Ce sont de vrais boutons radio, masqués visuellement. Le groupe se comporte
 * alors comme le navigateur l'impose sans une ligne de JavaScript : un seul
 * arrêt de tabulation, navigation aux flèches entre les options, annonce
 * « 2 sur 3 » par les lecteurs d'écran. Des `<button>` porteurs de
 * `role="radio"` auraient l'apparence mais aucun de ces comportements.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  // Un nom de groupe par instance : deux sélecteurs sur la même page ne
  // doivent pas partager leur état.
  const groupName = useId();

  return (
    <fieldset
      className={cn(
        "border-subtle bg-background flex items-center gap-0.5 rounded-lg border p-0.5",
        className,
      )}
    >
      <legend className="sr-only">{t("label")}</legend>

      {THEMES.map((option) => {
        const Icon = ICONS[option];
        const isActive = theme === option;

        return (
          <label
            key={option}
            title={t(option)}
            className={cn(
              "cursor-pointer rounded-md p-1.5 transition-colors",
              // Le bouton radio étant masqué, c'est au libellé de porter
              // l'anneau de focus.
              "has-[:focus-visible]:outline-brand-500 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
              isActive
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted hover:text-foreground",
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={option}
              checked={isActive}
              onChange={(event) => {
                if (isTheme(event.target.value)) setTheme(event.target.value);
              }}
              className="sr-only"
            />
            <Icon className="size-4" aria-hidden />
            <span className="sr-only">{t(option)}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
