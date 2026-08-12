import {
  AlertTriangle,
  BarChart3,
  Building2,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Route,
  Settings,
  Ticket,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { ROUTES } from "@/constants/routes";

export type NavItem = {
  href: string;
  /** Clé du catalogue, sous `nav.items`. */
  key: string;
  icon: LucideIcon;
  /** `true` tant que la page n'est pas implémentée (voir PLAN.md). */
  soon?: boolean;
};

/** `key` désigne une entrée de `nav.sections` dans les catalogues de langue. */
export type NavSection = { key: string; items: NavItem[] };

/**
 * Navigation du dashboard.
 *
 * Purement cosmétique : masquer un lien n'est PAS un contrôle d'accès.
 * L'autorisation est appliquée par `requireSession()` dans chaque page.
 *
 * Les libellés ne figurent pas ici : ce module est importé par un composant
 * client, et un libellé en dur y serait figé dans une seule langue. Seules les
 * clés circulent, la barre latérale les traduit.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    key: "steering",
    items: [
      { href: ROUTES.dashboard, key: "dashboard", icon: LayoutDashboard },
      { href: ROUTES.statistics, key: "statistics", icon: BarChart3 },
      { href: ROUTES.revenue, key: "revenue", icon: Wallet },
    ],
  },
  {
    key: "organization",
    items: [
      { href: ROUTES.company, key: "company", icon: Building2 },
      { href: ROUTES.seats, key: "seats", icon: MapPin },
      { href: ROUTES.staff, key: "staff", icon: Users },
    ],
  },
  {
    key: "operations",
    items: [
      { href: ROUTES.journeys, key: "journeys", icon: Route },
      { href: ROUTES.tickets, key: "tickets", icon: Ticket },
      { href: ROUTES.incidents, key: "incidents", icon: AlertTriangle },
      { href: ROUTES.opinions, key: "opinions", icon: MessageSquare },
    ],
  },
  {
    key: "account",
    items: [{ href: ROUTES.settings, key: "settings", icon: Settings }],
  },
];
