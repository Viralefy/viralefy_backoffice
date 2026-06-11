"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type UserDetail } from "@/lib/api";
import { can } from "@/lib/auth";
import { JourneyPanel } from "@/components/JourneyPanel";
import { DeleteActions } from "@/components/DeleteActions";

const TX_LABEL: Record<string, string> = {
  recharge: "Top-up",
  spend: "Order",
  refund: "Refund",
  adjustment: "Adjustment",
};

// Créditos são canonicamente USD-cents.
function usd(c: number) {
  return `$ ${(c / 100).toFixed(2)}`;
}

export default function UserDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const writable = can("admins:manage");

  async function load() {
    try {
      setData(await adminApi.getUser(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Ajuste de saldo. Unidade do form = USD (não R$). Créditos são USD-cents
  // canônicos desde a migração 011 — admin digita "50" → grava $ 50.00. Antes
  // o form rotulava "Δ em R$" e o admin entrava 50 achando R$ 50, mas saía $ 50
  // USD no ledger (≈ R$ 270). Bug silencioso. Agora "Δ em USD" + dialog "$ X".
  async function onAdjust(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const usdDelta = parseFloat(String(fd.get("delta") ?? "0").replace(",", "."));
    if (!usdDelta || isNaN(usdDelta)) return;
    const description = String(fd.get("description") ?? "Manual adjustment");
    if (!confirm(`${usdDelta > 0 ? "Credit" : "Debit"} $ ${Math.abs(usdDelta).toFixed(2)} USD to ${data?.user.email}?`)) return;
    setAdjusting(true);
    try {
      await adminApi.adjustCredits(id, Math.round(usdDelta * 100), description);
      (e.target as HTMLFormElement).reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setAdjusting(false);
    }
  }

  if (!data) {
    return (
      <AdminShell>
        <p><Link href="/users">← Customers</Link></p>
        {error ? <div className="alert alert-error">{error}</div> : <p style={{ color: "var(--muted)" }}>Loading…</p>}
      </AdminShell>
    );
  }

  const u = data.user;
  return (
    <AdminShell>
      <p style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        <Link href="/users">← Customers</Link>
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="card">
          <h1 style={{ fontSize: "1.3rem", marginBottom: "0.25rem" }}>{u.name || u.email}</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{u.email}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: "0.5rem", fontFamily: "monospace" }}>#{u.id}</p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Customer since {new Date(u.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ color: "var(--muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: ".5px", marginBottom: "0.25rem" }}>Balance</p>
          <p className="plan-price" style={{ fontSize: "2rem", margin: 0 }}>{usd(data.credits?.balance_cents ?? 0)}</p>
        </div>
      </div>

      {writable && (
        <form onSubmit={onAdjust} className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Adjust balance</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
            Use a negative value to debit. Each adjustment is a row in the ledger. Balance is canonically USD-cents — enter the amount in <strong>USD</strong>.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "0.5rem", alignItems: "end" }}>
            <div>
              <label className="label" htmlFor="delta">Δ in USD ($)</label>
              <input className="input" id="delta" name="delta" type="number" step="0.01" placeholder="e.g. 50 or -10" required />
            </div>
            <div>
              <label className="label" htmlFor="description">Description</label>
              <input className="input" id="description" name="description" placeholder="e.g. Courtesy bonus" required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={adjusting}>
              {adjusting ? "…" : "Apply"}
            </button>
          </div>
        </form>
      )}

      <DeleteActions
        label="Customer"
        deletedAt={u.deleted_at}
        deletedBy={u.deleted_by_admin_id}
        deleteReason={u.delete_reason}
        onSoftDelete={(reason) => adminApi.softDeleteUser(id, reason)}
        onHardDelete={() => adminApi.hardDeleteUser(id)}
        onRestore={() => adminApi.restoreUser(id)}
      />

      <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Tracking journey</h2>
      <div style={{ marginBottom: "1.5rem" }}>
        <JourneyPanel mode={{ kind: "user", userID: id }} />
      </div>

      <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Profiles ({data.profiles.length})</h2>
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        {data.profiles.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No profiles.</p>
        ) : (
          <table>
            <thead>
              <tr><th>Platform</th><th>Handle</th><th>Nickname</th><th>Added</th></tr>
            </thead>
            <tbody>
              {data.profiles.map((p) => (
                <tr key={p.id}>
                  <td>{p.platform === "tiktok" ? "🎵 TikTok" : "📷 Instagram"}</td>
                  <td>@{p.handle}{p.verified && <span style={{ color: "var(--success)", marginLeft: "0.4rem", fontSize: "0.8rem" }}>✓</span>}</td>
                  <td style={{ color: "var(--muted)" }}>{p.display_name || "—"}</td>
                  <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>Ledger ({data.transactions.length})</h2>
      <div className="card" style={{ padding: 0 }}>
        {data.transactions.length === 0 ? (
          <p style={{ color: "var(--muted)", padding: "1rem" }}>No transactions.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(168,85,247,0.06)" }}>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.8rem", color: "var(--muted)" }}>When</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.8rem", color: "var(--muted)" }}>Type</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "left", fontSize: "0.8rem", color: "var(--muted)" }}>Description</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.8rem", color: "var(--muted)" }}>Amount</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.8rem", color: "var(--muted)" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.transactions.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.8rem", color: "var(--muted)" }}>{new Date(t.created_at).toLocaleString()}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>{TX_LABEL[t.type] ?? t.type}</td>
                  <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>
                    {t.description}
                    <div style={{ color: "var(--muted)", fontSize: "0.7rem", fontFamily: "monospace" }}>
                      #{t.id.slice(0, 8)}{t.order_id ? ` · order ${t.order_id.slice(0,8)}` : ""}{t.invoice_id ? ` · inv ${t.invoice_id.slice(0,8)}` : ""}
                    </div>
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontWeight: 600, color: t.amount_cents > 0 ? "var(--success)" : "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
                    {t.amount_cents > 0 ? "+ " : "− "}{usd(Math.abs(t.amount_cents))}
                  </td>
                  <td style={{ padding: "0.5rem 0.75rem", textAlign: "right", fontSize: "0.85rem", color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
                    {usd(t.balance_after_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
