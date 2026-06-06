// Sentry — runtime edge (middleware, route handlers com runtime='edge').
// Hoje só middleware corre nessa runtime, mas mantemos o init pra futuro.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.APP_ENV || "production",
    tracesSampleRate: 0,
  });
}
