import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { RegisterFlow } from "@/features/auth/components/register-flow";
import { readPendingRegistration } from "@/lib/auth/pending-registration";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("register") };
}

/**
 * Inscription du chef d'entreprise.
 *
 * L'étape d'entrée est décidée ici, côté serveur : une inscription déjà créée
 * mais non vérifiée (cookie `httpOnly`) rouvre directement l'écran de saisie du
 * code, plutôt qu'un formulaire vierge qui échouerait sur un doublon.
 *
 * Le compte créé a nécessairement le rôle `company_admin` : `auth.service.create()`
 * le force, `UserSubscribeDto` ne portant aucun champ de rôle.
 */
export default async function RegisterPage() {
  const pending = await readPendingRegistration();

  return (
    <RegisterFlow
      initialStep={pending ? "verify" : "account"}
      pendingEmail={pending?.email ?? null}
    />
  );
}
