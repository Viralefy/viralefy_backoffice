"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Category, type Currency, type Plan } from "@/lib/api";
import { can } from "@/lib/auth";

// Editor completo de plano. Vem do botão "Edit" da listagem (/plans).
// Diferente do form de criação inline, permite editar TUDO:
//   nome, descrição, categoria, plataforma, target_type, qty, sort_order,
//   preços por moeda, ativo.
// Salvar dispara PUT /v1/admin/plans/{id} com audit log no backend.

export default function PlanEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [plan, setPlan] = useState<Plan | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const writable = can("plans:write");

  function load() {
    // Não temos getPlan dedicado; pega via listagem (rápido suficiente).
    adminApi.listPlans().then((all) => {
      const found = all.find((p) => p.id === id);
      if (!found) {
        setError("Plan not found.");
        return;
      }
      setPlan(found);
    }).catch((e) => setError(e.message));
  }

  useEffect(() => {
    if (!id) return;
    load();
    adminApi.listCategories().then(setCategories).catch(() => setCategories([]));
    adminApi.listCurrencies().then(setCurrencies).catch(() => setCurrencies([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function collectPrices(fd: FormData): Record<string, string> {
    const prices: Record<string, string> = {};
    for (const c of currencies) {
      const v = String(fd.get(`price_${c.code}`) ?? "").trim();
      if (v) prices[c.code] = v;
    }
    return prices;
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!plan) return;
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    try {
      await adminApi.updatePlan(plan.id, {
        ...plan,
        name: String(fd.get("name") ?? plan.name),
        description: String(fd.get("description") ?? plan.description),
        category: String(fd.get("category") ?? plan.category),
        platform: String(fd.get("platform") ?? plan.platform ?? "instagram"),
        target_type: String(fd.get("target_type") ?? plan.target_type ?? "profile"),
        followers_qty: Number(fd.get("followers_qty") ?? plan.followers_qty),
        sort_order: Number(fd.get("sort_order") ?? plan.sort_order),
        active: fd.get("active") === "on",
        prices: collectPrices(fd),
      });
      router.push("/plans");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save error");
    } finally {
      setSaving(false);
    }
  }

  if (!writable) {
    return (
      <AdminShell>
        <p style={{ color: "var(--muted)" }}>Your role is read-only for plans.</p>
        <Link href="/plans" className="btn btn-outline">← Back</Link>
      </AdminShell>
    );
  }

  if (error) {
    return (
      <AdminShell>
        <p style={{ color: "var(--danger)" }}>{error}</p>
        <Link href="/plans" className="btn btn-outline">← Back</Link>
      </AdminShell>
    );
  }
  if (!plan) {
    return (
      <AdminShell>
        <p style={{ color: "var(--muted)" }}>Loading…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div style={{ marginBottom: "1rem" }}>
        <Link href="/plans" style={{ fontSize: "0.85rem" }}>← Plans</Link>
        <h1 style={{ margin: "0.25rem 0 0" }}>Edit “{plan.name}”</h1>
      </div>

      <form className="card" onSubmit={save} style={{ marginBottom: "1.5rem" }}>
        <div className="form-row">
          <div style={{ flex: 1 }}>
            <label className="label">Name</label>
            <input className="input" name="name" defaultValue={plan.name} required />
          </div>
          <div>
            <label className="label">Category</label>
            <select className="input" name="category" defaultValue={plan.category}>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <label className="label">Description</label>
        <input className="input" name="description" defaultValue={plan.description} />

        <div className="form-row" style={{ flexWrap: "wrap" }}>
          <div>
            <label className="label">Platform</label>
            <select className="input" name="platform" defaultValue={plan.platform ?? "instagram"}>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
          <div>
            <label className="label">Target type</label>
            <select className="input" name="target_type" defaultValue={plan.target_type ?? "profile"}>
              <option value="profile">Profile</option>
              <option value="publication">Publication</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input className="input" name="followers_qty" type="number" defaultValue={plan.followers_qty} required />
          </div>
          <div>
            <label className="label">Order</label>
            <input className="input" name="sort_order" type="number" defaultValue={plan.sort_order} />
          </div>
        </div>

        <h3 style={{ marginTop: "1rem", marginBottom: "0.5rem", fontSize: "0.95rem" }}>Prices per currency</h3>
        <div className="form-row" style={{ flexWrap: "wrap" }}>
          {currencies.map((c) => (
            <div key={c.code}>
              <label className="label">{c.symbol} {c.code}</label>
              <input
                className="input"
                name={`price_${c.code}`}
                defaultValue={plan.prices?.[c.code] ?? ""}
                placeholder={c.code === "USD" ? "2.50" : ""}
                style={{ width: "8rem" }}
              />
            </div>
          ))}
        </div>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0.5rem 0" }}>
          USD is required (canonical base). Others are optional — when blank, derived from the exchange rate.
        </p>

        <label style={{ display: "block", margin: "0.75rem 0" }}>
          <input type="checkbox" name="active" defaultChecked={plan.active} /> Active
        </label>

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <Link href="/plans" className="btn btn-ghost">Cancel</Link>
        </div>
      </form>

      {/* Metadados read-only */}
      <div className="card" style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1rem", color: "var(--text)" }}>Metadata</h2>
        <div>ID: <code>{plan.id}</code></div>
        <div>Base price (USD cents): {plan.price_cents}</div>
        <div>Canonical currency: {plan.currency}</div>
      </div>
    </AdminShell>
  );
}
