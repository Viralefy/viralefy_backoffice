"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

function usd(c: number) { return `$ ${(c / 100).toFixed(2)}`; }

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

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--accent-dim)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>ID</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Usuário</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "right" }}>Valor</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Status</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Criada</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }} />
            </tr>
          </thead>
          <tbody>
            {list.map((inv) => (
              <tr
                key={inv.id}
                style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                onClick={() => (window.location.href = `/invoices/${inv.id}`)}
              >
                <td style={{ padding: "0.65rem 1rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  #{inv.id.slice(0, 8)}
                </td>
                <td style={{ padding: "0.65rem 1rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
                  {inv.user_id.slice(0, 8)}…
                </td>
                <td style={{ padding: "0.65rem 1rem", textAlign: "right" }}>
                  {usd(inv.amount_cents)}
                  {inv.display_currency !== "USD" && (
                    <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>
                      cobrança {inv.settlement_amount} {inv.settlement_currency}
                    </div>
                  )}
                </td>
                <td style={{ padding: "0.65rem 1rem" }}>
                  <span style={{ fontSize: "0.85rem", color: inv.status === "paid" ? "var(--success)" : "var(--muted)" }}>
                    {inv.status}
                  </span>
                </td>
                <td style={{ padding: "0.65rem 1rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                  {new Date(inv.created_at).toLocaleString("pt-BR")}
                </td>
                <td style={{ padding: "0.65rem 1rem", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`/invoices/${inv.id}`}
                    className="btn btn-outline"
                    style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                  >
                    Abrir
                  </Link>
                  {inv.status === "pending" && canMarkPaid && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem", marginLeft: "0.5rem" }}
                      onClick={() => markPaid(inv.id)}
                      disabled={marking === inv.id}
                    >
                      {marking === inv.id ? "…" : "Pagar"}
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
