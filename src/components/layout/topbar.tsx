"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";

import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";
import { ROUTES } from "@/constants/routes";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import type { SessionUser } from "@/types/user";

export function Topbar({
  user,
  unreadNotifications,
}: {
  user: SessionUser;
  /** Calculé au rendu serveur : la pastille est juste dès le premier HTML. */
  unreadNotifications: number;
}) {
  const tBrand = useTranslations("brand");
  const tRoles = useTranslations("roles");

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <header className="border-subtle bg-surface flex h-16 items-center justify-between gap-4 border-b px-5">
      <div className="flex min-w-0 items-center gap-3">
        {/* La barre latérale — et donc le logo — disparaît sous `lg`. En deçà
            de `sm`, la place revient aux sélecteurs de langue et de thème, qui
            doivent rester atteignables sur mobile. */}
        <Link
          href={ROUTES.dashboard}
          className="hidden sm:block lg:hidden"
          aria-label={tBrand("dashboardHome")}
        >
          <BrandLogo height={26} decorative />
        </Link>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{fullName}</p>
          <p className="text-muted truncate text-xs">
            {tRoles(user.role)}
            {user.seat?.name ? ` · ${user.seat.name}` : ""}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell initialUnreadCount={unreadNotifications} />
        <LocaleSwitcher />
        <ThemeToggle />
        <SignOutButton compact />
      </div>
    </header>
  );
}
