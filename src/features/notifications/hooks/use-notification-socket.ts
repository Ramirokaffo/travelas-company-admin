"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

import { publicEnv } from "@/lib/config/public-env";

/** Événement émis par `SocketService.sendNotifcation` côté backend. */
const NOTIFICATION_EVENT = "notification";

/** Palier de reprise, en millisecondes. Plafonné pour ne pas marteler l'API. */
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

export type SocketNotification = {
  id?: string;
  type?: string;
  title?: string;
  title_en?: string;
  subtitle?: string;
  subtitle_en?: string;
};

/**
 * Abonne le composant aux notifications temps réel du compte connecté.
 *
 * MÉCANIQUE DU TICKET — c'est le point qui gouverne tout le reste. Le JWT vit
 * dans un cookie `httpOnly` et ne doit jamais redescendre au navigateur
 * (règle 3). L'ouverture du socket passe donc par un ticket opaque, à usage
 * unique, obtenu auprès de notre propre serveur.
 *
 * Conséquence directe : **la reconnexion automatique de socket.io est
 * désactivée**. Elle rejouerait le ticket déjà consommé du premier handshake,
 * et toutes les tentatives échoueraient en boucle. La reprise est donc pilotée
 * ici, avec un nouveau ticket à chaque essai et un délai croissant.
 *
 * Sans `NEXT_PUBLIC_SOCKET_URL`, le hook ne fait rien : le centre de
 * notification reste alimenté par le rendu serveur.
 */
export function useNotificationSocket(
  onNotification: (payload: SocketNotification) => void,
): void {
  // Le callback change à chaque rendu du parent ; le garder dans une ref évite
  // de refermer et rouvrir le socket — donc de consommer un ticket — à chaque
  // frappe au clavier ailleurs dans la page.
  //
  // La mise à jour se fait dans un effet, pas pendant le rendu : une ref écrite
  // en cours de rendu casse le rendu concurrent (React peut abandonner puis
  // rejouer un rendu, laissant la ref pointer sur un callback jamais monté).
  // `useRef(onNotification)` couvre le premier montage, cet effet les suivants.
  const handlerRef = useRef(onNotification);
  useEffect(() => {
    handlerRef.current = onNotification;
  }, [onNotification]);

  useEffect(() => {
    const socketUrl = publicEnv.socketUrl;
    if (!socketUrl) return;

    let socket: Socket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    // `cancelled` couvre le double montage du mode strict en développement :
    // sans lui, la connexion lancée par le premier effet s'établirait après son
    // propre nettoyage et resterait ouverte.
    let cancelled = false;

    const scheduleRetry = () => {
      if (cancelled || retryTimer) return;
      const delay = Math.min(RETRY_BASE_MS * 2 ** attempt, RETRY_MAX_MS);
      attempt += 1;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, delay);
    };

    const connect = async () => {
      if (cancelled) return;

      let ticket: string;
      try {
        const response = await fetch("/api/notifications/socket-ticket", {
          method: "POST",
        });
        // Sans cookie de session, le proxy redirige vers la page de connexion :
        // la réponse est alors un 200 en HTML, pas un ticket. On s'arrête là
        // plutôt que de relancer une boucle de reprise pour un compte déconnecté.
        if (response.redirected) return;

        if (!response.ok) {
          // 401 / 403 : la session a expiré ou le compte est bloqué. Inutile
          // d'insister — la prochaine navigation redirigera.
          if (response.status === 401 || response.status === 403) return;
          scheduleRetry();
          return;
        }

        const payload = (await response.json()) as { ticket?: string };
        if (!payload.ticket) return;
        ticket = payload.ticket;
      } catch {
        scheduleRetry();
        return;
      }

      if (cancelled) return;

      socket = io(socketUrl, {
        auth: { ticket },
        transports: ["websocket"],
        // Voir le commentaire d'en-tête : un ticket ne se rejoue pas.
        reconnection: false,
      });

      socket.on("connect", () => {
        attempt = 0;
      });

      // `SocketService` enveloppe toujours la charge utile dans `{ data }`.
      socket.on(NOTIFICATION_EVENT, (message: { data?: SocketNotification }) => {
        handlerRef.current(message?.data ?? {});
      });

      socket.on("disconnect", scheduleRetry);
      socket.on("connect_error", scheduleRetry);
    };

    void connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.removeAllListeners();
      socket?.disconnect();
    };
  }, []);
}
