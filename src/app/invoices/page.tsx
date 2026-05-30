"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Invoice } from "@/lib/api";
import { can } from "@/lib/auth";

const STATUS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "paid", label: "Pagas" },
  { value: "failed", label: "Falhadas" },
  { value: "cancelled", label: "Canceladas" },
];

function brl(c: number) { return `R$ ${(c / 100).toFixed(2).replace(".", ",")}`; }

export default function InvoicesPage() {
  const [list, setList] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState<string | null>(null);
  const canMarkPaid = can("admins:manage");

  function reload(s: string) {
    adminApi.listInvoices(s || undefined).then(setList).catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload(filter);
  }, [filter]);

  async function markPaid(id: string) {
    if (!confirm("Marcar essa recarga como paga? Isso credita o saldo do usuário.")) return;
    setMarking(id);
    try {
      await adminApi.markInvoicePaid(id);
      reload(filter);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setMarking(null);
    }
  }

  return (
    <AdminShell>
      <h1 style={{ marginBottom: "1rem" }}>Recargas de crédito</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        {STATUS.map((s) => (
          <button
            key={s.value}
            type="button"
            className={filter === s.value ? "btn btn-primary" : "btn btn-outline"}
            style={{ padding: "0.4rem 0.9rem", fontSize: "0.9rem" }}
            onClick={() => setFilter(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuário</th>
              <th>Valor</th>
              <th>Status</th>
              <th>Criada</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => (
              <tr key={inv.id}>
                <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>#{inv.id.slice(0, 8)}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>{inv.user_id.slice(0, 8)}…</td>
                <td>
                  {brl(inv.amount_cents)}
                  {inv.display_currency !== "BRL" && (
                    <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      cobrança {inv.settlement_amount} {inv.settlement_currency}
                    </div>
                  )}
                </td>
                <td>
                  <span style={{ fontSize: "0.85rem", color: inv.status === "paid" ? "var(--success)" : "var(--muted)" }}>
                    {inv.status}
                  </span>
                </td>
                <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {new Date(inv.created_at).toLocaleString("pt-BR")}
                </td>
                <td>
                  {inv.status === "pending" && canMarkPaid && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
                      onClick={() => markPaid(inv.id)}
                      disabled={marking === inv.id}
                    >
                      {marking === inv.id ? "Marcando…" : "Marcar paga"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p style={{ color: "var(--muted)", padding: "1rem" }}>Nenhuma recarga.</p>}
      </div>
    </AdminShell>
  );
}
