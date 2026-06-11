"use client";

import { useState } from "react";
import { can, isSuperadmin } from "@/lib/auth";

// DeleteActions — bloco padrão de ações de delete pra qualquer entidade
// (orders, invoices, users). Renderiza:
//
//   - "Deleted" badge + Restore button quando deletedAt != null (superadmin)
//   - Soft Delete (admin com perm) quando ainda ativo
//   - Hard Delete (superadmin only) sempre disponível
//
// As actions chamam callbacks (soft/hard/restore) que o caller passa pra
// que esta UI fique entity-agnóstica. Confirm() no browser pra cada ação
// destrutiva — hard delete pede confirmação dupla.
//
// label: "Order" / "Invoice" / "Customer" — usado nas mensagens de confirm
// e nos avisos UI ("This Customer has been deleted").

export type DeleteActionsProps = {
  label: string;            // ex.: "Order", "Customer"
  deletedAt: string | null | undefined;
  deletedBy?: string | null;
  deleteReason?: string | null;
  // permsRequired = perm name pra soft delete (default admins:manage)
  permsRequired?: string;
  onSoftDelete: (reason: string) => Promise<void>;
  onHardDelete: () => Promise<void>;
  onRestore: () => Promise<void>;
};

export function DeleteActions(props: DeleteActionsProps) {
  const {
    label,
    deletedAt,
    deletedBy,
    deleteReason,
    permsRequired = "admins:manage",
    onSoftDelete,
    onHardDelete,
    onRestore,
  } = props;

  const [busy, setBusy] = useState<"" | "soft" | "hard" | "restore">("");
  const [error, setError] = useState<string | null>(null);
  const canSoft = can(permsRequired);
  const canHard = isSuperadmin();
  const deleted = !!deletedAt;

  async function handleSoft() {
    const reason = window.prompt(
      `Soft delete this ${label}? It will disappear from customer views but stay in the admin panel. Optional reason:`,
      "",
    );
    if (reason === null) return;
    setBusy("soft");
    setError(null);
    try {
      await onSoftDelete(reason);
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  async function handleHard() {
    if (!window.confirm(
      `HARD DELETE this ${label}? This action is IRREVERSIBLE — the row is purged from the database forever. Continue?`,
    )) return;
    if (!window.confirm(`Are you absolutely sure? Last chance to abort.`)) return;
    setBusy("hard");
    setError(null);
    try {
      await onHardDelete();
      // hard delete → redirect pra listagem pq a row some
      window.history.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  async function handleRestore() {
    if (!window.confirm(`Restore this ${label}? It will become visible to customers again.`)) return;
    setBusy("restore");
    setError(null);
    try {
      await onRestore();
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  // Sem permissão pra nenhuma ação: render nada
  if (!canSoft && !canHard) return null;

  return (
    <div
      className="card"
      style={{
        marginBottom: "1.5rem",
        border: deleted ? "1px solid var(--danger, #ef4444)" : undefined,
        background: deleted ? "rgba(239, 68, 68, 0.06)" : undefined,
      }}
    >
      <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.5rem" }}>Danger zone</h2>

      {deleted && (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            padding: "0.6rem 0.75rem",
            borderRadius: "0.45rem",
            marginBottom: "0.75rem",
            fontSize: "0.85rem",
          }}
        >
          <strong style={{ color: "var(--danger, #ef4444)" }}>Soft-deleted</strong>{" "}
          on {deletedAt ? new Date(deletedAt).toLocaleString() : "—"}
          {deletedBy && (
            <>
              {" "}by <code style={{ fontSize: "0.78rem" }}>{deletedBy.slice(0, 8)}</code>
            </>
          )}
          {deleteReason && <div style={{ color: "var(--muted)", marginTop: "0.25rem" }}>Reason: {deleteReason}</div>}
          <div style={{ color: "var(--muted)", marginTop: "0.25rem", fontSize: "0.78rem" }}>
            Customer views hide this {label.toLowerCase()}. Admin panel still shows it for audit.
          </div>
        </div>
      )}

      {error && <div className="alert alert-error" style={{ marginBottom: "0.5rem" }}>{error}</div>}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {!deleted && canSoft && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleSoft}
            disabled={busy !== ""}
            style={{ fontSize: "0.85rem" }}
          >
            {busy === "soft" ? "Deleting…" : `Soft delete ${label}`}
          </button>
        )}
        {deleted && canHard && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleRestore}
            disabled={busy !== ""}
            style={{ fontSize: "0.85rem", color: "var(--success, #3cd87d)" }}
          >
            {busy === "restore" ? "Restoring…" : `Restore ${label}`}
          </button>
        )}
        {canHard && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleHard}
            disabled={busy !== ""}
            style={{
              fontSize: "0.85rem",
              color: "var(--danger, #ef4444)",
              borderColor: "var(--danger, #ef4444)",
            }}
            title="Purges row from DB permanently"
          >
            {busy === "hard" ? "Purging…" : `Hard delete ${label}`}
          </button>
        )}
        {/* Honeypot: admin não-superadmin NÃO recebe nenhuma pista de que
            existe uma role mais alta. Sem texto "requires superadmin", sem
            tooltip — só os botões disponíveis pra role atual. Pra ele a UI
            inteira parece o limite do sistema. */}
      </div>
    </div>
  );
}
