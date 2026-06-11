"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken, getToken, isSuperadmin } from "@/lib/auth";
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

// Estados possíveis na inicialização do shell:
//   "checking"  — SSR / 1º render no client antes de localStorage estar acessível
//   "authed"    — token presente OU mockAuth ativo → renderiza UI
//   "anonymous" — sem token → return null + redirect imediato (SEM mostrar shell)
type AuthState = "checking" | "authed" | "anonymous";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const mockAuth = isMockAuthEnabled();

  // Gate síncrono: já no 1º render no client checamos localStorage. Sem isso
  // o shell renderiza com nav + sidebar + main e SÓ depois o useEffect
  // redireciona — usuário com sessão expirada via "tela admin deslogado"
  // por uma fração de segundo, exibindo dados sensíveis.
  const [authState, setAuthState] = useState<AuthState>(() => {
    if (mockAuth) return "authed";
    if (typeof window === "undefined") return "checking"; // SSR
    return getToken() ? "authed" : "anonymous";
  });

  useEffect(() => {
    if (mockAuth) {
      if (typeof document !== "undefined") {
        document.body.setAttribute("data-mock-auth", "1");
      }
      setAuthState("authed");
      return;
    }
    if (!getToken()) {
      setAuthState("anonymous");
      // replace (não push) — o login é um destino terminal, não pode voltar
      // pelo back e cair de novo no shell sem session.
      router.replace("/login");
      return;
    }
    setAuthState("authed");
  }, [router, mockAuth]);

  // Listen pra evento global de sessão expirada (despachado pelo request<T>
  // quando qualquer chamada admin retorna 401). Garante que se o usuário
  // estiver navegando e o token expirar, ele cai pro login imediatamente em
  // vez de continuar vendo o shell com mensagens de erro.
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onExpired() {
      setAuthState("anonymous");
      router.replace("/login");
    }
    window.addEventListener("viralefy:session-expired", onExpired);
    return () => window.removeEventListener("viralefy:session-expired", onExpired);
  }, [router]);

  // Ainda checando (SSR ou 1ª pintura) ou sem auth: NÃO renderiza shell.
  // Retornar null é o caminho seguro — nenhum dado sensível vaza, nenhum
  // template "deslogado" aparece. O redirect já foi disparado no useEffect.
  if (authState !== "authed") {
    return null;
  }

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
        {/* Trash — só superadmin vê o link. Renderizado isolado abaixo do
            stack normal pra deixar óbvio que é ferramenta de audit, não
            workflow do dia-a-dia. */}
        {isSuperadmin() && (
          <Link
            href="/trash"
            className={pathname === "/trash" ? "active" : ""}
            style={{
              marginTop: "1rem",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: "1rem",
              color: pathname === "/trash" ? undefined : "#94a3b8",
              fontSize: "0.9rem",
            }}
          >
            Trash
          </Link>
        )}
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
