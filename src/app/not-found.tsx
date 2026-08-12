import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ROUTES } from "@/constants/routes";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-brand-700 dark:text-brand-400 text-sm font-semibold">404</p>
      <h1 className="text-xl font-semibold">{t("notFoundTitle")}</h1>
      <p className="text-muted max-w-md text-sm">{t("notFoundDescription")}</p>
      <Link
        href={ROUTES.dashboard}
        className="text-brand-700 dark:text-brand-400 text-sm font-medium hover:underline"
      >
        {t("backToDashboard")}
      </Link>
    </div>
  );
}
