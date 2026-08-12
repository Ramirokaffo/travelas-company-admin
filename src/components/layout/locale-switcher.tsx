"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

import { writeLocaleCookie } from "@/i18n/client-locale";
import { LOCALES, LOCALE_LABELS, parseLocale } from "@/i18n/config";
import { cn } from "@/lib/utils/cn";

/**
 * Sélecteur de langue.
 *
 * Les libellés viennent du serveur : changer de langue impose donc un nouveau
 * rendu serveur, pas seulement une mise à jour d'état. D'où le couple
 * « écriture du cookie » puis `router.refresh()`, qui rejoue les Server
 * Components avec le nouveau catalogue sans recharger la page ni perdre la
 * position de défilement.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("locale");
  const locale = useLocale();
  const router = useRouter();
  const selectId = useId();
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string) => {
    writeLocaleCookie(parseLocale(value));
    startTransition(() => router.refresh());
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <label htmlFor={selectId} className="sr-only">
        {t("label")}
      </label>
      <Languages
        className="text-muted pointer-events-none absolute left-2.5 size-4"
        aria-hidden
      />
      <select
        id={selectId}
        value={locale}
        disabled={isPending}
        onChange={(event) => handleChange(event.target.value)}
        className={cn(
          "border-subtle bg-background h-9 appearance-none rounded-lg border py-0 pr-3 pl-8 text-sm",
          "disabled:opacity-60",
        )}
      >
        {LOCALES.map((option) => (
          <option key={option} value={option}>
            {LOCALE_LABELS[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
