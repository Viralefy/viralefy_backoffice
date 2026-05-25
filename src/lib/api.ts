import { getToken, setToken } from "./auth";

export { setToken };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message ?? "Erro na requisição");
  }
  if (res.status === 204) return undefined as T;
  return json.data as T;
}

export type Plan = {
  id: string;
  name: string;
  description: string;
  followers_qty: number;
  price_cents: number;
  currency: string;
  active: boolean;
  sort_order: number;
};

export type Gateway = {
  id: string;
  name: string;
  provider: string;
  active: boolean;
  config: Record<string, string>;
};

export type Order = {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  created_at: string;
};

export async function login(email: string, password: string) {
  return request<{ token: string; email: string; name: string }>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export const adminApi = {
  listPlans: () => request<Plan[]>("/v1/admin/plans"),
  createPlan: (body: Partial<Plan>) =>
    request<Plan>("/v1/admin/plans", { method: "POST", body: JSON.stringify(body) }),
  updatePlan: (id: string, body: Partial<Plan>) =>
    request<Plan>(`/v1/admin/plans/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePlan: (id: string) => request<void>(`/v1/admin/plans/${id}`, { method: "DELETE" }),
  listGateways: () => request<Gateway[]>("/v1/admin/gateways"),
  createGateway: (body: Partial<Gateway>) =>
    request<Gateway>("/v1/admin/gateways", { method: "POST", body: JSON.stringify(body) }),
  updateGateway: (id: string, body: Partial<Gateway>) =>
    request<Gateway>(`/v1/admin/gateways/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteGateway: (id: string) =>
    request<void>(`/v1/admin/gateways/${id}`, { method: "DELETE" }),
  listOrders: () => request<Order[]>("/v1/admin/orders"),
};
