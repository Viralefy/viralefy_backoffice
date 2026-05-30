const TOKEN_KEY = "viralefy_admin_token";
const PERMS_KEY = "viralefy_admin_perms";
const ROLE_KEY = "viralefy_admin_role";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function setSession(token: string, role: string, permissions: string[]) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  localStorage.setItem(PERMS_KEY, JSON.stringify(permissions));
}

export function getRole(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ROLE_KEY);
}

export function getPermissions(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PERMS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function can(permission: string): boolean {
  if (getRole() === "superadmin") return true;
  return getPermissions().includes(permission);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PERMS_KEY);
  localStorage.removeItem(ROLE_KEY);
}
