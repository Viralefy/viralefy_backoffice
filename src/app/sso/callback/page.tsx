"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setSession } from "@/lib/auth";

// /sso/callback do backoffice — landing OAuth-style do login unificado.
//
// auth.viralefy.com/login termina o fluxo e nos manda pra cá com:
//   #access_token=...&subject_kind=admin&admin={ID,Email,Name,Role,Permissions?}
//
// Persistimos token + role + permissions no localStorage do admin host e
// redirecionamos pra /dashboard. Fragment é limpo via replaceState pra
// não vazar em referer/share.

const AUTH_UI_URL = process.env.NEXT_PUBLIC_AUTH_UI_URL || "https://auth.viralefy.com";

export default function SSOCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!hash) {
      // Sem fragment — provavelmente landed direto sem passar pelo auth.
      // Redirect pro /login que vai expulsar pra auth.viralefy.com.
      router.replace("/login");
      return;
    }
    try {
      const params = new URLSearchParams(hash);
      const token = params.get("access_token");
      const adminRaw = params.get("admin");
      if (!token) {
        setError("Session payload is missing access_token.");
        return;
      }
      if (!adminRaw) {
        setError("This URL has no admin principal — your account may not have admin access.");
        return;
      }
      const admin = JSON.parse(adminRaw) as { Role?: string; Permissions?: string[] };
      const role = admin.Role ?? "";
      const perms = admin.Permissions ?? [];
      setSession(token, role, perms);
      // Limpa fragment antes da navegação.
      window.history.replaceState(null, "", "/sso/callback");
      router.replace("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to parse session.");
    }
  }, [router]);

  return (
    <div style={{ padding: "4rem 1rem", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div className="card" style={{ padding: "2rem" }}>
        <h1 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>
          {error ? "Sign-in problem" : "Signing you in…"}
        </h1>
        {error ? (
          <>
            <p style={{ color: "var(--danger, #ff6b6b)", fontSize: "0.9rem" }}>{error}</p>
            <p style={{ marginTop: "1.5rem" }}>
              <a className="btn btn-primary" href={`${AUTH_UI_URL}/login?return_to=${encodeURIComponent(typeof window === "undefined" ? "" : window.location.origin + "/sso/callback")}`}>
                Go to login
              </a>
            </p>
          </>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>Restoring your session…</p>
        )}
      </div>
    </div>
  );
}
