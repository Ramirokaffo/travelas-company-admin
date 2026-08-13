import { describe, expect, it } from "vitest";

import {
  parseNotificationFilters,
  toNotification,
  unreadCountSchema,
  userNotificationEntitySchema,
} from "./schemas";

/**
 * Le piège de ce domaine : deux entités se ressemblent. `NotificationEntity`
 * est le contenu diffusé, `UserNotificationEntity` sa distribution à un compte.
 * L'identifiant projeté doit être celui de la **distribution** — c'est le seul
 * que `PATCH /user-notification/:id` accepte.
 */

const ENTITY = {
  id: "distribution-1",
  isOpen: false,
  createAt: "2026-08-10T09:00:00.000Z",
  notification: {
    id: "diffusion-1",
    type: "ticket",
    title: "Nouveau billet",
    title_en: "New ticket",
    subtitle: "Un billet vient d'être acheté",
    subtitle_en: "A ticket has just been purchased",
    description: "Détail",
    description_en: "Detail",
    image: "https://cdn/fr.png",
    image_en: "https://cdn/en.png",
    createAt: "2026-08-10T08:00:00.000Z",
  },
};

describe("toNotification", () => {
  it("projette l'identifiant de la distribution, pas celui de la diffusion", () => {
    expect(toNotification(ENTITY, "fr").id).toBe("distribution-1");
  });

  it("choisit la variante française par défaut", () => {
    const notification = toNotification(ENTITY, "fr");
    expect(notification.title).toBe("Nouveau billet");
    expect(notification.subtitle).toBe("Un billet vient d'être acheté");
    expect(notification.image).toBe("https://cdn/fr.png");
  });

  it("choisit la variante anglaise en locale en", () => {
    const notification = toNotification(ENTITY, "en");
    expect(notification.title).toBe("New ticket");
    expect(notification.description).toBe("Detail");
  });

  it("retombe sur le français quand la variante anglaise manque", () => {
    const notification = toNotification(
      { ...ENTITY, notification: { ...ENTITY.notification, title_en: null } },
      "en",
    );
    expect(notification.title).toBe("Nouveau billet");
  });

  it("lit `isOpen` même remonté en TINYINT", () => {
    // MySQL stocke le booléen en TINYINT ; le pilote rend parfois 0/1.
    expect(toNotification({ ...ENTITY, isOpen: 1 }, "fr").isRead).toBe(true);
    expect(toNotification({ ...ENTITY, isOpen: 0 }, "fr").isRead).toBe(false);
  });

  it("retombe sur le type générique quand le backend en renvoie un inconnu", () => {
    const notification = toNotification(
      { ...ENTITY, notification: { ...ENTITY.notification, type: "promo" } },
      "fr",
    );
    expect(notification.type).toBe("notification");
  });

  it("survit à une distribution sans contenu rattaché", () => {
    const notification = toNotification({ id: "orpheline", isOpen: true }, "fr");
    expect(notification.title).toBe("");
    expect(notification.type).toBe("notification");
    expect(notification.isRead).toBe(true);
  });

  it("préfère la date de distribution à celle de la diffusion", () => {
    // Une diffusion ancienne peut être distribuée à un nouveau compte : c'est
    // la date de réception qui intéresse le destinataire.
    expect(toNotification(ENTITY, "fr").createdAt).toBe("2026-08-10T09:00:00.000Z");
  });
});

describe("userNotificationEntitySchema", () => {
  it("accepte la forme réellement renvoyée par getMine", () => {
    expect(userNotificationEntitySchema.safeParse(ENTITY).success).toBe(true);
  });

  it("tolère les champs supplémentaires du backend", () => {
    const parsed = userNotificationEntitySchema.safeParse({
      ...ENTITY,
      userId: "u-1",
      notificationId: 42,
      deleteAt: null,
    });
    expect(parsed.success).toBe(true);
  });
});

describe("unreadCountSchema", () => {
  it("lit le compteur nominal", () => {
    expect(unreadCountSchema.parse({ count: 5 }).count).toBe(5);
  });

  it("accepte un compteur remonté en chaîne", () => {
    // Les agrégats SQL reviennent parfois en texte selon le pilote.
    expect(unreadCountSchema.parse({ count: "5" }).count).toBe(5);
  });

  it("retombe sur zéro plutôt que de faire tomber la cloche", () => {
    // La pastille est un agrément : une réponse malformée ne doit pas casser
    // le layout, partagé par toutes les pages du dashboard.
    expect(unreadCountSchema.parse({}).count).toBe(0);
    expect(unreadCountSchema.parse({ count: null }).count).toBe(0);
    expect(unreadCountSchema.parse({ count: "beaucoup" }).count).toBe(0);
  });
});

describe("parseNotificationFilters", () => {
  it("ne filtre rien par défaut", () => {
    expect(parseNotificationFilters({})).toEqual({ status: "all", type: "all" });
  });

  it("lit les filtres depuis l'URL", () => {
    expect(parseNotificationFilters({ statut: "unread", type: "wallet" })).toEqual({
      status: "unread",
      type: "wallet",
    });
  });

  it("ignore une valeur non prévue plutôt que de la transmettre au backend", () => {
    // `forbidNonWhitelisted` côté NestJS ferait échouer la liste en 400.
    expect(parseNotificationFilters({ statut: "peu-importe", type: "inconnu" })).toEqual(
      { status: "all", type: "all" },
    );
  });

  it("retient la première valeur d'un paramètre répété", () => {
    expect(parseNotificationFilters({ statut: ["unread", "all"] }).status).toBe("unread");
  });
});
