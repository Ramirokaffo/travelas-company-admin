import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@test/intl";

import { LoginStatus } from "@/constants/auth-status";

import { LoginForm } from "./login-form";

/**
 * Tests du formulaire de connexion.
 *
 * Le cas qui compte ici est celui du compte jamais vérifié : sans porte de
 * sortie, l'utilisateur est bloqué pour de bon — il ne peut ni se connecter, ni
 * se réinscrire, son téléphone et son identifiant étant déjà pris.
 */

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));

function mockLoginResponse(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
    ),
  );
}

async function submitCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText("E-mail ou identifiant"),
    "chef@transport.example",
  );
  await user.type(screen.getByLabelText("Mot de passe"), "Transport-2026!");
  await user.click(screen.getByRole("button", { name: "Se connecter" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("LoginForm", () => {
  it("mène à l'écran de vérification quand le compte n'est pas vérifié", async () => {
    const user = userEvent.setup();
    mockLoginResponse(401, {
      status: LoginStatus.ACCOUNT_NOT_VERIFIED,
      message: "Votre compte n'est pas encore vérifié. Consultez votre boîte mail.",
      canResumeVerification: true,
    });

    render(<LoginForm callbackUrl="/dashboard" />);
    await submitCredentials(user);

    const resume = await screen.findByRole("link", {
      name: "Terminer la vérification de mon e-mail",
    });
    // `/register` reprend à la saisie du code grâce au cookie posé par le
    // route handler, avec le renvoi et la correction d'adresse.
    expect(resume).toHaveAttribute("href", "/register");
  });

  it("n'affiche aucune reprise pour un simple mot de passe erroné", async () => {
    const user = userEvent.setup();
    mockLoginResponse(401, {
      status: LoginStatus.WRONG_PASSWORD,
      message: "Identifiants invalides.",
    });

    render(<LoginForm callbackUrl="/dashboard" />);
    await submitCredentials(user);

    expect(await screen.findByText("Identifiants invalides.")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Terminer la vérification de mon e-mail" }),
    ).not.toBeInTheDocument();
  });

  it("mène au tableau de bord après une connexion réussie", async () => {
    const user = userEvent.setup();
    mockLoginResponse(200, { status: LoginStatus.SUCCESS });

    render(<LoginForm callbackUrl="/seats" />);
    await submitCredentials(user);

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/seats"));
    expect(refresh).toHaveBeenCalled();
  });

  it("propose le mot de passe oublié", () => {
    render(<LoginForm callbackUrl="/dashboard" />);

    expect(screen.getByRole("link", { name: "Mot de passe oublié ?" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
  });
});
