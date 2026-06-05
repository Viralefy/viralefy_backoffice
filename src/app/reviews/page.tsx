"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type AdminReview } from "@/lib/api";
import { can } from "@/lib/auth";

// Moderação de reviews. Lista os reviews com filtros (todos / só escondidos)
// + ações: toggle visibility. Permissão reviews:read pra ver,
// reviews:moderate pra alterar.

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "hidden", label: "Hidden only" },
];

function stars(n: number): string {
  const f = Math.max(0, Math.min(5, n));
  return "★".repeat(f) + "☆".repeat(5 - f);
}

export default function ReviewsAdminPage() {
  const [list, setList] = useState<AdminReview[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const canModerate = can("reviews:moderate");

  function load(f: string) {
    adminApi
      .listReviews({ only_hidden: f === "hidden" })
      .then(setList)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  async function toggle(r: AdminReview) {
    if (!canModerate) return;
    setUpdatingId(r.id);
    try {
      const updated = await adminApi.setReviewVisibility(r.id, !r.visible);
      setList((curr) => curr.map((x) => (x.id === r.id ? { ...x, ...updated } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update visibility");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <AdminShell>
      <h1 style={{ marginBottom: "1rem" }}>Customer reviews</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "0.4rem 0.9rem", fontSize: "0.9rem" }}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--accent-dim)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Customer</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Plan</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Rating</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Review</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Order</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Submitted</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Visible</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }} />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "0.65rem 1rem", fontSize: "0.9rem" }}>
                  <Link href={`/users/${r.user_id}`}>{r.user_name || "—"}</Link>
                  <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{r.user_email}</div>
                </td>
                <td style={{ padding: "0.65rem 1rem", fontSize: "0.85rem" }}>
                  {r.plan_name || "—"}
                  <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{r.plan_category} · {r.country_code.toUpperCase()}</div>
                </td>
                <td style={{ padding: "0.65rem 1rem", color: "#f59e0b", letterSpacing: "0.05em" }}>
                  {stars(r.rating)}{" "}
                  <span style={{ color: "var(--muted)", fontSize: "0.75rem", letterSpacing: 0 }}>{r.rating}/5</span>
                </td>
                <td style={{ padding: "0.65rem 1rem", maxWidth: 320 }}>
                  {r.title && <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{r.title}</div>}
                  {r.body && <div style={{ color: "var(--muted)", fontSize: "0.8rem", whiteSpace: "pre-wrap" }}>{r.body}</div>}
                  {!r.title && !r.body && <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>— rating only —</span>}
                </td>
                <td style={{ padding: "0.65rem 1rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  <Link href={`/orders/${r.order_id}`}>#{r.order_id.slice(0, 8)}</Link>
                </td>
                <td style={{ padding: "0.65rem 1rem", color: "var(--muted)", fontSize: "0.8rem" }}>
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "0.65rem 1rem" }}>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "0.4rem",
                      background: r.visible ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
                      color: r.visible ? "var(--success)" : "var(--danger)",
                      fontWeight: 600,
                    }}
                  >
                    {r.visible ? "Visible" : "Hidden"}
                  </span>
                </td>
                <td style={{ padding: "0.65rem 1rem" }}>
                  {canModerate && (
                    <button
                      type="button"
                      className={r.visible ? "btn btn-danger" : "btn btn-primary"}
                      style={{ padding: "0.3rem 0.7rem", fontSize: "0.78rem" }}
                      onClick={() => toggle(r)}
                      disabled={updatingId === r.id}
                    >
                      {updatingId === r.id ? "…" : r.visible ? "Hide" : "Restore"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && (
          <p style={{ color: "var(--muted)", padding: "1rem" }}>No reviews in this filter.</p>
        )}
      </div>
    </AdminShell>
  );
}
