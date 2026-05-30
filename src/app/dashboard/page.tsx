"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Order } from "@/lib/api";
import { can } from "@/lib/auth";

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const canMark = can("admins:manage");

  function load() {
    adminApi.listOrders().then(setOrders).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function markPaid(id: string) {
    if (!confirm("Marcar pedido como pago? Use só se o pagamento foi confirmado externamente.")) return;
    setMarking(id);
    try {
      await adminApi.markOrderPaid(id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setMarking(null);
    }
  }

  return (
    <AdminShell>
      <h1 style={{ marginBottom: "1rem" }}>Pedidos</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Plano</th>
              <th>Status</th>
              <th>Exibido</th>
              <th>Cobrança</th>
              <th>Criado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{o.id.slice(0, 8)}…</td>
                <td>{o.plan_name || o.plan_id.slice(0, 8)}</td>
                <td>
                  <span style={{ color: o.status === "paid" ? "var(--success)" : "var(--muted)", fontSize: "0.9rem" }}>
                    {statusLabel[o.status] ?? o.status}
                  </span>
                </td>
                <td>{o.display_amount} {o.display_currency}</td>
                <td>
                  {o.settlement_amount} {o.settlement_currency}
                  {o.settlement_currency !== o.display_currency && (
                    <span style={{ color: "var(--muted)" }}> *</span>
                  )}
                </td>
                <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{new Date(o.created_at).toLocaleString("pt-BR")}</td>
                <td>
                  {o.status === "pending" && canMark && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                      onClick={() => markPaid(o.id)}
                      disabled={marking === o.id}
                    >
                      {marking === o.id ? "…" : "Marcar pago"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && !error && (
          <p style={{ color: "var(--muted)", padding: "1rem" }}>Nenhum pedido ainda.</p>
        )}
      </div>
    </AdminShell>
  );
}
