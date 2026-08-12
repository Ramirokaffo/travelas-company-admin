import { describe, expect, it } from "vitest";

import { MAX_IMAGE_BYTES, checkCompanyImage, companyFormSchema } from "./schemas";

/** Fabrique un `File` d'un poids et d'un type donnés, sans rien lire du disque. */
function fakeImage(type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], "logo", { type });
}

describe("companyFormSchema", () => {
  it("accepte un nom d'entreprise et retire les espaces", () => {
    expect(companyFormSchema.parse({ name: "  Transports Atlantique " }).name).toBe(
      "Transports Atlantique",
    );
  });

  it.each([
    ["", "validation.companyNameRequired"],
    ["T", "validation.companyNameRequired"],
    ["T".repeat(101), "validation.max100"],
  ])("refuse « %s »", (name, expected) => {
    const result = companyFormSchema.safeParse({ name });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(expected);
    }
  });
});

describe("checkCompanyImage", () => {
  // Le champ vide d'un formulaire multipart arrive sous la forme d'un fichier
  // de taille nulle : c'est une absence, pas une erreur.
  it("traite un champ vide comme une absence de fichier", () => {
    expect(checkCompanyImage(fakeImage("application/octet-stream", 0))).toEqual({
      ok: true,
      file: null,
    });
    expect(checkCompanyImage(null)).toEqual({ ok: true, file: null });
    expect(checkCompanyImage("")).toEqual({ ok: true, file: null });
  });

  it.each(["image/png", "image/jpeg", "image/webp"])("accepte un %s", (type) => {
    const result = checkCompanyImage(fakeImage(type, 1024));
    expect(result.ok).toBe(true);
  });

  it("refuse un type non accepté par le backend", () => {
    const result = checkCompanyImage(fakeImage("application/pdf", 1024));
    expect(result).toEqual({ ok: false, message: "onboarding.actions.imageType" });
  });

  it("refuse une image au-delà de la limite du backend", () => {
    const result = checkCompanyImage(fakeImage("image/png", MAX_IMAGE_BYTES + 1));
    expect(result).toEqual({ ok: false, message: "onboarding.actions.imageTooLarge" });
  });

  it("accepte une image pile à la limite", () => {
    expect(checkCompanyImage(fakeImage("image/png", MAX_IMAGE_BYTES)).ok).toBe(true);
  });
});
