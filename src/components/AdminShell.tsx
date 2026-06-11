"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearToken, getToken } from "@/lib/auth";
import { isMockAuthEnabled } from "@/lib/mock-auth";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/users", label: "Customers" },
  { href: "/analytics/visitors", label: "Visitors" },
  { href: "/plans", label: "Services" },
  { href: "/currencies", label: "Currencies" },
  { href: "/gateways", label: "Gateways" },
  { href: "/invoices", label: "Top-ups" },
  { href: "/tickets", label: "Support" },
  { href: "/reviews", label: "Reviews" },
  { href: "/admins", label: "Admins" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const mockAuth = isMockAuthEnabled();

  useEffect(() => {
    // MOCK_AUTH bypass — só ativo quando NODE_ENV !== "production" no
    // sentido do flag (verificação real em isMockAuthEnabled). Sem isso,
    // o Lighthouse cai em /login e não consegue medir o dashboard.
    if (mockAuth) {
      // Marca o body para deixar óbvio em screenshots/audits que o bypass
      // está ativo. Se isso aparecer em prod algum dia, é bug.
      if (typeof document !== "undefined") {
        document.body.setAttribute("data-mock-auth", "1");
      }
      return;
    }
    if (!getToken()) router.replace("/login");
  }, [router, mockAuth]);

  return (
    <div className="layout" data-mock-auth={mockAuth ? "1" : undefined}>
      <aside className="sidebar">
        <Link href="/dashboard" aria-label="Viralefy" style={{ display: "inline-flex", marginBottom: "1.5rem" }}>
          <Image src="/logo.png" alt="Viralefy" width={2471} height={704} priority style={{ height: 28, width: "auto" }} />
        </Link>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={pathname === l.href ? "active" : ""}
          >
            {l.label}
          </Link>
        ))}
        <button
          type="button"
          style={{
            marginTop: "2rem",
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: "0.5rem 0.75rem",
          }}
          onClick={() => {
            clearToken();
            router.push("/login");
          }}
        >
          Sign out
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
