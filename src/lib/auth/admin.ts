/**
 * Admin role resolution helper
 * Determines whether a given user email or session role has administrator privileges.
 */

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== "string") return false;
  const normalized = email.trim().toLowerCase();
  const adminList = getAdminEmails();
  return adminList.includes(normalized);
}

export function isUserAdmin(user?: { email?: string | null; role?: string | null } | null): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  return isAdminEmail(user.email);
}
