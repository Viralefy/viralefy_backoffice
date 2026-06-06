// Sentry — runtime do navegador. Carregado automaticamente em todo bundle
// client. No-op quando NEXT_PUBLIC_SENTRY_DSN está vazio (HML/POC default).
//
// Não usamos Performance/Replay por enquanto pra não inflar o bundle —
// só error reporting estruturado. Habilitar quando convencer-se do volume.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV || "production",
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Drops conhecidos: bots/scrapers e network noise.
    ignoreErrors: [
      "Non-Error promise rejection captured",
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
    ],
  });
}
