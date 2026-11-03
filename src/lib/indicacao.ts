import { normalizarUsername } from "@/lib/instagram";

export type Preenchimento = { instagram: string; souDono: boolean };

/**
 * Valores iniciais do cadastro por etapas vindos da URL (/participar?instagram=<@>&dono=sim),
 * como os links antigos do /indicar trazem. São só sugestões: o envio valida tudo de novo.
 */
export function lerPreenchimento(busca: Record<string, string | string[] | undefined>): Preenchimento {
  const primeiro = (valor: string | string[] | undefined) => (Array.isArray(valor) ? valor[0] : valor);
  return {
    instagram: normalizarUsername(primeiro(busca.instagram)) ?? "",
    souDono: primeiro(busca.dono) === "sim",
  };
}

type Contatos = {
  site: unknown;
  whatsapp: unknown;
  emailContato: unknown;
  telefoneComercial: unknown;
  emailDoDono: unknown;
  telefoneDoDono: unknown;
};

/**
 * Quem indica não publica contatos: site, WhatsApp, e-mail e telefone ficam com o dono
 * (#105), e o contato do dono é dele. O servidor apaga o que vier, mesmo que alguém mande.
 */
export function semContatosDeTerceiros<T extends Contatos>(campos: T, souDono: boolean): T {
  if (souDono) return campos;
  return { ...campos, site: null, whatsapp: null, emailContato: null, telefoneComercial: null, emailDoDono: null, telefoneDoDono: null };
}
