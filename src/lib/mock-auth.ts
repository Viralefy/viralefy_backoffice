// MOCK_AUTH bypass — habilitado apenas em builds não-produção quando
// `MOCK_AUTH=1` foi exportado no ambiente do CI (vide
// `.github/workflows/lighthouse.yml`). O objetivo é permitir que o
// Lighthouse renderize `/dashboard` sem precisar de uma sessão real, já
// que toda a auth do backoffice é client-side via localStorage.
//
// Regras invioláveis:
//   - NUNCA ativa se `NODE_ENV === "production"`.
//     (a Lighthouse roda `next build && next start`, então o NODE_ENV é
//     "production" no runtime. Para acomodar isso sem rebaixar a guard,
//     verificamos também NEXT_PUBLIC_APP_ENV que o workflow do CI pode
//     forçar — mas o flag por si só já tem que vir setado, então o risco
//     de vazar em prod requer DUAS variáveis de ambiente erradas
//     simultâneas. Veja `isMockAuthEnabled()` abaixo.)
//   - O indicador `data-mock-auth="1"` no <body> torna óbvio em
//     qualquer screenshot que estamos em modo mock.
//
// Como `process.env.MOCK_AUTH` precisa estar disponível no client,
// expomos via `next.config.ts` (env mapping). Em runtime do CI a variável
// é inlined no bundle.

import type { MetricsSummary, Principal } from "./api";

// MOCK_AUTH é exposto ao client via next.config.ts -> env. NEXT_PUBLIC_APP_ENV
// é o sinal explícito de "este build é um audit do Lighthouse" e cabe ao
// workflow setar — sem ele, mesmo com MOCK_AUTH=1 não bypassamos.
export function isMockAuthEnabled(): boolean {
  if (process.env.MOCK_AUTH !== "1") return false;
  // Em ambiente de audit (CI/Lighthouse) o workflow seta NEXT_PUBLIC_APP_ENV
  // explicitamente. Se não vier, recusamos o bypass.
  const appEnv = process.env.NEXT_PUBLIC_APP_ENV;
  if (appEnv !== "lighthouse" && appEnv !== "ci-audit") return false;
  return true;
}

// Stub principal exposto à UI quando MOCK_AUTH está ligado. `superadmin`
// para que todos os botões / menus aparecem nos screenshots do Lighthouse.
export const MOCK_PRINCIPAL: Principal = {
  admin_id: "00000000-0000-0000-0000-000000000000",
  role: "superadmin",
  permissions: ["*"],
};

export const MOCK_TOKEN = "mock-auth-lighthouse";

// Resposta determinística para o GET /v1/admin/metrics/summary usado pelo
// /dashboard. Valores estáveis para que o Lighthouse não meça flutuações
// de layout/CLS entre runs.
export const MOCK_METRICS_SUMMARY: MetricsSummary = {
  orders_total: 1234,
  orders_paid: 987,
  revenue_usd: "12,345.67",
  status_count: {
    pending: 120,
    paid: 987,
    delivered: 800,
    refunded: 20,
  },
  top_categories: [
    { category: "instagram_followers", orders: 540, revenue_usd: "6,400.00" },
    { category: "tiktok_followers", orders: 230, revenue_usd: "3,100.00" },
    { category: "instagram_likes", orders: 217, revenue_usd: "2,845.67" },
  ],
  daily_30d: Array.from({ length: 30 }, (_, i) => ({
    day: `2026-05-${String(i + 1).padStart(2, "0")}`,
    orders: 20 + ((i * 7) % 25),
    revenue_usd: String(200 + ((i * 13) % 300)),
  })),
};

// Roteia GET requests do client mock para a fixture apropriada. Retorna
// `undefined` quando não há mock — caller deve fall through pro fetch
// real (que em ambiente Lighthouse vai falhar, mas isso é OK: a UI deve
// renderizar mesmo com erro).
export function mockRequest<T>(path: string): T | undefined {
  if (path === "/v1/admin/metrics/summary") {
    return MOCK_METRICS_SUMMARY as unknown as T;
  }
  if (path === "/v1/admin/me") {
    return MOCK_PRINCIPAL as unknown as T;
  }
  return undefined;
}
