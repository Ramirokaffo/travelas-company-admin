"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { ApiError, toUserMessage } from "@/lib/api/errors";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

import { createSeat, deleteSeat, setSeatActive, updateSeat } from "./api";
import { createSeatContact, deleteSeatContact } from "./contacts-api";
import {
  createSeatSchema,
  seatContactFormSchema,
  seatContactIdSchema,
  seatIdSchema,
  toggleSeatActiveSchema,
  updateSeatSchema,
} from "./schemas";

/**
 * Server Actions du domaine « agences ».
 *
 * Chaque action est un **point d'entrée HTTP indépendant** : le layout
 * `(dashboard)` ne la protège pas. D'où l'appel systématique à
 * `requireCompanySession()` en première ligne — règle 4 de CLAUDE.md.
 *
 * Le cloisonnement réel reste backend : `assertSeatBelongsToUser()` charge
 * l'agence et refuse (403) tout identifiant appartenant à une autre entreprise,
 * **avant** toute écriture. Rien ici ne peut le remplacer.
 *
 * Les messages renvoyés sont des **clés de catalogue**, traduites à l'affichage
 * par `useTranslatedMessage()` : une action peut être rejouée par un client
 * d'une autre langue que celle du serveur.
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Traduit une erreur backend en résultat affichable. */
async function toActionError(error: unknown): Promise<ActionResult> {
  if (error instanceof ApiError) {
    if (error.isForbidden) {
      return { ok: false, message: "seats.actions.forbidden" };
    }

    // `SeatService.create()` refuse une gare inconnue par un message figé —
    // « Target Seat not Found », qui désigne en réalité l'`AgencyEntity`.
    if (error.message.includes("Target Seat not Found")) {
      return {
        ok: false,
        message: "seats.actions.unknownAgency",
        fieldErrors: { agencyId: "seats.actions.unknownAgency" },
      };
    }

    // Message venu du backend : non traduisible, transmis tel quel.
    return { ok: false, message: toUserMessage(error, await getTranslations()) };
  }

  return { ok: false, message: "errors.unexpected" };
}

/** Transforme les erreurs Zod en messages par champ, pour le formulaire. */
function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}

export async function createSeatAction(input: unknown): Promise<ActionResult> {
  await requireCompanySession();

  const parsed = createSeatSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "seats.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const token = await getAuthorizedToken();
    await createSeat(parsed.data, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.seats);
  // Le sélecteur d'affectation de `/staff` lit la même liste d'agences.
  revalidatePath(ROUTES.staff);
  return { ok: true, message: "seats.actions.created" };
}

export async function updateSeatAction(input: unknown): Promise<ActionResult> {
  await requireCompanySession();

  const parsed = updateSeatSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "seats.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const { id, ...values } = parsed.data;

  try {
    const token = await getAuthorizedToken();
    await updateSeat(id, values, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.seats);
  revalidatePath(ROUTES.staff);
  return { ok: true, message: "seats.actions.updated" };
}

export async function toggleSeatActiveAction(input: unknown): Promise<ActionResult> {
  const session = await requireCompanySession();

  const parsed = toggleSeatActiveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "seats.actions.invalidRequest" };
  }

  // Garde-fou d'ergonomie : désactiver sa propre agence de rattachement coupe
  // les droits d'écriture du chef d'entreprise sur celle-ci (`canWriteOnSeat`).
  if (!parsed.data.isActive && parsed.data.id === session.seat?.id) {
    return { ok: false, message: "seats.actions.cannotDeactivateOwn" };
  }

  try {
    const token = await getAuthorizedToken();
    await setSeatActive(parsed.data.id, parsed.data.isActive, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.seats);
  revalidatePath(ROUTES.staff);
  return {
    ok: true,
    message: parsed.data.isActive
      ? "seats.actions.activated"
      : "seats.actions.deactivated",
  };
}

export async function deleteSeatAction(input: unknown): Promise<ActionResult> {
  const session = await requireCompanySession();

  const parsed = seatIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "seats.actions.invalidRequest" };
  }

  if (parsed.data.id === session.seat?.id) {
    return { ok: false, message: "seats.actions.cannotDeleteOwn" };
  }

  try {
    const token = await getAuthorizedToken();
    await deleteSeat(parsed.data.id, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.seats);
  revalidatePath(ROUTES.staff);
  return { ok: true, message: "seats.actions.deleted" };
}

/* -------------------------------------------------------------------------- */
/* Contacts d'agence                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Ajoute un contact à une agence.
 *
 * `canWriteOnSeat()` n'est **pas** appliqué ici : les contacts sont une donnée
 * de configuration d'entreprise, que le backend autorise sur toutes les agences
 * du locataire (`assertSameCompany`). La restriction « seulement mon agence » du
 * §2 de PLAN.md vise l'exploitation quotidienne, pas l'annuaire.
 */
export async function createSeatContactAction(input: unknown): Promise<ActionResult> {
  await requireCompanySession();

  const parsed = seatContactFormSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "seats.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const token = await getAuthorizedToken();
    await createSeatContact(parsed.data, token);
  } catch (error) {
    // Le numéro est `UNIQUE` en base : c'est l'échec le plus probable, et il se
    // corrige dans le champ plutôt que dans un message général.
    if (
      error instanceof ApiError &&
      error.message.includes("phone number already exists")
    ) {
      return {
        ok: false,
        message: "seats.contacts.duplicate",
        fieldErrors: { phoneNumber: "seats.contacts.duplicate" },
      };
    }
    return await toActionError(error);
  }

  revalidatePath(`${ROUTES.seats}/${parsed.data.seatId}`);
  return { ok: true, message: "seats.contacts.created" };
}

export async function deleteSeatContactAction(input: unknown): Promise<ActionResult> {
  await requireCompanySession();

  const parsed = seatContactIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "seats.actions.invalidRequest" };
  }

  try {
    const token = await getAuthorizedToken();
    await deleteSeatContact(parsed.data.id, token);
  } catch (error) {
    return await toActionError(error);
  }

  // Le chemin exact n'est pas connu ici (l'action ne reçoit que l'identifiant
  // du contact) : on revalide la section entière.
  revalidatePath(ROUTES.seats, "layout");
  return { ok: true, message: "seats.contacts.deleted" };
}
