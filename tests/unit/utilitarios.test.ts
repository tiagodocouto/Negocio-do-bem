import { describe, expect, it } from "vitest";
import { gerarHashSenha, verificarSenha } from "@/lib/auth/senha";
import { filtrarCausas } from "@/lib/causas";
import { cnpjValido, formatarCnpj } from "@/lib/cnpj";
import { campoEmail, campoSite, campoTelefone, campoWhatsapp } from "@/lib/formulario";
import { comPontoFinal, formatarFavoritos, formatarTelefone, iniciais, normalizarTexto, tempoDeLeitura, textoDoPrazo } from "@/lib/texto";

describe("cnpjValido", () => {
  it("aceita CNPJ numérico válido, com ou sem pontuação", () => {
    expect(cnpjValido("11.222.333/0001-81")).toBe(true);
    expect(cnpjValido("11222333000181")).toBe(true);
  });

  it("aceita o novo CNPJ alfanumérico", () => {
    // Exemplo publicado pela Receita Federal.
    expect(cnpjValido("12.ABC.345/01DE-35")).toBe(true);
    expect(cnpjValido("12abc34501de35")).toBe(true);
  });

  it("rejeita dígito verificador errado, tamanho errado e repetições", () => {
    expect(cnpjValido("11.222.333/0001-82")).toBe(false);
    expect(cnpjValido("12.ABC.345/01DE-36")).toBe(false);
    expect(cnpjValido("1122233300018")).toBe(false);
    expect(cnpjValido("00000000000000")).toBe(false);
  });

  it("formata", () => {
    expect(formatarCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("senha", () => {
  it("confere a senha certa e rejeita a errada", async () => {
    const hash = await gerarHashSenha("uma senha bem grande");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verificarSenha("uma senha bem grande", hash)).toBe(true);
    expect(await verificarSenha("outra senha", hash)).toBe(false);
    expect(await verificarSenha("uma senha bem grande", "lixo")).toBe(false);
  });

  it("usa sal diferente a cada vez", async () => {
    expect(await gerarHashSenha("abc12345")).not.toBe(await gerarHashSenha("abc12345"));
  });
});

describe("texto", () => {
  it("normaliza acentos e caixa", () => {
    expect(normalizarTexto("  São   PAULO ")).toBe("sao paulo");
  });

  it("gera iniciais", () => {
    expect(iniciais("Padaria Flor do Bairro")).toBe("PB");
    expect(iniciais("Ateliê")).toBe("A");
    expect(iniciais("@@@")).toBe("?");
  });
});

describe("filtrarCausas", () => {
  it("remove desconhecidas e repetidas, mantendo a ordem oficial", () => {
    expect(filtrarCausas(["pet-friendly", "inventada", "escala-4x3", "pet-friendly"])).toEqual([
      "escala-4x3",
      "pet-friendly",
    ]);
  });
});

describe("campoSite", () => {
  it("completa o protocolo e aceita vazio", () => {
    expect(campoSite.parse(" meunegocio.com.br ")).toBe("https://meunegocio.com.br/");
    expect(campoSite.parse("http://loja.example.com/contato")).toBe("http://loja.example.com/contato");
    expect(campoSite.parse("")).toBeNull();
  });

  it("recusa o que não parece endereço", () => {
    expect(campoSite.safeParse("minha loja").success).toBe(false);
    expect(campoSite.safeParse("localhost").success).toBe(false);
  });
});

describe("campoWhatsapp", () => {
  it("guarda só os dígitos, com o 55 do Brasil", () => {
    expect(campoWhatsapp.parse("(11) 99148-8052")).toBe("5511991488052");
    expect(campoWhatsapp.parse("+55 11 99148-8052")).toBe("5511991488052");
    expect(campoWhatsapp.parse("011 99148 8052")).toBe("5511991488052");
    expect(campoWhatsapp.parse("(21) 3456-7890")).toBe("552134567890");
    expect(campoWhatsapp.parse("")).toBeNull();
  });

  it("recusa número sem DDD ou estrangeiro", () => {
    expect(campoWhatsapp.safeParse("99148-8052").success).toBe(false);
    expect(campoWhatsapp.safeParse("+1 415 555 0100").success).toBe(false);
  });

  it("formata para exibir", () => {
    expect(formatarTelefone("5511991488052")).toBe("(11) 99148-8052");
    expect(formatarTelefone("552134567890")).toBe("(21) 3456-7890");
  });
});

describe("campoTelefone", () => {
  it("guarda como o WhatsApp: só os dígitos, com o 55 do Brasil", () => {
    expect(campoTelefone.parse("(11) 99148-8052")).toBe("5511991488052");
    expect(campoTelefone.parse(" +55 11 99148-8052 ")).toBe("5511991488052");
    expect(campoTelefone.parse("(21) 3456-7890")).toBe("552134567890");
  });

  it("é obrigatório", () => {
    const resultado = campoTelefone.safeParse("");
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toBe("Informe seu telefone com DDD.");
  });

  it.each(["99148-8052", "+1 415 555 0100", "(11) 1234-5678", "(01) 99148-8052", "1".repeat(31)])("recusa %j", (valor) => {
    expect(campoTelefone.safeParse(valor).success).toBe(false);
  });
});

describe("campoEmail", () => {
  it("aceita vazio ou um e-mail válido, em minúsculas", () => {
    expect(campoEmail.parse("")).toBeNull();
    expect(campoEmail.parse(" Contato@Negocio.com.BR ")).toBe("contato@negocio.com.br");
  });

  it("recusa o que não é e-mail", () => {
    expect(campoEmail.safeParse("contato@").success).toBe(false);
  });
});

describe("tempoDeLeitura", () => {
  it("conta as palavras a 200 por minuto, sem a marcação do Markdown", () => {
    const paragrafo = "palavra ".repeat(100);
    expect(tempoDeLeitura(`## Título\n\n${paragrafo}\n\n**${paragrafo}**`)).toBe(1);
    expect(tempoDeLeitura(paragrafo.repeat(7))).toBe(4);
  });

  it("não conta o endereço das fotos e dos links", () => {
    const foto = "![legenda](https://fotos.exemplo.com/historias/x.jpg)";
    expect(tempoDeLeitura(`${foto}\n\n[site](https://exemplo.com)`)).toBe(1);
  });

  it("nunca dá zero", () => {
    expect(tempoDeLeitura("")).toBe(1);
  });
});

describe("comPontoFinal", () => {
  it("fecha a frase com ponto, sem dobrar o que já tem pontuação", () => {
    expect(comPontoFinal("O contato do perfil mudou")).toBe("O contato do perfil mudou.");
    expect(comPontoFinal("Golpe confirmado. ")).toBe("Golpe confirmado.");
    expect(comPontoFinal("Vendeu o negócio?")).toBe("Vendeu o negócio?");
    expect(comPontoFinal("  ")).toBe("");
  });
});

describe("formatarFavoritos", () => {
  it("diz quantas pessoas favoritaram, no singular e no plural", () => {
    expect(formatarFavoritos(0)).toBe("Ninguém favoritou ainda");
    expect(formatarFavoritos(1)).toBe("1 pessoa favoritou");
    expect(formatarFavoritos(1234)).toBe("1.234 pessoas favoritaram");
  });
});

describe("textoDoPrazo", () => {
  const agora = new Date("2026-11-06T12:00:00Z");
  const daqui = (minutos: number) => new Date(agora.getTime() + minutos * 60_000);

  it("mostra dias e horas, e horas e minutos no último dia", () => {
    expect(textoDoPrazo(daqui(3 * 1440 + 4 * 60 + 30), agora)).toBe("Termina em 3 dias e 4 h");
    expect(textoDoPrazo(daqui(1440), agora)).toBe("Termina em 1 dia");
    expect(textoDoPrazo(daqui(3 * 60 + 12), agora)).toBe("Termina em 3 h 12 min");
    expect(textoDoPrazo(daqui(12), agora)).toBe("Termina em 12 min");
    expect(textoDoPrazo(daqui(0), agora)).toBe("Terminou");
  });
});
