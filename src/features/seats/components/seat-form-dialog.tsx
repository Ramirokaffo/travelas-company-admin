"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { AgencyOption } from "@/features/agencies/schemas";
import { createSeatAction, updateSeatAction } from "@/features/seats/actions";
import {
  seatFormSchema,
  toSeatFormValues,
  type SeatFormValues,
  type SeatSummary,
} from "@/features/seats/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type SeatFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agencies: AgencyOption[];
  /** `null` en création, l'agence visée en édition. */
  seat: SeatSummary | null;
};

/**
 * Formulaire de création / d'édition d'une agence.
 *
 * La gare de rattachement (`agencyId`) est obligatoire : `CreateSeatDto` la
 * valide avec `@IsNotEmpty()`, et c'est elle qui rattache l'agence à une ville.
 * Elle est présentée groupée par ville, seul repère utilisable quand plusieurs
 * gares portent des noms proches.
 */
export function SeatFormDialog({
  open,
  onOpenChange,
  agencies,
  seat,
}: SeatFormDialogProps) {
  const t = useTranslations("seats.form");
  const tCommon = useTranslations("common");
  const tSeats = useTranslations("seats");
  const message = useTranslatedMessage();

  const isEdit = seat !== null;
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<SeatFormValues>({
    resolver: zodResolver(seatFormSchema),
    defaultValues: toSeatFormValues(seat),
  });

  // La fenêtre est montée en permanence : sans cette remise à zéro, l'édition
  // d'une seconde agence rouvrirait le formulaire de la première.
  useEffect(() => {
    if (open) reset(toSeatFormValues(seat));
  }, [open, seat, reset]);

  /** Les gares arrivent déjà triées par ville : un simple regroupement suffit. */
  const cities = useMemo(() => {
    const groups = new Map<string, AgencyOption[]>();
    for (const agency of agencies) {
      const city = agency.city ?? tSeats("unknownCity");
      const group = groups.get(city);
      if (group) group.push(agency);
      else groups.set(city, [agency]);
    }
    return [...groups];
  }, [agencies, tSeats]);

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = isEdit
        ? await updateSeatAction({ ...values, id: seat.id })
        : await createSeatAction(values);

      if (!result.ok) {
        // Les Server Actions renvoient des clés de catalogue, pas du texte :
        // la traduction a lieu ici, dans la langue de l'utilisateur.
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof SeatFormValues, { message: key });
        }
        setError("root", { message: result.message });
        return;
      }

      toast.success(message(result.message));
      onOpenChange(false);
    });
  });

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
          <Button type="submit" form="seat-form" disabled={isPending}>
            {isPending ? tCommon("saving") : t(isEdit ? "submitEdit" : "submitCreate")}
          </Button>
        </>
      }
    >
      <form id="seat-form" onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("name")} htmlFor="name" error={message(errors.name?.message)}>
            <Input
              id="name"
              autoComplete="off"
              aria-invalid={Boolean(errors.name)}
              {...register("name")}
            />
          </Field>

          <Field
            label={t("agency")}
            htmlFor="agencyId"
            error={message(errors.agencyId?.message)}
            hint={t(agencies.length === 0 ? "agencyHintEmpty" : "agencyHint")}
          >
            <Select
              id="agencyId"
              aria-invalid={Boolean(errors.agencyId)}
              {...register("agencyId")}
            >
              <option value="">{t("agencyPlaceholder")}</option>
              {cities.map(([city, group]) => (
                <optgroup key={city} label={city}>
                  {group.map((agency) => (
                    <option key={agency.id} value={String(agency.id)}>
                      {agency.name ?? tSeats("unnamedAgency")}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>

          <Field
            label={t("street")}
            htmlFor="street"
            error={message(errors.street?.message)}
            hint={t("streetHint")}
          >
            <Input
              id="street"
              autoComplete="off"
              aria-invalid={Boolean(errors.street)}
              {...register("street")}
            />
          </Field>

          <Field
            label={t("booking")}
            htmlFor="allowSeatNumberBook"
            error={message(errors.allowSeatNumberBook?.message)}
            hint={t("bookingHint")}
          >
            <Select id="allowSeatNumberBook" {...register("allowSeatNumberBook")}>
              <option value="inherit">{t("bookingInherit")}</option>
              <option value="yes">{t("bookingYes")}</option>
              <option value="no">{t("bookingNo")}</option>
            </Select>
          </Field>

          <Field
            label={t("latitude")}
            htmlFor="lat"
            error={message(errors.lat?.message)}
            hint={t("coordinatesHint")}
          >
            <Input
              id="lat"
              inputMode="decimal"
              autoComplete="off"
              placeholder="5.3599"
              aria-invalid={Boolean(errors.lat)}
              {...register("lat")}
            />
          </Field>

          <Field
            label={t("longitude")}
            htmlFor="long"
            error={message(errors.long?.message)}
            hint={t("coordinatesHint")}
          >
            <Input
              id="long"
              inputMode="decimal"
              autoComplete="off"
              placeholder="-4.0083"
              aria-invalid={Boolean(errors.long)}
              {...register("long")}
            />
          </Field>
        </div>

        <div className="border-subtle space-y-3 border-t pt-4">
          <CheckboxField
            id="isMain"
            label={t("isMain")}
            hint={t("isMainHint")}
            {...register("isMain")}
          />
          <CheckboxField
            id="hasBedroom"
            label={t("hasBedroom")}
            hint={t("hasBedroomHint")}
            {...register("hasBedroom")}
          />
          <CheckboxField
            id="isActive"
            label={t("isActive")}
            hint={t("isActiveHint")}
            {...register("isActive")}
          />
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
