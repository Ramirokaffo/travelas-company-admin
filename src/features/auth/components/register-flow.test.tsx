import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@test/intl";

import { RegisterFlow } from "./register-flow";

/**
 * Tests du parcours d'inscription côté navigateur.
 *
 * Ce qui est vérifié ici tient en une phrase : l'utilisateur qui saisit ses
 * informations puis son code arrive dans l'espace de travail sans jamais
 * ressaisir son mot de passe — et ce mot de passe ne quitte pas les deux appels
 * qui en ont besoin.
 */

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

type FetchCall = { url: string; body: unknown };

/** Journalise les appels réseau et répond selon la route visée. */
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

const ACCOUNT = {
  Prénom: "Yao",
  Nom: "Kouassi",
  "E-mail professionnel": "Chef@Transport.example",
  Téléphone: "+2250700000000",
  "Identifiant de connexion": "yao.kouassi",
  "Mot de passe": "Transport-2026!",
  "Confirmer le mot de passe": "Transport-2026!",
};

async function fillAccountStep(user: ReturnType<typeof userEvent.setup>) {
  for (const [label, value] of Object.entries(ACCOUNT)) {
    await user.type(screen.getByLabelText(label), value);
  }
  await user.click(screen.getByRole("button", { name: "Créer mon compte" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("RegisterFlow", () => {
  it("enchaîne compte → vérification → espace de travail sans redemander le mot de passe", async () => {
    const user = userEvent.setup();
    const calls = mockFetch({
      "/api/auth/register": { status: 201, body: {} },
      "/api/auth/verify-email": { status: 200, body: {} },
      "/api/auth/login": { status: 200, body: { status: "login_successfully" } },
    });

    render(<RegisterFlow initialStep="account" pendingEmail={null} />);

    await fillAccountStep(user);

    // Étape 2 : l'adresse est rappelée, en minuscules comme côté serveur.
    expect(await screen.findByText("Vérifiez votre e-mail")).toBeInTheDocument();
    expect(screen.getByText("chef@transport.example")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Code de vérification"), "100420");
    await user.click(screen.getByRole("button", { name: "Vérifier mon e-mail" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/onboarding"));
    expect(refresh).toHaveBeenCalled();

    // La session est ouverte par le même route handler que le formulaire de
    // connexion, avec les identifiants gardés en mémoire le temps du parcours.
    const login = calls.find((call) => call.url === "/api/auth/login");
    expect(login?.body).toEqual({
      login: "chef@transport.example",
      password: "Transport-2026!",
    });

    // Le mot de passe ne part que là où il est indispensable.
    const leaks = calls.filter(
      (call) =>
        call.url !== "/api/auth/register" &&
        call.url !== "/api/auth/login" &&
        JSON.stringify(call.body ?? {}).includes("Transport-2026!"),
    );
    expect(leaks).toEqual([]);
  });

  it("rattache une erreur de doublon au champ concerné", async () => {
    const user = userEvent.setup();
    mockFetch({
      "/api/auth/register": {
        status: 409,
        body: {
          message: "Un compte existe déjà avec cet e-mail.",
          fieldErrors: { email: "Un compte existe déjà avec cet e-mail." },
        },
      },
    });

    render(<RegisterFlow initialStep="account" pendingEmail={null} />);
    await fillAccountStep(user);

    expect(
      await screen.findAllByText("Un compte existe déjà avec cet e-mail."),
    ).not.toHaveLength(0);
    // On reste sur le formulaire : rien à corriger sur l'écran suivant.
    expect(screen.queryByText("Vérifiez votre e-mail")).not.toBeInTheDocument();
  });

  it("reprend à la vérification quand une inscription est déjà en attente", async () => {
    render(<RegisterFlow initialStep="verify" pendingEmail="chef@transport.example" />);

    expect(screen.getByText("Vérifiez votre e-mail")).toBeInTheDocument();
    expect(screen.getByText("chef@transport.example")).toBeInTheDocument();
  });

  // Page rechargée en cours de vérification : le mot de passe n'est plus en
  // mémoire, la connexion automatique n'est pas possible.
  it("renvoie vers la connexion après vérification si le mot de passe est perdu", async () => {
    const user = userEvent.setup();
    mockFetch({ "/api/auth/verify-email": { status: 200, body: {} } });

    render(<RegisterFlow initialStep="verify" pendingEmail="chef@transport.example" />);

    await user.type(screen.getByLabelText("Code de vérification"), "100420");
    await user.click(screen.getByRole("button", { name: "Vérifier mon e-mail" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?verified=1"));
  });

  it("affiche l'expiration du code sans quitter l'étape", async () => {
    const user = userEvent.setup();
    mockFetch({
      "/api/auth/verify-email": {
        status: 400,
        body: { message: "Ce code a expiré. Demandez-en un nouveau." },
      },
    });

    render(<RegisterFlow initialStep="verify" pendingEmail="chef@transport.example" />);

    await user.type(screen.getByLabelText("Code de vérification"), "100420");
    await user.click(screen.getByRole("button", { name: "Vérifier mon e-mail" }));

    expect(
      await screen.findByText("Ce code a expiré. Demandez-en un nouveau."),
    ).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
