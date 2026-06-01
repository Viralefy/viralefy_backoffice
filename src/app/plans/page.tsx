"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Category, type Currency, type Plan } from "@/lib/api";
import { can } from "@/lib/auth";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const writable = can("plans:write");

  function reload() {
    adminApi.listPlans().then(setPlans).catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload();
    adminApi.listCategories().then(setCategories).catch(() => setCategories([]));
    adminApi.listCurrencies().then(setCurrencies).catch(() => setCurrencies([]));
  }, []);

  function labelFor(code: string) {
    return categories.find((c) => c.code === code)?.label ?? code;
  }

  function collectPrices(fd: FormData): Record<string, string> {
    const prices: Record<string, string> = {};
    for (const c of currencies) {
      const v = String(fd.get(`price_${c.code}`) ?? "").trim();
      if (v) prices[c.code] = v;
    }
    return prices;
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await adminApi.createPlan({
        name: String(fd.get("name")),
        description: String(fd.get("description")),
        category: String(fd.get("category")),
        followers_qty: Number(fd.get("followers_qty")),
        active: fd.get("active") === "on",
        sort_order: Number(fd.get("sort_order")),
        prices: collectPrices(fd),
      });
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar plano");
    }
  }

  async function savePrices(plan: Plan, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await adminApi.updatePlan(plan.id, { ...plan, prices: collectPrices(fd) });
      setEditing(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar preços");
    }
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
        <h1>Serviços / Planos</h1>
        {writable && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "Novo plano"}
          </button>
        )}
      </div>
      {!writable && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Seu papel é somente leitura para planos.
        </p>
      )}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {showForm && writable && (
        <form className="card" onSubmit={handleCreate} style={{ marginBottom: "1rem" }}>
          <div className="form-row">
            <div>
              <label className="label">Nome</label>
              <input className="input" name="name" required />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input" name="category" defaultValue="seguidores">
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="label">Descrição</label>
          <input className="input" name="description" />
          <div className="form-row">
            <div>
              <label className="label">Quantidade</label>
              <input className="input" name="followers_qty" type="number" defaultValue={1} required />
            </div>
            <div>
              <label className="label">Ordem</label>
              <input className="input" name="sort_order" type="number" defaultValue={0} />
            </div>
          </div>
          <label className="label">Preço por moeda (manual)</label>
          <div className="form-row" style={{ flexWrap: "wrap" }}>
            {currencies.map((c) => (
              <div key={c.code}>
                <label className="label">{c.symbol} {c.code}</label>
                <input className="input" name={`price_${c.code}`} placeholder={c.code === "USD" ? "2.50" : ""} style={{ width: "8rem" }} />
              </div>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.5rem 0" }}>
            USD é obrigatório (moeda base). As demais são opcionais (derivadas
            via taxa de câmbio quando não preenchidas).
          </p>
          <label style={{ display: "block", margin: "0.5rem 0" }}>
            <input type="checkbox" name="active" defaultChecked /> Ativo
          </label>
          <button type="submit" className="btn btn-primary">Salvar</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Qtd</th>
              <th>Preço (BRL)</th>
              <th>Moedas</th>
              <th>Ativo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{labelFor(p.category)}</td>
                <td>{p.followers_qty.toLocaleString("pt-BR")}</td>
                <td>R$ {(p.price_cents / 100).toFixed(2)}</td>
                <td>{Object.keys(p.prices ?? {}).length}</td>
                <td>{p.active ? "Sim" : "Não"}</td>
                <td>
                  {writable ? (
                    <>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing(editing === p.id ? null : p.id)}>
                        Preços
                      </button>{" "}
                      <button type="button" className="btn btn-ghost" onClick={() => toggleActive(p)}>
                        Toggle
                      </button>{" "}
                      <button type="button" className="btn btn-danger" onClick={() => remove(p.id)}>
                        Excluir
                      </button>
                    </>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && writable && (() => {
        const plan = plans.find((p) => p.id === editing);
        if (!plan) return null;
        return (
          <form className="card" onSubmit={(e) => savePrices(plan, e)} style={{ marginTop: "1rem" }}>
            <h3 style={{ marginBottom: "0.75rem" }}>Preços de “{plan.name}”</h3>
            <div className="form-row" style={{ flexWrap: "wrap" }}>
              {currencies.map((c) => (
                <div key={c.code}>
                  <label className="label">{c.symbol} {c.code}</label>
                  <input className="input" name={`price_${c.code}`} defaultValue={plan.prices?.[c.code] ?? ""} style={{ width: "8rem" }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: "0.75rem" }}>
              <button type="submit" className="btn btn-primary">Salvar preços</button>{" "}
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Fechar</button>
            </div>
          </form>
        );
      })()}
    </AdminShell>
  );
}
