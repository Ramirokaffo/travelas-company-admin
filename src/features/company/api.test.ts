import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompanySettingsValues } from "./schemas";

/**
 * `PATCH /company/:id` monte un `FileFieldsInterceptor` : le corps est du
 * **multipart**, pas du JSON. Conséquence sur les booléens — `UpdateCompanyDto`
 * les valide en `@IsBooleanString()`, il faut donc écrire `"true"` / `"false"`.
 */
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/server-api", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

const { getCompanyProfile, updateCompany } = await import("./api");

function lastCall() {
  return apiFetchMock.mock.calls.at(-1);
}

function lastFormData(): FormData {
  return lastCall()?.[2]?.formData as FormData;
}

const VALUES: CompanySettingsValues = {
  name: "Travelas Transport",
  allowedAction: "both",
  allowSeatNumberBook: true,
  allowIssuesReport: false,
  is2fAuthEnable: false,
};

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ id: "company-1", name: "Travelas Transport" });
});

describe("getCompanyProfile", () => {
  it("encode l'identifiant dans le chemin", async () => {
    await getCompanyProfile("a/b", "token");
    expect(lastCall()?.[0]).toBe("/company/a%2Fb");
  });

  it("comble les champs absents par des valeurs sûres", async () => {
    const profile = await getCompanyProfile("company-1", "token");

    expect(profile.isActive).toBe(false);
    expect(profile.ratingCount).toBe(0);
    // `allowedAction` absent : le paiement immédiat est le comportement par
    // défaut du backend (`TicketAllowedAction.PAY`).
    expect(profile.allowedAction).toBe("pay");
  });

  it("refuse une action de billet inconnue", async () => {
    apiFetchMock.mockResolvedValue({ id: "company-1", allowedAction: "troc" });
    expect((await getCompanyProfile("company-1", "token")).allowedAction).toBe("pay");
  });
});

describe("updateCompany", () => {
  it("envoie du multipart, pas du JSON", async () => {
    await updateCompany("company-1", VALUES, { logo: null, banner: null }, "token");

    expect(lastCall()?.[2]?.method).toBe("PATCH");
    expect(lastCall()?.[2]?.body).toBeUndefined();
    expect(lastFormData()).toBeInstanceOf(FormData);
  });

  it("écrit les booléens en chaînes, comme l'exige @IsBooleanString", async () => {
    await updateCompany("company-1", VALUES, { logo: null, banner: null }, "token");

    const formData = lastFormData();
    expect(formData.get("allowSeatNumberBook")).toBe("true");
    expect(formData.get("allowIssuesReport")).toBe("false");
    expect(formData.get("is2fAuthEnable")).toBe("false");
  });

  /**
   * `requiredFee` et `feePercent` appartiennent à `AdminUpdateCompanyDto` :
   * les envoyer ferait échouer la requête en 400 (`forbidNonWhitelisted`) —
   * ce qui est la bonne réponse, le taux de la plateforme n'étant pas
   * négociable depuis ce dashboard.
   */
  it("n'envoie aucun champ réservé au super_admin", async () => {
    await updateCompany("company-1", VALUES, { logo: null, banner: null }, "token");

    const formData = lastFormData();
    expect(formData.get("requiredFee")).toBeNull();
    expect(formData.get("feePercent")).toBeNull();
    expect(formData.get("isActive")).toBeNull();
  });

  // Un champ absent laisse l'image en place ; un champ vide la remplacerait.
  it("omet les images non modifiées", async () => {
    await updateCompany("company-1", VALUES, { logo: null, banner: null }, "token");

    const formData = lastFormData();
    expect(formData.get("logo")).toBeNull();
    expect(formData.get("banner")).toBeNull();
  });

  it("transmet les images choisies sous les noms attendus par le backend", async () => {
    const logo = new File(["x"], "logo.png", { type: "image/png" });
    const banner = new File(["y"], "banner.png", { type: "image/png" });

    await updateCompany("company-1", VALUES, { logo, banner }, "token");

    const formData = lastFormData();
    expect(formData.get("logo")).toBe(logo);
    expect(formData.get("banner")).toBe(banner);
  });
});
