"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type UserView } from "@/lib/api";

// Saldo de créditos é canônico em USD; mostrar como "$ 12.50".
function usd(c: number) {
  return `$ ${(c / 100).toFixed(2)}`;
}

export default function UsersAdminPage() {
  const [list, setList] = useState<UserView[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.listUsers().then(setList).catch((e) => setError(e.message));
  }, []);

  const filtered = list.filter((u) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q);
  });

  return (
    <AdminShell>
      <h1 style={{ marginBottom: "1rem" }}>Customers</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <input
        type="search"
        className="input"
        placeholder="Search by name or email…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ maxWidth: 360, marginBottom: "1rem" }}
      />

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th style={{ textAlign: "right" }}>Balance</th>
              <th>Since</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} style={u.deleted_at ? { opacity: 0.55 } : undefined}>
                <td>
                  {u.name || "—"}
                  {u.deleted_at && (
                    <span
                      style={{
                        marginLeft: "0.5rem",
                        background: "rgba(239,68,68,0.15)",
                        color: "var(--danger, #ef4444)",
                        padding: "0.1rem 0.45rem",
                        borderRadius: "0.35rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: ".04em",
                      }}
                      title={`Deleted ${new Date(u.deleted_at).toLocaleString()}`}
                    >
                      Deleted
                    </span>
                  )}
                </td>
                <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{u.email}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: u.balance_cents > 0 ? "var(--success)" : "var(--muted)" }}>
                  {usd(u.balance_cents)}
                </td>
                <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
                <td>
                  <Link href={`/users/${u.id}`} className="btn btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.85rem" }}>
                    Details
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={{ color: "var(--muted)", padding: "1rem" }}>No customers.</p>}
      </div>
    </AdminShell>
  );
}
