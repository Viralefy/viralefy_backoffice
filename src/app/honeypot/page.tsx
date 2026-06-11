"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type HoneypotEntry } from "@/lib/api";
import { isSuperadmin } from "@/lib/auth";

// /honeypot — review SUPERADMIN-only de tentativas que viraram no-op.
//
// Cada row mostra: quem (actor), quando, que ação (update_role | delete),
// em quem (target — sempre superadmin no design atual), o role tentado
// (se update_role), e IP + UA do request original (metadata.ip, etc).
//
// Use: dashboard de "vagabundo querendo me passar pra trás". Se ver
// repetidas tentativas vindo de um actor → considerar banir.

const ACTION_LABEL: Record<string, string> = {
  get: "Viewed admin",
  update_role: "Tried to change role",
  delete: "Tried to delete",
};

export default function HoneypotPage() {
  const router = useRouter();
  const [list, setList] = useState<HoneypotEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperadmin()) {
      router.replace("/dashboard");
      return;
    }
    setLoading(true);
    adminApi
      .getHoneypot(200)
      .then((d) => {
        setList(d ?? []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load honeypot"))
      .finally(() => setLoading(false));
  }, [router]);

  // Agrega por actor pra mostrar "top suspects" — quem tá tentando mais
  // vezes provavelmente é o vagabundo.
  const suspects = new Map<string, { email: string; count: number }>();
  for (const e of list) {
    const id = e.actor_admin_id;
    const cur = suspects.get(id) ?? { email: e.actor_email ?? "", count: 0 };
    cur.count++;
    suspects.set(id, cur);
  }
  const topSuspects = Array.from(suspects.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  return (
    <AdminShell>
      <header style={{ marginBottom: "1.25rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Honeypot · Audit</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.35rem 0 0" }}>
          Tentativas de admins normais mexerem em superadmin. Como o admin
          vê o superadmin como &quot;manager&quot; (camuflado), ele acha que tem poder
          sobre voce. A ação vira no-op aqui mas a tentativa fica
          registrada. Total: <strong>{list.length}</strong>.
        </p>
      </header>

      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}
      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}

      {!loading && topSuspects.length > 0 && (
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.75rem" }}>Top suspects</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.4rem" }}>
            {topSuspects.map(([id, info]) => (
              <li
                key={id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.75rem",
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: "0.4rem",
                  fontSize: "0.88rem",
                }}
              >
                <span>
                  <strong>{info.email || id.slice(0, 8)}</strong>{" "}
                  <code style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{id.slice(0, 8)}</code>
                </span>
                <span style={{ color: "var(--danger, #ef4444)", fontWeight: 700 }}>
                  {info.count} attempt{info.count > 1 ? "s" : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!loading && list.length === 0 ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
          No honeypot triggers yet. Either everyone is well-behaved or
          you&apos;ve been doing this only for a few minutes.
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "rgba(168,85,247,0.06)" }}>
                <th style={th()}>When</th>
                <th style={th()}>Actor</th>
                <th style={th()}>Action</th>
                <th style={th()}>Target</th>
                <th style={th()}>Attempted role</th>
                <th style={th()}>IP</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => {
                const meta = (e.metadata ?? {}) as Record<string, string>;
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={td()}>{new Date(e.attempted_at).toLocaleString()}</td>
                    <td style={td()}>
                      <Link href={`/admins`} style={{ fontWeight: 600 }}>
                        {e.actor_email || e.actor_admin_id.slice(0, 8)}
                      </Link>
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "monospace" }}>
                        {e.actor_admin_id.slice(0, 8)}
                      </div>
                    </td>
                    <td style={td()}>
                      <span
                        style={{
                          padding: "0.15rem 0.5rem",
                          borderRadius: "0.3rem",
                          background: e.action === "delete" ? "rgba(239,68,68,0.15)" : "rgba(245,158,11,0.15)",
                          color: e.action === "delete" ? "var(--danger, #ef4444)" : "#f59e0b",
                          fontSize: "0.78rem",
                          fontWeight: 600,
                        }}
                      >
                        {ACTION_LABEL[e.action] ?? e.action}
                      </span>
                    </td>
                    <td style={td()}>
                      <div>{e.target_email || e.target_admin_id.slice(0, 8)}</div>
                      <div style={{ color: "var(--muted)", fontSize: "0.75rem", fontFamily: "monospace" }}>
                        {e.target_admin_id.slice(0, 8)}
                      </div>
                    </td>
                    <td style={{ ...td(), color: "var(--muted)" }}>{e.attempted_role || "—"}</td>
                    <td style={{ ...td(), fontFamily: "monospace", color: "var(--muted)" }}>
                      {meta.ip || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}

function th(): React.CSSProperties {
  return { padding: "0.55rem 0.75rem", textAlign: "left", fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" };
}
function td(): React.CSSProperties {
  return { padding: "0.55rem 0.75rem", verticalAlign: "top" };
}
