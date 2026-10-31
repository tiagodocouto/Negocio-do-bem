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
  codigo_dm: "Código por DM",
  documento: "Dados do negócio",
};

export const STATUS_REIVINDICACAO: Record<string, string> = {
  pendente: "Em análise",
  aprovada: "Aprovada",
  recusada: "Recusada",
  expirada: "Expirada",
  cancelada: "Cancelada",
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
  "depoimento.mantido": "Manteve um depoimento denunciado",
  "depoimento.removido": "Removeu um depoimento denunciado",
  "usuario.moderacao_dada": "Deu a moderação a uma conta",
  "usuario.moderacao_tirada": "Tirou a moderação de uma conta",
};

/** Onde fica o código aberto do projeto. */
export const REPOSITORIO = "https://github.com/fabsreis/Negocio-do-bem";
