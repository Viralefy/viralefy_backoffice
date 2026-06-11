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
  const [pendingProofCount, setPendingProofCount] = useState<number>(0);
  const [showOnlyPendingProofs, setShowOnlyPendingProofs] = useState(false);
  // Bulk approve state — só ativa quando filtro proof_status=pending está on.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listOrders().then(setOrders).catch((e) => setError(e.message));
    // Fila de proofs pendentes — busca leve, só pra badge no topo.
    adminApi.listPendingProofs(200).then((rows) => setPendingProofCount(rows.length)).catch(() => undefined);
  }, []);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (status && o.status !== status) return false;
      if (showOnlyPendingProofs && o.proof_status !== "pending") return false;
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0 }}>Orders</h1>
        {pendingProofCount > 0 && (
          <button
            type="button"
            className={showOnlyPendingProofs ? "btn btn-primary" : "btn btn-outline"}
            onClick={() => setShowOnlyPendingProofs((v) => !v)}
            style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }}
            title="Filter to orders with proof_status=pending"
          >
            📎 Proofs to review · {pendingProofCount}
          </button>
        )}
      </div>
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

      {showOnlyPendingProofs && selectedIds.size > 0 && (
        <div className="card" style={{ marginBottom: "1rem", background: "rgba(60,216,125,0.06)", border: "1px solid rgba(60,216,125,0.3)" }}>
          <strong>{selectedIds.size} selected</strong>
          {bulkResult && <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.3rem 0" }}>{bulkResult}</p>}
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button type="button" className="btn btn-primary" disabled={bulkBusy} onClick={async () => {
              if (!confirm(`Approve ${selectedIds.size} proofs? This fires mark-as-paid + emails + tickets per order.`)) return;
              setBulkBusy(true);
              try {
                const r = await adminApi.bulkProofDecision(Array.from(selectedIds), "approved");
                const applied = r.results.filter((x) => x.status === "applied").length;
                const skipped = r.results.filter((x) => x.status === "skipped").length;
                const errors = r.results.filter((x) => x.status === "error").length;
                setBulkResult(`✓ ${applied} applied · ${skipped} skipped · ${errors} errors`);
                setSelectedIds(new Set());
                adminApi.listOrders().then(setOrders);
                adminApi.listPendingProofs(200).then((rows) => setPendingProofCount(rows.length)).catch(() => undefined);
              } catch (e) {
                setBulkResult(e instanceof Error ? e.message : "Bulk failed");
              } finally {
                setBulkBusy(false);
              }
            }}>
              {bulkBusy ? "Working…" : `Approve ${selectedIds.size}`}
            </button>
            <button type="button" className="btn btn-outline" disabled={bulkBusy} onClick={async () => {
              const note = prompt("Reason for rejection (sent in email to customer):") ?? "";
              if (!confirm(`Reject ${selectedIds.size} proofs?`)) return;
              setBulkBusy(true);
              try {
                const r = await adminApi.bulkProofDecision(Array.from(selectedIds), "rejected", note);
                const applied = r.results.filter((x) => x.status === "applied").length;
                setBulkResult(`✓ ${applied} rejected`);
                setSelectedIds(new Set());
                adminApi.listOrders().then(setOrders);
              } catch (e) {
                setBulkResult(e instanceof Error ? e.message : "Bulk failed");
              } finally {
                setBulkBusy(false);
              }
            }}>
              Reject {selectedIds.size}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--accent-dim)", borderBottom: "1px solid var(--border)" }}>
              {showOnlyPendingProofs && (
                <th style={{ padding: "0.65rem 0.5rem", textAlign: "center", width: 32 }}>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((o) => selectedIds.has(o.id))}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(filtered.map((o) => o.id)));
                      else setSelectedIds(new Set());
                    }}
                  />
                </th>
              )}
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
                {showOnlyPendingProofs && (
                  <td style={{ padding: "0.65rem 0.5rem", textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(o.id)}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(o.id); else next.delete(o.id);
                        setSelectedIds(next);
                      }}
                    />
                  </td>
                )}
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
                  {o.deleted_at && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        background: "rgba(239,68,68,0.15)",
                        color: "var(--danger, #ef4444)",
                        padding: "0.1rem 0.45rem",
                        borderRadius: "0.35rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                      title={`Deleted ${new Date(o.deleted_at).toLocaleString()}`}
                    >
                      Deleted
                    </span>
                  )}
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
