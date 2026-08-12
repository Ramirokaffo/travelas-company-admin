import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@test/intl";

import { SignOutButton } from "./sign-out-button";

/**
 * La déconnexion n'est pas réversible d'un clic : elle invalide le token côté
 * backend. Un clic sur « Déconnexion » ne doit donc rien appeler tant que la
 * confirmation n'est pas donnée — et un échec doit laisser l'utilisateur sur
 * place, toujours connecté.
 */

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

afterEach(() => {
  vi.restoreAllMocks();
  replace.mockClear();
  refresh.mockClear();
});

function mockLogout(ok: boolean) {
  const fetchMock = vi.fn().mockResolvedValue({ ok });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("SignOutButton", () => {
  it("ne déconnecte pas sans confirmation", async () => {
    const fetchMock = mockLogout(true);
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Déconnexion" }));

    expect(await screen.findByRole("dialog")).toHaveTextContent("Se déconnecter ?");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("abandonne la déconnexion à l'annulation", async () => {
    const fetchMock = mockLogout(true);
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    await userEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("déconnecte après confirmation", async () => {
    const fetchMock = mockLogout(true);
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    // Le bouton de confirmation porte le même libellé, dans la fenêtre.
    await userEvent.click(
      screen.getAllByRole("button", { name: "Déconnexion" }).at(-1)!,
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      }),
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });

  // Effacer l'écran sur un échec laisserait croire la session fermée alors
  // qu'elle reste ouverte côté backend.
  it("laisse la session ouverte et signale l'échec", async () => {
    mockLogout(false);
    render(<SignOutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Déconnexion" }));
    await userEvent.click(
      screen.getAllByRole("button", { name: "Déconnexion" }).at(-1)!,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "La déconnexion a échoué. Réessayez.",
    );
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
