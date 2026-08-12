"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";

import { ROUTES } from "@/constants/routes";
import { ApiError, toUserMessage } from "@/lib/api/errors";
import { getAuthorizedToken, requireCompanySession } from "@/lib/auth/session";

import { resolveIssue } from "./api";
import { resolveIssueSchema } from "./schemas";

/**
 * Server Actions du domaine « incidents ».
 *
 * Comme toute Server Action, chacune est un point d'entrée HTTP indépendant :
 * le layout `(dashboard)` ne la protège pas, d'où `requireCompanySession()` en
 * première ligne (règle 4 de CLAUDE.md).
 *
 * Le cloisonnement réel reste backend : `IssueService.resolve()` recharge le
 * signalement et vérifie `assertSameCompany()` avant toute écriture.
 */

export type ActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export async function resolveIssueAction(input: unknown): Promise<ActionResult> {
  await requireCompanySession();

  const parsed = resolveIssueSchema.safeParse(input);
  if (!parsed.success) {
    const field = parsed.error.issues[0];
    return {
      ok: false,
      message: "incidents.actions.invalidFields",
      ...(typeof field?.path[0] === "string"
        ? { fieldErrors: { [field.path[0]]: field.message } }
        : {}),
    };
  }

  try {
    const token = await getAuthorizedToken();
    await resolveIssue(parsed.data, token);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.isForbidden) {
        return { ok: false, message: "incidents.actions.forbidden" };
      }
      return { ok: false, message: toUserMessage(error, await getTranslations()) };
    }
    return { ok: false, message: "errors.unexpected" };
  }

  revalidatePath(ROUTES.incidents);
  revalidatePath(ROUTES.dashboard);
  // La fiche d'agence affiche les derniers signalements et compte ceux qui
  // restent ouverts : sans cette ligne, traiter un incident depuis `/seats/[id]`
  // n'y changerait rien avant la prochaine navigation complète.
  revalidatePath(ROUTES.seats, "layout");

  return {
    ok: true,
    message: parsed.data.isResolved
      ? "incidents.actions.resolved"
      : "incidents.actions.reopened",
  };
}
