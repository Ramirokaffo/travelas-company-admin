import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Concatène des classes Tailwind en résolvant les conflits (`p-2` vs `p-4`). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
