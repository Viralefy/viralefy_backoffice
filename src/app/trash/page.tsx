"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Invoice, type Order, type UserView } from "@/lib/api";
import { isSuperadmin } from "@/lib/auth";

// /trash — aba consolidada de items soft-deleted das 3 entidades. Acesso
// restrito a superadmin (backend gateia via RequireSuperadmin; UI faz
// guard adicional via isSuperadmin + redirect pra dashboard pra admins
// comuns que tentarem entrar).
//
// 3 seções (Customers, Orders, Top-ups), cada uma com tabela mostrando
// quem apagou, quando, motivo. Cada item linka pra detail page (onde
// rola Restore ou Hard Delete via DeleteActions).

type Tab = "users" | "orders" | "invoices";

export default function TrashPage() {
  const router = useRouter();
  const [data, setData] = useState<{ orders: Order[]; invoices: Invoice[]; users: UserView[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("users");

  useEffect(() => {
    // Guard UI extra. Backend é a fonte de verdade (403 se chegar mesmo
    // assim — admin comum nem deve ver o link na sidebar).
    if (!isSuperadmin()) {
      router.replace("/dashboard");
      return;
    }
    setLoading(true);
    adminApi
      .getTrash(200)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load trash"))
      .finally(() => setLoading(false));
  }, [router]);

  const userCount = data?.users.length ?? 0;
  const orderCount = data?.orders.length ?? 0;
  const invoiceCount = data?.invoices.length ?? 0;
  const totalCount = userCount + orderCount + invoiceCount;

  return (
    <AdminShell>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Trash · Superadmin audit</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
          Items soft-deleted pelos admins. Use isto pra revisar deletes
          suspeitos. Hard delete e restore acontecem em cada detail page.
          Total: <strong>{totalCount}</strong> items.
        </p>
      </header>

      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

      {data && (
        <>
          <nav
            style={{
              display: "flex",
              gap: "0.25rem",
              marginBottom: "1rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <TabButton current={tab} value="users" onClick={() => setTab("users")} label={`Customers (${userCount})`} />
            <TabButton current={tab} value="orders" onClick={() => setTab("orders")} label={`Orders (${orderCount})`} />
            <TabButton current={tab} value="invoices" onClick={() => setTab("invoices")} label={`Top-ups (${invoiceCount})`} />
          </nav>

          {tab === "users" && <UsersTable rows={data.users} />}
          {tab === "orders" && <OrdersTable rows={data.orders} />}
          {tab === "invoices" && <InvoicesTable rows={data.invoices} />}
        </>
      )}
    </AdminShell>
  );
}

function TabButton({
  current,
  value,
  onClick,
  label,
}: {
  current: Tab;
  value: Tab;
  onClick: () => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        border: "none",
        borderBottom: active ? "2px solid var(--accent, #00fed6)" : "2px solid transparent",
        padding: "0.5rem 0.85rem",
        marginBottom: "-1px",
        color: active ? "var(--text)" : "var(--muted)",
        cursor: "pointer",
        fontSize: "0.9rem",
        fontWeight: active ? 700 : 500,
      }}
    >
      {label}
    </button>
  );
}

function UsersTable({ rows }: { rows: UserView[] }) {
  if (rows.length === 0) return <EmptyState what="customers" />;
  return (
    <div className="card" style={{ padding: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ background: "rgba(168,85,247,0.06)" }}>
            <th style={th()}>Customer</th>
            <th style={th()}>Email</th>
            <th style={{ ...th(), textAlign: "right" }}>Balance</th>
            <th style={th()}>Deleted at</th>
            <th style={th()}>By admin</th>
            <th style={th()}>Reason</th>
            <th style={th()}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td()}>{u.name || "—"}</td>
              <td style={{ ...td(), fontFamily: "monospace" }}>{u.email}</td>
              <td style={{ ...td(), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                ${(u.balance_cents / 100).toFixed(2)}
              </td>
              <td style={td()}>{u.deleted_at ? new Date(u.deleted_at).toLocaleString() : "—"}</td>
              <td style={{ ...td(), fontFamily: "monospace", color: "var(--muted)" }}>
                {u.deleted_by_admin_id ? u.deleted_by_admin_id.slice(0, 8) : "—"}
              </td>
              <td style={{ ...td(), color: "var(--muted)" }}>{u.delete_reason || "—"}</td>
              <td style={td()}>
                <Link href={`/users/${u.id}`} className="btn btn-outline" style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}>
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OrdersTable({ rows }: { rows: Order[] }) {
  if (rows.length === 0) return <EmptyState what="orders" />;
  return (
    <div className="card" style={{ padding: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ background: "rgba(168,85,247,0.06)" }}>
            <th style={th()}>Order</th>
            <th style={th()}>Plan</th>
            <th style={th()}>Customer</th>
            <th style={{ ...th(), textAlign: "right" }}>Amount</th>
            <th style={th()}>Deleted at</th>
            <th style={th()}>By admin</th>
            <th style={th()}>Reason</th>
            <th style={th()}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td(), fontFamily: "monospace" }}>#{o.id.slice(0, 8)}</td>
              <td style={td()}>{o.plan_name || "—"}</td>
              <td style={{ ...td(), fontFamily: "monospace" }}>{o.user_email || o.user_id?.slice(0, 8) || "—"}</td>
              <td style={{ ...td(), textAlign: "right" }}>
                {o.display_amount} {o.display_currency}
              </td>
              <td style={td()}>{o.deleted_at ? new Date(o.deleted_at).toLocaleString() : "—"}</td>
              <td style={{ ...td(), fontFamily: "monospace", color: "var(--muted)" }}>
                {o.deleted_by_admin_id ? o.deleted_by_admin_id.slice(0, 8) : "—"}
              </td>
              <td style={{ ...td(), color: "var(--muted)" }}>{o.delete_reason || "—"}</td>
              <td style={td()}>
                <Link href={`/orders/${o.id}`} className="btn btn-outline" style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}>
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvoicesTable({ rows }: { rows: Invoice[] }) {
  if (rows.length === 0) return <EmptyState what="top-ups" />;
  return (
    <div className="card" style={{ padding: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ background: "rgba(168,85,247,0.06)" }}>
            <th style={th()}>Top-up</th>
            <th style={th()}>Customer</th>
            <th style={{ ...th(), textAlign: "right" }}>Amount</th>
            <th style={th()}>Status</th>
            <th style={th()}>Deleted at</th>
            <th style={th()}>By admin</th>
            <th style={th()}>Reason</th>
            <th style={th()}>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ ...td(), fontFamily: "monospace" }}>#{i.id.slice(0, 8)}</td>
              <td style={{ ...td(), fontFamily: "monospace" }}>{i.user_email || i.user_id.slice(0, 8)}</td>
              <td style={{ ...td(), textAlign: "right" }}>
                {i.display_amount} {i.display_currency}
              </td>
              <td style={td()}>{i.status}</td>
              <td style={td()}>{i.deleted_at ? new Date(i.deleted_at).toLocaleString() : "—"}</td>
              <td style={{ ...td(), fontFamily: "monospace", color: "var(--muted)" }}>
                {i.deleted_by_admin_id ? i.deleted_by_admin_id.slice(0, 8) : "—"}
              </td>
              <td style={{ ...td(), color: "var(--muted)" }}>{i.delete_reason || "—"}</td>
              <td style={td()}>
                <Link href={`/invoices/${i.id}`} className="btn btn-outline" style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}>
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ what }: { what: string }) {
  return (
    <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
      No deleted {what}. Either everything is intact, or admin hasn&apos;t had to clean up yet.
    </div>
  );
}

function th(): React.CSSProperties {
  return { padding: "0.55rem 0.75rem", textAlign: "left", fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" };
}
function td(): React.CSSProperties {
  return { padding: "0.55rem 0.75rem", verticalAlign: "top" };
}
