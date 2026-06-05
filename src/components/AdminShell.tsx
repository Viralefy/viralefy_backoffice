"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearToken, getToken } from "@/lib/auth";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/orders", label: "Orders" },
  { href: "/users", label: "Customers" },
  { href: "/plans", label: "Services" },
  { href: "/currencies", label: "Currencies" },
  { href: "/gateways", label: "Gateways" },
  { href: "/invoices", label: "Top-ups" },
  { href: "/tickets", label: "Support" },
  { href: "/reviews", label: "Reviews" },
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
