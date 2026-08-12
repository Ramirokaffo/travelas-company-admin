import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { render, screen } from "@test/intl";

import { ThemeToggle } from "./theme-toggle";
import { ThemeProvider } from "@/lib/theme/theme-context";

function setup(initialTheme: "light" | "dark" | "system" = "system") {
  return render(
    <ThemeProvider initialTheme={initialTheme}>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

afterEach(() => {
  document.documentElement.classList.remove("light", "dark");
  document.cookie = "travelas_theme=; Path=/; Max-Age=0";
});

describe("ThemeToggle", () => {
  it("expose les trois réglages comme un groupe de boutons radio", () => {
    setup();

    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Système" })).toBeChecked();
  });

  it("applique le choix au document et le mémorise", async () => {
    setup();

    await userEvent.click(screen.getByRole("radio", { name: "Sombre" }));

    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("travelas_theme=dark");
  });

  /**
   * Le cœur du dispositif : « Système » retire toute classe, ce qui rend la
   * main à `prefers-color-scheme`. Une classe résiduelle figerait le thème.
   */
  it("retire toute classe en revenant sur « Système »", async () => {
    setup("dark");
    document.documentElement.classList.add("dark");

    await userEvent.click(screen.getByRole("radio", { name: "Système" }));

    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(document.cookie).toContain("travelas_theme=system");
  });
});
