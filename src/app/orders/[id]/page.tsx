"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type OrderDetail } from "@/lib/api";
import { can } from "@/lib/auth";

// Detalhe do pedido — order completo + profile e user hidratados (clicáveis
// para a página do usuário). Inclui visualização dos snapshots baseline e
// delivery (fonte secundária de verdade sobre a entrega do gateway) e
// botão de Capturar agora (manual refresh).
//
// Edição de status: admins:manage troca direto (sem hooks) OU dispara
// mark-paid (com email + ticket + admin webhook).

const STATUS_OPTIONS = ["pending", "paid", "failed", "cancelled"];

function platformURL(platform: string, handle: string): string {
  if (platform === "instagram") return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  if (platform === "tiktok") return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
  return "#";
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [data, setData] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [statusDraft, setStatusDraft] = useState<string>("");
  const canEdit = can("admins:manage");

  function load() {
    if (!id) return;
    adminApi
      .getOrder(id)
      .then((d) => {
        setData(d);
        setStatusDraft(d.order.status);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveStatus() {
    if (!data || statusDraft === data.order.status) return;
    if (!confirm(`Change status from "${data.order.status}" to "${statusDraft}"? This does NOT fire email/webhook.`)) {
      return;
    }
    setSaving(true);
    try {
      await adminApi.patchOrder(data.order.id, { status: statusDraft });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save error");
    } finally {
      setSaving(false);
    }
  }

  async function markPaid() {
    if (!data) return;
    if (
      !confirm(
        "Mark as paid through the payment flow? Will fire confirmation email, open ticket (if handoff category), and notify admin via webhook.",
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await adminApi.markOrderPaid(data.order.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function capture(kind: "baseline" | "delivery") {
    if (!data) return;
    setCapturing(true);
    try {
      await adminApi.captureOrderMetrics(data.order.id, kind);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scrape failed");
    } finally {
      setCapturing(false);
    }
  }

  if (error) {
    return (
      <AdminShell>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <button type="button" className="btn btn-outline" onClick={() => router.push("/orders")}>
          ← Back
        </button>
      </AdminShell>
    );
  }
  if (!data) {
    return (
      <AdminShell>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </AdminShell>
    );
  }

  const order = data.order;
  const profile = data.profile;
  const user = data.user;

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <Link href="/orders" style={{ fontSize: "0.85rem" }}>← Orders</Link>
          <h1 style={{ margin: "0.25rem 0 0" }}>
            #{order.id.slice(0, 8)} <span style={{ color: "var(--muted)", fontSize: "1rem" }}>· {order.plan_name}</span>
          </h1>
        </div>
        {order.ticket_id && (
          <Link href={`/tickets/${order.ticket_id}`} className="btn btn-outline">
            💬 Related ticket
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {/* Dados do pedido + cliente e perfil hidratados */}
        <Section title="Order">
          <KV k="ID" v={order.id} mono />
          <KV k="Plan" v={`${order.plan_name} (${order.plan_id.slice(0, 8)})`} />
          <KV k="Category" v={order.plan_category ?? "—"} />
          <KV k="Method" v={order.payment_method ?? "gateway"} />
          <KV k="External ref" v={order.external_ref ?? "—"} mono />
          <KV k="Created" v={new Date(order.created_at).toLocaleString()} />
          {order.updated_at && <KV k="Updated" v={new Date(order.updated_at).toLocaleString()} />}
        </Section>

        <Section title="Customer">
          {user ? (
            <>
              <div style={{ marginBottom: "0.5rem" }}>
                <Link href={`/users/${user.id}`} style={{ fontWeight: 600, fontSize: "1rem" }}>
                  {user.name}
                </Link>
              </div>
              <KV k="Email" v={user.email} />
              <KV k="ID" v={user.id} mono />
            </>
          ) : (
            <KV k="User ID" v={order.user_id} mono />
          )}
        </Section>

        <Section title="Target">
          {profile ? (
            <>
              <div style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <a
                  href={platformURL(profile.platform, profile.handle)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 600, fontSize: "1rem" }}
                >
                  @{profile.handle}
                </a>
                <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {profile.platform === "tiktok" ? "🎵" : "📷"} {profile.platform}
                </span>
                {profile.verified && <span title="Verified" style={{ color: "var(--accent)" }}>✓</span>}
              </div>
              {profile.display_name && <KV k="Name" v={profile.display_name} />}
              <KV k="Profile ID" v={profile.id} mono />
              {user && (
                <Link href={`/users/${user.id}`} style={{ fontSize: "0.85rem", textDecoration: "underline" }}>
                  See customer&apos;s other profiles →
                </Link>
              )}
            </>
          ) : order.publication_url ? (
            <>
              <a
                href={order.publication_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontWeight: 600, fontSize: "0.95rem", wordBreak: "break-all" }}
              >
                {order.publication_url}
              </a>
              <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.5rem 0 0" }}>Target post</p>
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>No target</p>
          )}
        </Section>

        <Section title="Amounts">
          <KV k="Display" v={`${order.display_amount} ${order.display_currency}`} />
          <KV k="Charge" v={`${order.settlement_amount} ${order.settlement_currency}`} />
          <KV k="Cents (USD base)" v={String(order.amount_cents)} />
          <KV k="Canonical currency" v={order.currency} />
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
                {saving ? "Saving…" : "Save"}
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
              ✓ Mark as paid (with hooks)
            </button>
          )}
        </Section>
      </div>

      {/* Baseline vs Delivery — fonte secundária de verdade pra confirmar entrega */}
      <BaselineDeliveryCard
        order={order}
        canEdit={canEdit}
        capturing={capturing}
        onCapture={capture}
      />

      {/* Custom data — schema livre da categoria (recovery/BMs/perfis) */}
      {order.custom_data && Object.keys(order.custom_data).length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Category form</h2>
          <pre style={{ background: "var(--accent-dim)", padding: "0.75rem", borderRadius: "0.5rem", overflowX: "auto" }}>
            {JSON.stringify(order.custom_data, null, 2)}
          </pre>
        </div>
      )}

      {/* Tracking — UTM, fbclid, etc. */}
      {order.tracking && Object.keys(order.tracking).length > 0 && (
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Tracking & origin</h2>
          <pre style={{ background: "var(--accent-dim)", padding: "0.75rem", borderRadius: "0.5rem", overflowX: "auto" }}>
            {JSON.stringify(order.tracking, null, 2)}
          </pre>
        </div>
      )}
    </AdminShell>
  );
}

function BaselineDeliveryCard({
  order,
  canEdit,
  capturing,
  onCapture,
}: {
  order: OrderDetail["order"];
  canEdit: boolean;
  capturing: boolean;
  onCapture: (kind: "baseline" | "delivery") => void;
}) {
  const hasBaseline = !!order.baseline_metrics && Object.keys(order.baseline_metrics).length > 0;
  const hasDelivery = !!order.delivery_metrics && Object.keys(order.delivery_metrics).length > 0;

  return (
    <div className="card" style={{ marginBottom: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ marginTop: 0, marginBottom: "0.25rem", fontSize: "1.05rem" }}>Target metrics (2nd source)</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>
            Public snapshot of the profile/post to verify the gateway delivered.
            Compare <code>delivery − baseline</code> against the plan&apos;s quantity.
          </p>
        </div>
        {canEdit && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onCapture("baseline")}
              disabled={capturing}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              {capturing ? "Capturing…" : hasBaseline ? "↻ Re-capture baseline" : "📸 Capture baseline now"}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onCapture("delivery")}
              disabled={capturing}
              style={{ padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
            >
              {capturing ? "Capturing…" : hasDelivery ? "↻ Re-capture delivery" : "📸 Capture delivery now"}
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "1rem" }}>
        <MetricColumn
          label="Baseline (pre-delivery)"
          metrics={order.baseline_metrics}
          capturedAt={order.baseline_captured_at}
          source={order.baseline_source}
        />
        <MetricColumn
          label="Delivery (post-delivery)"
          metrics={order.delivery_metrics}
          capturedAt={order.delivery_captured_at}
          source={order.delivery_source}
        />
      </div>
    </div>
  );
}

function MetricColumn({
  label,
  metrics,
  capturedAt,
  source,
}: {
  label: string;
  metrics?: Record<string, unknown> | null;
  capturedAt?: string | null;
  source?: string | null;
}) {
  return (
    <div style={{ background: "var(--accent-dim)", padding: "0.75rem", borderRadius: "0.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
        <strong style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</strong>
        {source && (
          <span
            style={{
              fontSize: "0.7rem",
              padding: "0.1rem 0.4rem",
              borderRadius: "0.4rem",
              background: source === "manual_pending" ? "var(--danger, #ef4444)" : "var(--accent)",
              color: "#000",
              fontWeight: 700,
            }}
          >
            {source}
          </span>
        )}
      </div>
      {metrics && Object.keys(metrics).length > 0 ? (
        <pre style={{ fontSize: "0.8rem", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {JSON.stringify(metrics, null, 2)}
        </pre>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: 0 }}>Not captured yet.</p>
      )}
      {capturedAt && (
        <p style={{ color: "var(--muted)", fontSize: "0.75rem", margin: "0.5rem 0 0" }}>
          @ {new Date(capturedAt).toLocaleString()}
        </p>
      )}
    </div>
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
