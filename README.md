# viralefy_backoffice

Painel admin: planos, gateways de pagamento e pedidos.

## Diretrizes

[../viralefy_archive/diretrizes.md](../viralefy_archive/diretrizes.md) · [../AGENTS.md](../AGENTS.md)

## Rodar

```bash
cp .env.example .env.local
npm install
npm run dev
```

http://localhost:3001 — credenciais vêm de `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` (lidas pelo seed do API na primeira subida). Em ambientes onde já tem admin no banco, use o que está cadastrado.
