"use client";

import { useTranslations } from "next-intl";

import { ErrorPanel } from "@/components/layout/error-panel";

/** Frontière d'erreur des pages sans session (connexion, inscription). */
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  return (
    <ErrorPanel
      error={error}
      reset={reset}
      title={t("publicTitle")}
      description={t("publicDescription")}
    />
  );
}
