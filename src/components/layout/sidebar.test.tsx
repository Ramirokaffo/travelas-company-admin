import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { render, screen } from "@test/intl";

import { SIDEBAR_COOKIE } from "@/lib/layout/sidebar-state";

import { Sidebar } from "./sidebar";

/**
 * Deux propriétés à tenir sur le pliage : rien ne disparaît pour un lecteur
 * d'écran (seuls les libellés cessent d'être *visibles*), et la préférence est
 * écrite dans le cookie que le serveur relira au rendu suivant — sans quoi la
 * barre se déplierait à chaque navigation.
 */

// `usePathname()` lève hors du contexte de l'App Router.
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

beforeEach(() => {
  document.cookie = `${SIDEBAR_COOKIE}=; Path=/; Max-Age=0`;
});

function renderSidebar(props: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return render(
    <Sidebar companyName="Transport Express" companyLogo={null} {...props} />,
  );
}

describe("Sidebar", () => {
  it("affiche le nom de l'entreprise à côté de son logo", () => {
    const { container } = renderSidebar({
      companyLogo: "https://storage.googleapis.com/logo.png",
    });

    expect(screen.getByText("Transport Express")).toBeInTheDocument();

    // Logo décoratif (`alt=""`, donc hors de l'arbre d'accessibilité) : le nom
    // adjacent porte déjà l'information, l'annoncer deux fois n'apporterait
    // rien. On le cherche donc par sa source.
    const logo = container.querySelector('img[src*="logo.png"]');
    expect(logo).not.toBeNull();
    expect(logo).toHaveAttribute("alt", "");
  });

  it("replie la barre et garde les libellés accessibles", async () => {
    renderSidebar();

    const collapse = screen.getByRole("button", { name: "Replier la barre latérale" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(collapse);

    const expand = screen.getByRole("button", { name: "Déplier la barre latérale" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    // Le lien reste trouvable par son nom accessible, libellé masqué à l'œil.
    expect(screen.getByRole("link", { name: "Agences" })).toBeInTheDocument();
    expect(screen.getByText("Transport Express")).toBeInTheDocument();
  });

  it("mémorise le pliage dans le cookie relu par le serveur", async () => {
    renderSidebar();

    await userEvent.click(
      screen.getByRole("button", { name: "Replier la barre latérale" }),
    );
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=collapsed`);

    await userEvent.click(
      screen.getByRole("button", { name: "Déplier la barre latérale" }),
    );
    expect(document.cookie).toContain(`${SIDEBAR_COOKIE}=expanded`);
  });

  // L'état vient du serveur : le lire après le montage ferait clignoter la
  // barre, dépliée le temps d'un rendu.
  it("part replié quand le cookie le dit", () => {
    renderSidebar({ initialState: "collapsed" });

    expect(
      screen.getByRole("button", { name: "Déplier la barre latérale" }),
    ).toBeInTheDocument();
  });
});
