import { customAlphabet } from "nanoid";

/** Top-level routes a public /username page would collide with. */
const RESERVED = new Set([
  "api",
  "dashboard",
  "booking",
  "sign_in",
  "signin",
  "sign_up",
  "signup",
  "admin",
  "settings",
  "login",
  "logout",
]);

const digits = customAlphabet("0123456789", 4);
const alnum = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

/** A starting point that satisfies the sign-up rules (3-30 of a-z, 0-9, _) from an email or name. */
export function usernameBase(email: string, name?: string | null) {
  const local = email.split("@")[0] || name || "";
  const base = local
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return base.length >= 3 ? base : "user";
}

/**
 * Picks a free username for someone who signed up through Google or Microsoft and
 * so never typed one. They can change it in Settings. `isTaken` reports whether a
 * candidate is already in use.
 */
export async function generateUsername(
  email: string,
  name: string | null | undefined,
  isTaken: (candidate: string) => Promise<boolean>
) {
  const base = usernameBase(email, name);
  const candidates = [
    base,
    ...Array.from({ length: 5 }, () => `${base}${digits()}`),
    `${base.slice(0, 20)}_${alnum()}`,
  ];
  for (const candidate of candidates) {
    if (RESERVED.has(candidate)) continue;
    if (!(await isTaken(candidate))) return candidate;
  }
  return `user_${alnum()}`;
}
