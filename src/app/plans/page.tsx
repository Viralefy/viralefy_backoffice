"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Plan } from "@/lib/api";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function reload() {
    adminApi.listPlans().then(setPlans).catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await adminApi.createPlan({
      name: String(fd.get("name")),
      description: String(fd.get("description")),
      followers_qty: Number(fd.get("followers_qty")),
      price_cents: Number(fd.get("price_cents")),
      currency: "BRL",
      active: fd.get("active") === "on",
      sort_order: Number(fd.get("sort_order")),
    });
    setShowForm(false);
    reload();
  }

  async function toggleActive(plan: Plan) {
    await adminApi.updatePlan(plan.id, { ...plan, active: !plan.active });
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Excluir plano?")) return;
    await adminApi.deletePlan(id);
    reload();
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Planos</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Novo plano"}
        </button>
      </div>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      {showForm && (
        <form className="card" onSubmit={handleCreate}>
          <div className="form-row">
            <div>
              <label className="label">Nome</label>
              <input className="input" name="name" required />
            </div>
            <div>
              <label className="label">Seguidores</label>
              <input className="input" name="followers_qty" type="number" required />
            </div>
          </div>
          <label className="label">Descrição</label>
          <input className="input" name="description" />
          <div className="form-row">
            <div>
              <label className="label">Preço (centavos)</label>
              <input className="input" name="price_cents" type="number" required />
            </div>
            <div>
              <label className="label">Ordem</label>
              <input className="input" name="sort_order" type="number" defaultValue={0} />
            </div>
          </div>
          <label>
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
              <th>Seguidores</th>
              <th>Preço</th>
              <th>Ativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.followers_qty.toLocaleString("pt-BR")}</td>
                <td>R$ {(p.price_cents / 100).toFixed(2)}</td>
                <td>{p.active ? "Sim" : "Não"}</td>
                <td>
                  <button type="button" className="btn btn-ghost" onClick={() => toggleActive(p)}>
                    Toggle
                  </button>{" "}
                  <button type="button" className="btn btn-danger" onClick={() => remove(p.id)}>
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
