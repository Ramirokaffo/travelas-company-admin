"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

/**
 * Frontière d'erreur globale.
 *
 * On n'affiche jamais `error.message` : il peut contenir des détails
 * techniques du backend. Seul le `digest` (identifiant corrélable dans les
 * logs serveur) est montré, pour le support.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");
  const tCommon = useTranslations("common");

  useEffect(() => {
    // TODO(observabilité) : brancher un collecteur (Sentry) — voir PLAN.md.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">{t("globalTitle")}</h1>
      <p className="text-muted max-w-md text-sm">{t("globalDescription")}</p>
      {error.digest ? (
        <code className="bg-subtle rounded px-2 py-1 font-mono text-xs">
          {error.digest}
        </code>
      ) : null}
      <Button onClick={reset}>{tCommon("retry")}</Button>
    </div>
  );
}
