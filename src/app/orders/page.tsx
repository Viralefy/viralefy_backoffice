"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Order } from "@/lib/api";

// Lista completa de pedidos. Cada linha é clicável → /orders/{id}.
// Filtros por status + busca por ID/email curto. Detalhes (edição) na
// página de detalhe.

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
];

const statusLabel: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    adminApi.listOrders().then(setOrders).catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (status && o.status !== status) return false;
      if (q) {
        const needle = q.toLowerCase();
        return (
          o.id.toLowerCase().includes(needle) ||
          o.user_id.toLowerCase().includes(needle) ||
          (o.user_name?.toLowerCase().includes(needle) ?? false) ||
          (o.user_email?.toLowerCase().includes(needle) ?? false) ||
          (o.plan_name?.toLowerCase().includes(needle) ?? false) ||
          (o.plan_category?.toLowerCase().includes(needle) ?? false)
        );
      }
      return true;
    });
  }, [orders, status, q]);

  return (
    <AdminShell>
      <h1 style={{ marginBottom: "1rem" }}>Orders</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.value}
            type="button"
            className={status === s.value ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
            onClick={() => setStatus(s.value)}
          >
            {s.label}
          </button>
        ))}
        <input
          className="input"
          placeholder="Search by ID, name, email, category, or plan…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--accent-dim)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>ID</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Customer</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Plan</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Category</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Status</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "right" }}>Amount</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Created</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr
                key={o.id}
                style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => (window.location.href = `/orders/${o.id}`)}
              >
                <td style={{ padding: "0.65rem 1rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                  {o.id.slice(0, 8)}
                </td>
                <td style={{ padding: "0.65rem 1rem" }} onClick={(e) => e.stopPropagation()}>
                  {o.user_name ? (
                    <>
                      <Link href={`/users/${o.user_id}`} style={{ fontWeight: 600 }}>
                        {o.user_name}
                      </Link>
                      {o.user_email && (
                        <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{o.user_email}</div>
                      )}
                    </>
                  ) : (
                    <span style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "var(--muted)" }}>
                      {o.user_id.slice(0, 8)}…
                    </span>
                  )}
                </td>
                <td style={{ padding: "0.65rem 1rem" }}>{o.plan_name || "—"}</td>
                <td style={{ padding: "0.65rem 1rem", color: "var(--muted)", fontSize: "0.85rem" }}>
                  {o.plan_category ?? "—"}
                </td>
                <td style={{ padding: "0.65rem 1rem" }}>
                  <span
                    style={{
                      fontSize: "0.85rem",
                      color: o.status === "paid" ? "var(--success)" : "var(--muted)",
                    }}
                  >
                    {statusLabel[o.status] ?? o.status}
                  </span>
                </td>
                <td style={{ padding: "0.65rem 1rem", textAlign: "right" }}>
                  {o.display_amount} {o.display_currency}
                </td>
                <td style={{ padding: "0.65rem 1rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                  {new Date(o.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "0.65rem 1rem" }}>
                  <Link
                    href={`/orders/${o.id}`}
                    className="btn btn-outline"
                    style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p style={{ color: "var(--muted)", padding: "1rem" }}>No orders found.</p>
        )}
      </div>
    </AdminShell>
  );
}
