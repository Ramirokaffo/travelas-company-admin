"use client";

import { Lock, Pencil, Trash2, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { SeatOption } from "@/features/seats/schemas";
import { deleteStaffAction, toggleStaffBlockAction } from "@/features/staff/actions";
import { StaffFormDialog } from "@/features/staff/components/staff-form-dialog";
import type { StaffMember } from "@/features/staff/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type StaffRowActionsProps = {
  member: StaffMember;
  seats: SeatOption[];
  /** `true` si la ligne est celle du chef d'entreprise connecté. */
  isSelf: boolean;
};

/**
 * Actions d'une ligne de la liste du personnel.
 *
 * Les deux actions destructrices passent par une confirmation. Masquer un
 * bouton n'est pas un contrôle d'accès : le refus qui compte est celui du
 * backend (`assertSameCompany`, `SELF_PROTECTED_FIELDS`) et celui des Server
 * Actions, qui revalident l'identifiant.
 */
export function StaffRowActions({ member, seats, isSelf }: StaffRowActionsProps) {
  const t = useTranslations("staff");
  const message = useTranslatedMessage();
  const [editOpen, setEditOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  /**
   * Les Server Actions renvoient un résultat au lieu de lever : on relève donc
   * l'échec en exception pour que `ConfirmDialog` reste ouverte et affiche
   * l'erreur, au lieu de se fermer sur un succès imaginaire.
   */
  const runOrThrow = async (
    action: () => Promise<{ ok: boolean; message: string }>,
  ) => {
    const result = await action();
    // Les Server Actions renvoient des clés de catalogue : la traduction a lieu
    // ici, dans la langue de l'utilisateur.
    if (!result.ok) throw new Error(result.message);
    toast.success(message(result.message));
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setEditOpen(true)}
        aria-label={t("rowActions.edit", { name: member.fullName })}
      >
        <Pencil className="size-4" aria-hidden />
      </Button>

      {!isSelf ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setBlockOpen(true)}
            aria-label={t(
              member.isBlocked ? "rowActions.unblock" : "rowActions.block",
              { name: member.fullName },
            )}
          >
            {member.isBlocked ? (
              <Unlock className="size-4" aria-hidden />
            ) : (
              <Lock className="size-4" aria-hidden />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDeleteOpen(true)}
            aria-label={t("rowActions.delete", { name: member.fullName })}
            className="hover:text-danger"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </>
      ) : null}

      <StaffFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        seats={seats}
        member={member}
      />

      <ConfirmDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title={t(member.isBlocked ? "confirmUnblock.title" : "confirmBlock.title")}
        description={t(
          member.isBlocked ? "confirmUnblock.description" : "confirmBlock.description",
          { name: member.fullName },
        )}
        confirmLabel={t(
          member.isBlocked ? "confirmUnblock.action" : "confirmBlock.action",
        )}
        variant={member.isBlocked ? "primary" : "danger"}
        onConfirm={() =>
          runOrThrow(() =>
            toggleStaffBlockAction({ id: member.id, isBlocked: !member.isBlocked }),
          )
        }
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description", { name: member.fullName })}
        confirmLabel={t("confirmDelete.action")}
        variant="danger"
        onConfirm={() => runOrThrow(() => deleteStaffAction({ id: member.id }))}
      />
    </div>
  );
}
