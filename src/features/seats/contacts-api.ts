import "server-only";

import { z } from "zod";

import { apiFetch } from "@/lib/api/server-api";

import {
  seatContactSchema,
  toSeatContact,
  type SeatContact,
  type SeatContactFormValues,
} from "./schemas";

/**
 * Contacts d'une agence (`SeatContactEntity`) — SERVEUR UNIQUEMENT.
 *
 * Chantier G de PLAN.md, livré avec la fiche d'agence. Avant ce correctif, un
 * `company_admin` n'avait accès qu'aux routes `mySeat`, qui lisaient
 * `user.companySeat.id` **sans vérifier son existence** : un chef d'entreprise
 * non rattaché à une agence recevait une 500 (`TypeError`), et celui qui l'était
 * ne pouvait gérer que sa propre agence. `bySeat/:seatId` lui est désormais
 * ouvert, cadré par `assertSameCompany()`.
 */

const contactListSchema = z.array(seatContactSchema);

export async function listSeatContacts(
  seatId: string,
  accessToken: string,
): Promise<SeatContact[]> {
  const contacts = await apiFetch(
    `/seat-contact/bySeat/${encodeURIComponent(seatId)}`,
    contactListSchema,
    { accessToken },
  );

  return contacts.map(toSeatContact);
}

export async function createSeatContact(
  values: SeatContactFormValues,
  accessToken: string,
): Promise<SeatContact> {
  const contact = await apiFetch(
    `/seat-contact/${encodeURIComponent(values.seatId)}`,
    seatContactSchema,
    {
      method: "POST",
      accessToken,
      // `label` est facultatif côté DTO : une chaîne vide y serait stockée
      // telle quelle, alors que l'absence laisse la colonne à `null`.
      body: {
        phoneNumber: values.phoneNumber,
        ...(values.label ? { label: values.label } : {}),
      },
    },
  );

  return toSeatContact(contact);
}

/** Suppression logique (`softRemove` côté backend). */
export async function deleteSeatContact(
  id: string,
  accessToken: string,
): Promise<void> {
  await apiFetch(`/seat-contact/${encodeURIComponent(id)}`, z.unknown(), {
    method: "DELETE",
    accessToken,
  });
}
