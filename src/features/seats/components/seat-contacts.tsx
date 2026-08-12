"use client";

import { Phone, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import {
  createSeatContactAction,
  deleteSeatContactAction,
} from "@/features/seats/actions";
import { seatContactFormSchema, type SeatContact } from "@/features/seats/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type SeatContactsProps = {
  seatId: string;
  contacts: SeatContact[];
};

/**
 * Annuaire téléphonique d'une agence.
 *
 * Formulaire d'ajout permanent plutôt qu'en fenêtre modale : ajouter deux ou
 * trois numéros à la suite est le cas courant, et une modale à rouvrir à chaque
 * fois ferait perdre plus de temps qu'elle n'en économise.
 *
 * La suppression, elle, passe par une confirmation : `softRemove` côté backend
 * n'a pas d'endpoint de restauration.
 */
export function SeatContacts({ seatId, contacts }: SeatContactsProps) {
  const t = useTranslations("seats.contacts");
  const tCommon = useTranslations("common");
  const message = useTranslatedMessage();

  const [label, setLabel] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SeatContact | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    const parsed = seatContactFormSchema.safeParse({ seatId, label, phoneNumber });

    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setFormError(null);

    startTransition(async () => {
      const result = await createSeatContactAction(parsed.data);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.fieldErrors ? null : (message(result.message) ?? null));
        return;
      }

      toast.success(message(result.message));
      setLabel("");
      setPhoneNumber("");
    });
  };

  return (
    <div className="space-y-4">
      {contacts.length === 0 ? (
        <p className="text-muted text-sm">{t("empty")}</p>
      ) : (
        <ul className="divide-subtle divide-y">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center gap-3 py-2.5">
              <Phone className="text-muted size-4 shrink-0" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium tabular-nums">
                  {contact.phoneNumber}
                </p>
                {contact.label ? (
                  <p className="text-muted truncate text-xs">{contact.label}</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="hover:text-danger"
                aria-label={t("delete", { phone: contact.phoneNumber })}
                onClick={() => setPendingDelete(contact)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="border-subtle space-y-3 border-t pt-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        noValidate
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t("phone")}
            htmlFor="contact-phone"
            error={message(fieldErrors.phoneNumber)}
            hint={t("phoneHint")}
          >
            <Input
              id="contact-phone"
              type="tel"
              inputMode="tel"
              value={phoneNumber}
              maxLength={15}
              placeholder="+237690000000"
              aria-invalid={Boolean(fieldErrors.phoneNumber)}
              onChange={(event) => setPhoneNumber(event.target.value)}
            />
          </Field>

          <Field
            label={t("label")}
            htmlFor="contact-label"
            error={message(fieldErrors.label)}
            hint={t("labelHint")}
          >
            <Input
              id="contact-label"
              value={label}
              maxLength={50}
              aria-invalid={Boolean(fieldErrors.label)}
              onChange={(event) => setLabel(event.target.value)}
            />
          </Field>
        </div>

        {formError ? <Alert variant="danger">{formError}</Alert> : null}

        <div className="flex justify-end">
          <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
            <Plus className="size-4" aria-hidden />
            {isPending ? tCommon("saving") : t("add")}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("confirmDelete.title")}
        description={t("confirmDelete.description", {
          phone: pendingDelete?.phoneNumber ?? "",
        })}
        confirmLabel={t("confirmDelete.action")}
        variant="danger"
        onConfirm={async () => {
          if (!pendingDelete) return;
          const result = await deleteSeatContactAction({ id: pendingDelete.id });
          // `ConfirmDialog` reste ouverte tant que la promesse échoue : on
          // relève donc l'échec en exception plutôt que de fermer sur un succès
          // imaginaire.
          if (!result.ok) throw new Error(result.message);
          toast.success(message(result.message));
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
