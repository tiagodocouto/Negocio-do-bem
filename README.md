# Negócio do Bem

Um diretório de negócios com consciência social e conexão com a comunidade. As pessoas encontram negócios que compartilham dos seus valores, indicam quem admiram e deixam depoimentos. Os donos assumem o perfil do negócio e contam a própria história.

- **Diretório** com busca (sem diferenciar acentos) e filtros por causa e estado.
- **Páginas por cidade, causa e tipo de negócio** (`/cidades/salvador-ba`, `/causas/opcoes-veganas`, `/tipos/cafe-e-padaria`), feitas para a busca do Google.
- **Perfis** com foto, botões de contato (WhatsApp, site e e-mail), a história do negócio no estilo Substack (Markdown, tipografia serifada, fotos com legenda), badges de causas e depoimentos.
- **Causas** como Pet friendly, Antirracista, Escala 5x2, Escala 4x3 e outras (lista em `src/lib/causas.ts`).
- **Indicação** pela comunidade, publicada na hora. A moderação tira do ar o que for impróprio.
- **Reivindicação de propriedade** pelo dono, explicada abaixo.
- **Painel do dono** para editar o perfil, responder depoimentos e ocultar o negócio.
- **Moderação** com um painel próprio: os números do projeto, a atividade das últimas semanas e a saúde dos dados; filas de disputas de reivindicação e de denúncias; todos os negócios, contas e depoimentos, com a ficha de cada conta; botão para tirar um negócio do ar; edição de qualquer perfil (foto, contatos, textos e causas); e o registro de auditoria, com filtros.

Vai colaborar? Comece por estes dois guias:

- [Regras de negócio](docs/regras-de-negocio.md): como o sistema funciona, regra por regra, com os limites e onde cada regra está no código.
- [Como o projeto foi feito](docs/como-foi-feito.md): o propósito, as decisões e o porquê delas, a arquitetura e receitas para as mudanças mais comuns.

## Telas

As imagens usam os dados de exemplo do seed.

![Página inicial com a busca e os filtros por causa](docs/prints/home.png)

| Diretório | Perfil do negócio |
| --- | --- |
| ![Cards do diretório com os selos de causas](docs/prints/diretorio.png) | ![Perfil da Padaria Florescer com a história no estilo Substack](docs/prints/perfil.png) |
| **Depoimentos** | **Painel do dono** |
| ![Depoimentos da comunidade com a resposta do dono](docs/prints/depoimentos.png) | ![Painel do dono editando o perfil](docs/prints/painel-do-dono.png) |

<p align="center">
  <img src="docs/prints/celular-home.png" alt="Página inicial no celular" width="280">
  <img src="docs/prints/celular-perfil.png" alt="Perfil do negócio no celular" width="280">
</p>

## Stack

Next.js 16 (App Router, Cache Components), React 19, Tailwind CSS 4, Prisma 7 + PostgreSQL, Zod e Vitest. A autenticação é por e-mail e senha (scrypt) ou por link mandado ao e-mail, com sessão em cookie `httpOnly`. O cookie guarda o token e o banco guarda só o hash dele.

## Rodando localmente

Requisitos: Node 22.12+ e Docker (ou um PostgreSQL seu).

```bash
docker compose up -d          # sobe o Postgres em localhost:5433
cp .env.example .env
npm install                   # também gera o cliente do Prisma
npm run db:migrate            # cria as tabelas
npm run db:seed               # dados de exemplo (opcional)
npm run dev                   # http://localhost:3000
```

Sem proxy declarado, o login e o cadastro dividem 10 tentativas a cada 15 minutos no `npm run dev`. Para zerar, apague as linhas da tabela `TentativaAcesso`.

O seed cria negócios fictícios e estas contas, todas com a senha `senha-demo-123` e o e-mail já confirmado:

| E-mail | Papel |
| --- | --- |
| `moderacao@exemplo.com` | moderação |
| `ana@exemplo.com`, `joao@exemplo.com`, `bia@exemplo.com` | donos de negócios de exemplo |
| `carla@exemplo.com` | enviou os dados do Café Arco-Íris e espera a moderação |

A confirmação de e-mail está desligada por enquanto (`CONFIRMACAO_DE_EMAIL_LIGADA` em `src/lib/auth/links.ts`): uma conta criada no site já indica, escreve depoimentos e reivindica. Ligada, a conta precisa confirmar o e-mail para isso. Sem o envio de e-mail configurado, o link de confirmação (e o de "Entrar por link") aparece no terminal do `npm run dev`.

Para a sua própria conta virar moderação, cadastre-se no site e rode `npm run moderacao -- dar seu@email.com`. O `npm run moderacao -- listar` mostra quem é moderação.

As fotos enviadas no seu computador ficam em `public/enviados/` (fora do Git). No Vercel, elas vão para o Vercel Blob: um para a produção e outro para os previews.

### Problemas comuns

- **"User was denied access on the database"**: o `DATABASE_URL` está apontando para outro Postgres, geralmente um instalado no computador (Homebrew ou Postgres.app) na porta 5432. O do Docker usa a **5433**: confira se o seu `.env` tem `localhost:5433`, como no `.env.example`, e rode `npm run db:migrate` de novo.
- **"Can't reach database server"**: o Docker não está rodando. Abra o Docker Desktop e rode `docker compose up -d`.
- **"The table `public.Empresa` does not exist"**: faltou criar as tabelas. Rode `npm run db:migrate`.
- Depois de mudar o `.env`, pare o `npm run dev` (Ctrl+C) e rode de novo.

## Como o dono reivindica o negócio

Tudo começa no botão "Sou o dono" do perfil (`/empresas/<@>/reivindicar`). Por enquanto, o caminho é um só: a pessoa envia os **dados do negócio**. Se o negócio ainda não tem dono, ela vira dona na hora. Se já tem, o pedido vira uma disputa, e a moderação decide com estes dados:

- **CNPJ ou MEI** (opcional): a moderação vê o CNPJ formatado e os dados da Receita ao lado.
- **Site** (opcional): aparece como link na ficha da moderação.
- **Instagram**: é o @ do próprio perfil, que a moderação abre para comparar com o CNPJ e o site.
- **Relação com o negócio** e **contato** (obrigatórios), para a moderação tirar dúvidas.

Duas formas automáticas de verificação já estão no código, mas ficam **desligadas** até você preencher as variáveis no `.env`:

| Caminho | Liga quando | Como é aprovado |
| --- | --- | --- |
| **Entrar com Instagram** | `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET` preenchidos | Na hora, se o @ conectado for o do negócio (só contas comerciais ou de criador) |
| **Código por DM** | `INSTAGRAM_PERFIL_OFICIAL` preenchido | Pela moderação, ou sozinho se o webhook estiver configurado |

Com algum deles ligado, o envio de dados vira a opção "Não tenho acesso ao Instagram do negócio". Se ligar um deles, atualize também o texto de `src/app/sobre/page.tsx`, que hoje só descreve o envio de dados.

Regras que protegem os negócios (em `src/lib/reivindicacao.ts`):

- Nos caminhos pelo Instagram, o perfil fica ligado ao **ID da conta**, não só ao @. Se um @ mudar de dono, a verificação nova vai para análise em vez de ser aprovada sozinha.
- **Não existe aprovação automática quando há conflito**: o negócio já tem dono, o ID da conta é diferente do registrado ou a conta já está ligada a outro perfil. Nesses casos a moderação decide se adiciona a pessoa como co-dona ou transfere o perfil.
- Quando ligado, o código da DM vale 48 horas, fica preso à conta de quem o gerou e só é aceito se vier do @ do negócio. A tela avisa para nunca enviar um código passado por outra pessoa.
- Cada pessoa pode fazer no máximo 10 solicitações e 10 indicações por dia.
- Toda aprovação, recusa, edição e decisão de moderação fica registrada na auditoria (`/moderacao?aba=auditoria`).
- Donos respondem depoimentos, mas não apagam. Uma denúncia não esconde o depoimento: só a moderação remove.
- O dono pode **ocultar** o negócio do diretório a qualquer momento, por exemplo se foi indicado e não quer aparecer.

### Ativando o código por DM (opcional)

Preencha `INSTAGRAM_PERFIL_OFICIAL` com o @ do perfil oficial do Negócio do Bem, que recebe as DMs. A moderação confere cada DM e localiza o pedido pelo código na aba de reivindicações. Para a confirmação ser automática, veja a seção do webhook abaixo.

### Ativando o "Entrar com Instagram" (opcional)

> Os nomes de telas e permissões da Meta mudam com frequência. Confira a [documentação oficial](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login) antes de configurar.

1. Em [developers.facebook.com](https://developers.facebook.com/), crie um app do tipo **Negócios** e adicione o produto **Instagram**, na opção de API com **login do Instagram**.
2. Nas configurações de login, cadastre a URL de redirecionamento `https://SEU-DOMINIO/api/instagram/retorno`, com o mesmo valor de `APP_URL`.
3. Copie o ID e a chave secreta **do app do Instagram** para `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`.
4. Enquanto o app estiver em desenvolvimento, só as contas cadastradas como testadoras conseguem entrar. Para liberar para todo mundo, peça a revisão do app (acesso avançado à permissão `instagram_business_basic`) e faça a verificação do negócio na Meta.

O site pede só `instagram_business_basic`, lê apenas o `user_id` e o `username` e **não guarda o token**.

### Ativando a confirmação automática da DM (opcional)

1. Conecte o perfil oficial (`INSTAGRAM_PERFIL_OFICIAL`) ao app e gere um token dele com `instagram_business_basic` e `instagram_business_manage_messages`. Coloque o token em `INSTAGRAM_ACCESS_TOKEN`.
2. Cadastre o webhook com a URL `https://SEU-DOMINIO/api/webhooks/instagram` e o mesmo texto de `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`. Depois assine o campo `messages`.
3. Tokens de longa duração do Instagram vencem e precisam ser renovados periodicamente. Se o token vencer, nada quebra: as DMs passam a cair na fila da moderação com uma anotação.

O webhook confere a assinatura `X-Hub-Signature-256` de cada chamada, descobre o @ de quem mandou a DM e só aprova sozinho quando o @ bate e não há conflito.

## Ativando a rotina de fotos do Instagram (opcional)

Um script no seu computador preenche, todo dia, a foto de perfil dos negócios que ainda não têm foto. Ele busca a foto pela API oficial da Meta (Business Discovery), recorta em 600×600 e envia pronta para o site, que só grava se o negócio continuar sem foto. As regras estão na [seção 9 das regras de negócio](docs/regras-de-negocio.md#rotina-de-fotos-do-instagram).

**Na Meta (uma vez):**

1. Tenha uma conta profissional do Instagram (comercial ou de criador) **ligada a uma Página do Facebook**. Ela só serve para fazer as consultas e não aparece no site.
2. Crie um app em developers.facebook.com com o caso de uso "Gerenciar mensagens e conteúdo no Instagram". Na configuração da API **com login do Facebook**, adicione as permissões `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` e `pages_show_list`.
3. No portfólio empresarial que tem a Página e o Instagram, conecte o app (Configurações → Contas → Apps) e crie um **usuário do sistema** (Usuários → Usuários do sistema).
4. Atribua ao usuário do sistema o app, a Página e a conta do Instagram. Gere um token para ele com as quatro permissões e validade **Nunca**.

**No Vercel:** configure `FOTOS_TOKEN` em Production com um valor de pelo menos 32 caracteres (`openssl rand -hex 32`). Sem ela, a rota `/api/fotos-instagram` responde 404.

**No seu computador:**

1. Copie `.env.fotos.example` para `.env.fotos` e preencha: o endereço do site, o mesmo `FOTOS_TOKEN`, o token do usuário do sistema e o ID da conta do Instagram que faz as consultas.
2. Rode uma vez para conferir: `npm run fotos:instagram`.
3. Agende para todo dia às 7h: `npm run fotos:agendar`. O registro fica em `~/Library/Logs/negocio-do-bem-fotos.log`. Para tirar o agendamento: `npm run fotos:agendar -- --remover`.

Contas pessoais ou privadas não aparecem na API. Para esses negócios, salve a foto em `fotos-manuais/<@>.jpg` (ou `.png`, `.webp`): ela tem prioridade sobre a da API.

## Ativando os avisos por e-mail (opcional)

O site manda por e-mail o link para confirmar o e-mail e o link para entrar sem senha. Também avisa quem pediu uma reivindicação quando a moderação decide, a moderação quando chega um pedido ou uma denúncia na fila, e os donos quando chega um depoimento. O envio é pelo [Resend](https://resend.com). As regras estão na [seção 14 das regras de negócio](docs/regras-de-negocio.md#14-avisos-por-e-mail).

1. Crie uma conta no Resend e adicione o domínio do site em **Domains**. Crie no DNS do domínio os registros que ele mostrar: o DKIM em `resend._domainkey` e, no subdomínio `send`, um MX e um SPF. Eles não mexem no MX nem no SPF da caixa de e-mail do domínio.
2. Quando o domínio aparecer como verificado, crie uma chave em **API Keys**, com permissão só de envio (**Sending access**).
3. No Vercel, só em **Production**, configure `RESEND_API_KEY` com a chave e `EMAIL_REMETENTE` com o remetente, como `Negócio do Bem <avisos@negociodobem.com>`. Opcional: `EMAIL_RESPOSTA`, para onde vão as respostas, como `ola@negociodobem.com`.
4. Faça um redeploy. A aba "Sistema" da moderação mostra se os avisos estão ligados.

Nos previews o envio fica desligado mesmo com as variáveis, porque o banco dos previews só tem contas de teste. Lá, os links de confirmar e de entrar aparecem no log da função no Vercel.

Com a confirmação de e-mail ligada e sem o envio ligado em produção, ninguém consegue confirmar o e-mail, e as contas novas não indicam, não escrevem depoimentos e não reivindicam. Por isso, e pelo limite de 100 e-mails por dia do plano grátis do Resend, a confirmação está desligada por enquanto.

## Testes e verificações

```bash
npm test          # testes unitários e de banco (precisa do Postgres rodando)
npm run lint
npm run typecheck
```

Os testes usam um banco separado (`negocio_do_bem_teste`, ou o de `TEST_DATABASE_URL`). Ele é criado na primeira execução e as tabelas são limpas entre os testes. Por segurança, a suíte só roda se o nome do banco tiver "test".

## Publicando

Funciona em qualquer hospedagem de Next.js com um PostgreSQL gerenciado.

**No Vercel**

1. Em **Storage**, crie um banco **Neon** e conecte ao projeto sem prefixo, só no ambiente **Production**, para as variáveis se chamarem `DATABASE_URL` e `DATABASE_URL_UNPOOLED`.
2. Crie um **segundo banco Neon**, só para os previews, e conecte do mesmo jeito, só no ambiente **Preview**. Assim, o código de um PR nunca lê nem altera os dados de produção.
3. Em **Environment Variables**, configure `APP_URL` (o domínio público, como `https://seu-projeto.vercel.app`). As do Instagram são opcionais.
4. Em **Storage**, crie um **Blob** com acesso público e conecte ao projeto só no ambiente **Production**. É onde ficam as fotos dos perfis e das histórias. A conexão cria a `BLOB_STORE_ID`, e o site se autentica pelo OIDC do deploy, sem token.
   - Crie o Blob pelo Storage da conta, e não pelo do projeto: criado dentro do projeto, ele já se conecta a Production e Preview.
   - O site não precisa da `BLOB_READ_WRITE_TOKEN`. Se o painel recomendar revogar o token (na página **Projects** do Blob), faça um redeploy e revogue.
5. Crie um **segundo Blob** público, só para os previews, e conecte do mesmo jeito, só no ambiente **Preview**. Assim, o código de um PR nunca grava nem apaga as fotos de produção.
6. Opcional: em **Environment Variables**, só para **Production**, configure `NEXT_PUBLIC_GA_ID` com o ID de medição do Google Analytics (`G-…`). Sem ela, o Analytics não carrega.
   - Para o Google Search Console e o Bing Webmaster Tools, configure também `GOOGLE_SITE_VERIFICATION` e `BING_SITE_VERIFICATION`, e depois envie o `sitemap.xml` nos dois painéis. O passo a passo está em [Como o projeto foi feito](docs/como-foi-feito.md#cadastrar-o-site-no-google-e-no-bing).
7. A cada deploy, de produção ou de preview, o `scripts/vercel-build.sh` aplica as migrações pendentes no banco daquele ambiente antes do build. Nos previews, ele também roda o seed, que só preenche um banco vazio.
8. Depois do primeiro deploy, cadastre a sua conta no site e dê a moderação a ela com a conexão direta do banco de produção: `DATABASE_URL="postgresql://..." npm run moderacao -- dar voce@exemplo.com`.

**Em outra hospedagem**

1. Configure as variáveis de `.env.example` no painel da hospedagem. `APP_URL` precisa ser o domínio público. Para as fotos, use a `BLOB_READ_WRITE_TOKEN` de um Vercel Blob: fora do Vercel não há OIDC.
2. Aplique as migrações no banco de produção com `npm run db:deploy`. Faça isso a cada mudança no `prisma/schema.prisma`.
3. O `npm install` gera o cliente do Prisma, e o `npm run build` faz o resto.
4. Diga ao site de onde vem o IP de cada visitante, que o limite de tentativas de login e cadastro usa. Sem isso, o site ignora os cabeçalhos de IP, porque qualquer visitante pode escrevê-los, e todos os visitantes dividem um limite só (10 tentativas a cada 15 minutos). Se há um proxy ou balanceador seu na frente do site, que escreve o `x-forwarded-for` e é o único caminho até o site, defina `AUTENTICACAO_PROXY_CONFIAVEL=1`. O site usa o último valor do `x-forwarded-for`, o que o proxy acrescentou. Se o proxy não é o único caminho, ou se não escreve esse cabeçalho, deixe a variável vazia.
5. Cadastre a sua conta no site e dê a moderação a ela: `DATABASE_URL="<conexão de produção>" npm run moderacao -- dar voce@exemplo.com`.

Nunca rode o seed em produção: ele cria contas com senha conhecida e se recusa a rodar quando `NODE_ENV=production` ou, no Vercel, quando `VERCEL_ENV=production`.

## Estrutura

```
assets/fontes/       fontes das imagens de compartilhamento (licença OFL)
docs/                regras de negócio, como o projeto foi feito e prints
prisma/              esquema, migrações e dados de exemplo
src/acoes/           Server Actions (formulários), sempre conferindo permissão no servidor
scripts/             build do Vercel, ícones da marca e a rotina de fotos do Instagram (roda no seu computador)
src/app/             páginas e rotas (api/link, api/instagram, api/webhooks/instagram e api/fotos-instagram)
src/components/      componentes de interface
src/lib/             regras de negócio: reivindicacao.ts, instagram.ts, auth/, causas.ts, cnpj.ts…
tests/               testes (unit/ sem banco, db/ com banco)
```

## Próximos passos sugeridos

- Uma verificação de verdade para o dono: hoje quem pede um negócio sem dono vira dono na hora, sem conferência. Um caminho é comparar o nome de quem pede com os sócios que a Receita devolve para o CNPJ.
- Trocar a senha pelo painel, para completar a recuperação de senha: o "Entrar por link" já devolve o acesso a quem esqueceu.
- Renovação automática do token do Instagram usado pelo webhook.

## Como contribuir

Contribuições são bem-vindas. O [CONTRIBUTING.md](CONTRIBUTING.md) explica como rodar o projeto, as regras do código e como abrir um pull request. As [regras de negócio](docs/regras-de-negocio.md) e [como o projeto foi feito](docs/como-foi-feito.md) explicam o que o sistema faz e por quê. Achou uma falha de segurança? Avise em particular, como explica o [SECURITY.md](SECURITY.md).

## Licença

[MIT](LICENSE): você pode usar, copiar e modificar o código, inclusive em outros projetos, desde que mantenha o aviso de licença.
