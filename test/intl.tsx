import { render as baseRender, type RenderOptions } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement, ReactNode } from "react";

import { APP_FORMATS, APP_TIME_ZONE } from "@/i18n/config";
import messages from "@/i18n/messages/fr.json";

/**
 * `render` de Testing Library, enveloppé dans le contexte de langue.
 *
 * Tout composant client qui appelle `useTranslations()` lève sans provider.
 * Plutôt que de simuler next-intl, on monte le vrai provider avec le catalogue
 * français réel : les tests continuent d'assurer sur les textes visibles, et
 * une clé oubliée dans le catalogue fait échouer le test au lieu de passer
 * inaperçue.
 *
 * Les formats nommés (`"currency"`, `"day"`…) sont passés explicitement : en
 * production, `NextIntlClientProvider` les hérite de `i18n/request.ts`, ce qui
 * n'existe pas sous Vitest. Sans eux, `format.number(x, "currency")` retomberait
 * silencieusement sur un nombre nu — et un test des montants passerait à côté.
 *
 * Les composants sous test importent ce `render` à la place de celui de
 * `@testing-library/react`.
 */
export function render(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  return baseRender(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <NextIntlClientProvider
        locale="fr"
        messages={messages}
        timeZone={APP_TIME_ZONE}
        formats={APP_FORMATS}
      >
        {children}
      </NextIntlClientProvider>
    ),
    ...options,
  });
}

export * from "@testing-library/react";
