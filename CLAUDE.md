@AGENTS.md

## Projeto

- Código, rotas e textos em português (pt-BR). Siga os nomes já usados (`empresa`, `reivindicacao`, `depoimento`, `causas`).
- Cache Components está ligado: leitura de cookies, `params`, `searchParams` ou banco fica dentro de `<Suspense>`. Os dados do banco não usam `use cache`, para estarem sempre atualizados.
- Formulários com `useActionState` usam `enviarSemLimpar` (`src/components/envio.ts`) para o React não limpar os campos quando há erro de validação.
- Regras da reivindicação ficam em `src/lib/reivindicacao.ts` e têm testes em `tests/db/`.
- Antes de concluir uma mudança: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run test:integracao` (precisam do Postgres; os testes usam o banco `negocio_do_bem_teste`, e a integração roda o Next compilado pelo build).
