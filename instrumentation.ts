// Hook do Next.js — chamado uma vez por runtime (node + edge) na inicialização.
// Importa o config correspondente pra inicializar o Sentry no contexto certo.

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string; headers: { [key: string]: string | undefined } },
) => {
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request, { routerKind: "App Router", routePath: request.path, routeType: "render" });
};
