<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Fluxo de trabalho: issues e pull requests

Vale para qualquer pessoa ou agente de IA que trabalhar neste repositório.

1. **Issue antes de codar.** Toda tarefa (bug, melhoria ou funcionalidade) começa por uma issue no GitHub com um destes labels:
   - `bug`: algo não funciona como deveria;
   - `enhancement`: melhoria em algo que já existe;
   - `feature`: funcionalidade nova.

   Sem issue, crie uma (`gh issue create --label ...`) antes de mexer no código.
2. **Branch dedicada, criada a partir da `stage`, nunca direto na `stage` nem na `main`**, no formato `tipo/numero-da-issue-descricao-curta`, em que o tipo é o label da issue. Exemplos: `bug/12-erro-no-login`, `feature/15-foto-do-negocio`.
3. **Entrega por pull request para a `stage`,** a branch padrão. Na descrição, use `Closes #N` quando o PR resolve a issue, ou `Refs #N` quando só se relaciona a ela.
4. **Deploy só pelo merge.** A `stage` é a homologação: o merge nela atualiza o preview da `stage` no Cloudflare Workers, e cada PR também ganha seu preview. Para publicar em produção, abra um PR da própria `stage` para a `main` e faça o merge com **"Create a merge commit"**; o merge na `main` publica no Cloudflare. O merge commit leva os commits da `stage` para a `main`, e assim o próximo PR de publicação não conflita com o que já foi publicado. Não faça deploy manual fora desse fluxo.
5. **`stage` e `main` são protegidas** por rulesets: exigem PR e a checagem "Lint, tipos e testes", e bloqueiam force push e a exclusão da branch. A `stage` aceita só squash (histórico linear) e não exige aprovação. A `main` aceita só merge commit e exige 1 aprovação. Como o GitHub não deixa aprovar o próprio PR, quem administra faz o merge da publicação marcando o bypass das regras, e não com auto-merge.

## Documentação do projeto

- `docs/regras-de-negocio.md` descreve cada regra de negócio como está no código. Leia antes de mudar comportamento e atualize no mesmo PR quando uma regra mudar.
- `docs/como-foi-feito.md` explica as decisões, a arquitetura, os padrões do código e receitas para as mudanças comuns.
