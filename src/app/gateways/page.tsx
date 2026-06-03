"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Gateway } from "@/lib/api";
import { can } from "@/lib/auth";

// Templates de config por provider — facilitam o preenchimento (admin pode editar).
const PROVIDER_TEMPLATES: Record<string, Record<string, string>> = {
  manual_pix: { pix_key: "" },
  woovi: { app_id: "", base_url: "https://api.woovi.com.br" },
  heleket: { merchant_id: "", api_key: "", base_url: "https://api.heleket.com", url_callback: "" },
};

const PROVIDER_LABEL: Record<string, string> = {
  manual_pix: "Manual Pix (no integration)",
  woovi: "Woovi — Pix",
  heleket: "Heleket — crypto (USDT/BTC)",
};

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const writable = can("gateways:write");

  function reload() {
    adminApi.listGateways().then(setGateways).catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload();
  }, []);

  function parseConfig(s: string): Record<string, string> | null {
    if (!s.trim()) return {};
    try {
      const obj = JSON.parse(s);
      if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return null;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(obj)) out[k] = String(v ?? "");
      return out;
    } catch {
      return null;
    }
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const config = parseConfig(String(fd.get("config") ?? "{}"));
    if (!config) {
      setError("Invalid config (must be JSON like {\"key\":\"value\"}).");
      return;
    }
    try {
      await adminApi.createGateway({
        name: String(fd.get("name")),
        provider: String(fd.get("provider")),
        active: fd.get("active") === "on",
        config,
      });
      setShowForm(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create gateway");
    }
  }

  async function saveEdit(g: Gateway, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const config = parseConfig(String(fd.get("config") ?? "{}"));
    if (!config) {
      setError("Invalid config (must be JSON).");
      return;
    }
    try {
      await adminApi.updateGateway(g.id, {
        ...g,
        active: fd.get("active") === "on",
        config,
      });
      setEditing(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save gateway");
    }
  }

  async function toggleActive(g: Gateway) {
    await adminApi.updateGateway(g.id, { ...g, active: !g.active });
    reload();
  }

  async function remove(id: string) {
    if (!confirm("Delete gateway?")) return;
    await adminApi.deleteGateway(id);
    reload();
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Payment gateways</h1>
        {writable && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "New gateway"}
          </button>
        )}
      </div>
      {!writable && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Your role is read-only for gateways.
        </p>
      )}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {showForm && writable && (
        <form className="card" onSubmit={handleCreate} style={{ marginBottom: "1rem" }}>
          <div className="form-row">
            <div>
              <label className="label">Name</label>
              <input className="input" name="name" required defaultValue="New gateway" />
            </div>
            <div>
              <label className="label">Provider</label>
              <select
                className="input"
                name="provider"
                defaultValue="manual_pix"
                onChange={(e) => {
                  const tmpl = PROVIDER_TEMPLATES[e.target.value] ?? {};
                  const ta = e.currentTarget.form?.elements.namedItem("config") as HTMLTextAreaElement | null;
                  if (ta) ta.value = JSON.stringify(tmpl, null, 2);
                }}
              >
                {Object.entries(PROVIDER_LABEL).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="label">Config (JSON)</label>
          <textarea className="input" name="config" rows={6} style={{ fontFamily: "monospace", fontSize: "0.85rem" }} defaultValue={JSON.stringify(PROVIDER_TEMPLATES.manual_pix, null, 2)} />
          <label style={{ display: "block", margin: "0.75rem 0" }}>
            <input type="checkbox" name="active" /> Active
          </label>
          <button type="submit" className="btn btn-primary">Save</button>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Config (keys)</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {gateways.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{PROVIDER_LABEL[g.provider] ?? g.provider}</td>
                <td style={{ fontSize: "0.85rem", color: "var(--muted)" }}>
                  {Object.keys(g.config ?? {}).join(", ") || "—"}
                </td>
                <td>{g.active ? "Yes" : "No"}</td>
                <td>
                  {writable ? (
                    <>
                      <button type="button" className="btn btn-ghost" onClick={() => setEditing(editing === g.id ? null : g.id)}>
                        Edit
                      </button>{" "}
                      <button type="button" className="btn btn-ghost" onClick={() => toggleActive(g)}>
                        Toggle
                      </button>{" "}
                      <button type="button" className="btn btn-danger" onClick={() => remove(g.id)}>
                        Delete
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
        const g = gateways.find((x) => x.id === editing);
        if (!g) return null;
        return (
          <form className="card" onSubmit={(e) => saveEdit(g, e)} style={{ marginTop: "1rem" }}>
            <h3 style={{ marginBottom: "0.75rem" }}>Edit “{g.name}” ({PROVIDER_LABEL[g.provider] ?? g.provider})</h3>
            <label className="label">Config (JSON)</label>
            <textarea className="input" name="config" rows={8} style={{ fontFamily: "monospace", fontSize: "0.85rem" }} defaultValue={JSON.stringify(g.config ?? {}, null, 2)} />
            <label style={{ display: "block", margin: "0.75rem 0" }}>
              <input type="checkbox" name="active" defaultChecked={g.active} /> Active
            </label>
            <button type="submit" className="btn btn-primary">Save</button>{" "}
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </form>
        );
      })()}
    </AdminShell>
  );
}
