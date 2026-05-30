"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearToken, getToken } from "@/lib/auth";

const links = [
  { href: "/dashboard", label: "Pedidos" },
  { href: "/plans", label: "Serviços" },
  { href: "/currencies", label: "Moedas" },
  { href: "/gateways", label: "Gateways" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace("/login");
  }, [router]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <strong style={{ display: "block", marginBottom: "1.5rem" }}>Viralefy</strong>
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
          Sair
        </button>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
