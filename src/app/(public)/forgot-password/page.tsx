import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ForgotPasswordFlow } from "@/features/auth/components/forgot-password-flow";
import { readPasswordReset } from "@/lib/auth/password-reset";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("metadata"))("forgotPassword") };
}

/**
 * Mot de passe oublié.
 *
 * L'étape d'entrée est décidée ici, côté serveur, d'après le cookie du parcours :
 * un code déjà validé (donc un jeton de réinitialisation en main) reprend
 * directement au choix du nouveau mot de passe, plutôt que de refaire tourner
 * un e-mail.
 */
export default async function ForgotPasswordPage() {
  const pending = await readPasswordReset();

  return (
    <ForgotPasswordFlow
      initialStep={pending?.resetToken ? "reset" : pending ? "code" : "email"}
      pendingEmail={pending?.email ?? null}
    />
  );
}
