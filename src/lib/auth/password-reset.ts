import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { useSecureCookies } from "@/lib/config/env";

/**
 * Réinitialisation de mot de passe en cours.
 *
 * Le parcours se fait en trois appels (demande du code, validation du code,
 * nouveau mot de passe) et deux secrets doivent survivre entre eux :
 *
 *  - l'**adresse** visée, pour pouvoir renvoyer un code sans la redemander ;
 *  - le **jeton de réinitialisation** délivré par le backend une fois le code
 *    validé. C'est un JWT de 30 minutes qui, à lui seul, autorise à changer le
 *    mot de passe du compte : il ne doit jamais atteindre le navigateur.
 *
 * D'où un cookie `httpOnly`, illisible par JavaScript, effacé dès le mot de
 * passe changé. Sa durée de vie suit celle du jeton backend : le laisser vivre
 * plus longtemps ne servirait qu'à conserver un secret périmé.
 */

export const PASSWORD_RESET_COOKIE = "travelas_password_reset";

/** 30 minutes — la durée de vie du `reset_token` signé par le backend. */
const PASSWORD_RESET_MAX_AGE_SECONDS = 60 * 30;

const passwordResetSchema = z.object({
  email: z.string().min(1),
  /** Absent tant que le code n'a pas été validé. */
  resetToken: z.string().min(1).optional(),
});

export type PasswordResetState = z.infer<typeof passwordResetSchema>;

export async function setPasswordReset(state: PasswordResetState): Promise<void> {
  const store = await cookies();
  store.set(PASSWORD_RESET_COOKIE, JSON.stringify(state), {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: PASSWORD_RESET_MAX_AGE_SECONDS,
  });
}

export async function readPasswordReset(): Promise<PasswordResetState | null> {
  const raw = (await cookies()).get(PASSWORD_RESET_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = passwordResetSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearPasswordReset(): Promise<void> {
  (await cookies()).delete({ name: PASSWORD_RESET_COOKIE, path: "/" });
}
