import { describe, expect, it } from "vitest";

import {
  changePasswordFormSchema,
  checkAvatarImage,
  emailChangeCodeSchema,
  emailChangeFormSchema,
  profileFormSchema,
  isAcceptedAvatarType,
} from "./schemas";

/**
 * Les schémas du compte sont la seule barrière avant des routes qui touchent à
 * l'identité et à la sécurité. Les cas testés ici sont ceux dont l'échec ne se
 * verrait qu'à l'exécution, sous la forme d'une 400 sans message exploitable.
 */

const VALID_PROFILE = {
  firstName: "Awa",
  lastName: "Traoré",
  userName: "awa.traore",
  phoneNumber: "+237690000000",
};

describe("profileFormSchema", () => {
  it("accepte un profil complet", () => {
    expect(profileFormSchema.safeParse(VALID_PROFILE).success).toBe(true);
  });

  it("exige l'indicatif international sur le téléphone", () => {
    // `@IsPhoneNumber()` est utilisé sans région côté backend : un numéro
    // local part et revient en 400.
    const parsed = profileFormSchema.safeParse({
      ...VALID_PROFILE,
      phoneNumber: "690000000",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("validation.phoneInternational");
  });

  it("refuse un nom d'utilisateur avec des caractères interdits", () => {
    const parsed = profileFormSchema.safeParse({
      ...VALID_PROFILE,
      userName: "awa traoré",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("validation.usernameCharset");
  });

  it("n'expose aucun champ que le backend interdit sur son propre compte", () => {
    // `role`, `isBlocked`, `seatId` et `permission` sont dans les
    // `SELF_PROTECTED_FIELDS` du backend : leur présence ici produirait une
    // 400 systématique.
    const fields = Object.keys(profileFormSchema.shape);

    for (const forbidden of ["role", "isBlocked", "isActive", "seatId", "permission"]) {
      expect(fields).not.toContain(forbidden);
    }
    // L'adresse relève du parcours vérifié, pas de ce formulaire.
    expect(fields).not.toContain("email");
  });
});

describe("changePasswordFormSchema", () => {
  const base = {
    currentPassword: "AncienMotDePasse1!",
    newPassword: "NouveauMotDePasse1!",
    confirmPassword: "NouveauMotDePasse1!",
  };

  it("accepte un changement valide", () => {
    expect(changePasswordFormSchema.safeParse(base).success).toBe(true);
  });

  it("refuse une confirmation qui diverge", () => {
    const parsed = changePasswordFormSchema.safeParse({
      ...base,
      confirmPassword: "AutreMotDePasse1!",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("validation.passwordMismatch");
  });

  it("refuse un nouveau mot de passe identique à l'actuel", () => {
    // Le backend le refuse aussi ; le dire ici évite un aller-retour réseau.
    const parsed = changePasswordFormSchema.safeParse({
      ...base,
      newPassword: base.currentPassword,
      confirmPassword: base.currentPassword,
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("validation.passwordSameAsCurrent");
  });

  it("applique les règles de robustesse du dashboard, plus strictes que le backend", () => {
    // `ChangePasswordDto` se contente de six caractères ; ces comptes donnent
    // accès à des données financières.
    const parsed = changePasswordFormSchema.safeParse({
      ...base,
      newPassword: "court1!",
      confirmPassword: "court1!",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("emailChangeFormSchema", () => {
  it("exige le mot de passe en plus de la nouvelle adresse", () => {
    const parsed = emailChangeFormSchema.safeParse({
      newEmail: "nouvelle@exemple.test",
      currentPassword: "",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("validation.passwordRequired");
  });

  it("refuse une adresse invalide", () => {
    const parsed = emailChangeFormSchema.safeParse({
      newEmail: "pas-une-adresse",
      currentPassword: "MotDePasse1!",
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("validation.emailInvalid");
  });
});

describe("emailChangeCodeSchema", () => {
  it("accepte le code à six chiffres du backend", () => {
    expect(emailChangeCodeSchema.safeParse({ code: "123456" }).success).toBe(true);
  });

  it("refuse un code non numérique", () => {
    const parsed = emailChangeCodeSchema.safeParse({ code: "12a456" });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("validation.codeInvalid");
  });

  it("refuse une longueur que le DTO backend rejetterait", () => {
    // `ConfirmEmailChangeDto` impose exactement six chiffres : laisser passer
    // « 1234 » ne produirait qu'un message backend non traduisible.
    expect(emailChangeCodeSchema.safeParse({ code: "1234" }).success).toBe(false);
  });
});

describe("checkAvatarImage", () => {
  const file = (type: string, size: number) =>
    new File([new Uint8Array(size)], "photo", { type });

  it("traite un champ vide comme une absence, pas comme une erreur", () => {
    expect(checkAvatarImage(file("image/png", 0))).toEqual({ ok: true, file: null });
    expect(checkAvatarImage(null)).toEqual({ ok: true, file: null });
  });

  it("refuse le WebP, que la route de photo de profil n'accepte pas", () => {
    // `POST /auth/profile/image` valide avec /^image\/(jpeg|jpg|ico|png)$/i :
    // un WebP reviendrait en 400 après un téléversement complet.
    expect(isAcceptedAvatarType(file("image/webp", 10))).toBe(false);
    expect(checkAvatarImage(file("image/webp", 10))).toEqual({
      ok: false,
      message: "settings.actions.imageType",
    });
  });

  it("accepte un JPEG dans les limites", () => {
    expect(checkAvatarImage(file("image/jpeg", 1024))).toEqual({
      ok: true,
      file: expect.any(File),
    });
  });

  it("refuse une image au-delà du plafond", () => {
    expect(checkAvatarImage(file("image/png", 3 * 1024 * 1024))).toEqual({
      ok: false,
      message: "settings.actions.imageTooLarge",
    });
  });
});
