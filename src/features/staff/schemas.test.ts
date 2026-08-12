import { describe, expect, it } from "vitest";

import { UserRole } from "@/constants/roles";
import {
  parseStaffFilters,
  staffFormSchema,
  staffMemberSchema,
  toStaffMember,
} from "./schemas";

/** Ce que renvoie réellement `GET /user/getMyCompanyUsers` : l'entité TypeORM. */
const rawStaffEntity = {
  id: "u-9",
  userName: "kone",
  firstName: "Awa",
  lastName: "Koné",
  email: "awa@transport.example",
  phoneNumber: "+2250700000001",
  role: UserRole.COMPANY_AGENT,
  isActive: true,
  isBlocked: false,
  isEmailVerify: true,
  cniNumber: "CI-0099",
  lang: "fr",
  createAt: "2026-02-01T09:00:00.000Z",
  companySeat: { id: "s-2", name: "Agence Yopougon", isMain: false },
  permission: { id: 7, canCutTicket: true, canWithdrawFromSeatWallet: false },
  // Champs que le backend joint encore à l'entité.
  password: "$2b$10$hash-collaborateur",
  salt: "sel-collaborateur",
  firebaseId: "firebase-staff",
  notificationId: "expo-staff",
  walletAmount: 4200,
};

describe("staffMemberSchema", () => {
  it("valide l'entité renvoyée par le backend", () => {
    expect(staffMemberSchema.safeParse(rawStaffEntity).success).toBe(true);
  });

  it("accepte une entité sans agence ni permission", () => {
    const { companySeat: _seat, permission: _permission, ...bare } = rawStaffEntity;
    expect(staffMemberSchema.safeParse(bare).success).toBe(true);
  });
});

describe("toStaffMember", () => {
  const entity = staffMemberSchema.parse(rawStaffEntity);

  // Même exigence que `toSessionUser` : rien de sensible ne franchit la
  // frontière serveur, même si le backend a cessé de renvoyer le hash.
  it("n'expose aucun champ sensible au navigateur", () => {
    const member = toStaffMember(entity);
    const serialized = JSON.stringify(member);

    for (const secret of [
      "password",
      "salt",
      "firebaseId",
      "notificationId",
      "walletAmount",
    ]) {
      expect(member).not.toHaveProperty(secret);
    }

    expect(serialized).not.toContain("hash-collaborateur");
    expect(serialized).not.toContain("sel-collaborateur");
    expect(serialized).not.toContain("firebase-staff");
    expect(serialized).not.toContain("4200");
  });

  it("compose un nom affichable et projette l'agence", () => {
    const member = toStaffMember(entity);
    expect(member.fullName).toBe("Awa Koné");
    expect(member.seat).toEqual({ id: "s-2", name: "Agence Yopougon" });
  });

  it("normalise les absences", () => {
    const minimal = staffMemberSchema.parse({
      id: "u-10",
      userName: "sans-nom",
      firstName: "Ibrahim",
      role: UserRole.COMPANY_DRIVER,
    });
    const member = toStaffMember(minimal);

    expect(member).toMatchObject({
      lastName: null,
      fullName: "Ibrahim",
      email: null,
      seat: null,
      cniNumber: null,
      createdAt: null,
      isActive: false,
      isBlocked: false,
      lang: "fr",
    });
  });
});

describe("staffFormSchema", () => {
  const valid = {
    firstName: "Awa",
    lastName: "Koné",
    email: "awa@transport.example",
    phoneNumber: "+2250700000001",
    role: UserRole.COMPANY_AGENT,
    seatId: "",
    cniNumber: "",
    lang: "fr",
  };

  it("accepte un formulaire complet", () => {
    expect(staffFormSchema.safeParse(valid).success).toBe(true);
  });

  // Le backend valide avec `@IsPhoneNumber()` sans région : un numéro local
  // part et revient en 400 sans message exploitable.
  it("exige un numéro au format international", () => {
    expect(
      staffFormSchema.safeParse({ ...valid, phoneNumber: "0700000001" }).success,
    ).toBe(false);
    expect(
      staffFormSchema.safeParse({ ...valid, phoneNumber: "+2250700000001" }).success,
    ).toBe(true);
  });

  // Miroir de la liste blanche `CREATABLE_ROLES` du backend : un
  // `company_admin` ne peut pas se fabriquer un compte super_admin.
  it("refuse un rôle hors du personnel d'entreprise", () => {
    for (const role of [UserRole.SUPER_ADMIN, UserRole.COMPANY_ADMIN, UserRole.USER]) {
      expect(staffFormSchema.safeParse({ ...valid, role }).success).toBe(false);
    }
  });

  it("accepte les champs facultatifs vides", () => {
    const parsed = staffFormSchema.parse({ ...valid, seatId: "", cniNumber: "" });
    expect(parsed.seatId).toBe("");
    expect(parsed.cniNumber).toBe("");
  });
});

describe("parseStaffFilters", () => {
  it("est permissif par défaut", () => {
    expect(parseStaffFilters({})).toEqual({ role: null, status: "all" });
  });

  it("lit les filtres reconnus", () => {
    expect(
      parseStaffFilters({ role: UserRole.AGENCY_ADMIN, statut: "blocked" }),
    ).toEqual({
      role: UserRole.AGENCY_ADMIN,
      status: "blocked",
    });
  });

  it("ignore une valeur inconnue au lieu de la relayer au backend", () => {
    expect(
      parseStaffFilters({ role: "super_admin", statut: "n'importe quoi" }),
    ).toEqual({
      role: null,
      status: "all",
    });
  });
});
