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
      <h1 style={{ marginBottom: "1.5rem" }}>Dashboard</h1>

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
