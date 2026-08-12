import { describe, expect, it } from "vitest";

import {
  PASSWORD_RULES,
  emailCodeSchema,
  registerSchema,
  strongPasswordSchema,
} from "./schemas";

/**
 * Ces schémas gardent la porte d'entrée de l'application : ils valident le
 * formulaire d'inscription *et* le route handler. Les cas testés sont ceux où
 * un écart avec le backend coûte cher — un numéro sans indicatif produit une
 * 400 illisible, un mot de passe faible ouvre un compte à données financières.
 */

const VALID = {
  firstName: "Yao",
  lastName: "Kouassi",
  userName: "yao.kouassi",
  email: "chef@transport.example",
  phoneNumber: "+2250700000000",
  password: "Transport-2026!",
  confirmPassword: "Transport-2026!",
};

/** Première clé d'erreur signalée pour un champ donné. */
function issueFor(input: Record<string, unknown>, field: string): string | undefined {
  const result = registerSchema.safeParse(input);
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path[0] === field)?.message;
}

describe("registerSchema", () => {
  it("accepte une inscription complète", () => {
    expect(registerSchema.safeParse(VALID).success).toBe(true);
  });

  // `@IsPhoneNumber()` est utilisé sans région côté backend : un numéro local
  // part en 400, sans message exploitable pour l'utilisateur.
  it.each(["0700000000", "00225070000", "+0700000000"])(
    "refuse le numéro « %s », faute d'indicatif international",
    (phoneNumber) => {
      expect(issueFor({ ...VALID, phoneNumber }, "phoneNumber")).toBe(
        "validation.phoneInternational",
      );
    },
  );

  it("accepte un indicatif international", () => {
    expect(issueFor({ ...VALID, phoneNumber: "+33612345678" }, "phoneNumber")).toBe(
      undefined,
    );
  });

  it("signale la confirmation, pas le mot de passe, quand les deux diffèrent", () => {
    const input = { ...VALID, confirmPassword: "Transport-2027!" };

    expect(issueFor(input, "confirmPassword")).toBe("validation.passwordMismatch");
    expect(issueFor(input, "password")).toBe(undefined);
  });

  it.each([
    ["Transp-26!", "validation.passwordMin12"],
    ["transport-2026!", "validation.passwordUppercase"],
    ["TRANSPORT-2026!", "validation.passwordLowercase"],
    ["Transport-Ivoire!", "validation.passwordDigit"],
    ["Transport20261234", "validation.passwordSpecial"],
  ])("refuse le mot de passe « %s »", (password, expected) => {
    const input = { ...VALID, password, confirmPassword: password };
    expect(issueFor(input, "password")).toBe(expected);
  });

  it("refuse un identifiant contenant un espace ou un accent", () => {
    expect(issueFor({ ...VALID, userName: "yao kouassi" }, "userName")).toBe(
      "validation.usernameCharset",
    );
    expect(issueFor({ ...VALID, userName: "yaô" }, "userName")).toBe(
      "validation.usernameCharset",
    );
  });

  it("retire les espaces autour des champs texte", () => {
    const parsed = registerSchema.parse({ ...VALID, firstName: "  Yao  " });
    expect(parsed.firstName).toBe("Yao");
  });
});

describe("PASSWORD_RULES", () => {
  // La liste de contrôle affichée doit dire la vérité : une règle cochée alors
  // que le schéma refuse encore serait pire que pas de liste du tout.
  it("est satisfaite exactement quand le schéma accepte le mot de passe", () => {
    const candidates = [
      "",
      "court",
      "transport-2026!",
      "TRANSPORT-2026!",
      "Transport-Ivoire!",
      "Transport20261234",
      "Transport-2026!",
    ];

    for (const candidate of candidates) {
      const allRulesPass = PASSWORD_RULES.every((rule) => rule.test(candidate));
      expect(strongPasswordSchema.safeParse(candidate).success, candidate).toBe(
        allRulesPass,
      );
    }
  });
});

describe("emailCodeSchema", () => {
  it("accepte le code à six chiffres du backend", () => {
    expect(emailCodeSchema.safeParse({ code: "100420" }).success).toBe(true);
  });

  it("tolère les espaces recopiés depuis l'e-mail", () => {
    expect(emailCodeSchema.parse({ code: " 100420 " }).code).toBe("100420");
  });

  it.each(["abcdef", "12", "1004201234", ""])("refuse « %s »", (code) => {
    expect(emailCodeSchema.safeParse({ code }).success).toBe(false);
  });
});
