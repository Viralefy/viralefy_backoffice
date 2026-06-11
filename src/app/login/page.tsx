"use client";

import { useEffect } from "react";

// /login do backoffice — redirect 302-soft pra auth.viralefy.com.
//
// Login UI unificada (2026-06-11): toda autenticação acontece em
// auth.viralefy.com/login (uma página só, com 2FA wizard). Esta página fica
// como compat pra bookmarks/links antigos. Faz client-side redirect com
// `return_to=https://admin.viralefy.com/sso/callback` pra que após o login
// o auth host nos mande de volta com session no fragment.

const AUTH_UI_URL = process.env.NEXT_PUBLIC_AUTH_UI_URL || "https://auth.viralefy.com";

export default function LoginPage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const returnTo = `${window.location.origin}/sso/callback`;
    const target = `${AUTH_UI_URL}/login?return_to=${encodeURIComponent(returnTo)}`;
    // replace pra não deixar /login no history (back não volta aqui).
    window.location.replace(target);
  }, []);

  return (
    <div style={{ padding: "4rem 1rem", textAlign: "center", maxWidth: 480, margin: "0 auto" }}>
      <div className="card" style={{ padding: "2rem" }}>
        <h1 style={{ fontSize: "1.2rem", marginBottom: "0.75rem" }}>Redirecting to sign in…</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          We&apos;ve moved sign in to{" "}
          <a href={AUTH_UI_URL} style={{ color: "var(--accent, #00fed6)" }}>auth.viralefy.com</a>.
        </p>
      </div>
    </div>
  );
}
