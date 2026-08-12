import type { SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Liste déroulante native.
 *
 * Choix assumé du `<select>` natif plutôt qu'un composant sur mesure : clavier,
 * lecteurs d'écran et sélecteur natif mobile fonctionnent sans code, et aucune
 * dépendance supplémentaire n'entre dans le bundle. Un composant riche
 * (recherche, multi-sélection) ne sera introduit qu'au besoin réel.
 */
export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "border-subtle bg-surface h-10 w-full rounded-lg border px-3 text-sm",
        "disabled:opacity-50",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "border-subtle bg-surface min-h-24 w-full rounded-lg border px-3 py-2 text-sm",
        "placeholder:text-muted disabled:opacity-50",
        "aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
    />
  );
}
