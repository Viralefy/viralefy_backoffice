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
  platform?: string;      // instagram | tiktok | facebook
  target_type?: string;   // profile | publication
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
  plan_category?: string;
  // Hidratado pelo backend (JOIN com users). Mostrado na listagem para
  // não exibir UUID puro.
  user_name?: string;
  user_email?: string;
  status: string;
  amount_cents: number;
  currency: string;
  display_currency: string;
  display_amount: string;
  settlement_currency: string;
  settlement_amount: string;
  publication_url?: string | null;
  profile_id?: string | null;
  payment_method?: string;
  ticket_id?: string | null;
  custom_data?: Record<string, unknown>;
  tracking?: Record<string, unknown>;
  external_ref?: string | null;
  baseline_metrics?: Record<string, unknown> | null;
  baseline_captured_at?: string | null;
  baseline_source?: string | null;
  delivery_metrics?: Record<string, unknown> | null;
  delivery_captured_at?: string | null;
  delivery_source?: string | null;
  refunded_usd_cents?: number;
  created_at: string;
  updated_at?: string;
};

// InvoiceDetail = invoice + user hidratado. Resposta de GET
// /v1/admin/invoices/{id}.
export type InvoiceDetail = {
  invoice: Invoice;
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

// OrderRefund = registro do histórico de estornos emitidos sobre um
// pedido pago (Fase 5.4). Imutável (somente INSERT).
export type OrderRefund = {
  id: string;
  order_id: string;
  refund_usd_cents: number;
  refund_type: "to_credits" | "to_gateway";
  reason?: string;
  refunded_by: string;
  external_ref?: string;
  created_at: string;
};

// OrderDetail = order com profile e user hidratados. Forma da resposta
// do GET /v1/admin/orders/{id}.
export type OrderDetail = {
  order: Order;
  profile?: {
    id: string;
    handle: string;
    display_name: string;
    platform: string;
    verified: boolean;
  };
  user?: {
    id: string;
    name: string;
    email: string;
  };
};

export type MetricsSummary = {
  orders_total: number;
  orders_paid: number;
  revenue_usd: string;
  status_count: Record<string, number>;
  top_categories: { category: string; orders: number; revenue_usd: string }[];
  daily_30d: { day: string; orders: number; revenue_usd: string }[];
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

export async function login(email: string, password: string, turnstileToken?: string) {
  return request<LoginResult>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, turnstile_token: turnstileToken ?? "" }),
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
  getOrder: (id: string) => request<OrderDetail>(`/v1/admin/orders/${id}`),
  patchOrder: (id: string, body: { status?: string }) =>
    request<Order>(`/v1/admin/orders/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  captureOrderMetrics: (id: string, kind: "baseline" | "delivery" = "baseline") =>
    request<Order>(`/v1/admin/orders/${id}/capture-metrics`, {
      method: "POST",
      body: JSON.stringify({ kind }),
    }),
  metricsSummary: () => request<MetricsSummary>("/v1/admin/metrics/summary"),

  listTickets: (status?: string) =>
    request<TicketView[]>(`/v1/admin/tickets${status ? `?status=${status}` : ""}`),
  getTicket: (id: string) => request<TicketDetail>(`/v1/admin/tickets/${id}`),
  replyTicket: (id: string, body: string) =>
    request<void>(`/v1/admin/tickets/${id}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
  patchTicket: (id: string, body: { status?: string; priority?: string }) =>
    request<void>(`/v1/admin/tickets/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  listInvoices: (status?: string) =>
    request<Invoice[]>(`/v1/admin/invoices${status ? `?status=${status}` : ""}`),
  getInvoice: (id: string) => request<InvoiceDetail>(`/v1/admin/invoices/${id}`),
  markInvoicePaid: (id: string) =>
    request<Invoice>(`/v1/admin/invoices/${id}/mark-paid`, { method: "POST" }),

  listUsers: () => request<UserView[]>("/v1/admin/users"),
  getUser: (id: string) => request<UserDetail>(`/v1/admin/users/${id}`),
  adjustCredits: (id: string, deltaCents: number, description: string) =>
    request<{ user_id: string; balance_cents: number }>(
      `/v1/admin/users/${id}/credits/adjust`,
      { method: "POST", body: JSON.stringify({ delta_cents: deltaCents, description }) }
    ),
  markOrderPaid: (id: string) =>
    request<void>(`/v1/admin/orders/${id}/mark-paid`, { method: "POST" }),

  issueRefund: (
    id: string,
    body: { refund_usd_cents: number; refund_type: "to_credits" | "to_gateway"; reason?: string; external_ref?: string }
  ) =>
    request<OrderRefund>(`/v1/admin/orders/${id}/refund`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  listOrderRefunds: (id: string) =>
    request<OrderRefund[]>(`/v1/admin/orders/${id}/refunds`),

  listReviews: (filter?: { only_hidden?: boolean; plan_id?: string; category?: string }) => {
    const q = new URLSearchParams();
    if (filter?.only_hidden) q.set("only_hidden", "1");
    if (filter?.plan_id) q.set("plan_id", filter.plan_id);
    if (filter?.category) q.set("category", filter.category);
    const qs = q.toString();
    return request<AdminReview[]>(`/v1/admin/reviews${qs ? `?${qs}` : ""}`);
  },
  setReviewVisibility: (id: string, visible: boolean) =>
    request<AdminReview>(`/v1/admin/reviews/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ visible }),
    }),
};

export type AdminReview = {
  id: string;
  user_id: string;
  order_id: string;
  plan_id: string;
  plan_category: string;
  country_code: string;
  rating: number;
  title: string;
  body: string;
  visible: boolean;
  created_at: string;
  updated_at: string;
  user_name: string;
  user_email: string;
  plan_name: string;
};

export type UserView = {
  id: string;
  email: string;
  name: string;
  instagram?: string;
  created_at: string;
  balance_cents: number;
};

export type AdminProfile = {
  id: string;
  platform: "instagram" | "tiktok";
  handle: string;
  display_name: string;
  verified: boolean;
  created_at: string;
};

export type CreditTx = {
  id: string;
  type: "recharge" | "spend" | "refund" | "adjustment";
  amount_cents: number;
  balance_after_cents: number;
  description: string;
  order_id?: string | null;
  invoice_id?: string | null;
  created_at: string;
};

export type UserDetail = {
  user: UserView;
  credits: { user_id: string; balance_cents: number };
  transactions: CreditTx[];
  profiles: AdminProfile[];
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
  gateway_id?: string | null;
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
