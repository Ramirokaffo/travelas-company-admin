import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

/**
 * Exporté pour les liens : un `<Link>` qui déclenche une navigation doit rester
 * une ancre — lui donner l'apparence d'un bouton ne doit pas le transformer en
 * `<button>`, qui perdrait le clic milieu et le menu contextuel.
 */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // L'orange de la marque (`brand-500`) est trop clair pour porter du
        // texte blanc : 2,5:1, très en dessous du seuil AA de 4,5:1. Il est
        // donc associé au bleu nuit Travelas (6,9:1), ce qui conserve la
        // teinte exacte de la charte tout en restant lisible.
        primary: "bg-brand-500 text-secondary-900 hover:bg-brand-600",
        secondary: "border border-subtle bg-surface text-foreground hover:bg-brand-50",
        ghost: "text-muted hover:bg-subtle hover:text-foreground",
        danger: "bg-danger text-white hover:opacity-90",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-6",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
  );
}
