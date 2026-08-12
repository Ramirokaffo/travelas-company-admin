import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  /** Action de sortie : « Créer une agence », « Réinitialiser les filtres »… */
  action?: ReactNode;
  className?: string;
};

/**
 * État vide.
 *
 * Distinguer « aucune donnée » de « aucun résultat pour ce filtre » : le premier
 * appelle une création, le second une réinitialisation. C'est à l'appelant de
 * fournir le bon `title` et la bonne `action`.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn("flex flex-col items-center gap-3 py-10 text-center", className)}
    >
      {Icon ? (
        <span className="bg-subtle text-muted rounded-full p-3">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted mx-auto max-w-sm text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
