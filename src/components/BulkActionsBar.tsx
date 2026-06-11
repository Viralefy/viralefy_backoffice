"use client";

import { useState } from "react";
import type { BulkDeleteResult } from "@/lib/api";

// BulkActionsBar — barra sticky no rodapé da viewport com contagem de
// selecionados + botão "Soft delete N items". Aparece só quando count > 0.
//
// Entity-agnostic via callback `onSoftDelete(ids, reason)`. Confirm() antes
// + alert() com resumo (X succeeded, Y failed) depois. UI propietária da
// página decide o que fazer com o resultado (clear selection + refresh).

export type BulkActionsBarProps = {
  label: string;                // "orders", "customers", "top-ups"
  selectedIds: string[];
  onClear: () => void;
  onSoftDelete: (ids: string[], reason: string) => Promise<BulkDeleteResult>;
  onDone: () => void;            // chamado após sucesso pra refresh da lista
};

export function BulkActionsBar({
  label,
  selectedIds,
  onClear,
  onSoftDelete,
  onDone,
}: BulkActionsBarProps) {
  const [busy, setBusy] = useState(false);

  if (selectedIds.length === 0) return null;

  async function handleDelete() {
    const reason = window.prompt(
      `Soft delete ${selectedIds.length} ${label}? Optional reason (audit trail):`,
      "",
    );
    if (reason === null) return;
    setBusy(true);
    try {
      const result = await onSoftDelete(selectedIds, reason);
      const failedCount = result.failed?.length ?? 0;
      if (failedCount > 0) {
        const detail = result.failed!
          .slice(0, 5)
          .map((f) => `  ${f.id.slice(0, 8)}: ${f.error}`)
          .join("\n");
        alert(
          `${result.succeeded} deleted, ${failedCount} failed.\nFirst errors:\n${detail}`,
        );
      }
      onDone();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: "1.25rem",
        transform: "translateX(-50%)",
        zIndex: 50,
        background: "var(--surface, #1a1f2e)",
        border: "1px solid var(--border)",
        borderRadius: "0.7rem",
        padding: "0.65rem 1rem",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        display: "flex",
        gap: "0.85rem",
        alignItems: "center",
        fontSize: "0.9rem",
      }}
    >
      <strong>{selectedIds.length}</strong> {label} selected
      <button
        type="button"
        className="btn btn-outline"
        onClick={onClear}
        disabled={busy}
        style={{ fontSize: "0.8rem", padding: "0.35rem 0.7rem" }}
      >
        Clear
      </button>
      <button
        type="button"
        className="btn btn-outline"
        onClick={handleDelete}
        disabled={busy}
        style={{
          fontSize: "0.8rem",
          padding: "0.35rem 0.7rem",
          color: "var(--danger, #ef4444)",
          borderColor: "var(--danger, #ef4444)",
        }}
      >
        {busy ? "Deleting…" : `Soft delete ${selectedIds.length}`}
      </button>
    </div>
  );
}
