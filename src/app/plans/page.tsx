"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Category, type Currency, type Plan } from "@/lib/api";
import { can } from "@/lib/auth";

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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
        platform: String(fd.get("platform") ?? "instagram"),
        target_type: String(fd.get("target_type") ?? "profile"),
        followers_qty: Number(fd.get("followers_qty")),
        active: fd.get("active") === "on",
        sort_order: Number(fd.get("sort_order")),
        prices: collectPrices(fd),
      });
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create plan");
    }
  }

  async function toggleActive(plan: Plan) {
    await adminApi.updatePlan(plan.id, { ...plan, active: !plan.active });
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Delete plan?")) return;
    await adminApi.deletePlan(id);
    reload();
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Services / Plans</h1>
        {writable && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "New plan"}
          </button>
        )}
      </div>
      {!writable && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Your role is read-only for plans.
        </p>
      )}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {showForm && writable && (
        <form className="card" onSubmit={handleCreate} style={{ marginBottom: "1rem" }}>
          <div className="form-row">
            <div>
              <label className="label">Name</label>
              <input className="input" name="name" required />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" name="category" defaultValue="seguidores_instagram">
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="label">Description</label>
          <input className="input" name="description" />
          <div className="form-row">
            <div>
              <label className="label">Platform</label>
              <select className="input" name="platform" defaultValue="instagram">
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="facebook">Facebook</option>
              </select>
            </div>
            <div>
              <label className="label">Target type</label>
              <select className="input" name="target_type" defaultValue="profile">
                <option value="profile">Profile</option>
                <option value="publication">Publication</option>
              </select>
            </div>
            <div>
              <label className="label">Quantity</label>
              <input className="input" name="followers_qty" type="number" defaultValue={1} required />
            </div>
            <div>
              <label className="label">Order</label>
              <input className="input" name="sort_order" type="number" defaultValue={0} />
            </div>
          </div>
          <label className="label">Price per currency (manual)</label>
          <div className="form-row" style={{ flexWrap: "wrap" }}>
            {currencies.map((c) => (
              <div key={c.code}>
                <label className="label">{c.symbol} {c.code}</label>
                <input className="input" name={`price_${c.code}`} placeholder={c.code === "USD" ? "2.50" : ""} style={{ width: "8rem" }} />
              </div>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.5rem 0" }}>
            USD is required (canonical base). Others are optional — when blank, derived from the exchange rate.
          </p>
          <label style={{ display: "block", margin: "0.5rem 0" }}>
            <input type="checkbox" name="active" defaultChecked /> Active
          </label>
          <button type="submit" className="btn btn-primary">Save</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Qty</th>
              <th>Price (USD)</th>
              <th>Currencies</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{labelFor(p.category)}</td>
                <td>{p.followers_qty.toLocaleString()}</td>
                <td>$ {(p.price_cents / 100).toFixed(2)}</td>
                <td>{Object.keys(p.prices ?? {}).length}</td>
                <td>{p.active ? "Yes" : "No"}</td>
                <td>
                  {writable ? (
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                      <Link href={`/plans/${p.id}/edit`} className="btn btn-primary" style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                        onClick={() => toggleActive(p)}
                      >
                        {p.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
                        onClick={() => remove(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
