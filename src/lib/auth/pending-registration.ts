import "server-only";

import { cookies } from "next/headers";
import { z } from "zod";

import { useSecureCookies } from "@/lib/config/env";

/**
 * Inscription en attente de vérification d'e-mail.
 *
 * Entre `POST /auth/create` et la validation du code, il faut retenir *quel*
 * compte est en cours de vérification. Cet état vit dans un cookie `httpOnly` —
 * jamais dans une prop de composant client ni dans le corps des réponses :
 *
 *  - le navigateur n'a pas besoin de connaître l'identifiant du compte ; le
 *    formulaire n'envoie que le code, le serveur retrouve le reste ;
 *  - `httpOnly` empêche du JavaScript injecté de le lire *ou* de le forger,
 *    donc de rattacher la vérification à un autre compte ;
 *  - l'état survit à un rechargement de page : l'utilisateur qui ferme puis
 *    rouvre `/register` retombe sur l'écran de saisie du code.
 *
 * Ce cookie n'est pas une session : il n'autorise rien d'autre que soumettre un
 * code, lequel est vérifié par le backend. Sa durée de vie est courte.
 */

export const PENDING_REGISTRATION_COOKIE = "travelas_pending_registration";

/** 30 minutes : le temps de retrouver l'e-mail, pas davantage. */
const PENDING_MAX_AGE_SECONDS = 60 * 30;

const pendingRegistrationSchema = z.object({
  userId: z.string().min(1),
  email: z.string().min(1),
});

export type PendingRegistration = z.infer<typeof pendingRegistrationSchema>;

export async function setPendingRegistration(
  pending: PendingRegistration,
): Promise<void> {
  const store = await cookies();
  store.set(PENDING_REGISTRATION_COOKIE, JSON.stringify(pending), {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_MAX_AGE_SECONDS,
  });
}

/**
 * Lit l'inscription en attente, ou `null`.
 *
 * Le contenu est revalidé : un cookie tronqué ou modifié à la main ne doit pas
 * produire un `userId` indéfini transmis tel quel au backend.
 */
export async function readPendingRegistration(): Promise<PendingRegistration | null> {
  const raw = (await cookies()).get(PENDING_REGISTRATION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = pendingRegistrationSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearPendingRegistration(): Promise<void> {
  (await cookies()).delete({ name: PENDING_REGISTRATION_COOKIE, path: "/" });
}
