"use client";

import { Check, Circle } from "lucide-react";
import { useTranslations } from "next-intl";

import { PASSWORD_RULES } from "@/features/auth/schemas";
import { cn } from "@/lib/utils/cn";

/**
 * Liste de contrôle des règles de mot de passe, cochée à la frappe.
 *
 * Elle remplace l'énumération des contraintes dans un message d'erreur découvert
 * à la validation : l'utilisateur voit ce qu'il lui reste à faire pendant qu'il
 * tape. Les règles viennent de `PASSWORD_RULES`, qui double `strongPasswordSchema` —
 * la validation, elle, reste celle du schéma, côté client et côté serveur.
 *
 * `aria-live="polite"` fait annoncer la progression sans interrompre la saisie.
 */
export function PasswordChecklist({ value }: { value: string }) {
  const t = useTranslations("auth.register.passwordRules");

  return (
    <ul className="grid gap-1 sm:grid-cols-2" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const satisfied = rule.test(value);

        return (
          <li
            key={rule.key}
            className={cn(
              "flex items-center gap-1.5 text-xs",
              satisfied ? "text-success" : "text-muted",
            )}
          >
            {satisfied ? (
              <Check className="size-3.5 shrink-0" aria-hidden />
            ) : (
              <Circle className="size-3.5 shrink-0" aria-hidden />
            )}
            <span>{t(rule.key)}</span>
          </li>
        );
      })}
    </ul>
  );
}
