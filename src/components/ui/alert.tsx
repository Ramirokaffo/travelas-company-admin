import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

const VARIANTS = {
  danger: {
    icon: AlertCircle,
    className: "bg-danger/10 text-danger",
    role: "alert" as const,
  },
  success: {
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
    role: "status" as const,
  },
  // L'orange de la marque sur fond clair passe par `brand-700` : `brand-600`
  // n'atteint pas 4,5:1 sur blanc.
  info: {
    icon: Info,
    className: "bg-brand-500/10 text-brand-700 dark:text-brand-300",
    role: "status" as const,
  },
};

type AlertProps = {
  variant?: keyof typeof VARIANTS;
  children: ReactNode;
  className?: string;
};

/**
 * Message d'état d'un formulaire ou d'une page.
 *
 * Le rôle ARIA suit la gravité : `alert` interrompt le lecteur d'écran pour une
 * erreur, `status` attend une pause pour une confirmation. Rendre les deux en
 * `alert` rendrait chaque succès aussi intrusif qu'une panne.
 */
export function Alert({ variant = "danger", children, className }: AlertProps) {
  const { icon: Icon, className: variantClassName, role } = VARIANTS[variant];

  return (
    <div
      role={role}
      className={cn(
        "flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm",
        variantClassName,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
