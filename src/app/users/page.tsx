"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type UserView } from "@/lib/api";

function brl(c: number) {
  return `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;
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
      <h1 style={{ marginBottom: "1rem" }}>Clientes</h1>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <input
        type="search"
        className="input"
        placeholder="Buscar por nome ou e-mail…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ maxWidth: 360, marginBottom: "1rem" }}
      />

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th style={{ textAlign: "right" }}>Saldo</th>
              <th>Desde</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id}>
                <td>{u.name || "—"}</td>
                <td style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>{u.email}</td>
                <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: u.balance_cents > 0 ? "var(--success)" : "var(--muted)" }}>
                  {brl(u.balance_cents)}
                </td>
                <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td>
                  <Link href={`/users/${u.id}`} className="btn btn-outline" style={{ padding: "0.35rem 0.7rem", fontSize: "0.85rem" }}>
                    Detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={{ color: "var(--muted)", padding: "1rem" }}>Nenhum cliente.</p>}
      </div>
    </AdminShell>
  );
}
