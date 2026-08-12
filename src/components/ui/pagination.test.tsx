import { render, screen } from "@test/intl";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { describe, expect, it, vi } from "vitest";

import { Pagination } from "./pagination";
import { parseTableQuery, toPageMeta, type TableQuery } from "@/lib/api/data-table";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/seats",
  useRouter: () => ({ push: pushMock }),
}));

// `next/link` exige un contexte App Router absent d'un rendu isolé ; l'ancre
// suffit ici, l'objet du test étant l'URL calculée et l'état des contrôles.
vi.mock("next/link", () => ({
  // `prefetch` est une prop de Next, pas un attribut HTML : elle est retirée
  // ici comme le ferait le vrai composant.
  default: ({
    children,
    prefetch: _prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => (
    <a {...props}>{children}</a>
  ),
}));

function setup(query: TableQuery, items: number, total: number | null) {
  const result = { items: new Array(items).fill(null), total };
  return render(
    <Pagination query={query} meta={toPageMeta(query, result)} itemLabel="agences" />,
  );
}

describe("Pagination", () => {
  it("résume la plage affichée", () => {
    setup(parseTableQuery({ page: "2" }), 20, 87);
    expect(screen.getByText(/21–40 sur 87 agences/)).toBeInTheDocument();
    expect(screen.getByText("Page 2 / 5")).toBeInTheDocument();
  });

  it("omet le nombre de pages quand le backend ne renvoie pas de total", () => {
    setup(parseTableQuery({}), 20, null);
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByText(/1–20 agences/)).toBeInTheDocument();
  });

  it("construit les liens en conservant les critères", () => {
    setup(parseTableQuery({ page: "2", q: "plateau" }), 20, 87);

    expect(screen.getByRole("link", { name: "Page suivante" })).toHaveAttribute(
      "href",
      "/seats?page=3&q=plateau",
    );
    expect(screen.getByRole("link", { name: "Page précédente" })).toHaveAttribute(
      "href",
      "/seats?q=plateau",
    );
  });

  // Un `<a>` sans `href` reste focusable et laisse croire à une action possible.
  it("n'expose pas de lien vers une page inexistante", () => {
    setup(parseTableQuery({}), 7, 7);

    expect(
      screen.queryByRole("link", { name: "Page précédente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Page suivante" }),
    ).not.toBeInTheDocument();
  });

  it("annonce l'état vide", () => {
    setup(parseTableQuery({}), 0, 0);
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
  });

  it("revient en page 1 en changeant la taille de page", async () => {
    setup(parseTableQuery({ page: "3", q: "plateau" }), 20, 87);

    await userEvent.selectOptions(screen.getByLabelText("Par page"), "50");

    expect(pushMock).toHaveBeenCalledWith("/seats?perPage=50&q=plateau");
  });
});
