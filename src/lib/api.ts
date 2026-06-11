import { clearToken, getToken, setToken, setSession } from "./auth";
import { isMockAuthEnabled, mockRequest } from "./mock-auth";

export { setToken, setSession };

// dispatchSessionExpired — limpa a sessão local e avisa o AdminShell pra
// trocar pro estado anonymous (return null) + redirecionar pra /login.
// Roda UMA vez por janela — flags evitam loop quando múltiplos fetches em
// paralelo recebem 401 do mesmo invalidation.
let sessionExpiredHandled = false;
function dispatchSessionExpired() {
  if (typeof window === "undefined") return;
  if (sessionExpiredHandled) return;
  sessionExpiredHandled = true;
  clearToken();
  window.dispatchEvent(new CustomEvent("viralefy:session-expired"));
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
// Auth host dedicado (auth.viralefy.com). Fallback no API_URL pra não
// quebrar quando rodando sem o vhost dedicado.
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? API_URL;

function baseFor(path: string): string {
  if (path.startsWith("/v1/auth/") || path.startsWith("/.well-known/")) return AUTH_URL;
  return API_URL;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // MOCK_AUTH bypass: durante audits do Lighthouse não há backend
  // disponível, então short-circuit com fixtures determinísticas para os
  // endpoints GET conhecidos. Mutations seguem retornando erro (não
  // queremos POSTs acidentais com payload falso).
  if (isMockAuthEnabled() && (!init?.method || init.method === "GET")) {
    const stub = mockRequest<T>(path);
    if (stub !== undefined) return stub;
  }
  const token = getToken();
  const res = await fetch(`${baseFor(path)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401 em rota autenticada do admin = sessão expirou OU foi revogada
    // (restart do core invalida JTI cache, admin removeu o admin, etc.).
    // Não tem o que fazer client-side a não ser limpar e ir pro login.
    // Excluímos rotas /v1/auth/* porque 401 ali significa "credencial
    // errada", não "sessão expirou" — usuário deve ver o erro no form.
    if (res.status === 401 && !path.startsWith("/v1/auth/")) {
      dispatchSessionExpired();
    }
    throw new Error(json?.error?.message ?? "Erro na requisição");
  }
  if (res.status === 204) return undefined as T;
  // Core/dispatcher: respostas envelopadas em {"data": ...}. Auth: NÃO
  // envelopa (POST /v1/auth/login devolve access_token no top-level).
  // Mesmo comportamento do front (lib/api.ts).
  const payload = (json && typeof json === "object" && "data" in json) ? (json as { data: unknown }).data : json;
  return payload as T;
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
  accepted_currencies: string[];
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
  // Proof of payment (migration 034). Cliente anexa comprovante de PIX
  // ou TX hash crypto; admin revisa em /orders/[id] e clica approve
  // (dispara mark-as-paid) ou reject (volta pendente, cliente reanexa).
  proof_url?: string | null;
  proof_uploaded_at?: string | null;
  proof_status?: "pending" | "approved" | "rejected" | null;
  proof_note?: string | null;
  created_at: string;
  updated_at?: string;
  // Soft-delete (migration 045). Quando deleted_at != null, customer views
  // escondem o registro. Admin panel mostra com badge "Deleted".
  deleted_at?: string | null;
  deleted_by_admin_id?: string | null;
  delete_reason?: string | null;
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

// AdminPrincipal — shape devolvido pelo auth-service (AdminView Go).
// PascalCase = default encoding/json. Permissions vem vazio do auth e é
// preenchido depois pelo /v1/admin/me (core).
export type AdminPrincipal = {
  ID: string;
  Email: string;
  Name: string;
  Role: string;
  Permissions?: string[];
};

// LoginResult — alinhado com o JSON real do auth (POST /v1/auth/login):
//   { access_token, access_expires_at, refresh_token, refresh_expires_at,
//     subject_kind, admin: {...} }   // ou twofa_required+partial_token
// Antes esperava `token`/`email`/`role` no top-level e davam undefined →
// "can't access property 'token', e is undefined" no console.
export type LoginResult = {
  access_token?: string;
  access_expires_at?: string;
  refresh_token?: string;
  refresh_expires_at?: string;
  subject_kind?: "user" | "admin";
  admin?: AdminPrincipal;
  // 2FA gate (PHASE-7 §7.2). Quando twofa_required ou twofa_enroll_required
  // vier true, `access_token` vem ausente e o cliente DEVE chamar:
  //   - enrollAdmin2FA(partial_token) → mostra QR + backup codes
  //   - completeAdmin2FA(partial_token, code) → access_token final
  twofa_required?: boolean;
  twofa_enroll_required?: boolean;
  partial_token?: string;
};

export type Enroll2FAResult = {
  secret_base32: string;
  otpauth_url: string;
  backup_codes: string[];
};

export async function enrollAdmin2FA(partialToken: string): Promise<Enroll2FAResult> {
  return request<Enroll2FAResult>("/v1/auth/login/2fa/enroll", {
    method: "POST",
    body: JSON.stringify({ partial_token: partialToken }),
  });
}

export async function completeAdmin2FA(partialToken: string, code: string): Promise<LoginResult> {
  return request<LoginResult>("/v1/auth/login/2fa", {
    method: "POST",
    body: JSON.stringify({ partial_token: partialToken, code }),
  });
}

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

export type BecomeCustomerResult = {
  session: {
    token: string;
    expires_at: string;
    user: { id: string; email: string; name: string; instagram: string };
  };
  generated_password: string;
};

export const adminApi = {
  me: () => request<Principal>("/v1/admin/me"),
  becomeCustomer: () =>
    request<BecomeCustomerResult>("/v1/admin/me/become-customer", { method: "POST" }),
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
  getUserJourney: (id: string) =>
    request<{ journey: UserJourney; events: UserEvent[] }>(`/v1/admin/users/${id}/journey`),

  // Soft / hard delete + restore. Soft = admin com perm; hard + restore =
  // superadmin only (backend valida via RequireSuperadmin middleware). UI
  // gateia o botão; backend é a fonte de verdade.
  softDeleteUser: (id: string, reason: string) =>
    request<void>(`/v1/admin/users/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  hardDeleteUser: (id: string) =>
    request<void>(`/v1/admin/users/${id}/hard`, { method: "DELETE" }),
  restoreUser: (id: string) =>
    request<void>(`/v1/admin/users/${id}/restore`, { method: "POST" }),

  softDeleteOrder: (id: string, reason: string) =>
    request<void>(`/v1/admin/orders/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  hardDeleteOrder: (id: string) =>
    request<void>(`/v1/admin/orders/${id}/hard`, { method: "DELETE" }),
  restoreOrder: (id: string) =>
    request<void>(`/v1/admin/orders/${id}/restore`, { method: "POST" }),

  softDeleteInvoice: (id: string, reason: string) =>
    request<void>(`/v1/admin/invoices/${id}`, { method: "DELETE", body: JSON.stringify({ reason }) }),
  hardDeleteInvoice: (id: string) =>
    request<void>(`/v1/admin/invoices/${id}/hard`, { method: "DELETE" }),
  restoreInvoice: (id: string) =>
    request<void>(`/v1/admin/invoices/${id}/restore`, { method: "POST" }),

  // Trash — só superadmin. Devolve agregado de items soft-deleted das 3
  // entidades pra renderizar na aba /trash do painel admin.
  getTrash: (limit = 100) =>
    request<{
      orders: Order[];
      invoices: Invoice[];
      users: UserView[];
    }>(`/v1/admin/trash?limit=${limit}`),

  // Honeypot — só superadmin. Lista tentativas de admins normais mexerem
  // em superadmins (que viraram no-op + foram loggadas pra auditoria).
  getHoneypot: (limit = 200) =>
    request<HoneypotEntry[]>(`/v1/admin/honeypot?limit=${limit}`),

  // Bulk soft delete. Aceita até 200 ids por request.
  bulkSoftDeleteOrders: (ids: string[], reason: string) =>
    request<BulkDeleteResult>(`/v1/admin/orders/bulk/soft-delete`, {
      method: "POST",
      body: JSON.stringify({ ids, reason }),
    }),
  bulkSoftDeleteInvoices: (ids: string[], reason: string) =>
    request<BulkDeleteResult>(`/v1/admin/invoices/bulk/soft-delete`, {
      method: "POST",
      body: JSON.stringify({ ids, reason }),
    }),
  bulkSoftDeleteUsers: (ids: string[], reason: string) =>
    request<BulkDeleteResult>(`/v1/admin/users/bulk/soft-delete`, {
      method: "POST",
      body: JSON.stringify({ ids, reason }),
    }),
  listVisitors: (limit = 50, offset = 0) =>
    request<VisitorSummary[]>(`/v1/admin/visitors?limit=${limit}&offset=${offset}`),
  getVisitor: (vid: string) =>
    request<{ summary: VisitorSummary; events: UserEvent[] }>(`/v1/admin/visitors/${encodeURIComponent(vid)}`),
  adjustCredits: (id: string, deltaCents: number, description: string) =>
    request<{ user_id: string; balance_cents: number }>(
      `/v1/admin/users/${id}/credits/adjust`,
      { method: "POST", body: JSON.stringify({ delta_cents: deltaCents, description }) }
    ),
  markOrderPaid: (id: string) =>
    request<void>(`/v1/admin/orders/${id}/mark-paid`, { method: "POST" }),

  // Proof: cliente anexou comprovante (PIX / TX hash crypto), admin
  // decide approved (dispara mark-as-paid em sequência) ou rejected
  // (volta pro cliente reanexar).
  proofDecision: (id: string, decision: "approved" | "rejected", note?: string) =>
    request<{ order: { id: string; status: string; proof_status?: string | null } }>(
      `/v1/admin/orders/${id}/proof/decision`,
      { method: "POST", body: JSON.stringify({ decision, note }) },
    ),

  listPendingProofs: (limit = 50) =>
    request<Array<{ id: string; user_email?: string; plan_name?: string; proof_url?: string | null; proof_uploaded_at?: string | null; display_currency: string; display_amount: string }>>(
      `/v1/admin/proofs/pending?limit=${limit}`,
    ),

  // Resolve proof_url pra URL viewável. Storage keys (sem protocol) viram
  // presigned URL de 5min; data: e http: URLs antigos passam direto.
  getProofURL: (id: string) =>
    request<{ url: string }>(`/v1/admin/orders/${id}/proof-url`),

  // Bulk approve/reject — até 50 orders por call. Cada decisão é gravada
  // individualmente pra audit + idempotency. Retorna lista de resultados.
  bulkProofDecision: (orderIds: string[], decision: "approved" | "rejected", note?: string) =>
    request<{ results: Array<{ order_id: string; status: string; reason?: string }> }>(
      "/v1/admin/proofs/bulk-decision",
      { method: "POST", body: JSON.stringify({ order_ids: orderIds, decision, note }) },
    ),

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

  // Gestão de admins (RBAC manager). createAdmin retorna a senha gerada
  // UMA vez — admin promotor anota e entrega ao novo admin (não há resend).
  listAdmins: () => request<AdminUser[]>("/v1/admin/admins"),
  listRoles: () => request<Role[]>("/v1/admin/roles"),
  createAdmin: (body: { email: string; name: string; role: string }) =>
    request<{ admin: AdminUser; generated_password: string }>("/v1/admin/admins", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateAdminRole: (id: string, role: string) =>
    request<AdminUser>(`/v1/admin/admins/${id}`, {
      method: "PUT",
      body: JSON.stringify({ role }),
    }),
  deleteAdmin: (id: string) =>
    request<{ status: string }>(`/v1/admin/admins/${id}`, { method: "DELETE" }),
  resetAdmin2FA: (id: string, reason?: string) =>
    request<{ status: string }>("/v1/admin/me/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ admin_id: id, reason: reason ?? "" }),
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
  // Soft-delete (migration 045).
  deleted_at?: string | null;
  deleted_by_admin_id?: string | null;
  delete_reason?: string | null;
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

// User Journey + Events — tracking observability (admin).
//
// UserJourney é o agregado 1:1 derivado de user_events. landing_* é
// first-touch (não muda após o primeiro evento). total_events e
// total_orders são atualizados a cada Record/Upsert.
export type UserJourney = {
  user_id: string;
  landing_path?: string;
  landing_referrer?: string;
  landing_utm?: Record<string, unknown>;
  first_seen_at: string;
  last_seen_at: string;
  total_events: number;
  total_orders: number;
};

// UserEvent — registro append-only. Cada page-view, click, modal-open vai
// pra cá. event_type whitelisted no backend.
export type UserEvent = {
  id: string;
  visitor_id: string;
  user_id?: string | null;
  event_type: string;
  path?: string | null;
  referrer?: string | null;
  payload?: Record<string, unknown> | null;
  utm?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
  analytics_consent?: boolean | null;
  occurred_at: string;
};

// Resultado de bulk soft-delete: cada id pode falhar individualmente.
export type BulkDeleteResult = {
  succeeded: number;
  failed?: Array<{ id: string; error: string }>;
};

// HoneypotEntry — entrada do log admin_honeypot_log. Só superadmin lê.
export type HoneypotEntry = {
  id: string;
  actor_admin_id: string;
  target_admin_id: string;
  action: "get" | "update_role" | "delete";
  attempted_role?: string | null;
  metadata?: Record<string, unknown> | null;
  attempted_at: string;
  actor_email?: string | null;
  actor_name?: string | null;
  target_email?: string | null;
  target_name?: string | null;
};

// VisitorSummary — agregado calculado pra listagem em /analytics/visitors.
// user_email / user_name vêm preenchidos quando o visitor converteu.
export type VisitorSummary = {
  visitor_id: string;
  user_id?: string | null;
  user_email?: string | null;
  user_name?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  total_events: number;
  landing_path?: string | null;
  landing_utm?: Record<string, unknown> | null;
  last_ip?: string | null;
  last_user_agent?: string | null;
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
  // user_name/user_email são populados em AdminListInvoices via JOIN.
  // Em AdminGetInvoice o backend retorna {invoice, user} separado; estes
  // campos opcionais só aparecem no list.
  user_name?: string;
  user_email?: string;
  // Soft-delete (migration 045).
  deleted_at?: string | null;
  deleted_by_admin_id?: string | null;
  delete_reason?: string | null;
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

// AdminUser é a representação pública de um row da tabela admins.
// password_hash NUNCA aparece — o backend stripa antes de devolver.
export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  requires_2fa: boolean;
  created_at: string;
};

export type Role = {
  code: string;
  label: string;
  permissions: string[];
};
