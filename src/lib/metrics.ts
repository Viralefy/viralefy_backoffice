// Prometheus metrics — exposto em /api/metrics (raspado por prometheus
// local em 127.0.0.1:3001, vide viralefy_ops/config/prometheus.yml).
//
// Estratégia:
// - prom-client default registry com collectDefaultMetrics (gc, memória,
//   eventloop lag, file descriptors, etc) — fecha o RED de processo.
// - Counter http_requests_total + Histogram http_request_duration_seconds
//   alimentados pelo middleware (src/middleware.ts).
// - Cardinalidade controlada: path é template (collapseIds) e só são
//   contabilizadas rotas conhecidas; tudo mais cai em "/_other".
//
// IMPORTANTE: o módulo é Node-only (prom-client usa perf_hooks/process).
// Não importar do Edge runtime. Middleware roda em Node (vide config
// `runtime: 'nodejs'` em src/middleware.ts).

import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from "prom-client";

// Singleton via globalThis para sobreviver ao HMR em dev e múltiplas
// importações em prod (Next.js compila o mesmo módulo em chunks distintos
// para middleware vs route handler — sem este guard teríamos 2 registries
// em paralelo e o /api/metrics só veria 1 deles).
const GLOBAL_KEY = "__viralefy_backoffice_metrics__";

interface MetricsBundle {
  register: Registry;
  httpRequestsTotal: Counter<"method" | "path" | "status">;
  httpRequestDurationSeconds: Histogram<"method" | "path">;
}

function build(): MetricsBundle {
  const register = new Registry();
  register.setDefaultLabels({ service: "viralefy-backoffice" });

  collectDefaultMetrics({ register });

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total de requests HTTP processadas pelo backoffice.",
    labelNames: ["method", "path", "status"] as const,
    registers: [register],
  });

  const httpRequestDurationSeconds = new Histogram({
    name: "http_request_duration_seconds",
    help: "Latência de requests HTTP em segundos.",
    labelNames: ["method", "path"] as const,
    // Buckets RED-style: cobre desde 5ms até 10s.
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [register],
  });

  return { register, httpRequestsTotal, httpRequestDurationSeconds };
}

const g = globalThis as unknown as { [GLOBAL_KEY]?: MetricsBundle };
const bundle: MetricsBundle = g[GLOBAL_KEY] ?? (g[GLOBAL_KEY] = build());

export const register = bundle.register;
export const httpRequestsTotal = bundle.httpRequestsTotal;
export const httpRequestDurationSeconds = bundle.httpRequestDurationSeconds;

// Rotas conhecidas do backoffice — qualquer outra cai em "/_other" para
// segurar cardinalidade ≤ 1000 series mesmo com paths arbitrários.
const KNOWN_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/login",
  "/dashboard",
  "/admins",
  "/currencies",
  "/gateways",
  "/invoices",
  "/orders",
  "/plans",
  "/reviews",
  "/tickets",
  "/users",
  "/api/metrics",
]);

// IDs numéricos e UUIDs viram [id]; sufixos /edit, /new etc permanecem.
const ID_SEGMENT = /^([0-9]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function sanitizePath(rawPath: string): string {
  // Strip query + hash.
  const noQuery = rawPath.split("?")[0]?.split("#")[0] ?? "/";

  // Colapsa IDs.
  const collapsed =
    "/" +
    noQuery
      .split("/")
      .filter((seg) => seg.length > 0)
      .map((seg) => (ID_SEGMENT.test(seg) ? "[id]" : seg))
      .join("/");

  const normalized = collapsed === "/" ? "/" : collapsed;

  // Match exato OU prefixo de rota conhecida (e.g. "/orders/[id]" casa
  // com "/orders").
  if (KNOWN_PATHS.has(normalized)) return normalized;
  for (const known of KNOWN_PATHS) {
    if (known !== "/" && normalized.startsWith(known + "/")) return known;
  }
  return "/_other";
}
