import { describe, expect, it } from "vitest";

import { UserRole } from "@/constants/roles";
import type { SessionUser } from "@/types/user";

import { canWriteOnSeat } from "./scope";

function session(seat: SessionUser["seat"]): SessionUser {
  return {
    id: "user-1",
    userName: "chef",
    firstName: "Awa",
    lastName: "Traoré",
    email: "awa@exemple.test",
    pendingEmail: null,
    isEmailVerify: true,
    phoneNumber: null,
    role: UserRole.COMPANY_ADMIN,
    profilImage: null,
    lang: "fr",
    is2fAuthEnable: false,
    company: {
      id: "company-1",
      name: "Travelas Transport",
      logo: null,
      isActive: true,
    },
    seat,
  };
}

describe("canWriteOnSeat", () => {
  it("autorise l'écriture sur l'agence de rattachement", () => {
    const user = session({ id: "seat-1", name: "Adjamé", isMain: true });
    expect(canWriteOnSeat(user, "seat-1")).toBe(true);
  });

  it("refuse l'écriture sur une autre agence de la même entreprise", () => {
    const user = session({ id: "seat-1", name: "Adjamé", isMain: true });
    expect(canWriteOnSeat(user, "seat-2")).toBe(false);
  });

  /**
   * Un chef d'entreprise sans rattachement pilote depuis le siège : il voit
   * tout, il ne saisit rien. Sans ce cas, l'absence de `seat` aurait pu être
   * lue comme « aucune restriction ».
   */
  it("refuse l'écriture partout lorsqu'aucune agence n'est rattachée", () => {
    const user = session(null);
    expect(canWriteOnSeat(user, "seat-1")).toBe(false);
    expect(canWriteOnSeat(user, "")).toBe(false);
  });

  it("ne se laisse pas berner par un identifiant vide", () => {
    const user = session({ id: "seat-1", name: null, isMain: false });
    expect(canWriteOnSeat(user, "")).toBe(false);
  });
});
