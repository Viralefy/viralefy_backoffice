// /api/metrics — Prometheus exposition format.
//
// Raspado por prometheus local (127.0.0.1:9090) com job
// `viralefy-backoffice` em http://127.0.0.1:3001/api/metrics. Vide
// viralefy_ops/config/prometheus.yml.
//
// Acesso: rota pública mas só devolve métricas de processo + contadores
// agregados (sem PII). Caddy bloqueia explicitamente /api/metrics em
// {$DOMAIN_BACKOFFICE} (vide viralefy_ops/config/Caddyfile, bloco backoffice).
// Loopback continua respondendo 200.

import { register } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// Runtime Node — prom-client precisa de perf_hooks/process.
export const runtime = "nodejs";

export async function GET() {
  const body = await register.metrics();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": register.contentType,
      "Cache-Control": "no-store",
    },
  });
}
