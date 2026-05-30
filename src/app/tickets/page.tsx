"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type TicketView } from "@/lib/api";

const STATUS: { value: string; label: string; color: string }[] = [
  { value: "", label: "Todos", color: "#9ca3af" },
  { value: "open", label: "Abertos", color: "#a855f7" },
  { value: "pending", label: "Aguardando cliente", color: "#f59e0b" },
  { value: "resolved", label: "Resolvidos", color: "#22c55e" },
  { value: "closed", label: "Fechados", color: "#6b7280" },
];

const PRIORITY_COLOR: Record<string, string> = {
  low: "#9ca3af",
  normal: "#a855f7",
  high: "#f59e0b",
  urgent: "#ef4444",
};

export default function TicketsAdminPage() {
  const [tickets, setTickets] = useState<TicketView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("");

  function load(s: string) {
    adminApi.listTickets(s || undefined).then(setTickets).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load(filter);
  }, [filter]);

  return (
    <AdminShell>
      <h1 style={{ marginBottom: "1rem" }}>Tickets de suporte</h1>
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
              <th>Assunto</th>
              <th>Cliente</th>
              <th>Status</th>
              <th>Prioridade</th>
              <th>Mensagens</th>
              <th>Última atividade</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => {
              const isPendingReply = t.last_author_type === "user" && t.status === "open";
              return (
                <tr key={t.id} style={isPendingReply ? { background: "rgba(245,158,11,0.06)" } : undefined}>
                  <td>
                    <Link href={`/tickets/${t.id}`} style={{ color: "var(--text)" }}>
                      <strong>{t.subject}</strong>
                      <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>#{t.id.slice(0, 8)}</div>
                    </Link>
                  </td>
                  <td style={{ fontSize: "0.9rem" }}>
                    {t.user_name || "—"}<br/>
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{t.user_email}</span>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{t.status}</td>
                  <td>
                    <span style={{ color: PRIORITY_COLOR[t.priority] ?? "var(--muted)", fontSize: "0.85rem", fontWeight: 600 }}>
                      {t.priority}
                    </span>
                  </td>
                  <td>{t.message_count}</td>
                  <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                    {new Date(t.last_message_at).toLocaleString("pt-BR")}
                    {isPendingReply && <span style={{ color: "#f59e0b" }}> · aguardando você</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tickets.length === 0 && (
          <p style={{ color: "var(--muted)", padding: "1rem" }}>Nenhum ticket nesse filtro.</p>
        )}
      </div>
    </AdminShell>
  );
}
