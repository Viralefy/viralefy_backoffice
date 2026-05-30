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

  listTickets: (status?: string) =>
    request<TicketView[]>(`/v1/admin/tickets${status ? `?status=${status}` : ""}`),
  getTicket: (id: string) => request<TicketDetail>(`/v1/admin/tickets/${id}`),
  replyTicket: (id: string, body: string) =>
    request<void>(`/v1/admin/tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  patchTicket: (id: string, body: { status?: string; priority?: string }) =>
    request<void>(`/v1/admin/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listInvoices: (status?: string) =>
    request<Invoice[]>(`/v1/admin/invoices${status ? `?status=${status}` : ""}`),
  markInvoicePaid: (id: string) =>
    request<Invoice>(`/v1/admin/invoices/${id}/mark-paid`, { method: "POST" }),
};

export type Invoice = {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  display_currency: string;
  display_amount: string;
  settlement_currency: string;
  settlement_amount: string;
  status: "pending" | "paid" | "failed" | "cancelled";
  external_ref?: string | null;
  payment_url?: string | null;
  payment_extra: Record<string, string>;
  created_at: string;
  updated_at: string;
  paid_at?: string | null;
};

export type TicketStatus = "open" | "pending" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type Ticket = {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  order_id?: string | null;
  assigned_admin_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketView = Ticket & {
  user_name: string;
  user_email: string;
  message_count: number;
  last_message_at: string;
  last_author_type: "user" | "admin" | "";
};

export type TicketMessage = {
  id: string;
  ticket_id: string;
  author_type: "user" | "admin";
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
};

export type TicketDetail = {
  ticket: Ticket;
  view?: TicketView;
  messages: TicketMessage[];
};
