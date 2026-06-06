// Sentry — runtime do servidor (Node) do Next.js. Captura erros das
// server actions, API routes, generateMetadata, RSC.
//
// SENTRY_DSN (não NEXT_PUBLIC_) — chave server-side; nunca exposta ao client.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV || "production",
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      return event;
    },
  });
}
