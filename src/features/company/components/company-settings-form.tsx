"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField, Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { updateCompanyAction } from "@/features/company/actions";
import { ImagePicker } from "@/features/company/components/image-picker";
import {
  TICKET_ACTIONS,
  checkCompanyImage,
  companySettingsSchema,
  toCompanySettingsValues,
  type CompanyProfile,
} from "@/features/company/schemas";
import { useTranslatedMessage } from "@/lib/i18n/message";

type FieldErrors = { name?: string; logo?: string; banner?: string };

/**
 * Fiche entreprise — édition.
 *
 * Même mécanique que le formulaire d'onboarding : `FormData` parce que
 * `PATCH /company/:id` attend du multipart, et images posées à la main parce
 * qu'elles sortent recadrées de `<ImageCropper>`.
 *
 * Différence importante : ici les images sont **facultatives**. Ne rien choisir
 * conserve celles déjà en place — le champ n'est simplement pas envoyé. Il n'y
 * a volontairement pas de bouton « supprimer le logo » : `UpdateCompanyDto` n'a
 * aucun moyen d'exprimer un effacement, et un champ vide ferait échouer la
 * validation de fichier plutôt que d'effacer quoi que ce soit.
 */
export function CompanySettingsForm({ company }: { company: CompanyProfile }) {
  const t = useTranslations("company.form");
  const tCommon = useTranslations("common");
  const message = useTranslatedMessage();
  const router = useRouter();

  const initial = toCompanySettingsValues(company);

  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [images, setImages] = useState<{ logo: File | null; banner: File | null }>({
    logo: null,
    banner: null,
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (images.logo) formData.set("logo", images.logo);
    if (images.banner) formData.set("banner", images.banner);

    setFormError(null);

    const values = companySettingsSchema.safeParse({
      name: formData.get("name"),
      allowedAction: formData.get("allowedAction"),
      allowSeatNumberBook: formData.get("allowSeatNumberBook") === "on",
      allowIssuesReport: formData.get("allowIssuesReport") === "on",
      is2fAuthEnable: formData.get("is2fAuthEnable") === "on",
    });
    const logo = checkCompanyImage(formData.get("logo"));
    const banner = checkCompanyImage(formData.get("banner"));

    const localErrors: FieldErrors = {};
    if (!values.success) {
      localErrors.name =
        values.error.issues.find((issue) => issue.path[0] === "name")?.message ??
        undefined;
    }
    if (!logo.ok) localErrors.logo = logo.message;
    if (!banner.ok) localErrors.banner = banner.message;

    setFieldErrors(localErrors);
    if (Object.values(localErrors).some(Boolean)) return;

    startTransition(async () => {
      const result = await updateCompanyAction(formData);

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(message(result.message) ?? null);
        return;
      }

      toast.success(message(result.message));
      setImages({ logo: null, banner: null });
      // Le nom et le logo sont affichés par la barre latérale : sans ce
      // rafraîchissement, l'ancienne valeur y resterait jusqu'au prochain
      // rechargement complet.
      router.refresh();
    });
  };

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <div className="space-y-5">
        <Field
          label={t("name")}
          htmlFor="company-name"
          error={message(fieldErrors.name)}
          hint={t("nameHint")}
        >
          <Input
            id="company-name"
            name="name"
            autoComplete="organization"
            maxLength={100}
            defaultValue={initial.name}
            aria-invalid={Boolean(fieldErrors.name)}
            onChange={() => clearFieldError("name")}
          />
        </Field>

        <Field
          label={t("allowedAction")}
          htmlFor="company-allowed-action"
          hint={t("allowedActionHint")}
        >
          <Select
            id="company-allowed-action"
            name="allowedAction"
            defaultValue={initial.allowedAction}
          >
            {TICKET_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {t(`actions.${action}`)}
              </option>
            ))}
          </Select>
        </Field>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">{t("options")}</legend>

          <CheckboxField
            id="company-allow-seat-number"
            name="allowSeatNumberBook"
            label={t("allowSeatNumberBook")}
            hint={t("allowSeatNumberBookHint")}
            defaultChecked={initial.allowSeatNumberBook}
          />
          <CheckboxField
            id="company-allow-issues"
            name="allowIssuesReport"
            label={t("allowIssuesReport")}
            hint={t("allowIssuesReportHint")}
            defaultChecked={initial.allowIssuesReport}
          />
          <CheckboxField
            id="company-2fa"
            name="is2fAuthEnable"
            label={t("is2fAuthEnable")}
            hint={t("is2fAuthEnableHint")}
            defaultChecked={initial.is2fAuthEnable}
          />
        </fieldset>
      </div>

      <div className="border-subtle grid gap-5 border-t pt-5 sm:grid-cols-2">
        <ImagePicker
          name="logo"
          label={t("logo")}
          hint={t("logoHint")}
          error={message(fieldErrors.logo)}
          value={images.logo}
          onChange={(file) => {
            setImages((current) => ({ ...current, logo: file }));
            clearFieldError("logo");
          }}
        />
        <ImagePicker
          name="banner"
          label={t("banner")}
          hint={t("bannerHint")}
          shape="wide"
          error={message(fieldErrors.banner)}
          value={images.banner}
          onChange={(file) => {
            setImages((current) => ({ ...current, banner: file }));
            clearFieldError("banner");
          }}
        />
      </div>

      {formError ? <Alert variant="danger">{formError}</Alert> : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? tCommon("saving") : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
