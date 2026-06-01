"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Currency } from "@/lib/api";

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  function reload() {
    adminApi.listCurrencies().then(setCurrencies).catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload();
  }, []);

  async function save(c: Currency, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSavingCode(c.code);
    setError(null);
    try {
      await adminApi.updateCurrency(c.code, {
        rate: Number(fd.get("rate")),
        display_enabled: fd.get("display_enabled") === "on",
        settlement_code: String(fd.get("settlement_code")),
      });
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <AdminShell>
      <h1 style={{ marginBottom: "0.5rem" }}>Moedas e câmbio</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1rem", fontSize: "0.9rem" }}>
        <code>rate</code> = unidades da moeda por 1 USD (base canônica). Exemplos:
        USDT/USD = 1, EUR ≈ 0.92, BRL ≈ 5.41, BTC ≈ 0.0000103. A moeda de
        liquidação define o que é efetivamente cobrado (ex.: USD exibe, USDT cobra).
      </p>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Moeda</th>
              <th>Taxa (por 1 USD)</th>
              <th>Exibir na loja</th>
              <th>Liquidação</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {currencies.map((c) => (
              <tr key={c.code}>
                <td>
                  {c.symbol} <strong>{c.code}</strong>
                  <div style={{ color: "var(--muted)", fontSize: "0.8rem" }}>{c.name} · {c.kind}</div>
                </td>
                <td colSpan={4}>
                  <form onSubmit={(e) => save(c, e)} style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                    <input
                      className="input"
                      name="rate"
                      type="number"
                      step="any"
                      defaultValue={c.rate}
                      style={{ width: "10rem" }}
                      required
                    />
                    <label style={{ whiteSpace: "nowrap" }}>
                      <input type="checkbox" name="display_enabled" defaultChecked={c.display_enabled} /> exibir
                    </label>
                    <select className="input" name="settlement_code" defaultValue={c.settlement_code} style={{ width: "auto" }}>
                      {currencies.map((s) => (
                        <option key={s.code} value={s.code}>{s.code}</option>
                      ))}
                    </select>
                    <button type="submit" className="btn btn-primary" disabled={savingCode === c.code}>
                      {savingCode === c.code ? "Salvando…" : "Salvar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
