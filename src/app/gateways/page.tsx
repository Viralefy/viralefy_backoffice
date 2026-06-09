"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type Gateway } from "@/lib/api";
import { can } from "@/lib/auth";

// PROVIDERS define o contrato visual de cada provider:
// - quais campos aparecem no editor (com label/help/sensitive)
// - quais moedas o provider tipicamente liquida (default sugerido)
//
// O backend continua armazenando `config` como JSONB livre — esse mapa só
// projeta o formulário. Adicionar um provider novo = uma entrada aqui +
// inclusão no enum do gateway_service.go.
type FieldDef = {
  key: string;
  label: string;
  help?: string;
  sensitive?: boolean;
  placeholder?: string;
};

type ProviderDef = {
  code: string;
  label: string;
  fields: FieldDef[];
  defaultCurrencies: string[];
};

const PROVIDERS: ProviderDef[] = [
  {
    code: "manual_pix",
    label: "Manual Pix (no integration)",
    defaultCurrencies: ["BRL"],
    fields: [
      { key: "pix_key", label: "Pix key", placeholder: "email / CPF / random" },
      { key: "beneficiary_name", label: "Beneficiary name", placeholder: "Holder shown on the bank slip" },
    ],
  },
  {
    code: "woovi",
    label: "Woovi — Pix (BR-only, automated)",
    defaultCurrencies: ["BRL"],
    fields: [
      { key: "app_id", label: "App ID", sensitive: true, help: "Woovi dashboard > Apps & Webhooks" },
      { key: "base_url", label: "Base URL", placeholder: "https://api.woovi.com.br" },
      { key: "webhook_secret", label: "Webhook secret", sensitive: true, help: "HMAC secret used to verify callbacks" },
    ],
  },
  {
    code: "abacatepay",
    label: "AbacatePay — Pix (BR-only, dynamic QR)",
    defaultCurrencies: ["BRL"],
    fields: [
      {
        key: "api_key",
        label: "API key (abc_live_… or abc_dev_…)",
        sensitive: true,
        placeholder: "abc_live_…",
        help: "AbacatePay dashboard > API Keys. Use abc_live_ in prod, abc_dev_ in HML.",
      },
      {
        key: "webhook_secret",
        label: "Webhook secret",
        sensitive: true,
        help: "Configure webhook URL https://api.viralefy.com/v1/webhooks/abacatepay, listen for transparent.completed. Copy the signing secret here.",
      },
      {
        key: "expires_in",
        label: "Expires in seconds (optional)",
        placeholder: "3600",
        help: "Default 3600 (1h). PIX dinâmico expira; cliente que demora precisa gerar novo.",
      },
      { key: "base_url", label: "Base URL (optional)", placeholder: "https://api.abacatepay.com", help: "Default api.abacatepay.com — só mude pra staging do AbacatePay." },
    ],
  },
  {
    code: "heleket",
    label: "Heleket — crypto processor (multi-currency)",
    // Heleket aceita várias cryptos de entrada — cliente escolhe BTC/ETH/LTC/etc
    // no card de pagamento e Heleket converte pra USDT na liquidação. Adicione
    // todas as moedas que sua conta Heleket habilitou.
    defaultCurrencies: ["USDT", "BTC", "ETH", "LTC"],
    fields: [
      { key: "merchant_id", label: "Merchant ID" },
      { key: "api_key", label: "API key", sensitive: true },
      { key: "base_url", label: "Base URL", placeholder: "https://api.heleket.com" },
      {
        key: "url_callback",
        label: "Callback URL",
        placeholder: "https://api.viralefy.com/v1/webhooks/heleket",
        help: "Heleket envia POST com o status do pagamento aqui. A assinatura é validada com md5(base64(body)+api_key) — não há webhook_secret separado. Confirme no painel da Heleket (Merchant > Webhook) que o callback default casa com este valor.",
      },
    ],
  },
  {
    code: "manual_usdt",
    label: "Manual USDT — DEPRECATED (use manual_crypto)",
    defaultCurrencies: ["USDT"],
    fields: [
      { key: "wallet_address", label: "USDT wallet address", placeholder: "TR... / 0x..." },
      { key: "network", label: "Network", placeholder: "TRC20 / ERC20 / BEP20 / Polygon / Solana", help: "Customer needs to use the EXACT network. Wrong network = lost funds." },
      { key: "memo", label: "Memo / tag (optional)", placeholder: "Optional — only if your exchange requires it" },
    ],
  },
  {
    code: "manual_crypto",
    label: "Manual Crypto (one wallet per network/asset)",
    defaultCurrencies: ["USDT"],
    fields: [
      { key: "wallet_address", label: "Wallet address", placeholder: "TR... / 0x... / bc1... / L..." },
      { key: "network", label: "Network", placeholder: "TRC20, BEP20, ERC20, Polygon, Solana, Bitcoin, Litecoin…", help: "EXACT network code. Customer must send on this network only — wrong network = lost funds forever." },
      { key: "network_label", label: "Display label (optional)", placeholder: "ex: USDT (Tron) — overrides the auto-label" },
      { key: "network_warning", label: "Warning override (optional)", placeholder: "Custom warning shown to customer" },
      { key: "memo", label: "Memo / tag (optional)", placeholder: "Required by some exchanges (Solana, BNB Beacon)" },
    ],
  },
  {
    code: "stripe",
    label: "Stripe — credit/debit card",
    defaultCurrencies: ["USD", "EUR", "BRL", "GBP"],
    fields: [
      {
        key: "secret_key",
        label: "API key (rk_live_… preferred, sk_live_… also accepted)",
        sensitive: true,
        placeholder: "rk_live_… or sk_live_…",
        help: "Restricted key from Stripe > Developers > API keys > Create restricted key. Required scopes: Checkout Sessions WRITE, Prices WRITE, Products WRITE. NEVER paste pk_… (publishable) — that key belongs in the front bundle.",
      },
      {
        key: "webhook_secret",
        label: "Webhook secret (whsec_…)",
        sensitive: true,
        placeholder: "whsec_…",
        help: "Stripe > Developers > Webhooks > Add endpoint https://api.viralefy.com/v1/webhooks/stripe. Listen for checkout.session.completed. Copy the signing secret here.",
      },
      {
        key: "payment_method_types",
        label: "Methods (CSV, optional)",
        placeholder: "card,link,boleto",
        help: "Default: card. boleto needs Stripe BR enabled on your account. Cliente success/cancel URLs are wired automatically by the API (siteURL + order id).",
      },
    ],
  },
];

const PROVIDER_BY_CODE: Record<string, ProviderDef> = Object.fromEntries(
  PROVIDERS.map((p) => [p.code, p]),
);

// Moedas disponíveis no picker. Casa com o filtro de validCurrencyCode no
// backend (3-5 letras maiúsculas).
// Pool de moedas suportado pelo seed em currencies. Aceitar codes fora
// daqui é OK do backend (validCurrencyCode aceita qualquer 3-5 letras
// maiúsculas) mas o picker só lista o que tem row em currencies — sem
// isso, ListPaymentMethods rejeita silenciosamente o gateway na hora do
// preview por GetByCode falhar.
const SUPPORTED_CURRENCIES = [
  "USDT", "USDC", "DAI",                  // stablecoins
  "USD", "EUR", "BRL", "GBP",             // fiat
  "BTC", "ETH", "LTC", "BNB", "SOL",      // major cryptos
  "TRX", "MATIC", "XRP", "DOGE", "ADA",   // alt cryptos
] as const;

// Cores fixas pros chips de moeda — ajuda admin a bater de olho qual
// gateway aceita o quê.
// Paleta pinada por currency. Default fallback pra qualquer code novo —
// SUPPORTED_CURRENCIES cresce; adicionar entrada aqui é opcional. Sem o
// fallback, o map quebrava com TypeError "fg of undefined" ao bater num
// code recém-adicionado (USDC/DAI/GBP/LTC/etc.).
const DEFAULT_COLOR = { bg: "#333", fg: "#ddd" };
const CURRENCY_COLORS: Record<string, { bg: string; fg: string }> = {
  USDT:  { bg: "#0c4a3e", fg: "#34d399" },
  USDC:  { bg: "#0c4a3e", fg: "#60a5fa" },
  DAI:   { bg: "#3b1e5c", fg: "#fcd34d" },
  USD:   { bg: "#1e3a8a", fg: "#93c5fd" },
  EUR:   { bg: "#3b1e5c", fg: "#c4b5fd" },
  GBP:   { bg: "#3b1e5c", fg: "#a7f3d0" },
  BRL:   { bg: "#5c2e1e", fg: "#fca5a5" },
  BTC:   { bg: "#5c4a1e", fg: "#fcd34d" },
  ETH:   { bg: "#1e3a5c", fg: "#a5b4fc" },
  LTC:   { bg: "#374151", fg: "#9ca3af" },
  BNB:   { bg: "#5c4a1e", fg: "#facc15" },
  SOL:   { bg: "#3b1e5c", fg: "#c084fc" },
  TRX:   { bg: "#5c1e1e", fg: "#f87171" },
  MATIC: { bg: "#3b1e5c", fg: "#a78bfa" },
  XRP:   { bg: "#1f2937", fg: "#9ca3af" },
  DOGE:  { bg: "#5c4a1e", fg: "#fde68a" },
  ADA:   { bg: "#1e3a8a", fg: "#7dd3fc" },
};

type FormState = {
  id: string | null;
  name: string;
  provider: string;
  active: boolean;
  config: Record<string, string>;
  accepted_currencies: string[];
};

function emptyFormFor(code: string): FormState {
  const def = PROVIDER_BY_CODE[code] ?? PROVIDERS[0];
  const config: Record<string, string> = {};
  for (const f of def.fields) config[f.key] = "";
  return {
    id: null,
    name: "",
    provider: def.code,
    active: false,
    config,
    accepted_currencies: [...def.defaultCurrencies],
  };
}

function fromGateway(g: Gateway): FormState {
  const def = PROVIDER_BY_CODE[g.provider];
  const config: Record<string, string> = {};
  if (def) {
    for (const f of def.fields) config[f.key] = g.config?.[f.key] ?? "";
  } else {
    // Provider desconhecido (legado) — preserva o que veio do servidor pra
    // não apagar dados ao salvar.
    Object.assign(config, g.config ?? {});
  }
  return {
    id: g.id,
    name: g.name,
    provider: g.provider,
    active: g.active,
    config,
    accepted_currencies: g.accepted_currencies ?? [],
  };
}

function CurrencyChip({ code }: { code: string }) {
  const c = CURRENCY_COLORS[code] ?? { bg: "#333", fg: "#ddd" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.1rem 0.5rem",
        marginRight: "0.25rem",
        borderRadius: "0.75rem",
        background: c.bg,
        color: c.fg,
        fontSize: "0.75rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {code}
    </span>
  );
}

export default function GatewaysPage() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const writable = can("gateways:write");

  function reload() {
    adminApi.listGateways().then(setGateways).catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload();
  }, []);

  const currentProvider = useMemo<ProviderDef | null>(
    () => (form ? PROVIDER_BY_CODE[form.provider] ?? null : null),
    [form],
  );

  function startNew() {
    setFieldErrors({});
    setError(null);
    setForm(emptyFormFor("manual_pix"));
  }

  function startEdit(g: Gateway) {
    setFieldErrors({});
    setError(null);
    setForm(fromGateway(g));
  }

  function cancelForm() {
    setForm(null);
    setFieldErrors({});
  }

  function changeProvider(code: string) {
    if (!form) return;
    const def = PROVIDER_BY_CODE[code];
    if (!def) return;
    const config: Record<string, string> = {};
    for (const f of def.fields) config[f.key] = form.config[f.key] ?? "";
    setForm({
      ...form,
      provider: code,
      config,
      // Switching provider only seeds defaults when user has no currencies
      // selected — preserva escolha manual se já tinha.
      accepted_currencies:
        form.accepted_currencies.length === 0 ? [...def.defaultCurrencies] : form.accepted_currencies,
    });
  }

  function toggleCurrency(code: string) {
    if (!form) return;
    const next = form.accepted_currencies.includes(code)
      ? form.accepted_currencies.filter((c) => c !== code)
      : [...form.accepted_currencies, code];
    setForm({ ...form, accepted_currencies: next });
  }

  function setConfigField(key: string, value: string) {
    if (!form) return;
    setForm({ ...form, config: { ...form.config, [key]: value } });
  }

  function validate(f: FormState): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = "Name is required.";
    if (!PROVIDER_BY_CODE[f.provider]) errs.provider = "Unknown provider.";
    if (f.active && f.accepted_currencies.length === 0) {
      errs.accepted_currencies = "Active gateway must accept at least one currency.";
    }
    return errs;
  }

  async function save() {
    if (!form) return;
    const errs = validate(form);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    setError(null);
    // Strip empty config values so the JSONB stays clean (não polui com
    // chaves vazias que o admin nem preencheu).
    const cleanConfig: Record<string, string> = {};
    for (const [k, v] of Object.entries(form.config)) {
      if (v.trim() !== "") cleanConfig[k] = v;
    }
    const payload = {
      name: form.name.trim(),
      provider: form.provider,
      active: form.active,
      config: cleanConfig,
      accepted_currencies: form.accepted_currencies,
    };
    try {
      if (form.id) {
        await adminApi.updateGateway(form.id, payload);
      } else {
        await adminApi.createGateway(payload);
      }
      cancelForm();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save gateway");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(g: Gateway) {
    try {
      await adminApi.updateGateway(g.id, {
        name: g.name,
        provider: g.provider,
        active: !g.active,
        config: g.config,
        accepted_currencies: g.accepted_currencies ?? [],
      });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to toggle gateway");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete gateway?\n\nNote: gateways with order/invoice history can't be hard-deleted (FK). Use 'Deactivate' instead to hide it from checkout.")) return;
    try {
      await adminApi.deleteGateway(id);
      reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to delete gateway";
      // Backend retorna 409 CONFLICT quando há FK (orders/invoices apontando).
      // Sugere o caminho correto ao admin em vez de erro genérico.
      if (msg.toLowerCase().includes("conflict") || msg.toLowerCase().includes("409")) {
        setError(
          "Cannot delete: there are orders/invoices using this gateway. Click 'Deactivate' instead — it hides the gateway from checkout without breaking history.",
        );
      } else {
        setError(msg);
      }
    }
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h1>Payment gateways</h1>
        {writable && !form && (
          <button type="button" className="btn btn-primary" onClick={startNew}>
            New gateway
          </button>
        )}
      </div>
      {!writable && (
        <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginBottom: "1rem" }}>
          Your role is read-only for gateways.
        </p>
      )}
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {form && writable && currentProvider && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          style={{ marginBottom: "1rem" }}
        >
          <h3 style={{ marginBottom: "0.75rem" }}>
            {form.id ? `Edit "${form.name}"` : "New gateway"}
          </h3>

          <div className="form-row">
            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Internal label, e.g. Woovi (prod)"
              />
              {fieldErrors.name && (
                <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  {fieldErrors.name}
                </p>
              )}
            </div>
            <div>
              <label className="label">Provider</label>
              <select
                className="input"
                value={form.provider}
                onChange={(e) => changeProvider(e.target.value)}
                disabled={Boolean(form.id)}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.label}
                  </option>
                ))}
              </select>
              {form.id && (
                <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                  Provider cannot be changed on an existing gateway. Delete and recreate to switch.
                </p>
              )}
              {fieldErrors.provider && (
                <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  {fieldErrors.provider}
                </p>
              )}
            </div>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label className="label">Accepted currencies</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {SUPPORTED_CURRENCIES.map((c) => {
                const on = form.accepted_currencies.includes(c);
                const col = CURRENCY_COLORS[c] ?? DEFAULT_COLOR;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCurrency(c)}
                    style={{
                      padding: "0.35rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: on ? `1px solid ${col.fg}` : "1px solid #444",
                      background: on ? col.bg : "transparent",
                      color: on ? col.fg : "var(--muted)",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
            {fieldErrors.accepted_currencies && (
              <p style={{ color: "var(--danger)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                {fieldErrors.accepted_currencies}
              </p>
            )}
            <p style={{ color: "var(--muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
              Checkout will only route an order to this gateway if the settlement currency matches one of the picked codes.
            </p>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <label className="label" style={{ marginBottom: "0.5rem" }}>
              {currentProvider.label} configuration
            </label>
            {currentProvider.fields.map((field) => (
              <div key={field.key} style={{ marginBottom: "0.75rem" }}>
                <label className="label" style={{ fontSize: "0.8rem" }}>
                  {field.label}
                </label>
                <input
                  className="input"
                  type={field.sensitive ? "password" : "text"}
                  value={form.config[field.key] ?? ""}
                  onChange={(e) => setConfigField(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  autoComplete="off"
                />
                {field.help && (
                  <p style={{ color: "var(--muted)", fontSize: "0.72rem", marginTop: "0.2rem" }}>
                    {field.help}
                  </p>
                )}
              </div>
            ))}
          </div>

          <label style={{ display: "block", margin: "0.75rem 0" }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />{" "}
            Active
          </label>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </button>{" "}
          <button type="button" className="btn btn-ghost" onClick={cancelForm} disabled={saving}>
            Cancel
          </button>
        </form>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Provider</th>
              <th>Accepted currencies</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {gateways.map((g) => (
              <tr key={g.id}>
                <td>{g.name}</td>
                <td>{PROVIDER_BY_CODE[g.provider]?.label ?? g.provider}</td>
                <td>
                  {(g.accepted_currencies ?? []).length > 0 ? (
                    (g.accepted_currencies ?? []).map((c) => <CurrencyChip key={c} code={c} />)
                  ) : (
                    <span style={{ color: "var(--muted)", fontSize: "0.8rem" }}>—</span>
                  )}
                </td>
                <td>
                  <span
                    style={{
                      color: g.active ? "#34d399" : "var(--muted)",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                    }}
                  >
                    {g.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td>
                  {writable ? (
                    <>
                      <button type="button" className="btn btn-ghost" onClick={() => startEdit(g)}>
                        Edit
                      </button>{" "}
                      <button type="button" className="btn btn-ghost" onClick={() => toggleActive(g)}>
                        {g.active ? "Deactivate" : "Activate"}
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
            {gateways.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: "var(--muted)", textAlign: "center", padding: "1rem" }}>
                  No gateways configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
