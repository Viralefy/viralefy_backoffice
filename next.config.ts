import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// MOCK_AUTH precisa estar disponível no client para o AdminShell skipar
// o redirect pra /login durante audits do Lighthouse. Sem este mapping,
// `process.env.MOCK_AUTH` é `undefined` no bundle do browser.
// Veja src/lib/mock-auth.ts — o flag só é honrado quando NEXT_PUBLIC_APP_ENV
// também sinaliza explicitamente que é um audit (defense-in-depth).
const nextConfig: NextConfig = {
  env: {
    MOCK_AUTH: process.env.MOCK_AUTH ?? "",
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT_BACKOFFICE,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
  tunnelRoute: "/monitoring",
});
