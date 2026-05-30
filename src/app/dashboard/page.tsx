"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Order } from "@/lib/api";

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  failed: "Falhou",
  cancelled: "Cancelado",
};

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listOrders().then(setOrders).catch((e) => setError(e.message));
  }, []);

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
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{o.id.slice(0, 8)}…</td>
                <td>{o.plan_name || o.plan_id.slice(0, 8)}</td>
                <td>{statusLabel[o.status] ?? o.status}</td>
                <td>{o.display_amount} {o.display_currency}</td>
                <td>
                  {o.settlement_amount} {o.settlement_currency}
                  {o.settlement_currency !== o.display_currency && (
                    <span style={{ color: "var(--muted)" }}> *</span>
                  )}
                </td>
                <td>{new Date(o.created_at).toLocaleString("pt-BR")}</td>
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
