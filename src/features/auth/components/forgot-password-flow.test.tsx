import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@test/intl";

import { ForgotPasswordFlow } from "./forgot-password-flow";

/**
 * Tests du parcours de réinitialisation côté navigateur.
 *
 * Deux propriétés à conserver : le jeton de réinitialisation n'apparaît jamais
 * dans le navigateur (le serveur le garde), et un jeton périmé ramène à la
 * demande de code plutôt que de laisser l'utilisateur buter sur un formulaire
 * qui n'aboutira plus.
 */

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh: vi.fn() }),
}));

type FetchCall = { url: string; body: unknown };

function mockFetch(responses: Record<string, { status: number; body?: unknown }>) {
  const calls: FetchCall[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      const response = responses[url] ?? { status: 200, body: {} };
      return new Response(JSON.stringify(response.body ?? {}), {
        status: response.status,
        headers: { "content-type": "application/json" },
      });
    }),
  );

  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("ForgotPasswordFlow", () => {
  it("enchaîne adresse → code → nouveau mot de passe, puis renvoie à la connexion", async () => {
    const user = userEvent.setup();
    const calls = mockFetch({
      "/api/auth/forgot-password": { status: 200, body: {} },
      "/api/auth/forgot-password/verify": { status: 200, body: {} },
      "/api/auth/forgot-password/reset": { status: 200, body: {} },
    });

    render(<ForgotPasswordFlow initialStep="email" pendingEmail={null} />);

    await user.type(
      screen.getByLabelText("E-mail du compte"),
      "Chef@Transport.example",
    );
    await user.click(screen.getByRole("button", { name: "Recevoir un code" }));

    expect(await screen.findByText("Saisissez le code")).toBeInTheDocument();
    expect(screen.getByText("chef@transport.example")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Code de vérification"), "428913");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));

    expect(
      await screen.findByRole("heading", { name: "Nouveau mot de passe" }),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "Transport-2027!");
    await user.type(
      screen.getByLabelText("Confirmer le mot de passe"),
      "Transport-2027!",
    );
    await user.click(screen.getByRole("button", { name: "Changer mon mot de passe" }));

    // Après une réinitialisation, on se reconnecte : aucune session n'est
    // ouverte automatiquement, et le mot de passe ne reste pas en mémoire.
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?reset=1"));
    expect(calls.some((call) => call.url === "/api/auth/login")).toBe(false);

    // Le formulaire n'a jamais eu à manipuler de jeton : le serveur le garde.
    const reset = calls.find((call) => call.url === "/api/auth/forgot-password/reset");
    expect(reset?.body).toEqual({
      password: "Transport-2027!",
      confirmPassword: "Transport-2027!",
    });
  });

  it("reprend au choix du mot de passe quand le code est déjà validé", () => {
    render(
      <ForgotPasswordFlow initialStep="reset" pendingEmail="chef@transport.example" />,
    );

    expect(
      screen.getByRole("heading", { name: "Nouveau mot de passe" }),
    ).toBeInTheDocument();
  });

  it("ramène à la demande de code quand le jeton a expiré", async () => {
    const user = userEvent.setup();
    mockFetch({
      "/api/auth/forgot-password/reset": {
        status: 409,
        body: { message: "Le délai est dépassé. Demandez un nouveau code." },
      },
    });

    render(
      <ForgotPasswordFlow initialStep="reset" pendingEmail="chef@transport.example" />,
    );

    await user.type(screen.getByLabelText("Nouveau mot de passe"), "Transport-2027!");
    await user.type(
      screen.getByLabelText("Confirmer le mot de passe"),
      "Transport-2027!",
    );
    await user.click(screen.getByRole("button", { name: "Changer mon mot de passe" }));

    expect(
      await screen.findByRole("heading", { name: "Mot de passe oublié" }),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("affiche un code erroné sans quitter l'étape", async () => {
    const user = userEvent.setup();
    mockFetch({
      "/api/auth/forgot-password/verify": {
        status: 400,
        body: { message: "Code incorrect. Vérifiez le dernier e-mail reçu." },
      },
    });

    render(
      <ForgotPasswordFlow initialStep="code" pendingEmail="chef@transport.example" />,
    );

    await user.type(screen.getByLabelText("Code de vérification"), "428913");
    await user.click(screen.getByRole("button", { name: "Valider le code" }));

    expect(
      await screen.findByText("Code incorrect. Vérifiez le dernier e-mail reçu."),
    ).toBeInTheDocument();
    expect(screen.getByText("Saisissez le code")).toBeInTheDocument();
  });
});
