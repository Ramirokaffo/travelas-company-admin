"use client";

import { RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ErrorPanelProps = {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
};

/**
 * Panneau partagé par les frontières d'erreur (`error.tsx`).
 *
 * `error.message` n'est jamais affiché : sur un rendu serveur, il peut contenir
 * un message du backend, un chemin de fichier ou un extrait de requête SQL. Next
 * remplace d'ailleurs le message par un `digest` en production — c'est ce
 * `digest` que le support demande pour retrouver la trace côté serveur.
 */
export function ErrorPanel({ error, reset, title, description }: ErrorPanelProps) {
  const t = useTranslations("errors");
  const tCommon = useTranslations("common");

  useEffect(() => {
    // TODO(observabilité) : brancher Sentry — sans corps de requête ni cookies
    // (voir la checklist du §8 de PLAN.md).
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="border-subtle bg-surface flex flex-col items-center gap-4 rounded-2xl border border-dashed p-10 text-center"
    >
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">{title ?? t("boundaryTitle")}</h2>
        <p className="text-muted mx-auto max-w-md text-sm">
          {description ?? t("boundaryDescription")}
        </p>
      </div>

      {error.digest ? (
        <code className="bg-subtle rounded px-2 py-1 font-mono text-xs">
          {error.digest}
        </code>
      ) : null}

      <Button variant="secondary" onClick={reset}>
        <RotateCw className="size-4" aria-hidden />
        {tCommon("retry")}
      </Button>
    </div>
  );
}
