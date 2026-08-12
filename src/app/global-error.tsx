"use client";

import { NextIntlClientProvider, useTranslations } from "next-intl";
import { useEffect } from "react";

import { LOCALE_COOKIE, parseLocale, type Locale } from "@/i18n/config";
import en from "@/i18n/messages/en.json";
import fr from "@/i18n/messages/fr.json";
import { THEME_COOKIE, parseTheme, themeClassName } from "@/lib/theme/theme";

import "./globals.css";

const MESSAGES: Record<Locale, typeof fr> = { fr, en };

/** Lit un cookie côté navigateur. Renvoie `undefined` pendant un rendu serveur. */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;

  return document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`))
    ?.split("=")[1];
}

/**
 * Dernier filet : erreur survenue dans le layout racine lui-même.
 *
 * `app/error.tsx` ne peut pas l'attraper puisqu'il est rendu *à l'intérieur* de
 * ce layout. Ce composant remplace donc tout le document et doit fournir ses
 * propres `<html>` et `<body>` — ni barre latérale, ni providers, ni police
 * personnalisée : rien de ce qui vient du layout n'est disponible ici.
 *
 * Conséquence pour l'internationalisation : le `NextIntlClientProvider` du
 * layout racine n'existe pas non plus. La langue et le thème sont donc relus
 * directement dans les cookies — ils sont lisibles par JavaScript, précisément
 * parce que ce ne sont que des préférences d'affichage — et les catalogues sont
 * importés statiquement plutôt que dupliqués en dur dans ce fichier.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const locale = parseLocale(readCookie(LOCALE_COOKIE));
  const theme = parseTheme(readCookie(THEME_COOKIE));

  return (
    // Les cookies sont invisibles au rendu serveur de cette page : le premier
    // rendu client peut donc différer légitimement du HTML reçu.
    <html lang={locale} className={themeClassName(theme)} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
          <GlobalErrorContent error={error} reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

function GlobalErrorContent({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <h1 className="text-xl font-semibold">{t("rootTitle")}</h1>
      <p className="text-muted max-w-md text-sm">{t("rootDescription")}</p>
      {error.digest ? (
        <code className="bg-subtle rounded px-2 py-1 font-mono text-xs">
          {error.digest}
        </code>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="bg-brand-500 hover:bg-brand-600 text-secondary-900 h-10 rounded-lg px-4 text-sm font-medium"
      >
        {t("reload")}
      </button>
    </>
  );
}
