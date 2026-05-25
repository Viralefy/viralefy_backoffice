"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Gateway } from "@/lib/api";

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    adminApi.listGateways().then(setGateways).catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await adminApi.createGateway({
      name: String(fd.get("name")),
      provider: String(fd.get("provider")),
      active: fd.get("active") === "on",
      config: { pix_key: String(fd.get("pix_key") || "") },
    });
    setShowForm(false);
    reload();
  }

  async function toggleActive(g: Gateway) {
    await adminApi.updateGateway(g.id, { ...g, active: !g.active });
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Excluir gateway?")) return;
    await adminApi.deleteGateway(id);
    reload();
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Gateways de pagamento</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Novo gateway"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {showForm && (
        <form className="card" onSubmit={handleCreate}>
          <label className="label">Nome</label>
          <input className="input" name="name" required />
          <label className="label">Provider (ex: manual_pix, stripe)</label>
          <input className="input" name="provider" required />
          <label className="label">Chave PIX (config)</label>
          <input className="input" name="pix_key" />
          <label style={{ display: "block", marginTop: "0.5rem" }}>
            <input type="checkbox" name="active" defaultChecked /> Ativo
          </label>
          <button type="submit" className="btn btn-primary" style={{ marginTop: "1rem" }}>
            Salvar
          </button>
        </form>
      )}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Provider</th>
              <th>Config</th>
              <th>Ativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {gateways.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{g.provider}</td>
                <td>{JSON.stringify(g.config)}</td>
                <td>{g.active ? "Sim" : "Não"}</td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => toggleActive(g)}>
                    Toggle
                  </button>{" "}
                  <button type="button" className="btn btn-danger" onClick={() => remove(g.id)}>
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
