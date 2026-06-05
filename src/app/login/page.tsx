"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, setSession } from "@/lib/api";
import { Turnstile } from "@/components/Turnstile";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await login(
        String(fd.get("email")),
        String(fd.get("password")),
        turnstileToken,
      );
      setSession(res.token, res.role, res.permissions);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 style={{ marginBottom: "0.5rem" }}>Viralefy Admin</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          Sign in to manage the marketplace.
        </p>
        <form onSubmit={onSubmit}>
          {error && (
            <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>
          )}
          <label className="label">Email</label>
          <input className="input" name="email" type="email" autoComplete="email" required />
          <label className="label">Password</label>
          <input className="input" name="password" type="password" autoComplete="current-password" required />
          <Turnstile onToken={setTurnstileToken} />
          {/* Submit fica trancado até o Turnstile resolver: API rejeita token
              vazio como INVALID_INPUT, então mostra "checking…" em vez de
              deixar o usuário enviar antes do widget montar. */}
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={loading || !turnstileToken}
          >
            {loading ? "Signing in…" : turnstileToken ? "Sign in" : "Checking…"}
          </button>
        </form>
      </div>
    </div>
  );
}
