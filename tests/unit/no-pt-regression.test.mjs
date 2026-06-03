// Backoffice regression guard: scan src/ for hardcoded "R$", pt-BR locale
// calls, and a curated list of Portuguese UI strings that previously leaked.
//
// Policy: the admin panel is now EN-default. Comments in PT stay (internal
// dev team), but any UI string (label, button text, error message, etc.)
// must be in English. Adding a new PT label without translating it should
// break this test.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("../../src/", import.meta.url).pathname;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx)$/.test(p)) files.push(p);
  }
  return files;
}

const files = walk(ROOT);

function stripCommentsAndStrings(line) {
  // Strip // comments — they may legitimately contain PT.
  return line.replace(/\/\/.*$/, "");
}

function isCommentLine(line) {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}

test("no hardcoded 'R$' literal anywhere in backoffice src/ (credits are USD-cents canonical)", () => {
  const leaks = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (isCommentLine(line)) return;
      const code = stripCommentsAndStrings(line);
      if (code.includes("R$")) {
        leaks.push(`${relative(ROOT, f)}:${i + 1} → ${line.trim().slice(0, 100)}`);
      }
    });
  }
  assert.equal(
    leaks.length,
    0,
    `BRL/R$ leaks found:\n${leaks.join("\n")}`,
  );
});

test("no toLocale*(\"pt-BR\") locale call (use toLocaleString() with no arg → browser-default)", () => {
  const leaks = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const re = /toLocale(?:String|DateString|TimeString)\(\s*["']pt-BR["']/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      const line = src.slice(0, m.index).split("\n").length;
      leaks.push(`${relative(ROOT, f)}:${line}`);
    }
  }
  assert.equal(
    leaks.length,
    0,
    `pt-BR locale calls found:\n${leaks.join("\n")}`,
  );
});

test("root layout.tsx sets <html lang=\"en\"> (admin default = English)", () => {
  const f = files.find((x) => /\/app\/layout\.tsx$/.test(x));
  assert.ok(f, "src/app/layout.tsx not found");
  const src = readFileSync(f, "utf8");
  assert.ok(/<html\s+lang=["']en["']/.test(src), "layout.tsx must declare lang=\"en\"");
  assert.ok(!/lang=["']pt-BR["']/.test(src), "layout.tsx must NOT declare lang=\"pt-BR\"");
});

test("no leaked Portuguese UI strings from the curated regression list", () => {
  // Words that were UI strings before the EN sweep. Each is checked AS A
  // BARE STRING LITERAL inside JSX/TS code (not inside // comments).
  // Adding a NEW item here = trapping a regression observed in prod.
  const FORBIDDEN_UI = [
    "Carregando…",       // loading message
    "Salvando…",         // saving
    "Salvar alterações", // save changes button
    "Excluir",           // delete button (multiple pages)
    "Cancelar",          // cancel button
    "Voltar",            // back button
    "Recargas de crédito", // page title
    "Pedidos",           // page title — careful, also a category code
    "Clientes",          // page title
    "Moedas",            // page title
    "Recargas",          // sidebar label
    "Suporte",           // sidebar label
    "Aguardando cliente",// ticket status
    "Tickets de suporte",
    "Marcar essa recarga como paga",
    "Nenhum pedido encontrado",
    "Nenhuma recarga",
    "Δ em R$",           // the OG misleading form label
    "Falha no login",
    "Plano não encontrado",
    "Sair",              // sign-out
    "Entrando…",         // signing in
  ];

  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
      if (isCommentLine(line)) return;
      for (const phrase of FORBIDDEN_UI) {
        if (line.includes(phrase)) {
          hits.push(`${relative(ROOT, f)}:${i + 1} → "${phrase}" in: ${line.trim().slice(0, 100)}`);
        }
      }
    });
  }
  assert.equal(
    hits.length,
    0,
    `Portuguese UI strings still in code:\n${hits.join("\n")}`,
  );
});
