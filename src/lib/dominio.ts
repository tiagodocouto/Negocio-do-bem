// Listas e rótulos usados em formulários e telas.

export const CATEGORIAS = [
  "Alimentação",
  "Café e padaria",
  "Restaurante e bar",
  "Mercado e empório",
  "Moda e acessórios",
  "Beleza e bem-estar",
  "Saúde",
  "Educação",
  "Arte e cultura",
  "Livraria e papelaria",
  "Casa e decoração",
  "Pet",
  "Serviços",
  "Tecnologia",
  "Turismo e hospedagem",
  "Outros",
] as const;

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type Uf = (typeof UFS)[number];

export const NOMES_UF: Record<Uf, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul",
  MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima",
  SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export const METODOS_REIVINDICACAO: Record<string, string> = {
  instagram_login: "Entrar com Instagram",
  // Não é mais oferecido; continua para mostrar os pedidos antigos.
  codigo_dm: "Código por DM",
  documento: "Dados do negócio",
};

export const STATUS_REIVINDICACAO: Record<string, string> = {
  pendente: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
  expirada: "Expirada",
  cancelada: "Cancelada",
  // A moderação tirou a pessoa dos donos depois de aprovar.
  revogada: "Removida pela moderação",
};

export const MODERACAO_EMPRESA: Record<string, string> = {
  pendente: "Aguardando moderação",
  aprovada: "Publicada",
  rejeitada: "Não publicada",
};

export const PAPEIS: Record<string, string> = {
  membro: "Membro",
  moderador: "Moderação",
};

/** Como a página da cidade chama quem é embaixador: "Embaixadora em Salvador". */
export const TITULOS_EMBAIXADOR = {
  embaixadora: "Embaixadora",
  embaixador: "Embaixador",
  "pessoa-embaixadora": "Pessoa embaixadora",
} as const;
export type TituloEmbaixador = keyof typeof TITULOS_EMBAIXADOR;

export const STATUS_DEPOIMENTO: Record<string, string> = {
  publicado: "Publicado",
  removido: "Removido",
};

/** O que cada ação da auditoria quer dizer, para a moderação ler sem decorar os códigos. */
export const ACOES_AUDITORIA: Record<string, string> = {
  "empresa.indicada": "Indicou um negócio",
  "empresa.aprovada": "Publicou um negócio",
  "empresa.rejeitada": "Tirou um negócio do ar",
  "empresa.editada": "Editou o próprio negócio",
  "empresa.editada_pela_moderacao": "Editou um negócio pela moderação",
  "empresa.foto_trocada": "Trocou a foto do próprio negócio",
  "empresa.foto_trocada_pela_moderacao": "Trocou a foto pela moderação",
  "empresa.foto_removida": "Removeu a foto do próprio negócio",
  "empresa.foto_removida_pela_moderacao": "Removeu a foto pela moderação",
  "empresa.foto_do_instagram": "Colocou a foto do Instagram",
  "empresa.ocultada": "Tirou o próprio negócio do diretório",
  "empresa.reexibida": "Devolveu o próprio negócio ao diretório",
  "reivindicacao.aprovada": "Aprovou um pedido de reivindicação",
  "reivindicacao.aprovada_com_transferencia": "Aprovou um pedido e transferiu o negócio",
  "reivindicacao.recusada": "Recusou um pedido de reivindicação",
  "empresa.dono_removido": "Tirou um dono do negócio",
  "depoimento.mantido": "Manteve um depoimento denunciado",
  "depoimento.removido": "Removeu um depoimento denunciado",
  "usuario.senha_trocada": "Trocou a própria senha no painel",
  "usuario.senha_redefinida": "Trocou a senha pelo link do e-mail",
  "usuario.moderacao_dada": "Deu a moderação a uma conta",
  "usuario.moderacao_tirada": "Tirou a moderação de uma conta",
  "embaixador.criado": "Cadastrou um embaixador",
  "embaixador.editado": "Editou um embaixador",
  "embaixador.excluido": "Excluiu um embaixador",
  "embaixador.foto_trocada": "Trocou a foto de um embaixador",
  "embaixador.foto_removida": "Removeu a foto de um embaixador",
  "embaixador.foto_do_instagram": "Colocou a foto do Instagram num embaixador",
  "clube.pedido": "Pediu a verificação para o Clube do Bem",
  "clube.documento_visto": "Abriu o documento de um pedido do Clube do Bem",
  "clube.liberado": "Liberou um dono para o Clube do Bem",
  "clube.recusado": "Recusou um pedido do Clube do Bem",
  "clube.suspenso": "Suspendeu um dono do Clube do Bem",
  "oferta.criada": "Criou uma oferta do Clube do Bem",
  "oferta.encerrada": "Encerrou uma oferta do Clube do Bem",
};

/** A caixa de e-mail do projeto, para quem quer falar com a equipe (ex.: ser embaixador). */
export const EMAIL_DO_PROJETO = "ola@negociodobem.com";

/** Onde fica o código aberto do projeto. */
export const REPOSITORIO = "https://github.com/fabs-reis/Negocio-do-bem";
