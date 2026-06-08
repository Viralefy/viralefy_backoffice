"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type MetricsSummary } from "@/lib/api";

// Dashboard de métricas — cards de status + revenue, top categorias e
// série de 30d (mini-bar chart inline em SVG, sem dependência).
// Pedidos listados ficam em /orders.

export default function DashboardPage() {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.metricsSummary().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <AdminShell>
        <h1>Dashboard</h1>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </AdminShell>
    );
  }
  if (!data) {
    return (
      <AdminShell>
        <h1>Dashboard</h1>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </AdminShell>
    );
  }

  const maxOrders = Math.max(1, ...data.daily_30d.map((d) => d.orders));

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <BecomeCustomerButton />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
        <Tile label="Total revenue (USD)" value={`$ ${data.revenue_usd}`} accent />
        <Tile label="Total orders" value={String(data.orders_total)} />
        <Tile label="Paid orders" value={String(data.orders_paid)} />
        <Tile
          label="Conversion rate"
          value={
            data.orders_total === 0
              ? "—"
              : `${((data.orders_paid / data.orders_total) * 100).toFixed(1)}%`
          }
        />
      </div>

      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Current status</h2>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {Object.entries(data.status_count).map(([s, n]) => (
            <div key={s}>
              <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {s}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{n}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Top categories by revenue</h2>
        {data.top_categories.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No paid orders yet.</p>
        ) : (
          <table style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Category</th>
                <th style={{ textAlign: "right" }}>Orders</th>
                <th style={{ textAlign: "right" }}>Revenue (USD)</th>
              </tr>
            </thead>
            <tbody>
              {data.top_categories.map((c) => (
                <tr key={c.category}>
                  <td>{c.category}</td>
                  <td style={{ textAlign: "right" }}>{c.orders}</td>
                  <td style={{ textAlign: "right", fontWeight: 600 }}>$ {c.revenue_usd}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Orders — last 30 days</h2>
        {data.daily_30d.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>No data.</p>
        ) : (
          <svg viewBox={`0 0 ${data.daily_30d.length * 18} 100`} style={{ width: "100%", height: 160 }}>
            {data.daily_30d.map((d, i) => {
              const h = (d.orders / maxOrders) * 90;
              return (
                <rect
                  key={d.day}
                  x={i * 18 + 2}
                  y={100 - h}
                  width={14}
                  height={h}
                  fill="var(--accent)"
                  opacity={0.85}
                >
                  <title>{`${d.day}: ${d.orders} orders · $ ${d.revenue_usd}`}</title>
                </rect>
              );
            })}
          </svg>
        )}
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>
          Hover over each bar to see the day and total.
        </p>
      </div>

      <p style={{ marginTop: "2rem" }}>
        <Link href="/orders" className="btn btn-primary">View full order list →</Link>
      </p>
    </AdminShell>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <div style={{ color: "var(--muted)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: "0.3rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.8rem", fontWeight: 800, color: accent ? "var(--accent)" : "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}

// Botão pra abrir a loja autenticado como customer espelhando o admin
// logado. Idempotente — chama POST /v1/admin/me/become-customer, recebe
// token de user session + (apenas na primeira vez) a senha gerada. Stash
// no localStorage do front e abre a loja em nova aba já logado.
function BecomeCustomerButton() {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const siteURL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.viralefy.com";

  async function onClick() {
    setBusy(true);
    setHint(null);
    try {
      const res = await adminApi.becomeCustomer();
      // Persiste o session token no domínio da loja via página intermediária
      // — abre /auth/handoff?token=... que faz localStorage.setItem e
      // redireciona pra /account. Como localStorage é per-origin, o
      // backoffice (admin.viralefy.com) NÃO consegue setar pra
      // www.viralefy.com diretamente; a página handoff resolve isso.
      const url = new URL("/auth/handoff", siteURL);
      url.searchParams.set("token", res.session.token);
      url.searchParams.set("user_id", res.session.user.id);
      url.searchParams.set("user_email", res.session.user.email);
      url.searchParams.set("user_name", res.session.user.name);
      url.searchParams.set("next", "/account");
      window.open(url.toString(), "_blank", "noopener,noreferrer");
      if (res.generated_password) {
        setHint(`Customer account created. One-time login: ${res.session.user.email} / ${res.generated_password} (save it).`);
      } else {
        setHint(`Opened customer side for ${res.session.user.email}.`);
      }
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ textAlign: "right" }}>
      <button type="button" className="btn btn-outline" onClick={onClick} disabled={busy}>
        {busy ? "Opening…" : "Open customer side ↗"}
      </button>
      {hint && (
        <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "var(--muted)", maxWidth: 360 }}>
          {hint}
        </p>
      )}
    </div>
  );
}
