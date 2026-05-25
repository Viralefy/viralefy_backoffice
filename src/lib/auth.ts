export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("viralefy_admin_token");
}

export function setToken(token: string) {
  localStorage.setItem("viralefy_admin_token", token);
}

export function clearToken() {
  localStorage.removeItem("viralefy_admin_token");
}
