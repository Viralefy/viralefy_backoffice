"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type TicketDetail } from "@/lib/api";
import { can } from "@/lib/auth";

const STATUSES = ["open", "pending", "resolved", "closed"];
const PRIORITIES = ["low", "normal", "high", "urgent"];

export default function TicketAdminThread() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const writable = can("tickets:write");

  async function load() {
    try {
      const d = await adminApi.getTicket(id);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function onReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = String(fd.get("body") ?? "").trim();
    if (!body) return;
    setSending(true);
    try {
      await adminApi.replyTicket(id, body);
      (e.target as HTMLFormElement).reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao responder");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: string) {
    await adminApi.patchTicket(id, { status });
    load();
  }

  async function setPriority(priority: string) {
    await adminApi.patchTicket(id, { priority });
    load();
  }

  if (!detail) {
    return (
      <AdminShell>
        <p><Link href="/tickets">← Tickets</Link></p>
        {error ? <div className="alert alert-error">{error}</div> : <p style={{ color: "var(--muted)" }}>Carregando…</p>}
      </AdminShell>
    );
  }

  const v = detail.view;

  return (
    <AdminShell>
      <p style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        <Link href="/tickets">← Tickets</Link>
      </p>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "1.4rem", marginBottom: "0.5rem" }}>{detail.ticket.subject}</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "0.75rem" }}>
          #{detail.ticket.id.slice(0, 8)} · aberto em {new Date(detail.ticket.created_at).toLocaleString("pt-BR")}
          {v && <> · cliente: <strong style={{ color: "var(--text)" }}>{v.user_name || v.user_email}</strong> ({v.user_email})</>}
        </p>
        {writable && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <div>
              <label className="label" style={{ marginBottom: 4 }}>Status</label>
              <select className="input" value={detail.ticket.status} onChange={(e) => setStatus(e.target.value)} style={{ width: "auto" }}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" style={{ marginBottom: 4 }}>Prioridade</label>
              <select className="input" value={detail.ticket.priority} onChange={(e) => setPriority(e.target.value)} style={{ width: "auto" }}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginBottom: "1rem" }}>
        {detail.messages.map((m) => {
          const isAdmin = m.author_type === "admin";
          return (
            <div
              key={m.id}
              className="card"
              style={{
                borderColor: isAdmin ? "var(--accent)" : "var(--border)",
                background: isAdmin ? "rgba(168,85,247,0.08)" : "var(--surface)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--muted)", fontSize: "0.8rem", marginBottom: "0.4rem" }}>
                <strong style={{ color: isAdmin ? "var(--accent)" : "var(--text)" }}>
                  {isAdmin ? `${m.author_name || "Suporte"} (suporte)` : "Cliente"}
                </strong>
                <span>{new Date(m.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{m.body}</div>
            </div>
          );
        })}
      </div>

      {writable && detail.ticket.status !== "closed" && (
        <form onSubmit={onReply} className="card">
          <label className="label" htmlFor="body">Responder ao cliente</label>
          <textarea className="input" id="body" name="body" rows={5} required placeholder="Sua resposta — também vira e-mail." />
          <button type="submit" className="btn btn-primary" style={{ marginTop: "0.75rem" }} disabled={sending}>
            {sending ? "Enviando…" : "Enviar resposta"}
          </button>
        </form>
      )}
    </AdminShell>
  );
}
