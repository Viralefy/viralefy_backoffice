"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  completeAdmin2FA,
  enrollAdmin2FA,
  login,
  setSession,
  type Enroll2FAResult,
  type LoginResult,
} from "@/lib/api";
import { Turnstile } from "@/components/Turnstile";

// LoginPage agora cobre 3 steps:
//   1. credentials  — email + password + Turnstile
//   2. enroll       — admin sem 2FA cadastrada: mostra QR + 8 backup codes
//                     (UMA vez), pede primeiro código pra confirmar
//   3. code         — admin já enrolled: pede código TOTP de 6 dígitos
//                     ou backup 10 chars
// O state guarda partial_token entre steps (TTL 5min, server-validated).

type Step = "credentials" | "enroll" | "code";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Ref evita stale-closure: state assíncrono não chegava na 1ª submission
  // gerando 422 "missing token".
  const turnstileTokenRef = useRef<string>("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const [partialToken, setPartialToken] = useState("");
  const [enrollData, setEnrollData] = useState<Enroll2FAResult | null>(null);

  function handleTurnstileToken(t: string) {
    turnstileTokenRef.current = t;
    setTurnstileToken(t);
  }

  async function onSubmitCredentials(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    // Aguarda até 3s pelo Turnstile token via ref.
    let tok = turnstileTokenRef.current;
    for (let i = 0; i < 30 && !tok; i++) {
      await new Promise((r) => setTimeout(r, 100));
      tok = turnstileTokenRef.current;
    }
    try {
      const res = await login(
        String(fd.get("email")),
        String(fd.get("password")),
        tok,
      );
      // Path A: sem 2FA → access_token vem direto.
      if (res.access_token) {
        finishLogin(res);
        return;
      }
      // Path B: 2FA gate. partial_token + (enroll required) OR (code required).
      if (!res.partial_token) {
        setError("Server returned no token and no partial_token — contact support");
        return;
      }
      setPartialToken(res.partial_token);
      if (res.twofa_enroll_required) {
        try {
          const enroll = await enrollAdmin2FA(res.partial_token);
          setEnrollData(enroll);
          setStep("enroll");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to start 2FA enrollment");
        }
      } else {
        setStep("code");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await completeAdmin2FA(partialToken, String(fd.get("code")));
      finishLogin(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  function finishLogin(res: LoginResult) {
    // Auth devolve admin: { Role, Permissions? }. Permissions vazia até o
    // dashboard buscar /v1/admin/me e re-popular (core enriquece com a
    // role do DB). Fallbacks defensivos pra não crashar caso o auth tenha
    // omitido o objeto admin (token sem 2FA é raro mas possível).
    const token = res.access_token ?? "";
    const role = res.admin?.Role ?? "";
    const perms = res.admin?.Permissions ?? [];
    setSession(token, role, perms);
    router.push("/dashboard");
  }

  return (
    <div className="login-wrap">
      <div className="card login-card">
        <h1 style={{ marginBottom: "0.5rem" }}>Viralefy Admin</h1>
        <p style={{ color: "var(--muted)", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
          {step === "credentials" && "Sign in to manage the marketplace."}
          {step === "enroll" && "Set up two-factor authentication (required for admins)."}
          {step === "code" && "Enter the 6-digit code from your authenticator app."}
        </p>
        {step === "credentials" && (
          <form onSubmit={onSubmitCredentials}>
            {error && <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>}
            <label className="label">Email</label>
            <input className="input" name="email" type="email" autoComplete="email" required />
            <label className="label">Password</label>
            <input className="input" name="password" type="password" autoComplete="current-password" required />
            <Turnstile onToken={handleTurnstileToken} />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%" }}
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "0.4rem 0 0", textAlign: "center" }}>
              {turnstileToken ? "" : "Aguarde 2-3s — verificação anti-bot carregando."}
            </p>
          </form>
        )}

        {step === "enroll" && enrollData && (
          <EnrollWizard
            data={enrollData}
            partialToken={partialToken}
            onComplete={finishLogin}
            onError={setError}
            error={error}
          />
        )}

        {step === "code" && (
          <form onSubmit={onSubmitCode}>
            {error && <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>}
            <label className="label">Authenticator code</label>
            <input
              className="input"
              name="code"
              autoComplete="one-time-code"
              autoFocus
              inputMode="numeric"
              placeholder="123456 or BACKUPCODE"
              required
            />
            <p style={{ color: "var(--muted)", fontSize: "0.78rem", margin: "0.4rem 0 1rem" }}>
              Use your authenticator app, or one of your backup codes if you lost the device.
            </p>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "Verifying…" : "Sign in"}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ width: "100%", marginTop: "0.5rem" }}
              onClick={() => { setStep("credentials"); setError(null); setPartialToken(""); }}
            >
              ← Use a different account
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function EnrollWizard({
  data, partialToken, onComplete, onError, error,
}: {
  data: Enroll2FAResult;
  partialToken: string;
  onComplete: (r: LoginResult) => void;
  onError: (m: string | null) => void;
  error: string | null;
}) {
  const [loading, setLoading] = useState(false);
  const [savedAck, setSavedAck] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    onError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await completeAdmin2FA(partialToken, String(fd.get("code")));
      onComplete(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  function downloadBackupCodes() {
    const text = `Viralefy admin 2FA backup codes (${new Date().toISOString()})\n\n` +
      data.backup_codes.map((c, i) => `${i + 1}. ${c}`).join("\n") +
      "\n\nKeep these safe. Each code works ONCE. Lose them and your account is lost.\n";
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "viralefy-2fa-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // QR via api.qrserver.com — public CDN, no client lib. Embed otpauth:// URL.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(data.otpauth_url)}`;

  return (
    <div>
      {error && <p style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>}
      <ol style={{ paddingLeft: "1.1rem", color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
        <li>Install Google Authenticator, Authy, 1Password, or Bitwarden.</li>
        <li>Scan the QR code (or paste the secret manually).</li>
        <li>Save your backup codes — they are shown only here.</li>
        <li>Enter the 6-digit code to finish setup.</li>
      </ol>
      <div style={{ textAlign: "center", marginBottom: "1rem" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrSrc} alt="2FA QR code" width={220} height={220} style={{ borderRadius: "0.5rem", background: "white", padding: "0.25rem" }} />
      </div>
      <details style={{ marginBottom: "1rem" }}>
        <summary style={{ cursor: "pointer", fontSize: "0.85rem", color: "var(--muted)" }}>Can&apos;t scan? Paste this secret manually</summary>
        <input readOnly className="input" value={data.secret_base32} style={{ marginTop: "0.4rem", fontFamily: "monospace", fontSize: "0.85rem" }} />
      </details>
      <div className="card" style={{ background: "rgba(255,76,76,0.08)", border: "1px solid rgba(255,76,76,0.3)", marginBottom: "1rem" }}>
        <strong style={{ display: "block", marginBottom: "0.4rem" }}>⚠ Backup codes (shown only once)</strong>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.3rem", fontFamily: "monospace", fontSize: "0.85rem", marginBottom: "0.5rem" }}>
          {data.backup_codes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <button type="button" className="btn btn-outline" style={{ width: "100%" }} onClick={downloadBackupCodes}>
          📥 Download backup codes
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.5rem", fontSize: "0.85rem" }}>
          <input type="checkbox" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} />
          I&apos;ve saved these somewhere safe.
        </label>
      </div>
      <form onSubmit={onSubmit}>
        <label className="label">First 6-digit code from your app</label>
        <input
          className="input"
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          placeholder="123456"
          required
          disabled={!savedAck}
        />
        <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: "0.8rem" }} disabled={loading || !savedAck}>
          {loading ? "Verifying…" : "Activate 2FA and sign in"}
        </button>
      </form>
    </div>
  );
}
