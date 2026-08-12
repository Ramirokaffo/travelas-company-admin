import { describe, expect, it } from "vitest";

import { UserRole } from "@/constants/roles";
import { toSessionUser, userSchema } from "./user";

/**
 * Réponse réaliste de `GET /auth/profile` : le backend renvoie l'entité TypeORM
 * complète, champs sensibles compris. C'est précisément ce que la projection
 * doit filtrer.
 */
const rawBackendUser = {
  id: "u-1",
  userName: "kouassi",
  firstName: "Yao",
  lastName: "Kouassi",
  email: "yao@transport.example",
  phoneNumber: "+2250700000000",
  role: UserRole.COMPANY_ADMIN,
  profilImage: null,
  is2fAuthEnable: true,
  password: "$2b$10$hash-du-mot-de-passe",
  salt: "sel-de-hachage",
  firebaseId: "firebase-abc",
  notificationId: "expo-token-xyz",
  walletAmount: 125_000,
  company: {
    id: "c-1",
    name: "Transports Atlantique",
    logo: "https://cdn.example/logo.png",
    isActive: true,
  },
  companySeat: { id: "s-1", name: "Agence Plateau", isMain: true },
};

describe("userSchema", () => {
  it("valide une réponse backend complète", () => {
    expect(userSchema.safeParse(rawBackendUser).success).toBe(true);
  });

  it("refuse un rôle inconnu du miroir front", () => {
    const parsed = userSchema.safeParse({ ...rawBackendUser, role: "root" });
    expect(parsed.success).toBe(false);
  });

  it("refuse une réponse amputée de ses champs obligatoires", () => {
    const { id: _id, ...withoutId } = rawBackendUser;
    expect(userSchema.safeParse(withoutId).success).toBe(false);
  });
});

describe("toSessionUser", () => {
  const user = userSchema.parse(rawBackendUser);

  it("n'expose aucun champ sensible", () => {
    const session = toSessionUser(user);
    const serialized = JSON.stringify(session);

    for (const secret of [
      "password",
      "salt",
      "firebaseId",
      "notificationId",
      "walletAmount",
    ]) {
      expect(session).not.toHaveProperty(secret);
    }

    // Contrôle par la valeur : un champ renommé laisserait passer le test
    // précédent tout en fuitant le contenu.
    expect(serialized).not.toContain("hash-du-mot-de-passe");
    expect(serialized).not.toContain("sel-de-hachage");
    expect(serialized).not.toContain("firebase-abc");
    expect(serialized).not.toContain("expo-token-xyz");
  });

  it("projette exactement les champs attendus", () => {
    expect(Object.keys(toSessionUser(user)).sort()).toEqual([
      "company",
      "email",
      "firstName",
      "id",
      "is2fAuthEnable",
      "isEmailVerify",
      "lang",
      "lastName",
      "pendingEmail",
      "phoneNumber",
      "profilImage",
      "role",
      "seat",
      "userName",
    ]);
  });

  it("renomme `companySeat` en `seat` (vocabulaire du dashboard)", () => {
    expect(toSessionUser(user).seat).toEqual({
      id: "s-1",
      name: "Agence Plateau",
      isMain: true,
    });
  });

  it("normalise les absences en `null` plutôt qu'en `undefined`", () => {
    const minimal = userSchema.parse({
      id: "u-2",
      userName: "sans-entreprise",
      firstName: "Ama",
      role: UserRole.COMPANY_ADMIN,
    });
    const session = toSessionUser(minimal);

    expect(session.company).toBeNull();
    expect(session.seat).toBeNull();
    expect(session.lastName).toBeNull();
    expect(session.email).toBeNull();
    expect(session.pendingEmail).toBeNull();
    expect(session.lang).toBeNull();
    expect(session.is2fAuthEnable).toBe(false);
    // Absent de la réponse = adresse non prouvée : le doute joue contre la
    // vérification, jamais en sa faveur.
    expect(session.isEmailVerify).toBe(false);
  });
});
