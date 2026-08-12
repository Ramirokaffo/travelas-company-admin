"use client";

import { ErrorPanel } from "@/components/layout/error-panel";

/**
 * Frontière d'erreur des pages protégées.
 *
 * Placée sous `(dashboard)/layout.tsx`, elle laisse la barre latérale et la
 * barre supérieure en place : l'utilisateur peut naviguer ailleurs au lieu de
 * se retrouver sur un écran vide.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel error={error} reset={reset} />;
}
