"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Order } from "@/lib/api";
import { can } from "@/lib/auth";

// Detalhe do pedido. Mostra TUDO que está em orders + permite editar
// status (admins:manage). Marcar pago dispara o hook completo de
// pós-pagamento (email + ticket + webhook); update direto de status
// pula esses hooks (correção emergencial).

const STATUS_OPTIONS = ["pending", "paid", "failed", "cancelled"];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState<string>("");
  const canEdit = can("admins:manage");

  function load() {
    if (!id) return;
    adminApi
      .getOrder(id)
      .then((o) => {
        setOrder(o);
        setStatusDraft(o.status);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveStatus() {
    if (!order || statusDraft === order.status) return;
    if (!confirm(`Mudar status de "${order.status}" para "${statusDraft}"? Essa ação não dispara email/webhook.`)) {
      return;
    }
    setSaving(true);
    try {
      await adminApi.patchOrder(order.id, { status: statusDraft });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!order) return;
    if (
      !confirm(
        "Marcar como pago via fluxo de pagamento? Vai disparar email de confirmação, abrir ticket (se categoria com handoff) e notificar admin via webhook.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await adminApi.markOrderPaid(order.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  if (error) {
    return (
      <AdminShell>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <button type="button" className="btn btn-outline" onClick={() => router.push("/orders")}>
          ← Voltar
        </button>
      </AdminShell>
    );
  }
  if (!order) {
    return (
      <AdminShell>
        <p style={{ color: "var(--muted)" }}>Carregando…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <Link href="/orders" style={{ fontSize: "0.85rem" }}>← Pedidos</Link>
          <h1 style={{ margin: "0.25rem 0 0" }}>
            #{order.id.slice(0, 8)} <span style={{ color: "var(--muted)", fontSize: "1rem" }}>· {order.plan_name}</span>
          </h1>
        </div>
        {order.ticket_id && (
          <Link href={`/tickets/${order.ticket_id}`} className="btn btn-outline">
            💬 Ticket relacionado
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <Section title="Dados do pedido">
          <KV k="ID" v={order.id} mono />
          <KV k="Plano" v={`${order.plan_name} (${order.plan_id.slice(0, 8)})`} />
          <KV k="Categoria" v={order.plan_category ?? "—"} />
          <KV k="Usuário" v={order.user_id} mono />
          <KV k="Método" v={order.payment_method ?? "gateway"} />
          <KV k="External ref" v={order.external_ref ?? "—"} mono />
          <KV k="Criado" v={new Date(order.created_at).toLocaleString("pt-BR")} />
          {order.updated_at && <KV k="Atualizado" v={new Date(order.updated_at).toLocaleString("pt-BR")} />}
        </Section>

        <Section title="Valores">
          <KV k="Display" v={`${order.display_amount} ${order.display_currency}`} />
          <KV k="Cobrança" v={`${order.settlement_amount} ${order.settlement_currency}`} />
          <KV k="Cents (base USD)" v={String(order.amount_cents)} />
          <KV k="Moeda canônica" v={order.currency} />
        </Section>

        <Section title="Alvo">
          <KV k="Profile ID" v={order.profile_id ?? "—"} mono />
          <KV k="Publication URL" v={order.publication_url ?? "—"} />
        </Section>

        <Section title="Status">
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
            <select
              className="input"
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value)}
              disabled={!canEdit || saving}
              style={{ minWidth: 140 }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {canEdit && statusDraft !== order.status && (
              <button type="button" className="btn btn-primary" onClick={saveStatus} disabled={saving}>
                {saving ? "Salvando…" : "Salvar"}
              </button>
            )}
          </div>
          {canEdit && order.status === "pending" && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={markPaid}
              disabled={saving}
              style={{ width: "100%" }}
            >
              ✓ Marcar como pago (com hooks)
            </button>
          )}
        </Section>
      </div>

      {/* Custom data — schema livre da categoria (recovery/BMs/perfis) */}
      {order.custom_data && Object.keys(order.custom_data).length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Form da categoria</h2>
          <pre style={{ background: "var(--accent-dim)", padding: "0.75rem", borderRadius: "0.5rem", overflowX: "auto" }}>
            {JSON.stringify(order.custom_data, null, 2)}
          </pre>
        </div>
      )}

      {/* Tracking — UTM, fbclid, etc. */}
      {order.tracking && Object.keys(order.tracking).length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Tracking & origem</h2>
          <pre style={{ background: "var(--accent-dim)", padding: "0.75rem", borderRadius: "0.5rem", overflowX: "auto" }}>
            {JSON.stringify(order.tracking, null, 2)}
          </pre>
        </div>
      )}
    </AdminShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h2 style={{ marginTop: 0, fontSize: "1.05rem", marginBottom: "0.75rem" }}>{title}</h2>
      {children}
    </div>
  );
}

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "0.25rem 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{k}</span>
      <span style={{ fontFamily: mono ? "monospace" : undefined, fontSize: "0.85rem", textAlign: "right", marginLeft: "1rem", wordBreak: "break-all" }}>
        {v}
      </span>
    </div>
  );
}
