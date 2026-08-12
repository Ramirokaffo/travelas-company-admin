import "server-only";

import { z } from "zod";

import { apiFetch } from "@/lib/api/server-api";
import { userSchema } from "@/types/user";

import type { ProfileFormValues } from "./schemas";

/**
 * Accès backend du domaine « compte » — SERVEUR UNIQUEMENT.
 *
 * Toutes ces routes agissent sur le compte **du porteur du token** : aucune
 * d'elles ne prend d'identifiant. C'est volontaire — un identifiant de compte
 * dans le corps d'une requête est un identifiant qu'un client peut changer.
 */

/** Réponse des endpoints qui ne renvoient qu'un statut métier. */
const statusResponseSchema = z.object({ status: z.string() }).loose();

/**
 * Réponse de `PATCH /user`.
 *
 * Le backend renvoie l'entité mise à jour, parfois enveloppée dans `{ user }`
 * selon le chemin emprunté par le service. On accepte les deux formes et on ne
 * garde que la projection habituelle — l'entité brute contient `password`,
 * `salt` et `firebaseId`.
 */
const updateResponseSchema = z.union([
  z.object({ user: userSchema }),
  userSchema,
  z.unknown(),
]);

/**
 * Met à jour l'identité du compte connecté (`PATCH /user`).
 *
 * ⚠️ `PATCH /user` (sans identifiant), pas `PATCH /user/:id` : la cible est le
 * porteur du token, elle ne se choisit pas. Le corps est du **JSON** — la route
 * monte bien un `FileInterceptor`, mais la photo passe par sa propre route
 * (`POST /auth/profile/image`), ce qui évite de faire transiter tous les champs
 * en multipart pour un fichier facultatif.
 *
 * Aucun champ n'est envoyé au-delà de ceux du formulaire : le `ValidationPipe`
 * global est en `forbidNonWhitelisted`, et plusieurs champs connus sont
 * interdits sur son propre compte (`role`, `isBlocked`, `seatId`…).
 */
export async function updateMyProfile(
  values: ProfileFormValues,
  accessToken: string,
): Promise<void> {
  await apiFetch("/user", updateResponseSchema, {
    method: "PATCH",
    accessToken,
    body: {
      firstName: values.firstName,
      lastName: values.lastName,
      userName: values.userName.toLowerCase(),
      phoneNumber: values.phoneNumber,
    },
  });
}

/**
 * Enregistre la langue **du compte** (`PATCH /user { lang }`).
 *
 * Distincte de la langue du dashboard, qui vit dans un cookie : celle-ci suit
 * le compte et sert aux e-mails et aux notifications poussées.
 */
export async function updateMyLang(
  lang: string,
  accessToken: string,
): Promise<void> {
  await apiFetch("/user", updateResponseSchema, {
    method: "PATCH",
    accessToken,
    body: { lang },
  });
}

/**
 * Change le mot de passe (`POST /auth/changePassword`).
 *
 * Le backend vérifie l'ancien mot de passe et refuse un nouveau identique.
 * La session **n'est pas** invalidée : `isLoggedOut` n'est pas touché et le
 * token reste valable, l'utilisateur poursuit sa navigation.
 */
export async function changeMyPassword(
  input: { currentPassword: string; newPassword: string },
  accessToken: string,
): Promise<{ status: string }> {
  return apiFetch("/auth/changePassword", statusResponseSchema, {
    method: "POST",
    accessToken,
    body: input,
  });
}

/**
 * Demande le changement d'adresse e-mail (`POST /auth/requestEmailChange`).
 *
 * L'adresse actuelle **reste en place** : le backend range la nouvelle dans
 * `pendingEmail` et lui envoie un code à six chiffres. Rien ne bouge tant que
 * ce code n'est pas validé — une faute de frappe ne coûte donc qu'une seconde
 * demande, là où un remplacement immédiat aurait déplacé le compte vers une
 * boîte hors de portée.
 */
export async function requestEmailChange(
  input: { currentPassword: string; newEmail: string },
  accessToken: string,
): Promise<{ status: string }> {
  return apiFetch("/auth/requestEmailChange", statusResponseSchema, {
    method: "POST",
    accessToken,
    body: input,
  });
}

/**
 * Valide le code reçu sur l'adresse en attente
 * (`POST /auth/confirmEmailChange`).
 *
 * Renvoie un `AuthStatusEnum` : `"Yes"` en cas de succès, `"TimeOut"` au-delà
 * de cinq minutes, `"None"` s'il n'y a aucune demande en cours.
 */
export async function confirmEmailChange(
  code: string,
  accessToken: string,
): Promise<{ status: string }> {
  return apiFetch("/auth/confirmEmailChange", statusResponseSchema, {
    method: "POST",
    accessToken,
    body: { token: code },
  });
}

/** Abandonne un changement d'adresse en cours. */
export async function cancelEmailChange(
  accessToken: string,
): Promise<{ status: string }> {
  return apiFetch("/auth/cancelEmailChange", statusResponseSchema, {
    method: "POST",
    accessToken,
  });
}

/**
 * Remplace la photo de profil (`POST /auth/profile/image`).
 *
 * Le champ s'appelle `image` — et non `file` comme sur `PATCH /user` : les deux
 * routes montent des `FileInterceptor` de noms différents, et un champ mal
 * nommé serait ignoré en silence. Types acceptés : JPEG, PNG, ICO. **Pas de
 * WebP** (voir `ACCEPTED_AVATAR_TYPES`).
 */
export async function uploadMyAvatar(
  file: File,
  accessToken: string,
): Promise<void> {
  const formData = new FormData();
  formData.append("image", file);

  await apiFetch("/auth/profile/image", z.unknown(), {
    method: "POST",
    accessToken,
    formData,
  });
}

/**
 * Retire la photo de profil.
 *
 * `POST` et non `DELETE` : le backend expose cette suppression en
 * `@Post("profile/image/delete")`.
 */
export async function deleteMyAvatar(accessToken: string): Promise<void> {
  await apiFetch("/auth/profile/image/delete", z.unknown(), {
    method: "POST",
    accessToken,
  });
}
