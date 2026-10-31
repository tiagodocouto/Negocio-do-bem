# Como contribuir

Que bom que você quer ajudar o Negócio do Bem! Correção de bug, melhoria de texto, acessibilidade ou uma funcionalidade nova: toda contribuição conta.

## Antes de começar

- Leia as [regras de negócio](docs/regras-de-negocio.md) e [como o projeto foi feito](docs/como-foi-feito.md). Eles explicam o que o sistema faz, por que faz e onde cada regra está no código.
- Toda mudança começa por uma issue, com o label `bug` (algo não funciona), `enhancement` (melhoria no que já existe) ou `feature` (funcionalidade nova). Se ela ainda não existe, abra.
- Para mudanças grandes, conte na issue o que você quer fazer e espere um retorno. Assim a gente combina o caminho antes de você investir tempo.
- Falhas de segurança não vão em issue pública. Veja o [SECURITY.md](SECURITY.md).
- Sem ideia por onde começar? Os [próximos passos do README](README.md#próximos-passos-sugeridos) são um bom lugar.

## Rodando o projeto

Siga o passo a passo de [Rodando localmente](README.md#rodando-localmente) no README. O seed cria negócios e contas de exemplo, todos fictícios.

## Regras do código

- Código, rotas e textos em português (pt-BR), com os nomes já usados no projeto (`empresa`, `reivindicacao`, `depoimento`, `causas`).
- Esta versão do Next.js mudou bastante em relação às anteriores. Na dúvida, consulte os guias em `node_modules/next/dist/docs/`.
- Cache Components está ligado: leitura de cookies, `params`, `searchParams` ou banco fica dentro de `<Suspense>`.
- Toda Server Action (`src/acoes/`) confere a permissão no servidor, nunca só na interface.
- Formulários com `useActionState` usam `enviarSemLimpar` (`src/components/envio.ts`) para os campos não sumirem quando há erro.
- Mudou uma regra da reivindicação (`src/lib/reivindicacao.ts`)? Atualize ou crie o teste em `tests/db/`.
- Mudou uma regra de negócio (quem pode fazer o quê, limites, estados, o que aparece para quem)? Atualize o [docs/regras-de-negocio.md](docs/regras-de-negocio.md) no mesmo PR.
- Mudou o `prisma/schema.prisma`? Crie a migração com `npm run db:migrate -- --name descricao-curta` e inclua no PR.
- Nunca faça commit do `.env` nem de dados reais de pessoas ou negócios. Use dados fictícios, como os do seed.

## Abrindo o pull request

1. Trabalhe numa branch `tipo/numero-da-issue-descricao-curta`, criada a partir da `stage`, em que o tipo é o label da issue. Exemplo: `bug/12-erro-no-login`.
2. Rode `npm run lint`, `npm run typecheck` e `npm test` (precisa do Postgres). O GitHub roda as mesmas verificações em todo PR.
3. Explique o que muda e por quê, e ligue o PR à issue: `Closes #12` se ele resolve, `Refs #12` se só se relaciona. Se mexeu na interface, coloque um print.
4. Prefira PRs pequenos, com um assunto só.

Abra o PR para a `stage`, a branch padrão. Ela é a homologação: cada PR ganha um preview no Cloudflare Workers para testar antes, e a `stage` tem o seu. A produção é a `main`, que recebe PRs da `stage`, e o deploy acontece sozinho depois do merge. As duas são protegidas: todo PR precisa passar na checagem "Lint, tipos e testes". Na `stage`, o merge é sempre por squash. Na `main`, a publicação precisa de uma aprovação e entra por merge commit.

## Convivência

O projeto existe para fortalecer quem cuida das pessoas e defende o respeito e a dignidade, e isso vale aqui também. Seja gentil nas issues e revisões. Comentários ofensivos ou discriminatórios são removidos.
