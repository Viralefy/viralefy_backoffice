// Middleware do Next.js — observabilidade RED por request.
//
// IMPORTANTE: roda em runtime Node (não Edge) porque `prom-client` usa
// APIs Node (perf_hooks, process). O `runtime: "nodejs"` em `config` está
// disponível no Next 15.5+ via flag experimental — vide next.config.ts.
//
// O middleware NÃO faz auth/redirect aqui (o AdminShell em src/app/* cuida
// disso). Aqui só medimos: incrementa http_requests_total + observa
// http_request_duration_seconds. Path é sanitizado (collapseIds + lista
// de rotas conhecidas) pra segurar cardinalidade ≤ 1000 series.

import { NextResponse, type NextRequest } from "next/server";

import {
  httpRequestDurationSeconds,
  httpRequestsTotal,
  sanitizePath,
} from "@/lib/metrics";

export const config = {
  // Roda em Node pra usar prom-client. Sem o matcher abaixo, Next intercepta
  // assets estáticos e adiciona overhead desnecessário.
  runtime: "nodejs",
  matcher: [
    // Tudo exceto _next/static, _next/image, favicon, monitoring (Sentry tunnel).
    "/((?!_next/static|_next/image|favicon.ico|monitoring).*)",
  ],
};

export async function middleware(request: NextRequest) {
  const start = process.hrtime.bigint();
  const method = request.method;
  const path = sanitizePath(request.nextUrl.pathname);

  const response = NextResponse.next();

  // Hook após resposta — Next.js executa middleware antes do handler, então
  // o status final só está disponível ao retornar. Medimos no return path
  // (síncrono) com o status do NextResponse.next() (200 default; rotas que
  // mudam status retornam status real via response.status).
  const durationSeconds =
    Number(process.hrtime.bigint() - start) / 1e9;

  try {
    httpRequestsTotal.inc({
      method,
      path,
      status: String(response.status),
    });
    httpRequestDurationSeconds.observe({ method, path }, durationSeconds);
  } catch {
    // Métricas nunca devem quebrar o request. Engole erro silenciosamente.
  }

  return response;
}
