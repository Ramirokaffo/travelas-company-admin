import type { SessionUser } from "@/types/user";

/**
 * Portée d'écriture d'un chef d'entreprise sur ses agences.
 *
 * Le besoin métier (§2 de PLAN.md) : observer **toutes** ses agences, mais
 * n'agir sur le terrain que dans celle à laquelle il est rattaché
 * (`user.companySeat`). Un chef d'entreprise sans rattachement pilote depuis le
 * siège : il voit tout, il ne saisit rien.
 *
 * ⚠️ **Ce helper ne protège rien.** Il pilote l'affichage — masquer un bouton
 * n'est pas un contrôle d'accès (règle 8 de CLAUDE.md). L'autorisation réelle
 * appartient au backend, qui vérifie l'appartenance de la ressource à
 * l'entreprise via `assertSameCompany()`.
 *
 * Distinction importante : la **configuration** d'une agence (création, nom,
 * activation, suppression) reste une opération d'entreprise, autorisée sur
 * toutes les agences du locataire — c'est l'objet de la page `/seats`. Ce que
 * cadre `canWriteOnSeat`, c'est l'**exploitation** quotidienne : contacts,
 * saisies, traitement d'incidents.
 */
export function canWriteOnSeat(session: SessionUser, seatId: string): boolean {
  if (!session.seat) return false;
  return session.seat.id === seatId;
}
