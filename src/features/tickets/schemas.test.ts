import { describe, expect, it } from "vitest";

import {
  TICKET_FILTER_PARAM,
  parseTicketFilters,
  ticketEntitySchema,
  toTicket,
} from "./schemas";

const ENTITY = ticketEntitySchema.parse({
  id: "ticket-1",
  amount: "7500",
  paidAmount: "7875",
  placeCount: 2,
  isPaid: true,
  isReservation: false,
  companyFee: "150",
  platformFee: "225",
  createAt: "2026-08-12T08:00:00.000Z",
  user: {
    id: "u-1",
    firstName: "Awa",
    lastName: "Traoré",
    phoneNumber: "+2250700000000",
    password: "$2b$10$hash",
    salt: "sel",
    walletAmount: 42000,
  },
  passengers: [{ isValid: true }, { isValid: false }],
  companyJourney: {
    id: "journey-1",
    travelDate: "2026-08-20T06:30:00.000Z",
    seat: { id: "seat-1", name: "Adjamé" },
    agencyFrom: { id: 1, name: "Gare Nord", city: { id: 10, name: "Abidjan" } },
    agencyTo: { id: 2, name: "Gare Sud", city: { id: 11, name: "Yamoussoukro" } },
  },
});

describe("toTicket", () => {
  it("projette le billet, son trajet et son agence", () => {
    const ticket = toTicket(ENTITY);

    expect(ticket.from).toBe("Abidjan");
    expect(ticket.to).toBe("Yamoussoukro");
    expect(ticket.seat).toEqual({ id: "seat-1", name: "Adjamé" });
    expect(ticket.travelDate).toBe("2026-08-20T06:30:00.000Z");
  });

  /**
   * Règle 7 de CLAUDE.md : jamais d'entité backend brute côté client. L'entité
   * `user` porte `password`, `salt` et le solde du portefeuille.
   */
  it("ne laisse passer que le nom et le téléphone de l'acheteur", () => {
    const ticket = toTicket(ENTITY);
    const serialized = JSON.stringify(ticket);

    expect(ticket.buyer).toEqual({
      name: "Awa Traoré",
      phoneNumber: "+2250700000000",
    });
    expect(serialized).not.toContain("hash");
    expect(serialized).not.toContain("sel");
    expect(serialized).not.toContain("42000");
  });

  // `amount` ignore les frais, `paidAmount` non : les deux se ressemblent assez
  // pour qu'une confusion passe inaperçue jusqu'au rapprochement comptable.
  it("distingue le prix annoncé du montant réellement payé", () => {
    const ticket = toTicket(ENTITY);

    expect(ticket.amount).toBe(7500);
    expect(ticket.paidAmount).toBe(7875);
    expect(ticket.platformFee).toBe(225);
  });

  it("compte les passagers déjà validés à l'embarquement", () => {
    expect(toTicket(ENTITY).validatedCount).toBe(1);
  });

  it("accepte un billet dont les relations ne sont pas chargées", () => {
    const ticket = toTicket(
      ticketEntitySchema.parse({
        ...ENTITY,
        user: null,
        passengers: null,
        companyJourney: null,
      }),
    );

    expect(ticket.buyer).toBeNull();
    expect(ticket.seat).toBeNull();
    expect(ticket.validatedCount).toBe(0);
  });
});

describe("parseTicketFilters", () => {
  it("n'applique aucun filtre par défaut", () => {
    expect(parseTicketFilters({})).toEqual({
      seatId: null,
      payment: "all",
      kind: "all",
    });
  });

  it("lit les filtres connus et ignore le reste", () => {
    expect(
      parseTicketFilters({
        [TICKET_FILTER_PARAM.seat]: "seat-1",
        [TICKET_FILTER_PARAM.payment]: "paid",
        [TICKET_FILTER_PARAM.kind]: "offert",
      }),
    ).toEqual({ seatId: "seat-1", payment: "paid", kind: "all" });
  });
});
