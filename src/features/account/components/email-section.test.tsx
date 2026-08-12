import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen, waitFor } from "@test/intl";

import type { SessionUser } from "@/types/user";

import { EmailSection } from "./email-section";

/**
 * Le changement d'adresse est le parcours le plus sensible de la page : c'est
 * l'adresse par laquelle on récupère son mot de passe. Deux propriétés doivent
 * tenir — l'adresse actuelle reste affichée tant que la nouvelle n'est pas
 * prouvée, et le mot de passe ne survit pas à la demande.
 */

const { requestEmailChangeAction, confirmEmailChangeAction, cancelEmailChangeAction } =
  vi.hoisted(() => ({
    requestEmailChangeAction: vi.fn(),
    confirmEmailChangeAction: vi.fn(),
    cancelEmailChangeAction: vi.fn(),
  }));

vi.mock("@/features/account/actions", () => ({
  requestEmailChangeAction,
  confirmEmailChangeAction,
  cancelEmailChangeAction,
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// `useRouter()` lève hors du contexte de l'App Router. Le rafraîchissement
// qu'il déclenche est ce qui fait basculer l'affichage vers l'état « en
// attente » : c'est un appel à observer, pas à ignorer.
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "u-1",
    userName: "awa",
    firstName: "Awa",
    lastName: "Traoré",
    email: "awa@exemple.test",
    pendingEmail: null,
    isEmailVerify: true,
    phoneNumber: "+237690000000",
    role: "company_admin" as SessionUser["role"],
    profilImage: null,
    lang: "fr",
    is2fAuthEnable: false,
    company: null,
    seat: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EmailSection", () => {
  it("demande le mot de passe avec la nouvelle adresse, et ne le conserve pas", async () => {
    const person = userEvent.setup();
    requestEmailChangeAction.mockResolvedValue({
      ok: true,
      message: "settings.actions.emailRequested",
    });

    render(<EmailSection user={user()} />);

    await person.type(
      screen.getByLabelText("Nouvelle adresse"),
      "nouvelle@exemple.test",
    );
    await person.type(screen.getByLabelText("Mot de passe actuel"), "MotDePasse1!");
    await person.click(screen.getByRole("button", { name: "Envoyer le code" }));

    await waitFor(() => expect(requestEmailChangeAction).toHaveBeenCalledTimes(1));
    expect(requestEmailChangeAction).toHaveBeenCalledWith({
      newEmail: "nouvelle@exemple.test",
      currentPassword: "MotDePasse1!",
    });

    // Le mot de passe est effacé du formulaire une fois la demande partie.
    await waitFor(() =>
      expect(screen.getByLabelText("Mot de passe actuel")).toHaveValue(""),
    );

    // Sans ce rafraîchissement, la carte resterait sur le formulaire de
    // demande alors que le backend attend désormais un code.
    expect(refresh).toHaveBeenCalled();
  });

  it("affiche toujours l'adresse actuelle pendant une demande en cours", () => {
    render(
      <EmailSection
        user={user({ pendingEmail: "nouvelle@exemple.test" })}
      />,
    );

    // L'adresse de connexion n'a pas changé : c'est tout l'intérêt de
    // `pendingEmail`, et l'utilisateur doit le voir.
    expect(screen.getByText("awa@exemple.test")).toBeInTheDocument();
    expect(screen.getByText(/nouvelle@exemple.test/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Envoyer le code" }),
    ).not.toBeInTheDocument();
  });

  it("signale un code expiré sur le champ concerné", async () => {
    const person = userEvent.setup();
    confirmEmailChangeAction.mockResolvedValue({
      ok: false,
      message: "settings.actions.codeExpired",
      fieldErrors: { code: "settings.actions.codeExpired" },
    });

    render(<EmailSection user={user({ pendingEmail: "nouvelle@exemple.test" })} />);

    await person.type(screen.getByLabelText("Code de vérification"), "123456");
    await person.click(screen.getByRole("button", { name: "Confirmer l'adresse" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Code expiré. Relancez la demande.",
      ),
    );
  });

  it("distingue une adresse non vérifiée", () => {
    render(<EmailSection user={user({ isEmailVerify: false })} />);
    expect(screen.getByText("Non vérifiée")).toBeInTheDocument();
  });
});
