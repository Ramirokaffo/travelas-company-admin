"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Alert } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { updateAccountLangAction } from "@/features/account/actions";
import { writeLocaleCookie } from "@/i18n/client-locale";
import { LOCALES, LOCALE_LABELS, parseLocale } from "@/i18n/config";
import { useTranslatedMessage } from "@/lib/i18n/message";

/**
 * Préférences d'affichage : langue et thème.
 *
 * Les deux vivent dans un cookie **lisible par JavaScript**, relu côté serveur
 * au rendu — ce n'est pas une entorse à la règle 3 de CLAUDE.md : une
 * préférence d'affichage n'est pas un secret, et l'écriture côté client rend la
 * bascule instantanée.
 *
 * La langue est en outre enregistrée **sur le compte** (`PATCH /user { lang }`),
 * ce que le sélecteur de la barre supérieure ne fait pas : celui-ci bascule
 * l'interface pour ce navigateur, celui-ci fixe aussi la langue des e-mails et
 * des notifications envoyés hors de ce dashboard. Un échec de cet
 * enregistrement n'annule pas la bascule d'interface, déjà effective : il est
 * signalé sans bloquer.
 */
export function PreferencesCard() {
  const t = useTranslations("settings.preferences");
  const tTheme = useTranslations("theme");
  const locale = useLocale();
  const router = useRouter();
  const message = useTranslatedMessage();

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onLocaleChange = (value: string) => {
    const next = parseLocale(value);
    setError(null);
    writeLocaleCookie(next);

    startTransition(async () => {
      const result = await updateAccountLangAction({ lang: next });
      if (!result.ok) setError(result.message);

      // Les libellés viennent du serveur : changer de langue impose un nouveau
      // rendu serveur, pas seulement une mise à jour d'état.
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <Field label={t("language")} htmlFor="account-language" hint={t("languageHint")}>
        <Select
          id="account-language"
          value={locale}
          disabled={isPending}
          onChange={(event) => onLocaleChange(event.target.value)}
        >
          {LOCALES.map((option) => (
            <option key={option} value={option}>
              {LOCALE_LABELS[option]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">{tTheme("label")}</p>
        <ThemeToggle className="w-fit" />
        <p className="text-muted text-xs">{t("themeHint")}</p>
      </div>

      {error ? <Alert variant="danger">{message(error)}</Alert> : null}
    </div>
  );
}
