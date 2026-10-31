import "server-only";
import { usaBlob } from "@/lib/armazenamento";
import { db } from "@/lib/db";
import { envioLigado } from "@/lib/email";
import { tokenDasFotos } from "@/lib/fotos-instagram";
import { configLogin, configWebhook, perfilOficial } from "@/lib/instagram";
import { ENDERECO_DO_SITE, INDEXAVEL } from "@/lib/seo";

// A aba "Sistema" do painel da moderação. Diz só se cada integração está ligada:
// nenhum valor de variável de ambiente sai daqui.

export type Integracao = { nome: string; ligada: boolean; ligadaTexto: string; desligadaTexto: string };

export function integracoes(): Integracao[] {
  return [
    {
      nome: "Fotos no Vercel Blob",
      ligada: usaBlob(),
      ligadaTexto: "As fotos vão para o Vercel Blob deste ambiente.",
      desligadaTexto: "As fotos ficam em public/enviados, o que só serve no computador de quem desenvolve.",
    },
    {
      nome: "Código por DM",
      ligada: perfilOficial() !== null,
      ligadaTexto: `Quem reivindica pode mandar um código por DM para @${perfilOficial()}.`,
      desligadaTexto: "Sem INSTAGRAM_PERFIL_OFICIAL, a reivindicação é só pelos dados do negócio.",
    },
    {
      nome: "Entrar com Instagram",
      ligada: configLogin() !== null,
      ligadaTexto: "O dono pode provar que controla o @ entrando com o Instagram.",
      desligadaTexto: "Faltam INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET ou APP_URL.",
    },
    {
      nome: "Confirmação automática da DM",
      ligada: configWebhook() !== null,
      ligadaTexto: "O webhook da Meta aprova sozinho o pedido quando a DM chega da conta certa.",
      desligadaTexto: "Faltam INSTAGRAM_APP_SECRET, INSTAGRAM_ACCESS_TOKEN ou INSTAGRAM_WEBHOOK_VERIFY_TOKEN.",
    },
    {
      nome: "Rotina de fotos do Instagram",
      ligada: tokenDasFotos() !== null,
      ligadaTexto: "A rota /api/fotos-instagram aceita o script local que busca as fotos.",
      desligadaTexto: "Sem FOTOS_TOKEN (de pelo menos 32 caracteres), a rota responde 404.",
    },
    {
      nome: "Avisos por e-mail",
      ligada: envioLigado(),
      ligadaTexto: "Donos e moderação recebem os avisos por e-mail, enviados pelo Resend.",
      desligadaTexto: "Sem RESEND_API_KEY e EMAIL_REMETENTE, ou fora da produção, ninguém recebe e-mail.",
    },
    {
      nome: "Google Analytics",
      ligada: Boolean(process.env.NEXT_PUBLIC_GA_ID),
      ligadaTexto: "As visitas são medidas pelo Google Analytics.",
      desligadaTexto: "Só a produção mede visitas.",
    },
    {
      nome: "Verificação no Google e no Bing",
      ligada: Boolean(process.env.GOOGLE_SITE_VERIFICATION || process.env.BING_SITE_VERIFICATION),
      ligadaTexto: "As meta tags de verificação estão na página inicial.",
      desligadaTexto: "Sem GOOGLE_SITE_VERIFICATION nem BING_SITE_VERIFICATION.",
    },
  ];
}

/** Em que ambiente o site está rodando e de qual commit ele veio, quando o Vercel informa. */
export function ambiente() {
  return {
    nome: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "desconhecido",
    endereco: ENDERECO_DO_SITE,
    indexavel: INDEXAVEL,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    regiao: process.env.VERCEL_REGION ?? null,
  };
}

type Migracao = { nome: string; terminadaEm: Date | null; desfeitaEm: Date | null };

/** As migrações aplicadas neste banco, da mais nova para a mais antiga. */
export async function migracoesAplicadas(): Promise<Migracao[]> {
  return db.$queryRaw<Migracao[]>`
    SELECT migration_name AS nome, finished_at AS "terminadaEm", rolled_back_at AS "desfeitaEm"
    FROM "_prisma_migrations"
    ORDER BY started_at DESC`;
}

/** Quantas linhas cada tabela tem. */
export async function linhasPorTabela() {
  const [contas, sessoes, negocios, causas, donos, reivindicacoes, depoimentos, auditoria, tentativas] = await Promise.all([
    db.usuario.count(),
    db.sessao.count(),
    db.empresa.count(),
    db.empresaCausa.count(),
    db.empresaMembro.count(),
    db.reivindicacao.count(),
    db.depoimento.count(),
    db.registroAuditoria.count(),
    db.tentativaAcesso.count(),
  ]);
  return [
    { tabela: "Usuario", rotulo: "Contas", total: contas },
    { tabela: "Sessao", rotulo: "Sessões", total: sessoes },
    { tabela: "Empresa", rotulo: "Negócios", total: negocios },
    { tabela: "EmpresaCausa", rotulo: "Causas marcadas", total: causas },
    { tabela: "EmpresaMembro", rotulo: "Donos", total: donos },
    { tabela: "Reivindicacao", rotulo: "Pedidos de reivindicação", total: reivindicacoes },
    { tabela: "Depoimento", rotulo: "Depoimentos", total: depoimentos },
    { tabela: "RegistroAuditoria", rotulo: "Registros da auditoria", total: auditoria },
    { tabela: "TentativaAcesso", rotulo: "Contadores de tentativas de acesso", total: tentativas },
  ];
}
