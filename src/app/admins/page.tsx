"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "@/components/AdminShell";
import { adminApi, type AdminUser, type Role } from "@/lib/api";
import { can, getRole } from "@/lib/auth";

// Página de gestão de admins. Requer permission `admins:manage`.
// Todos os admins listados; ações sensíveis (criar superadmin, mexer em
// outro superadmin, self-delete) são bloqueadas pelo backend AuthService —
// a UI só esconde os botões pra reduzir confusão.
export default function AdminsPage() {
  const [list, setList] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [generatedPwd, setGeneratedPwd] = useState<{ email: string; pwd: string } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const canManage = can("admins:manage");
  const myRole = getRole();

  function reload() {
    adminApi.listAdmins().then(setList).catch((e) => setError(e.message));
  }

  useEffect(() => {
    reload();
    adminApi.listRoles().then(setRoles).catch(() => {
      // /admin/roles também é admins:manage — se falhar aqui, listAdmins já
      // teria falhado primeiro.
    });
  }, []);

  if (!canManage) {
    return (
      <AdminShell>
        <h1>Admins</h1>
        <p style={{ color: "var(--danger)" }}>
          Permission required: <code>admins:manage</code>. Pede pra um superadmin
          te promover.
        </p>
      </AdminShell>
    );
  }

  async function handleCreate(email: string, name: string, role: string) {
    setBusy("create");
    setError(null);
    try {
      const res = await adminApi.createAdmin({ email, name, role });
      setGeneratedPwd({ email: res.admin.email, pwd: res.generated_password });
      setShowCreate(false);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar admin");
    } finally {
      setBusy(null);
    }
  }

  async function handleUpdateRole(id: string, newRole: string) {
    setBusy(`role:${id}`);
    setError(null);
    try {
      await adminApi.updateAdminRole(id, newRole);
      setEditing(null);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar role");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Remove admin ${email}? Esta ação não pode ser desfeita.`)) return;
    setBusy(`delete:${id}`);
    setError(null);
    try {
      await adminApi.deleteAdmin(id);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover admin");
    } finally {
      setBusy(null);
    }
  }

  async function handleResetTwoFA(id: string, email: string) {
    const reason = prompt(`Motivo do reset 2FA de ${email}?`);
    if (!reason) return;
    setBusy(`2fa:${id}`);
    setError(null);
    try {
      await adminApi.resetAdmin2FA(id, reason);
      alert(`2FA resetada. ${email} precisa re-enroll no próximo login.`);
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao resetar 2FA");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Admins</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + New admin
        </button>
      </div>

      {error && (
        <div className="card" style={{ background: "var(--danger-dim)", color: "var(--danger)", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {generatedPwd && (
        <div className="card" style={{ background: "var(--accent-dim)", marginBottom: "1rem", border: "1px solid var(--accent)" }}>
          <h3 style={{ marginTop: 0 }}>⚠️ Senha gerada — copia agora</h3>
          <p style={{ margin: "0.5rem 0" }}>
            Admin criado: <strong>{generatedPwd.email}</strong>
          </p>
          <p style={{ margin: "0.5rem 0", fontFamily: "monospace", fontSize: "1.1rem", padding: "0.5rem", background: "var(--bg)", borderRadius: 4 }}>
            {generatedPwd.pwd}
          </p>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", margin: "0.5rem 0" }}>
            Esta senha NÃO será mostrada novamente. Envie ao novo admin por canal
            seguro (1Password share, Signal, etc.) — ele será forçado a fazer
            2FA enroll no primeiro login.
          </p>
          <button type="button" className="btn btn-outline" onClick={() => setGeneratedPwd(null)}>
            Entendi, descartar
          </button>
        </div>
      )}

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--accent-dim)", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Name</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Email</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Role</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>2FA</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "left" }}>Created</th>
              <th style={{ padding: "0.65rem 1rem", textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const isEditingThis = editing === a.id;
              // UI guards (não-superadmin não vê botões pra mexer em
              // superadmin nem em si mesmo) — backend valida igual.
              const canModify =
                myRole === "superadmin" || (a.role !== "superadmin");
              return (
                <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.65rem 1rem", fontWeight: 500 }}>{a.name}</td>
                  <td style={{ padding: "0.65rem 1rem", fontFamily: "monospace", fontSize: "0.85rem" }}>
                    {a.email}
                  </td>
                  <td style={{ padding: "0.65rem 1rem" }}>
                    {isEditingThis ? (
                      <select
                        className="input"
                        defaultValue={a.role}
                        style={{ padding: "0.25rem 0.5rem", fontSize: "0.85rem" }}
                        onChange={(e) => handleUpdateRole(a.id, e.target.value)}
                        disabled={busy === `role:${a.id}`}
                      >
                        {roles.map((r) => (
                          <option key={r.code} value={r.code}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={a.role} />
                    )}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", fontSize: "0.85rem" }}>
                    {a.requires_2fa ? (
                      <span style={{ color: "var(--success)" }}>required</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>disabled</span>
                    )}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", fontSize: "0.85rem", color: "var(--muted)" }}>
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "0.65rem 1rem", textAlign: "right", whiteSpace: "nowrap" }}>
                    {canModify && (
                      <>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", marginRight: "0.4rem" }}
                          onClick={() => setEditing(isEditingThis ? null : a.id)}
                        >
                          {isEditingThis ? "Cancel" : "Change role"}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", marginRight: "0.4rem" }}
                          onClick={() => handleResetTwoFA(a.id, a.email)}
                          disabled={busy === `2fa:${a.id}`}
                        >
                          Reset 2FA
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", color: "var(--danger)" }}
                          onClick={() => handleDelete(a.id, a.email)}
                          disabled={busy === `delete:${a.id}`}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                  Nenhum admin além de você.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateAdminModal
          roles={roles}
          mySuperadmin={myRole === "superadmin"}
          busy={busy === "create"}
          onClose={() => setShowCreate(false)}
          onSubmit={handleCreate}
        />
      )}
    </AdminShell>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    superadmin: "var(--accent)",
    manager: "var(--success)",
    support: "var(--muted)",
    viewer: "var(--muted)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.6rem",
        background: colors[role] ?? "var(--muted)",
        color: "white",
        borderRadius: 12,
        fontSize: "0.78rem",
        fontWeight: 600,
      }}
    >
      {role}
    </span>
  );
}

function CreateAdminModal({
  roles,
  mySuperadmin,
  busy,
  onClose,
  onSubmit,
}: {
  roles: Role[];
  mySuperadmin: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (email: string, name: string, role: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("viewer");

  // Non-superadmin não pode criar superadmin — backend bloqueia mas a UI
  // remove a opção pra evitar erro 403.
  const availableRoles = roles.filter((r) => mySuperadmin || r.code !== "superadmin");

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ minWidth: 400, maxWidth: 500, background: "var(--card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ marginTop: 0 }}>Novo admin</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(email, name, role);
          }}
        >
          <div style={{ marginBottom: "1rem" }}>
            <label className="label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="novo-admin@viralefy.com"
              autoFocus
            />
          </div>
          <div style={{ marginBottom: "1rem" }}>
            <label className="label">Nome</label>
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome completo"
            />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <label className="label">Role</label>
            <select
              className="input"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {availableRoles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label} ({r.permissions.length} perms)
                </option>
              ))}
            </select>
            <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              Senha será gerada automaticamente. Você vai vê-la UMA vez depois
              de criar — envie por canal seguro.
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Criando…" : "Criar admin"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
