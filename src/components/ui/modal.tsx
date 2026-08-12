"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Zone d'actions en pied de fenêtre. */
  footer?: ReactNode;
  /** Empêche la fermeture par Échap ou par clic sur le fond (opération en cours). */
  dismissible?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

/**
 * Fenêtre modale bâtie sur `<dialog>` natif.
 *
 * `showModal()` fournit gratuitement ce qu'une div maison doit réimplémenter et
 * rate souvent : piège de focus, restitution du focus à la fermeture, fond
 * inerte, fermeture par Échap, et le calque supérieur (`::backdrop`) qui
 * s'affranchit des `z-index` de la page. Aucune dépendance ajoutée au bundle.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = "md",
}: ModalProps) {
  const t = useTranslations("common");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    // Échap et `dialog.close()` passent tous les deux par cet évènement : c'est
    // le seul point où l'état du parent peut être resynchronisé.
    const handleClose = () => onClose();
    const handleCancel = (event: Event) => {
      if (!dismissible) event.preventDefault();
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [onClose, dismissible]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Le clic sur le fond atteint l'élément `<dialog>` lui-même : on ne ferme
      // que dans ce cas, jamais sur un clic à l'intérieur du panneau.
      onClick={(event) => {
        if (dismissible && event.target === dialogRef.current)
          dialogRef.current?.close();
      }}
      className={cn(
        "bg-surface text-foreground m-auto w-[calc(100%-2rem)] rounded-2xl p-0 shadow-xl",
        "backdrop:bg-black/50",
        SIZES[size],
      )}
    >
      <div className="border-subtle flex items-start justify-between gap-4 border-b px-5 py-4">
        <div className="min-w-0 space-y-1">
          <h2 id={titleId} className="text-sm font-semibold">
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="text-muted text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {dismissible ? (
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t("close")}
            className="text-muted hover:text-foreground shrink-0 rounded-lg p-1 transition-colors"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {children ? <div className="px-5 py-4">{children}</div> : null}

      {footer ? (
        <div className="border-subtle flex items-center justify-end gap-2 border-t px-5 py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
