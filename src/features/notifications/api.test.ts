import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseTableQuery } from "@/lib/api/data-table";

import { parseNotificationFilters } from "./schemas";

/**
 * Les deux pièges de ce domaine :
 *
 *  - `UserNotificationFilterDto` n'accepte ni `orderBy` ni `order`. Le
 *    `ValidationPipe` global étant en `forbidNonWhitelisted`, les transmettre
 *    ferait échouer toute la liste en 400 — pas seulement le tri.
 *  - `withCount` est opt-in côté backend pour ne pas casser l'application
 *    mobile, qui lit un tableau nu. Ce dashboard doit donc le demander
 *    explicitement, sinon la pagination perd son dernier numéro de page.
 */
const { apiFetchMock } = vi.hoisted(() => ({ apiFetchMock: vi.fn() }));

vi.mock("@/lib/api/server-api", () => ({
  apiFetch: apiFetchMock,
  apiRequest: vi.fn(),
}));

const {
  countUnreadNotifications,
  deleteNotification,
  issueSocketTicket,
  listMyNotifications,
  listRecentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = await import("./api");

function lastCall() {
  return apiFetchMock.mock.calls.at(-1);
}

function lastOptions(): Record<string, unknown> {
  return (lastCall()?.[2] ?? {}) as Record<string, unknown>;
}

function lastQuery(): Record<string, unknown> {
  return (lastOptions().query ?? {}) as Record<string, unknown>;
}

const NO_FILTER = parseNotificationFilters({});

beforeEach(() => {
  apiFetchMock.mockReset();
  apiFetchMock.mockResolvedValue({ items: [], total: 0, count: 0, updated: 0 });
});

describe("listMyNotifications", () => {
  it("interroge la boîte du porteur du token", async () => {
    await listMyNotifications(parseTableQuery({}), NO_FILTER, "token", "fr");
    expect(lastCall()?.[0]).toBe("/user-notification/getMine");
  });

  it("convertit la page d'interface en page 0-indexée", async () => {
    await listMyNotifications(parseTableQuery({ page: "3" }), NO_FILTER, "token", "fr");
    expect(lastQuery().page).toBe(2);
  });

  it("demande le total, sans quoi la pagination reste borgne", async () => {
    await listMyNotifications(parseTableQuery({}), NO_FILTER, "token", "fr");
    expect(lastQuery().withCount).toBe(true);
  });

  it("ne transmet jamais orderBy ni order", async () => {
    await listMyNotifications(
      parseTableQuery({ sort: "createAt", order: "asc" }),
      NO_FILTER,
      "token",
      "fr",
    );
    expect(lastQuery()).not.toHaveProperty("orderBy");
    expect(lastQuery()).not.toHaveProperty("order");
  });

  it("n'envoie `onlyUnread` que sur le filtre correspondant", async () => {
    await listMyNotifications(parseTableQuery({}), NO_FILTER, "token", "fr");
    expect(lastQuery()).not.toHaveProperty("onlyUnread");

    await listMyNotifications(
      parseTableQuery({}),
      parseNotificationFilters({ statut: "unread" }),
      "token",
      "fr",
    );
    expect(lastQuery().onlyUnread).toBe(true);
  });

  it("n'envoie `type` que lorsqu'un type est choisi", async () => {
    await listMyNotifications(parseTableQuery({}), NO_FILTER, "token", "fr");
    expect(lastQuery()).not.toHaveProperty("type");

    await listMyNotifications(
      parseTableQuery({}),
      parseNotificationFilters({ type: "wallet" }),
      "token",
      "fr",
    );
    expect(lastQuery().type).toBe("wallet");
  });

  it("projette les entités dans la langue demandée", async () => {
    apiFetchMock.mockResolvedValue({
      items: [
        {
          id: "d-1",
          isOpen: false,
          notification: { id: "n-1", title: "Bonjour", title_en: "Hello" },
        },
      ],
      total: 1,
    });

    const page = await listMyNotifications(parseTableQuery({}), NO_FILTER, "token", "en");
    expect(page.items[0]?.title).toBe("Hello");
    expect(page.total).toBe(1);
  });
});

describe("listRecentNotifications", () => {
  it("ne demande pas de total : le panneau de la cloche ne pagine pas", async () => {
    await listRecentNotifications("token", "fr");
    expect(lastQuery()).not.toHaveProperty("withCount");
    expect(lastQuery().page).toBe(0);
  });

  it("borne le nombre d'éléments chargés", async () => {
    await listRecentNotifications("token", "fr", 4);
    expect(lastQuery().count).toBe(4);
  });
});

describe("countUnreadNotifications", () => {
  it("lit l'endpoint dédié plutôt que de compter la liste", async () => {
    apiFetchMock.mockResolvedValue({ count: 7 });
    await expect(countUnreadNotifications("token")).resolves.toBe(7);
    expect(lastCall()?.[0]).toBe("/user-notification/unreadCount");
  });

  // Le repli sur zéro d'une réponse malformée est porté par `unreadCountSchema`,
  // appliqué par `apiFetch` — donc hors de portée d'un test qui le mocke. Il est
  // vérifié sur le schéma lui-même dans `schemas.test.ts`.
});

describe("écritures", () => {
  it("marque une notification lue par PATCH isOpen", async () => {
    await markNotificationRead("d-1", "token");
    expect(lastCall()?.[0]).toBe("/user-notification/d-1");
    expect(lastOptions().method).toBe("PATCH");
    expect(lastOptions().body).toEqual({ isOpen: true });
  });

  it("échappe l'identifiant dans le chemin", async () => {
    await markNotificationRead("a/../b", "token");
    expect(lastCall()?.[0]).toBe("/user-notification/a%2F..%2Fb");
  });

  it("marque toute la boîte lue sur la route dédiée", async () => {
    apiFetchMock.mockResolvedValue({ updated: 12 });
    await expect(markAllNotificationsRead("token")).resolves.toBe(12);
    expect(lastCall()?.[0]).toBe("/user-notification/readAll");
    expect(lastOptions().method).toBe("PATCH");
  });

  it("supprime une notification de la boîte", async () => {
    await deleteNotification("d-1", "token");
    expect(lastOptions().method).toBe("DELETE");
  });
});

describe("issueSocketTicket", () => {
  it("demande un ticket au backend, jamais le JWT", async () => {
    apiFetchMock.mockResolvedValue({ ticket: "abc", expiresIn: 60 });
    await expect(issueSocketTicket("token")).resolves.toEqual({
      ticket: "abc",
      expiresIn: 60,
    });
    expect(lastCall()?.[0]).toBe("/socket/ticket");
    expect(lastOptions().method).toBe("POST");
  });
});
