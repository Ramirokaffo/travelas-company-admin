"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { changePasswordAction } from "@/features/account/actions";
import {
  changePasswordFormSchema,
  type ChangePasswordFormValues,
} from "@/features/account/schemas";
import { PasswordChecklist } from "@/features/auth/components/password-checklist";
import { useTranslatedMessage } from "@/lib/i18n/message";

const EMPTY: ChangePasswordFormValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

/**
 * Changement de mot de passe depuis un compte connecté.
 *
 * Le mot de passe actuel est exigé : une session laissée ouverte sur un poste
 * partagé ne doit pas suffire à verrouiller le compte de son titulaire.
 *
 * La session **reste ouverte** après le changement — le backend ne révoque pas
 * le token, et déconnecter ici obligerait à ressaisir un mot de passe qu'on
 * vient de choisir.
 */
export function PasswordForm() {
  const t = useTranslations("settings.password");
  const tCommon = useTranslations("common");
  const message = useTranslatedMessage();
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    control,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: EMPTY,
  });

  // La liste de contrôle se coche à la frappe : elle vaut mieux qu'un message
  // d'erreur unique découvert à la validation.
  const newPassword = useWatch({ control, name: "newPassword" }) ?? "";

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await changePasswordAction(values);

      if (!result.ok) {
        for (const [field, key] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof ChangePasswordFormValues, { message: key });
        }
        setError("root", { message: result.message });
        return;
      }

      toast.success(message(result.message));
      // Aucun mot de passe ne reste en mémoire dans le formulaire une fois
      // l'opération réussie.
      reset(EMPTY);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <Field
        label={t("current")}
        htmlFor="account-current-password"
        error={message(errors.currentPassword?.message)}
      >
        <PasswordInput
          id="account-current-password"
          autoComplete="current-password"
          maxLength={128}
          aria-invalid={Boolean(errors.currentPassword)}
          {...register("currentPassword")}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label={t("new")}
          htmlFor="account-new-password"
          error={message(errors.newPassword?.message)}
        >
          <PasswordInput
            id="account-new-password"
            autoComplete="new-password"
            maxLength={128}
            aria-invalid={Boolean(errors.newPassword)}
            {...register("newPassword")}
          />
        </Field>

        <Field
          label={t("confirm")}
          htmlFor="account-confirm-password"
          error={message(errors.confirmPassword?.message)}
        >
          <PasswordInput
            id="account-confirm-password"
            autoComplete="new-password"
            maxLength={128}
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </Field>
      </div>

      <PasswordChecklist value={newPassword} />

      {errors.root ? (
        <Alert variant="danger">{message(errors.root.message)}</Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("working") : t("submit")}
        </Button>
      </div>
    </form>
  );
}
