import type { MetadataRoute } from "next";

/** Back-office : aucune indexation, sur aucun chemin. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
