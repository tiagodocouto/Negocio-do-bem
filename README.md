# Negócio do Bem

Um diretório de negócios com consciência social e conexão com a comunidade. As pessoas encontram negócios que compartilham dos seus valores, indicam quem admiram e deixam depoimentos. Os donos assumem o perfil do negócio e contam a própria história.

- **Diretório** com busca (sem diferenciar acentos) e filtros por causa e estado.
- **Páginas por cidade, causa e tipo de negócio** (`/cidades/salvador-ba`, `/causas/opcoes-veganas`, `/tipos/cafe-e-padaria`), feitas para a busca do Google.
- **Perfis** com foto, botões de contato (WhatsApp, site e e-mail), a história do negócio no estilo Substack (Markdown, tipografia serifada, fotos com legenda), badges de causas e depoimentos.
- **Causas** como Pet friendly, Antirracista, Escala 5x2, Escala 4x3 e outras (lista em `src/lib/causas.ts`).
- **Indicação** pela comunidade, publicada na hora. A moderação tira do ar o que for impróprio.
- **Reivindicação de propriedade** pelo dono, explicada abaixo.
- **Painel do dono** para editar o perfil, responder depoimentos, ocultar o negócio e trocar a senha.
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

As fotos enviadas no seu computador ficam em `public/enviados/` (fora do Git). No Cloudflare, elas vão para o bucket R2 ligado ao Worker.

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

O **Entrar com Instagram** já está no código, mas fica **desligado** até você preencher `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET` no `.env`. Ligado, ele aprova na hora quando o @ conectado é o do negócio (só contas comerciais ou de criador), e o envio de dados vira a opção "Não tenho acesso ao Instagram do negócio". Se ligar, atualize também o texto de `src/app/sobre/page.tsx`, que hoje só descreve o envio de dados.

O código por DM, um terceiro caminho, saiu do site ([#193](https://github.com/fabs-reis/Negocio-do-bem/issues/193)). Os pedidos antigos por ele continuam no banco e aparecem como "Código por DM".

Regras que protegem os negócios (em `src/lib/reivindicacao.ts`):

- No Entrar com Instagram, o perfil fica ligado ao **ID da conta**, não só ao @. Se um @ mudar de dono, a verificação nova vai para análise em vez de ser aprovada sozinha.
- **Não existe aprovação automática quando há conflito**: o negócio já tem dono, o ID da conta é diferente do registrado ou a conta já está ligada a outro perfil. Nesses casos a moderação decide se adiciona a pessoa como co-dona ou transfere o perfil.
- Cada pessoa pode fazer no máximo 10 solicitações e 10 indicações por dia.
- Toda aprovação, recusa, edição e decisão de moderação fica registrada na auditoria (`/moderacao?aba=auditoria`).
- Donos respondem depoimentos, mas não apagam. Uma denúncia não esconde o depoimento: só a moderação remove.
- O dono pode **ocultar** o negócio do diretório a qualquer momento, por exemplo se foi indicado e não quer aparecer.

### Ativando o "Entrar com Instagram" (opcional)

> Os nomes de telas e permissões da Meta mudam com frequência. Confira a [documentação oficial](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login) antes de configurar.

1. Em [developers.facebook.com](https://developers.facebook.com/), crie um app do tipo **Negócios** e adicione o produto **Instagram**, na opção de API com **login do Instagram**.
2. Nas configurações de login, cadastre a URL de redirecionamento `https://SEU-DOMINIO/api/instagram/retorno`, com o mesmo valor de `APP_URL`.
3. Copie o ID e a chave secreta **do app do Instagram** para `INSTAGRAM_APP_ID` e `INSTAGRAM_APP_SECRET`.
4. Enquanto o app estiver em desenvolvimento, só as contas cadastradas como testadoras conseguem entrar. Para liberar para todo mundo, peça a revisão do app (acesso avançado à permissão `instagram_business_basic`) e faça a verificação do negócio na Meta.

O site pede só `instagram_business_basic`, lê apenas o `user_id` e o `username` e **não guarda o token**.

## Ativando a rotina de fotos do Instagram (opcional)

Um script no seu computador preenche, todo dia, a foto de perfil dos negócios que ainda não têm foto. Ele busca a foto pela API oficial da Meta (Business Discovery), recorta em 600×600 e envia pronta para o site, que só grava se o negócio continuar sem foto. As regras estão na [seção 9 das regras de negócio](docs/regras-de-negocio.md#rotina-de-fotos-do-instagram).

**Na Meta (uma vez):**

1. Tenha uma conta profissional do Instagram (comercial ou de criador) **ligada a uma Página do Facebook**. Ela só serve para fazer as consultas e não aparece no site.
2. Crie um app em developers.facebook.com com o caso de uso "Gerenciar mensagens e conteúdo no Instagram". Na configuração da API **com login do Facebook**, adicione as permissões `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement` e `pages_show_list`.
3. No portfólio empresarial que tem a Página e o Instagram, conecte o app (Configurações → Contas → Apps) e crie um **usuário do sistema** (Usuários → Usuários do sistema).
4. Atribua ao usuário do sistema o app, a Página e a conta do Instagram. Gere um token para ele com as quatro permissões e validade **Nunca**.

**No Cloudflare:** configure `FOTOS_TOKEN` em Production com um valor de pelo menos 32 caracteres (`openssl rand -hex 32`). Sem ela, a rota `/api/fotos-instagram` responde 404.

**No seu computador:**

1. Copie `.env.fotos.example` para `.env.fotos` e preencha: o endereço do site, o mesmo `FOTOS_TOKEN`, o token do usuário do sistema e o ID da conta do Instagram que faz as consultas.
2. Rode uma vez para conferir: `npm run fotos:instagram`.
3. Agende para todo dia às 7h: `npm run fotos:agendar`. O registro fica em `~/Library/Logs/negocio-do-bem-fotos.log`. Para tirar o agendamento: `npm run fotos:agendar -- --remover`.

Contas pessoais ou privadas não aparecem na API. Para esses negócios, salve a foto em `fotos-manuais/<@>.jpg` (ou `.png`, `.webp`): ela tem prioridade sobre a da API.

### A prévia do Instagram no cadastro

A mesma API mostra a foto, o nome e o site do perfil assim que a pessoa digita o @ em `/participar`, e a foto vira a foto do negócio ao cadastrar. Para ligar, configure no Worker de produção (Variables & Secrets) `META_ACCESS_TOKEN` (como secret) e `META_IG_USER_ID`, com os mesmos valores do `.env.fotos`. Sem elas, o cadastro funciona sem a prévia. As regras estão na [seção 4 das regras de negócio](docs/regras-de-negocio.md#o-cadastro-por-etapas).

## Ativando o login com o Google (opcional)

O botão "Continuar com o Google" aparece em `/entrar` e `/cadastrar` quando `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `APP_URL` estão configurados. As regras estão na [seção 2 das regras de negócio](docs/regras-de-negocio.md#cadastro-e-login).

> Os nomes das telas do Google Cloud mudam com frequência. Confira a [documentação oficial](https://developers.google.com/identity/protocols/oauth2/web-server) antes de configurar.

1. No [Google Cloud Console](https://console.cloud.google.com/), crie um projeto e abra o **Google Auth Platform**.
2. Em **Branding**, preencha o nome do app, o e-mail de suporte e o domínio autorizado (`negociodobem.com`). Em **Audience**, escolha **External** e publique o app (**In production**): em teste, só os usuários de teste cadastrados conseguem entrar. Os escopos usados (`openid`, `email` e `profile`) não pedem a verificação do Google.
3. Em **Clients**, crie um cliente do tipo **Web application**, com a URI de redirecionamento `https://www.negociodobem.com/api/google/retorno`: o `APP_URL` mais `/api/google/retorno`. Para testar no seu computador, acrescente `http://localhost:3000/api/google/retorno`.
4. No Cloudflare, configure `GOOGLE_CLIENT_ID` com o ID do cliente e `GOOGLE_CLIENT_SECRET` com a chave secreta, como secret. A aba "Sistema" da moderação mostra se o login com o Google está ligado.

Nos previews, o retorno vai para o `APP_URL` configurado no preview. O botão só funciona lá se esse endereço também estiver nas URIs do cliente; senão, deixe as variáveis do Google só na produção.

O site pede só `openid email profile`, lê a conta, o e-mail e o nome e **não guarda o token**.

## Ativando os avisos por e-mail (opcional)

O site manda por e-mail o link para confirmar o e-mail, o link para entrar sem senha e o link para criar uma senha nova, e avisa a pessoa quando a senha da conta é trocada. Também avisa quem pediu uma reivindicação quando a moderação decide, a moderação quando chega um pedido ou uma denúncia na fila, e os donos quando chega um depoimento. O envio é pelo [Resend](https://resend.com). As regras estão na [seção 14 das regras de negócio](docs/regras-de-negocio.md#14-avisos-por-e-mail).

1. Crie uma conta no Resend e adicione o domínio do site em **Domains**. Crie no DNS do domínio os registros que ele mostrar: o DKIM em `resend._domainkey` e, no subdomínio `send`, um MX e um SPF. Eles não mexem no MX nem no SPF da caixa de e-mail do domínio.
2. Quando o domínio aparecer como verificado, crie uma chave em **API Keys**, com permissão só de envio (**Sending access**).
3. No Cloudflare, só em **Production**, configure `RESEND_API_KEY` com a chave e `EMAIL_REMETENTE` com o remetente, como `Negócio do Bem <avisos@negociodobem.com>`. Opcional: `EMAIL_RESPOSTA`, para onde vão as respostas, como `ola@negociodobem.com`.
4. Faça um redeploy. A aba "Sistema" da moderação mostra se os avisos estão ligados.

Nos previews o envio fica desligado mesmo com as variáveis, porque o banco dos previews só tem contas de teste. Lá, os links de confirmar e de entrar aparecem no log do Worker.

Com a confirmação de e-mail ligada e sem o envio ligado em produção, ninguém consegue confirmar o e-mail, e as contas novas não indicam, não escrevem depoimentos e não reivindicam. Por isso, e pelo limite de 100 e-mails por dia do plano grátis do Resend, a confirmação está desligada por enquanto.

## Testes e verificações

```bash
npm test          # testes unitários e de banco (precisa do Postgres rodando)
npm run lint
npm run typecheck
```

Os testes usam um banco separado (`negocio_do_bem_teste`, ou o de `TEST_DATABASE_URL`). Ele é criado na primeira execução e as tabelas são limpas entre os testes. Por segurança, a suíte só roda se o nome do banco tiver "test".

## Publicando no Cloudflare

O site roda em Cloudflare Workers pelo adaptador OpenNext, com PostgreSQL gerenciado e fotos no R2. O bundle medido tem cerca de **15,7 MiB sem compressão**, abaixo do limite atual de 64 MiB ([limites dos Workers](https://developers.cloudflare.com/workers/platform/limits/)); o tamanho gzip exibido pelo Wrangler é apenas informativo. Os comandos `npm run preview:cloudflare` e `npm run deploy:cloudflare` constroem e executam no runtime de Workers; o build aplica as migrações em produção e nos previews, e roda o seed só nos previews.

1. Na conta Cloudflare, crie um Worker chamado `negocio-do-bem` e conecte o repositório Git. Configure produção pela branch `main`, habilite previews de branches/PRs, use `npm run cf:build` como build command, `npx opennextjs-cloudflare deploy` como deploy command (sem o `npx`, o deploy falha com "not found") e `npm run cf:preview` como preview command. O `cf:preview` preenche o cache das páginas no bucket dos previews antes do `wrangler preview`; sem isso, as páginas do preview travam com erro 1101 ([#172](https://github.com/fabs-reis/Negocio-do-bem/issues/172)).
2. Crie os buckets R2 `negocio-do-bem-cache` e `negocio-do-bem-fotos`, com bindings `NEXT_INC_CACHE_R2_BUCKET` e `UPLOADS`, respectivamente, e os dos previews, `negocio-do-bem-preview-cache` e `negocio-do-bem-preview-fotos`. Os buckets de cache devem ser privados. Para uma POC sem domínio, habilite a **Public Development URL** (`r2.dev`) no bucket de fotos e use a URL gerada como `NEXT_PUBLIC_R2_PUBLIC_URL`; essa URL é limitada e deixa os objetos acessíveis publicamente, então não armazene arquivos privados nela. Para produção, conecte ao bucket de fotos um domínio próprio, por exemplo `fotos.negociodobem.com`. O domínio precisa estar adicionado como zona na mesma conta Cloudflare. Se o DNS ainda estiver na Hostinger, revise e recrie todos os registros — em especial MX, SPF e DKIM do Zoho/Resend — antes de trocar os nameservers.
3. Use o plano **Workers Paid**. No grátis, cada requisição tem 10 ms de CPU, e só a conferência da senha (scrypt) passa disso. Há também um teto de 100 mil requisições por dia, que os robôs já passaram.
   - **Banco:** crie o PlanetScale Postgres pelo painel do Cloudflare (Hyperdrive → Criar banco de dados PlanetScale) e uma configuração do Hyperdrive apontando para ele, com o cache de consultas desligado e um limite de conexões abaixo do limite do banco (8, para as 25 do PS-5). O ID dela vai no binding `HYPERDRIVE` do `wrangler.jsonc`. Fora do Worker (build e scripts), use a conexão direta com `?sslmode=verify-full`: o `node-postgres` não entende o `sslrootcert=system` que o PlanetScale põe na conexão.
   - **Domínio:** o `www` é domínio personalizado do Worker, declarado no `wrangler.jsonc`. O domínio sem `www` usa o proxy do Cloudflare e uma regra de redirecionamento da zona para o `www`.
4. Configure **Build Variables and Secrets**. A produção e os previews têm abas separadas no painel, e o `scripts/cloudflare-build.sh` ainda decide o ambiente pela branch (`WORKERS_CI_BRANCH`): só a `main` é produção. Cadastre:
   - na aba da produção: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `APP_URL` (o domínio canônico) e `NEXT_PUBLIC_R2_PUBLIC_URL`;
   - na **Preview base config** (a aba "Base de Prévias" no painel em português): `PREVIEW_DATABASE_URL`, `PREVIEW_DATABASE_URL_UNPOOLED`, `PREVIEW_APP_URL` e `PREVIEW_R2_PUBLIC_URL`, com o banco e o bucket de teste. Sem elas, o build do preview falha, em vez de usar as de produção.

   O build usa essas variáveis para aplicar as migrações e gravar no HTML pré-renderizado o endereço canônico (`APP_URL`), o domínio das fotos e a política de segurança (CSP). Por isso, elas precisam estar no build, e não só no runtime.

   **A Preview base config é copiada quando o preview de uma branch é criado.** Um preview que já existia, como o da `stage`, não recebe o que você muda nela com o **Salvar** simples. Para levar a mudança a eles, use a seta do Salvar, **"Aplicar a pré-visualizações existentes"**, ou abra o preview no painel (o seletor ao lado do nome do Worker) e mude em Configurações dele. Vale para as variáveis de build, as de runtime e o preview command.
5. Cadastre as variáveis de runtime em **Variables & Secrets**: `DATABASE_URL` (como secret), `APP_URL`, `NEXT_PUBLIC_R2_PUBLIC_URL` e as opcionais do Resend, do Instagram, do Analytics e da verificação nos buscadores. `DEPLOY_ENV=production` e `CLOUDFLARE_DEPLOY=1` já estão no `wrangler.jsonc`, e o `keep_vars` impede que o deploy apague as outras variáveis do painel. Em **Worker Previews**, os buckets e as variáveis dos previews ficam no bloco `previews` do `wrangler.jsonc`. Cadastre a `DATABASE_URL` do banco de teste como secret de preview (`npx wrangler preview secret put DATABASE_URL`) e, nos previews que já existiam, na página de cada um. Nunca use recursos de produção nos previews.
6. Opcional: configure `NEXT_PUBLIC_GA_ID`, `GOOGLE_SITE_VERIFICATION` e `BING_SITE_VERIFICATION` em produção. Envie o `sitemap.xml` aos painéis do Google e Bing conforme [Como o projeto foi feito](docs/como-foi-feito.md#cadastrar-o-site-no-google-e-no-bing).
7. Depois do primeiro deploy, cadastre sua conta e dê a moderação com a conexão direta ao banco de produção: `DATABASE_URL="<conexão de produção>" npm run moderacao -- dar voce@exemplo.com`.

As fotos enviadas antes da migração estavam no Vercel Blob e foram copiadas para o R2 em 31 de outubro. O Blob continua no ar como reserva. Se aparecer alguma foto com endereço do Blob, rode `npm run fotos:para-r2` com a conexão de produção na frente: sem `--aplicar`, ele só mostra o que faria; com `--aplicar`, copia cada foto para o bucket `negocio-do-bem-fotos` e troca o endereço no banco. Precisa do `npx wrangler login`. Não apague o Blob antes de conferir os perfis. Enquanto isso, trocar ou remover uma foto antiga não a apaga do Blob: o arquivo continua público no endereço antigo até a cópia e a limpeza.

Para copiar o banco do Neon para outro Postgres, como o PlanetScale, use `npm run banco:copiar`, com `ORIGEM_URL` e `DESTINO_URL` no ambiente ou no `.env.migracao`. O cabeçalho do `scripts/copiar-banco.sh` explica as opções, inclusive como deixar a origem só para leitura durante a troca ([#177](https://github.com/fabs-reis/Negocio-do-bem/issues/177)).

Nunca rode o seed em produção: ele cria contas com senha conhecida e se recusa a rodar quando `NODE_ENV=production`, `DEPLOY_ENV=production` ou `VERCEL_ENV=production`.

## Estrutura

```
assets/fontes/       fontes das imagens de compartilhamento (licença OFL)
docs/                regras de negócio, como o projeto foi feito e prints
prisma/              esquema, migrações e dados de exemplo
src/acoes/           Server Actions (formulários), sempre conferindo permissão no servidor
scripts/             build do Cloudflare, ícones da marca e a rotina de fotos do Instagram (roda no seu computador)
src/app/             páginas e rotas (api/link, api/instagram e api/fotos-instagram)
src/components/      componentes de interface
src/lib/             regras de negócio: reivindicacao.ts, instagram.ts, auth/, causas.ts, cnpj.ts…
tests/               testes (unit/ sem banco, db/ com banco)
```

## Próximos passos sugeridos

- Uma verificação de verdade para o dono: hoje quem pede um negócio sem dono vira dono na hora, sem conferência. Um caminho é comparar o nome de quem pede com os sócios que a Receita devolve para o CNPJ.

## Como contribuir

Contribuições são bem-vindas. O [CONTRIBUTING.md](CONTRIBUTING.md) explica como rodar o projeto, as regras do código e como abrir um pull request. As [regras de negócio](docs/regras-de-negocio.md) e [como o projeto foi feito](docs/como-foi-feito.md) explicam o que o sistema faz e por quê. Achou uma falha de segurança? Avise em particular, como explica o [SECURITY.md](SECURITY.md).

## Licença

[MIT](LICENSE): você pode usar, copiar e modificar o código, inclusive em outros projetos, desde que mantenha o aviso de licença.
