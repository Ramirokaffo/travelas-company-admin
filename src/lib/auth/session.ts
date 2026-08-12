import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { isAllowedDashboardRole } from "@/constants/roles";
import { apiFetch } from "@/lib/api/server-api";
import { ApiError } from "@/lib/api/errors";
import { readAccessToken } from "@/lib/auth/cookies";
import { toSessionUser, userSchema, type SessionUser } from "@/types/user";

/**
 * Source de vérité de la session côté serveur.
 *
 * Le profil est relu auprès du backend à chaque rendu (mémoïsé par requête via
 * `cache()`), et non déduit du contenu du JWT : une révocation, un blocage de
 * compte ou un changement de rôle prend effet immédiatement.
 */
export const getSession = cache(async (): Promise<SessionUser | null> => {
  const accessToken = await readAccessToken();
  if (!accessToken) return null;

  try {
    const user = await apiFetch("/auth/profile", userSchema, { accessToken });

    // Cloisonnement des dashboards : le backend autorise plusieurs rôles sur
    // `/auth/login`, mais CE front n'est ouvert qu'aux chefs d'entreprise.
    if (!isAllowedDashboardRole(user.role)) return null;

    return toSessionUser(user);
  } catch (error) {
    // 401/403 : token expiré, compte bloqué ou déconnecté côté backend.
    if (error instanceof ApiError && (error.isUnauthorized || error.isForbidden)) {
      return null;
    }
    throw error;
  }
});

/**
 * Exige une session valide de chef d'entreprise.
 * À appeler dans chaque layout/page protégé et chaque Server Action.
 *
 * Le middleware ne suffit pas : il ne fait qu'un contrôle de présence de cookie
 * et ne s'exécute pas sur les Server Actions.
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect(ROUTES.login);
  return session;
}

/**
 * Exige une session ET une entreprise déjà créée.
 * Redirige vers l'onboarding tant que le chef d'entreprise n'a pas d'entreprise.
 */
export async function requireCompanySession(): Promise<
  SessionUser & { company: NonNullable<SessionUser["company"]> }
> {
  const session = await requireSession();
  if (!session.company) redirect(ROUTES.onboarding);
  return session as SessionUser & { company: NonNullable<SessionUser["company"]> };
}

/**
 * Récupère l'access token pour un appel backend, après validation de session.
 * Empêche d'écrire un appel API authentifié sans avoir vérifié la session.
 */
export async function getAuthorizedToken(): Promise<string> {
  await requireSession();
  const token = await readAccessToken();
  if (!token) redirect(ROUTES.login);
  return token;
}
