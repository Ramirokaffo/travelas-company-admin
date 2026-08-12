"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { updateProfileAction } from "@/features/account/actions";
import { profileFormSchema, type ProfileFormValues } from "@/features/account/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";
import type { SessionUser } from "@/types/user";

/**
 * Identité du titulaire du compte.
 *
 * L'adresse e-mail n'est pas ici : la changer suppose de prouver qu'on possède
 * la nouvelle, ce qui est un parcours en deux temps (voir `EmailSection`). La
 * mélanger aux autres champs laisserait croire qu'un simple « Enregistrer »
 * suffit.
 */
export function ProfileForm({ user }: { user: SessionUser }) {
  const t = useTranslations("settings.profile");
  const tCommon = useTranslations("common");
  const message = useTranslatedMessage();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName ?? "",
      userName: user.userName,
      phoneNumber: user.phoneNumber ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateProfileAction(values);

      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof ProfileFormValues, { message: key });
        }
        setError("root", { message: result.message });
        return;
      }

      toast.success(message(result.message));
      // Les valeurs enregistrées deviennent la nouvelle référence : sans cette
      // remise à zéro, le formulaire resterait « modifié » après un succès.
      reset(values);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("firstName")}
          htmlFor="account-first-name"
          error={message(errors.firstName?.message)}
        >
          <Input
            id="account-first-name"
            autoComplete="given-name"
            maxLength={50}
            aria-invalid={Boolean(errors.firstName)}
            {...register("firstName")}
          />
        </Field>

        <Field
          label={t("lastName")}
          htmlFor="account-last-name"
          error={message(errors.lastName?.message)}
        >
          <Input
            id="account-last-name"
            autoComplete="family-name"
            maxLength={50}
            aria-invalid={Boolean(errors.lastName)}
            {...register("lastName")}
          />
        </Field>

        <Field
          label={t("userName")}
          htmlFor="account-user-name"
          hint={t("userNameHint")}
          error={message(errors.userName?.message)}
        >
          <Input
            id="account-user-name"
            autoComplete="username"
            maxLength={30}
            aria-invalid={Boolean(errors.userName)}
            {...register("userName")}
          />
        </Field>

        <Field
          label={t("phoneNumber")}
          htmlFor="account-phone"
          hint={t("phoneNumberHint")}
          error={message(errors.phoneNumber?.message)}
        >
          <Input
            id="account-phone"
            type="tel"
            autoComplete="tel"
            maxLength={15}
            placeholder="+237600000000"
            aria-invalid={Boolean(errors.phoneNumber)}
            {...register("phoneNumber")}
          />
        </Field>
      </div>

      {errors.root ? (
        <Alert variant="danger">{message(errors.root.message)}</Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
