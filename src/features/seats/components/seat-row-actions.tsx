"use client";

import { Pencil, Power, PowerOff, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { AgencyOption } from "@/features/agencies/schemas";
import { deleteSeatAction, toggleSeatActiveAction } from "@/features/seats/actions";
import { SeatFormDialog } from "@/features/seats/components/seat-form-dialog";
import type { SeatSummary } from "@/features/seats/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type SeatRowActionsProps = {
  seat: SeatSummary;
  agencies: AgencyOption[];
};

/**
 * Actions d'une ligne de la liste des agences.
 *
 * Désactivation et suppression sont deux gestes distincts : la première est
 * réversible et laisse l'agence dans la liste, la seconde est un `softDelete`
 * backend sans endpoint de restauration. Les deux passent par une confirmation,
 * et l'autorisation qui compte reste celle du backend
 * (`assertSeatBelongsToUser`).
 */
export function SeatRowActions({ seat, agencies }: SeatRowActionsProps) {
  const t = useTranslations("seats");
  const message = useTranslatedMessage();
  const [editOpen, setEditOpen] = useState(false);
  const [activeOpen, setActiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const name = seat.name ?? t("unnamed");

  /**
   * Les Server Actions renvoient un résultat au lieu de lever : on relève donc
   * l'échec en exception pour que `ConfirmDialog` reste ouverte et affiche
   * l'erreur, au lieu de se fermer sur un succès imaginaire.
   */
  const runOrThrow = async (
    action: () => Promise<{ ok: boolean; message: string }>,
  ) => {
    const result = await action();
    if (!result.ok) throw new Error(result.message);
    toast.success(message(result.message));
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditOpen(true)}
        aria-label={t("rowActions.edit", { name })}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setActiveOpen(true)}
        aria-label={t(seat.isActive ? "rowActions.deactivate" : "rowActions.activate", {
          name,
        })}
      >
        {seat.isActive ? (
          <PowerOff className="size-4" aria-hidden />
        ) : (
          <Power className="size-4" aria-hidden />
        )}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        onClick={() => setDeleteOpen(true)}
        aria-label={t("rowActions.delete", { name })}
        className="hover:text-danger"
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>

      <SeatFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        agencies={agencies}
        seat={seat}
      />

      <ConfirmDialog
        open={activeOpen}
        onOpenChange={setActiveOpen}
        title={t(seat.isActive ? "confirmDeactivate.title" : "confirmActivate.title")}
        description={t(
          seat.isActive
            ? "confirmDeactivate.description"
            : "confirmActivate.description",
          { name },
        )}
        confirmLabel={t(
          seat.isActive ? "confirmDeactivate.action" : "confirmActivate.action",
        )}
        variant={seat.isActive ? "danger" : "primary"}
        onConfirm={() =>
          runOrThrow(() =>
            toggleSeatActiveAction({ id: seat.id, isActive: !seat.isActive }),
          )
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description", { name })}
        confirmLabel={t("confirmDelete.action")}
        variant="danger"
        onConfirm={() => runOrThrow(() => deleteSeatAction({ id: seat.id }))}
      />
    </div>
  );
}
