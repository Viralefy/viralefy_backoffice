"use client";

import { useEffect, useState } from "react";
import { adminApi, type UserEvent, type UserJourney, type VisitorSummary } from "@/lib/api";

// JourneyPanel — renderiza o agregado de tracking de UM user (lookup
// por user_id) OU de UM visitor (lookup por visitor_id). Mostra:
//
//   - Header com totais (eventos, pedidos, primeira/última vez, IP/UA do
//     último evento, landing path + UTM source/medium/campaign).
//   - Timeline DESC dos últimos 100 eventos (event_type, path, payload).
//
// Quando o lookup vem vazio (user sem tracking ainda), renderiza um stub
// suave em vez de erro — é o caso de admin/superadmin que não usam o site.

type Mode = { kind: "user"; userID: string } | { kind: "visitor"; visitorID: string };

export function JourneyPanel(props: { mode: Mode }) {
  const [journey, setJourney] = useState<UserJourney | null>(null);
  const [visitor, setVisitor] = useState<VisitorSummary | null>(null);
  const [events, setEvents] = useState<UserEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const m = props.mode;
    (async () => {
      try {
        if (m.kind === "user") {
          const data = await adminApi.getUserJourney(m.userID);
          setJourney(data.journey);
          setEvents(data.events ?? []);
        } else {
          const data = await adminApi.getVisitor(m.visitorID);
          setVisitor(data.summary);
          setEvents(data.events ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load journey");
      } finally {
        setLoading(false);
      }
    })();
  }, [props.mode]);

  if (loading) return <p style={{ color: "var(--muted)" }}>Loading journey…</p>;
  if (error) return <div className="alert alert-error">{error}</div>;

  // Visitor mode: derive header dele
  const header =
    visitor ?
      <VisitorHeader v={visitor} /> :
      journey ? <UserJourneyHeader j={journey} /> :
        <p style={{ color: "var(--muted)" }}>No tracking data captured yet.</p>;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {header}
      <Timeline events={events} />
    </div>
  );
}

function Pill({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", minWidth: 120 }}>
      <span style={{ color: "var(--muted)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
      <span style={{ fontSize: "0.9rem", color: "var(--text, #fff)" }}>{value ?? "—"}</span>
    </div>
  );
}

function VisitorHeader({ v }: { v: VisitorSummary }) {
  const utm = (v.landing_utm ?? {}) as Record<string, string>;
  return (
    <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem" }}>
      <Pill label="Visitor ID" value={<code style={{ fontSize: "0.78rem" }}>{shortID(v.visitor_id)}</code>} />
      <Pill label="Converted?" value={v.user_email ? `Yes (${v.user_email})` : "Anonymous"} />
      <Pill label="Total events" value={v.total_events.toLocaleString()} />
      <Pill label="First seen" value={dateLabel(v.first_seen_at)} />
      <Pill label="Last seen" value={dateLabel(v.last_seen_at)} />
      <Pill label="Landing" value={v.landing_path || "—"} />
      <Pill label="UTM source" value={utm.utm_source || "—"} />
      <Pill label="UTM campaign" value={utm.utm_campaign || "—"} />
      <Pill label="Last IP" value={v.last_ip || "—"} />
      <Pill label="Last UA" value={v.last_user_agent ? shortUA(v.last_user_agent) : "—"} />
    </div>
  );
}

function UserJourneyHeader({ j }: { j: UserJourney }) {
  const utm = (j.landing_utm ?? {}) as Record<string, string>;
  const seenAt = j.first_seen_at && j.last_seen_at && j.first_seen_at !== j.last_seen_at
    ? `${dateLabel(j.first_seen_at)} → ${dateLabel(j.last_seen_at)}`
    : (j.first_seen_at ? dateLabel(j.first_seen_at) : "—");
  return (
    <div className="card" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1rem" }}>
      <Pill label="Total events" value={(j.total_events ?? 0).toLocaleString()} />
      <Pill label="Total orders" value={(j.total_orders ?? 0).toLocaleString()} />
      <Pill label="Window" value={seenAt} />
      <Pill label="Landing path" value={j.landing_path || "—"} />
      <Pill label="Referrer" value={j.landing_referrer || "Direct"} />
      <Pill label="UTM source" value={utm.utm_source || "—"} />
      <Pill label="UTM medium" value={utm.utm_medium || "—"} />
      <Pill label="UTM campaign" value={utm.utm_campaign || "—"} />
    </div>
  );
}

function Timeline({ events }: { events: UserEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="card">
        <p style={{ color: "var(--muted)", margin: 0 }}>No events captured yet.</p>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 0 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
        <thead>
          <tr style={{ background: "rgba(168,85,247,0.06)" }}>
            <th style={th()}>When</th>
            <th style={th()}>Event</th>
            <th style={th()}>Path</th>
            <th style={th()}>Referrer</th>
            <th style={th()}>IP</th>
            <th style={th()}>Consent</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={td()}>{new Date(e.occurred_at).toLocaleString()}</td>
              <td style={td()}><strong>{e.event_type}</strong></td>
              <td style={{ ...td(), fontFamily: "monospace", color: "var(--muted)" }}>{e.path || "—"}</td>
              <td style={{ ...td(), color: "var(--muted)" }}>{shortReferrer(e.referrer)}</td>
              <td style={{ ...td(), fontFamily: "monospace", color: "var(--muted)" }}>{e.ip || "—"}</td>
              <td style={td()}>{e.analytics_consent === true ? "Y" : e.analytics_consent === false ? "N" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function th(): React.CSSProperties {
  return { padding: "0.55rem 0.75rem", textAlign: "left", fontSize: "0.72rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" };
}
function td(): React.CSSProperties {
  return { padding: "0.55rem 0.75rem", verticalAlign: "top" };
}
function dateLabel(s: string): string {
  if (!s) return "—";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}
function shortID(s: string): string {
  if (!s) return "—";
  return s.length > 12 ? `${s.slice(0, 8)}…${s.slice(-4)}` : s;
}
function shortReferrer(r: string | null | undefined): string {
  if (!r) return "Direct";
  try {
    const u = new URL(r);
    return u.hostname;
  } catch {
    return r.slice(0, 40);
  }
}
function shortUA(ua: string): string {
  // pega o token relevante (Firefox/X, Chrome/X, etc.)
  const m = ua.match(/(Firefox|Chrome|Safari|Edge|Opera)\/[\d.]+/);
  return m ? m[0] : ua.slice(0, 48);
}
