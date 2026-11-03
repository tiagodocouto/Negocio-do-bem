// A primeira etapa do cadastro (/participar): a pessoa digita o @, e o caso decide
// as opções da etapa seguinte. Sem banco, para testar cada caso sem navegador.

/** O negócio com aquele @, ou null quando ele ainda não está no Negócio do Bem. */
export type NegocioProcurado = { moderacao: string; oculta: boolean; donos: number } | null;

export type CasoDaProcura =
  /** Não existe: a pessoa indica ou cadastra como dona, nas próximas etapas. */
  | "indicar"
  /** No diretório e sem dono: "É meu negócio" ou "Quero deixar um depoimento". */
  | "confirmar"
  /** No diretório e com dono: pede revisão. */
  | "revisao"
  /** Tirado do ar, esperando a moderação ou oculto: a resposta não diz o motivo. */
  | "indisponivel";

export function casoDaProcura(negocio: NegocioProcurado): CasoDaProcura {
  if (!negocio) return "indicar";
  if (negocio.moderacao !== "aprovada" || negocio.oculta) return "indisponivel";
  return negocio.donos > 0 ? "revisao" : "confirmar";
}

/** "Você vai estar em boa companhia: 12 negócios em 5 cidades." */
export function boaCompanhia(total: number, cidades: number): string {
  const negocios = `${total.toLocaleString("pt-BR")} ${total === 1 ? "negócio" : "negócios"}`;
  const emCidades = `${cidades.toLocaleString("pt-BR")} ${cidades === 1 ? "cidade" : "cidades"}`;
  return `Você vai estar em boa companhia: ${negocios} em ${emCidades}.`;
}
