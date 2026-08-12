import { Star } from "lucide-react";

import { cn } from "@/lib/utils/cn";

/**
 * Note sur cinq étoiles.
 *
 * Les étoiles sont `aria-hidden` : un lecteur d'écran annonce le libellé
 * textuel (« 4,5 sur 5 »), pas cinq icônes. Les demi-notes sont rendues par un
 * recouvrement de largeur proportionnelle plutôt que par une icône « demi-
 * étoile » — un `4,3` reste alors visuellement exact.
 */
export function Rating({
  value,
  label,
  className,
}: {
  value: number;
  /** Formulation accessible complète, déjà traduite par l'appelant. */
  label: string;
  className?: string;
}) {
  const ratio = Math.min(Math.max(value, 0), 5) / 5;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={label}>
      <span className="relative inline-flex" aria-hidden>
        <span className="text-subtle flex">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className="size-4 fill-current" />
          ))}
        </span>
        <span
          className="text-warning absolute inset-0 flex overflow-hidden"
          style={{ width: `${ratio * 100}%` }}
        >
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className="size-4 shrink-0 fill-current" />
          ))}
        </span>
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
