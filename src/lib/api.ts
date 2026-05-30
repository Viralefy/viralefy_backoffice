import { getToken, setToken, setSession } from "./auth";

export { setToken, setSession };

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
  category: string;
  followers_qty: number;
  price_cents: number;
  currency: string;
  active: boolean;
  sort_order: number;
  prices: Record<string, string>;
};

export type Category = {
  code: string;
  label: string;
};

export type Gateway = {
  id: string;
  name: string;
  provider: string;
  active: boolean;
  config: Record<string, string>;
};

export type Currency = {
  code: string;
  name: string;
  symbol: string;
  rate: number;
  decimals: number;
  kind: string;
  display_enabled: boolean;
  settlement_code: string;
};

export type Order = {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  status: string;
  amount_cents: number;
  currency: string;
  display_currency: string;
  display_amount: string;
  settlement_currency: string;
  settlement_amount: string;
  created_at: string;
};

export type LoginResult = {
  token: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
};

export type Principal = {
  admin_id: string;
  role: string;
  permissions: string[];
};

export async function login(email: string, password: string) {
  return request<LoginResult>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export const adminApi = {
  me: () => request<Principal>("/v1/admin/me"),
  listCategories: () => request<Category[]>("/v1/categories"),

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
    request<Gateway>(`/v1/admin/gateways/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteGateway: (id: string) =>
    request<void>(`/v1/admin/gateways/${id}`, { method: "DELETE" }),

  listCurrencies: () => request<Currency[]>("/v1/admin/currencies"),
  updateCurrency: (
    code: string,
    body: { rate: number; display_enabled: boolean; settlement_code: string }
  ) => request<Currency>(`/v1/admin/currencies/${code}`, { method: "PUT", body: JSON.stringify(body) }),

  listOrders: () => request<Order[]>("/v1/admin/orders"),
};
