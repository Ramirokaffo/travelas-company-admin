"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger";
  /**
   * Message affiché si `onConfirm` lève. Par défaut, l'échec générique — à
   * préciser quand l'appelant sait dire quelque chose d'utile de plus.
   */
  errorMessage?: string;
  /** Action à confirmer. Peut être asynchrone (Server Action). */
  onConfirm: () => void | Promise<void>;
};

/**
 * Confirmation d'une action sensible (suppression d'agence, retrait d'un
 * collaborateur…).
 *
 * Deux garde-fous pendant l'exécution : la fenêtre devient non fermable, et le
 * bouton est désactivé. Sans cela, un double clic sur « Supprimer » envoie deux
 * mutations. La fenêtre ne se referme qu'en cas de succès — une erreur reste
 * affichée là où l'utilisateur regarde, plutôt que dans une notification
 * fugitive.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  variant = "primary",
  errorMessage,
  onConfirm,
}: ConfirmDialogProps) {
  const t = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isPending) return;
    setError(null);
    onOpenChange(false);
  };

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      try {
        await onConfirm();
        onOpenChange(false);
      } catch {
        // Le détail technique reste côté serveur : on n'affiche jamais le
        // message brut d'une erreur backend dans l'interface.
        setError(errorMessage ?? tErrors("operationFailed"));
      }
    });
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      description={description}
      dismissible={!isPending}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isPending}>
            {cancelLabel ?? t("cancel")}
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? t("working") : (confirmLabel ?? t("confirm"))}
          </Button>
        </>
      }
    >
      {error ? (
        <p
          role="alert"
          className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm"
        >
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
