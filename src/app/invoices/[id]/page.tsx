"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type InvoiceDetail } from "@/lib/api";
import { can } from "@/lib/auth";

// Detalhe de uma recarga de crédito (invoice). Mostra dados completos +
// dados do cliente clicáveis e botão de marcar paga (com hooks).

function usd(c: number) {
  return `$ ${(c / 100).toFixed(2)}`;
}

const statusColor: Record<string, string> = {
  pending: "var(--muted)",
  paid: "var(--success)",
  failed: "var(--danger)",
  cancelled: "var(--muted)",
};

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [data, setData] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const canMarkPaid = can("admins:manage");

  function load() {
    if (!id) return;
    adminApi.getInvoice(id).then(setData).catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function markPaid() {
    if (!data) return;
    if (!confirm("Marcar essa recarga como paga? Vai creditar o saldo do usuário.")) return;
    setMarking(true);
    try {
      await adminApi.markInvoicePaid(data.invoice.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setMarking(false);
    }
  }

  if (error) {
    return (
      <AdminShell>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <button type="button" className="btn btn-outline" onClick={() => router.push("/invoices")}>
          ← Voltar
        </button>
      </AdminShell>
    );
  }
  if (!data) {
    return (
      <AdminShell>
        <p style={{ color: "var(--muted)" }}>Carregando…</p>
      </AdminShell>
    );
  }

  const inv = data.invoice;
  const user = data.user;

  return (
    <AdminShell>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/invoices" style={{ fontSize: "0.85rem" }}>← Recargas</Link>
        <h1 style={{ margin: "0.25rem 0 0" }}>
          Recarga #{inv.id.slice(0, 8)}{" "}
          <span style={{ color: statusColor[inv.status] ?? "var(--muted)", fontSize: "1rem", fontWeight: 700 }}>
            · {inv.status}
          </span>
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <Section title="Cliente">
          {user ? (
            <>
              <Link href={`/users/${user.id}`} style={{ fontWeight: 600, fontSize: "1rem" }}>
                {user.name}
              </Link>
              <KV k="E-mail" v={user.email} />
              <KV k="ID" v={user.id} mono />
            </>
          ) : (
            <KV k="User ID" v={inv.user_id} mono />
          )}
        </Section>

        <Section title="Valor">
          <KV k="Display" v={`${inv.display_amount} ${inv.display_currency}`} />
          <KV k="Cobrança" v={`${inv.settlement_amount} ${inv.settlement_currency}`} />
          <KV k="Cents (base USD)" v={usd(inv.amount_cents)} />
          <KV k="Moeda canônica" v={inv.currency} />
        </Section>

        <Section title="Status & gateway">
          <KV k="Status" v={inv.status} />
          <KV k="Gateway" v={inv.gateway_id ?? "—"} mono />
          <KV k="External ref" v={inv.external_ref ?? "—"} mono />
          {inv.payment_url && (
            <KV
              k="Link de pagamento"
              v={inv.payment_url}
            />
          )}
        </Section>

        <Section title="Datas">
          <KV k="Criada" v={new Date(inv.created_at).toLocaleString("pt-BR")} />
          <KV k="Atualizada" v={new Date(inv.updated_at).toLocaleString("pt-BR")} />
          {inv.paid_at && <KV k="Paga" v={new Date(inv.paid_at).toLocaleString("pt-BR")} />}
        </Section>
      </div>

      {/* Ações */}
      {canMarkPaid && inv.status === "pending" && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Ações</h2>
          <button
            type="button"
            className="btn btn-primary"
            onClick={markPaid}
            disabled={marking}
          >
            {marking ? "Marcando…" : "✓ Marcar como paga (credita saldo)"}
          </button>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>
            Vai disparar credit_transactions(type=recharge) e atualizar credit_accounts.balance do usuário.
          </p>
        </div>
      )}

      {/* Payment extra (do gateway) */}
      {inv.payment_extra && Object.keys(inv.payment_extra).length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Extras do gateway</h2>
          <pre style={{ background: "var(--accent-dim)", padding: "0.75rem", borderRadius: "0.5rem", overflowX: "auto" }}>
            {JSON.stringify(inv.payment_extra, null, 2)}
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
