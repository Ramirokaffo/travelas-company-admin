import { Check } from "lucide-react";

import { cn } from "@/lib/utils/cn";

export type StepperStep = {
  key: string;
  label: string;
};

type StepperProps = {
  steps: StepperStep[];
  /** Index de l'étape en cours (0-indexé). */
  current: number;
  /** Nom du parcours, pour les lecteurs d'écran. */
  label: string;
  /** Position annoncée textuellement, ex. « Étape 2 sur 3 ». */
  positionLabel: string;
  className?: string;
};

/**
 * Fil d'Ariane d'un parcours en plusieurs étapes.
 *
 * Rendu en Server Component : la progression est une donnée, pas un état
 * client. Sémantiquement une liste ordonnée — un lecteur d'écran annonce donc
 * « 2 sur 3 » sans qu'on ait à le simuler, et `aria-current="step"` désigne
 * l'étape en cours. Les puces cochées portent `aria-hidden` : leur sens est
 * déjà donné par le texte de position.
 */
export function Stepper({
  steps,
  current,
  label,
  positionLabel,
  className,
}: StepperProps) {
  return (
    <nav aria-label={label} className={className}>
      <p className="sr-only">{positionLabel}</p>

      <ol className="flex items-center">
        {steps.map((step, index) => {
          const isDone = index < current;
          const isCurrent = index === current;

          return (
            <li
              key={step.key}
              className={cn("flex items-center", index > 0 && "min-w-0 flex-1")}
            >
              {index > 0 ? (
                <span
                  aria-hidden
                  className={cn(
                    "mx-2 h-px flex-1 transition-colors",
                    isDone || isCurrent ? "bg-brand-500" : "bg-subtle",
                  )}
                />
              ) : null}

              <span
                className="flex min-w-0 items-center gap-2"
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                    isDone && "bg-brand-500 border-brand-500 text-secondary-900",
                    // Sur fond sombre, `brand-50` serait une pastille blanche :
                    // on passe par une teinte transparente de l'orange.
                    isCurrent &&
                      "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300",
                    !isDone && !isCurrent && "border-subtle text-muted",
                  )}
                >
                  {isDone ? <Check className="size-4" /> : index + 1}
                </span>

                <span
                  className={cn(
                    "truncate text-xs font-medium",
                    isCurrent ? "text-foreground" : "text-muted",
                    // Sous `sm`, seule l'étape en cours garde son libellé :
                    // trois textes côte à côte y deviendraient illisibles.
                    !isCurrent && "hidden sm:inline",
                  )}
                >
                  {step.label}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
