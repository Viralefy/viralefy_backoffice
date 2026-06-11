"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type VisitorSummary } from "@/lib/api";

const PAGE_SIZE = 50;

// /analytics/visitors — lista paginada de TODOS os visitors (anônimos +
// convertidos), ordenados por última atividade DESC.
//
// Linhas linkam pra /analytics/visitors/{visitor_id} pro drill-down de
// timeline. Quando o visitor virou user, mostramos email + link pro
// detalhe do customer.

export default function VisitorsPage() {
  const [rows, setRows] = useState<VisitorSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    setLoading(true);
    adminApi
      .listVisitors(PAGE_SIZE, offset)
      .then((data) => {
        setRows(data ?? []);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load visitors"))
      .finally(() => setLoading(false));
  }, [offset]);

  return (
    <AdminShell>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Visitors</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.25rem 0 0" }}>
            All tracked visitors, ordered by last activity. Anonymous + converted (signed up).
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            className="btn btn-outline"
            disabled={offset === 0 || loading}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            ← Prev
          </button>
          <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
            {offset + 1}–{offset + rows.length}
          </span>
          <button
            type="button"
            className="btn btn-outline"
            disabled={rows.length < PAGE_SIZE || loading}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Next →
          </button>
        </div>
      </header>

      {error && <div className="alert alert-error" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <p style={{ color: "var(--muted)", padding: "1rem" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--muted)", padding: "1rem" }}>No visitors captured yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr style={{ background: "rgba(168,85,247,0.06)" }}>
                <th style={th()}>Visitor</th>
                <th style={th()}>Customer</th>
                <th style={th()}>Events</th>
                <th style={th()}>Landing path</th>
                <th style={th()}>UTM</th>
                <th style={th()}>IP</th>
                <th style={th()}>First seen</th>
                <th style={th()}>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.visitor_id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={td()}>
                    <Link href={`/analytics/visitors/${encodeURIComponent(v.visitor_id)}`} style={{ fontFamily: "monospace" }}>
                      {short(v.visitor_id)}
                    </Link>
                  </td>
                  <td style={td()}>
                    {v.user_id && v.user_email ? (
                      <Link href={`/users/${v.user_id}`}>{v.user_email}</Link>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>Anonymous</span>
                    )}
                  </td>
                  <td style={td()}>{v.total_events.toLocaleString()}</td>
                  <td style={{ ...td(), fontFamily: "monospace", color: "var(--muted)" }}>{v.landing_path || "—"}</td>
                  <td style={{ ...td(), fontSize: "0.78rem", color: "var(--muted)" }}>{utmCompact(v.landing_utm)}</td>
                  <td style={{ ...td(), fontFamily: "monospace", color: "var(--muted)" }}>{v.last_ip || "—"}</td>
                  <td style={td()}>{date(v.first_seen_at)}</td>
                  <td style={td()}>{date(v.last_seen_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function th(): React.CSSProperties {
  return { padding: "0.55rem 0.75rem", textAlign: "left", fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" };
}
function td(): React.CSSProperties {
  return { padding: "0.55rem 0.75rem", verticalAlign: "top" };
}
function date(s: string): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function short(s: string): string {
  if (!s) return "—";
  return s.length > 14 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
function utmCompact(u: Record<string, unknown> | null | undefined): string {
  if (!u) return "—";
  const src = (u as Record<string, string>).utm_source;
  const med = (u as Record<string, string>).utm_medium;
  const cmp = (u as Record<string, string>).utm_campaign;
  const parts = [src, med, cmp].filter(Boolean);
  return parts.length === 0 ? "—" : parts.join(" / ");
}
