"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { ApiError, toUserMessage } from "@/lib/api/errors";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

import {
  createStaffMember,
  deleteStaffMember,
  setStaffBlocked,
  updateStaffMember,
} from "./api";
import {
  createStaffSchema,
  staffIdSchema,
  toggleStaffBlockSchema,
  updateStaffSchema,
} from "./schemas";

/**
 * Server Actions du domaine « personnel ».
 *
 * Chaque action est un **point d'entrée HTTP indépendant** : le layout
 * `(dashboard)` ne la protège pas. D'où l'appel systématique à
 * `requireCompanySession()` en première ligne — c'est la règle 4 de CLAUDE.md,
 * et l'oubli le plus coûteux possible ici.
 *
 * Les entrées sont revalidées côté serveur même si le formulaire les a déjà
 * validées : une Server Action s'invoque très bien sans passer par le
 * formulaire.
 *
 * Les messages renvoyés sont des **clés de catalogue** (`staff.actions.created`,
 * `validation.emailInvalid`), traduites par l'appelant via
 * `useTranslatedMessage()`. Une action peut être rejouée par un autre client
 * que celui qui l'a déclenchée : figer du texte dans la langue du serveur
 * l'afficherait dans la mauvaise langue. Seuls les messages venus du backend,
 * qui ne sont pas traduisibles, traversent tels quels.
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/** Codes métier renvoyés par `UserService` dans le corps d'une 400. */
const DUPLICATE_MESSAGES: Record<string, { field: string; message: string }> = {
  "duplicate email": {
    field: "email",
    message: "staff.actions.duplicateEmail",
  },
  "duplicate phone number": {
    field: "phoneNumber",
    message: "staff.actions.duplicatePhone",
  },
  "duplicate username": {
    field: "firstName",
    message: "staff.actions.duplicateUsername",
  },
};

/**
 * Traduit une erreur backend en résultat affichable.
 *
 * Le backend signale les doublons par `BadRequestException({ status })` : le
 * code métier arrive donc dans le corps, pas dans `message`.
 */
async function toActionError(error: unknown): Promise<ActionResult> {
  if (error instanceof ApiError) {
    const details = error.details;
    const status =
      details && typeof details === "object" && "status" in details
        ? String((details as { status: unknown }).status)
        : undefined;

    const duplicate = status ? DUPLICATE_MESSAGES[status] : undefined;
    if (duplicate) {
      return {
        ok: false,
        message: duplicate.message,
        fieldErrors: { [duplicate.field]: duplicate.message },
      };
    }

    if (error.isForbidden) {
      return { ok: false, message: "staff.actions.forbidden" };
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

export async function createStaffAction(input: unknown): Promise<ActionResult> {
  await requireCompanySession();

  const parsed = createStaffSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "staff.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  try {
    const token = await getAuthorizedToken();
    await createStaffMember(parsed.data, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.staff);
  return { ok: true, message: "staff.actions.created" };
}

export async function updateStaffAction(input: unknown): Promise<ActionResult> {
  await requireCompanySession();

  const parsed = updateStaffSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "staff.actions.invalidFields",
      fieldErrors: toFieldErrors(parsed.error.issues),
    };
  }

  const { id, ...values } = parsed.data;

  try {
    const token = await getAuthorizedToken();
    // Le cloisonnement réel est backend : `assertSameCompany()` refuse un
    // identifiant appartenant à une autre entreprise.
    await updateStaffMember(id, values, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.staff);
  return { ok: true, message: "staff.actions.updated" };
}

export async function toggleStaffBlockAction(input: unknown): Promise<ActionResult> {
  const session = await requireCompanySession();

  const parsed = toggleStaffBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "staff.actions.invalidRequest" };
  }

  // Garde-fou d'ergonomie : se bloquer soi-même coupe l'accès au dashboard.
  // Le backend l'interdit déjà via `SELF_PROTECTED_FIELDS`.
  if (parsed.data.id === session.id) {
    return { ok: false, message: "staff.actions.cannotBlockSelf" };
  }

  try {
    const token = await getAuthorizedToken();
    await setStaffBlocked(parsed.data.id, parsed.data.isBlocked, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.staff);
  return {
    ok: true,
    message: parsed.data.isBlocked
      ? "staff.actions.blocked"
      : "staff.actions.unblocked",
  };
}

export async function deleteStaffAction(input: unknown): Promise<ActionResult> {
  const session = await requireCompanySession();

  const parsed = staffIdSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "staff.actions.invalidRequest" };
  }

  if (parsed.data.id === session.id) {
    return { ok: false, message: "staff.actions.cannotDeleteSelf" };
  }

  try {
    const token = await getAuthorizedToken();
    await deleteStaffMember(parsed.data.id, token);
  } catch (error) {
    return await toActionError(error);
  }

  revalidatePath(ROUTES.staff);
  return { ok: true, message: "staff.actions.deleted" };
}
