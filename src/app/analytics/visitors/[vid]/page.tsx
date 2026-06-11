"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "@/components/AdminShell";
import { JourneyPanel } from "@/components/JourneyPanel";

// /analytics/visitors/[vid] — drill-down de UM visitor.
// Reusa JourneyPanel em modo "visitor" pra header + timeline.

export default function VisitorDetailPage() {
  const params = useParams<{ vid: string }>();
  const vid = decodeURIComponent(params.vid);

  return (
    <AdminShell>
      <p style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
        <Link href="/analytics/visitors">← Visitors</Link>
      </p>

      <header style={{ marginBottom: "1rem" }}>
        <h1 style={{ margin: 0, fontSize: "1.3rem" }}>Visitor detail</h1>
        <p style={{ color: "var(--muted)", fontSize: "0.78rem", marginTop: "0.25rem", fontFamily: "monospace" }}>
          {vid}
        </p>
      </header>

      <JourneyPanel mode={{ kind: "visitor", visitorID: vid }} />
    </AdminShell>
  );
}
