"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { SeatOption } from "@/features/seats/schemas";
import { createStaffAction, updateStaffAction } from "@/features/staff/actions";
import {
  EMPTY_STAFF_FORM,
  STAFF_ROLES,
  staffFormSchema,
  type StaffFormValues,
  type StaffMember,
} from "@/features/staff/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type StaffFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seats: SeatOption[];
  /** `null` en création, le collaborateur visé en édition. */
  member: StaffMember | null;
};

function toFormValues(member: StaffMember | null): StaffFormValues {
  if (!member) return EMPTY_STAFF_FORM;

  return {
    firstName: member.firstName,
    lastName: member.lastName ?? "",
    email: member.email ?? "",
    phoneNumber: member.phoneNumber ?? "",
    // Le rôle stocké peut sortir de la liste gérable (compte créé côté
    // super_admin) : on retombe alors sur le premier rôle proposé.
    role: STAFF_ROLES.includes(member.role as (typeof STAFF_ROLES)[number])
      ? (member.role as (typeof STAFF_ROLES)[number])
      : EMPTY_STAFF_FORM.role,
    seatId: member.seat?.id ?? "",
    cniNumber: member.cniNumber ?? "",
    lang: member.lang,
  };
}

/**
 * Formulaire de création / d'édition d'un collaborateur.
 *
 * Aucun champ « mot de passe » : à la création, le backend en génère un et
 * l'envoie par e-mail au collaborateur, avec obligation de le changer à la
 * première connexion. L'administrateur n'a donc jamais à manipuler — ni à
 * connaître — le mot de passe de son personnel.
 */
export function StaffFormDialog({
  open,
  onOpenChange,
  seats,
  member,
}: StaffFormDialogProps) {
  const t = useTranslations("staff.form");
  const tCommon = useTranslations("common");
  const tRoles = useTranslations("roles");
  const tLanguages = useTranslations("languages");
  const tSeats = useTranslations("seats");
  const message = useTranslatedMessage();

  const isEdit = member !== null;
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffFormSchema),
    defaultValues: toFormValues(member),
  });

  // La fenêtre est montée en permanence : sans cette remise à zéro, l'édition
  // d'un second collaborateur rouvrirait le formulaire du premier.
  useEffect(() => {
    if (open) reset(toFormValues(member));
  }, [open, member, reset]);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateStaffAction({ ...values, id: member.id })
        : await createStaffAction(values);

      if (!result.ok) {
        // Les Server Actions renvoient des clés de catalogue, pas du texte :
        // la traduction a lieu ici, dans la langue de l'utilisateur.
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof StaffFormValues, { message: key });
        }
        setError("root", { message: result.message });
        return;
      }

      toast.success(result.message);
      onOpenChange(false);
    });
  });

  const activeSeats = seats.filter(
    (seat) => seat.isActive || seat.id === member?.seat?.id,
  );

  return (
    <Modal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t(isEdit ? "editTitle" : "createTitle")}
      description={t(isEdit ? "editDescription" : "createDescription")}
      dismissible={!isPending}
      size="lg"
      footer={
        <>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {tCommon("cancel")}
          </Button>
          <Button type="submit" form="staff-form" disabled={isPending}>
            {isPending ? tCommon("saving") : t(isEdit ? "submitEdit" : "submitCreate")}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("firstName")}
            htmlFor="firstName"
            error={message(errors.firstName?.message)}
          >
            <Input
              id="firstName"
              autoComplete="off"
              aria-invalid={Boolean(errors.firstName)}
              {...register("firstName")}
            />
          </Field>

          <Field
            label={t("lastName")}
            htmlFor="lastName"
            error={message(errors.lastName?.message)}
          >
            <Input
              id="lastName"
              autoComplete="off"
              aria-invalid={Boolean(errors.lastName)}
              {...register("lastName")}
            />
          </Field>

          <Field
            label={t("email")}
            htmlFor="email"
            error={message(errors.email?.message)}
          >
            <Input
              id="email"
              type="email"
              autoComplete="off"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </Field>

          <Field
            label={t("phone")}
            htmlFor="phoneNumber"
            error={message(errors.phoneNumber?.message)}
            hint={t("phoneHint")}
          >
            <Input
              id="phoneNumber"
              type="tel"
              autoComplete="off"
              aria-invalid={Boolean(errors.phoneNumber)}
              {...register("phoneNumber")}
            />
          </Field>

          <Field label={t("role")} htmlFor="role" error={message(errors.role?.message)}>
            <Select id="role" aria-invalid={Boolean(errors.role)} {...register("role")}>
              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {tRoles(role)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t("seat")}
            htmlFor="seatId"
            error={message(errors.seatId?.message)}
            hint={t(seats.length === 0 ? "seatHintEmpty" : "seatHint")}
          >
            <Select id="seatId" {...register("seatId")}>
              <option value="">{tCommon("none")}</option>
              {activeSeats.map((seat) => (
                <option key={seat.id} value={seat.id}>
                  {seat.name ?? tSeats("unnamed")}
                  {seat.isMain ? ` ${t("mainSeat")}` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t("cni")}
            htmlFor="cniNumber"
            error={message(errors.cniNumber?.message)}
            hint={t("cniHint")}
          >
            <Input
              id="cniNumber"
              autoComplete="off"
              aria-invalid={Boolean(errors.cniNumber)}
              {...register("cniNumber")}
            />
          </Field>

          <Field label={t("lang")} htmlFor="lang" error={message(errors.lang?.message)}>
            <Select id="lang" {...register("lang")}>
              <option value="fr">{tLanguages("fr")}</option>
              <option value="en">{tLanguages("en")}</option>
            </Select>
          </Field>
        </div>

        {errors.root ? (
          <p
            role="alert"
            className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm"
          >
            {message(errors.root.message)}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
