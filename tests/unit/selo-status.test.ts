import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmpresaCard, type EmpresaResumo } from "@/components/EmpresaCard";
import { EmpresaLinha } from "@/components/EmpresaLinha";
import { SeloStatus } from "@/components/SeloStatus";
import { lerFiltros, ORDENS } from "@/lib/diretorio";

const empresa: EmpresaResumo = {
  instagramUsername: "cafe_exemplo",
  nome: "Café Exemplo",
  fotoUrl: null,
  resumo: "Um café da comunidade.",
  categoria: "Café e padaria",
  cidade: "Recife",
  uf: "PE",
  status: "verificada",
  causas: [],
  _count: { depoimentos: 0 },
};

describe("rótulos de perfil assumido", () => {
  it("não apresenta a aprovação automática como conferência da moderação", () => {
    const selo = renderToStaticMarkup(createElement(SeloStatus, { status: "verificada" }));

    expect(selo).toContain("Perfil assumido");
    expect(selo).toContain("O selo não certifica a identidade nem as causas do negócio.");
    expect(selo).not.toContain("moderação conferiu");
    expect(selo).not.toContain("Verificado pelo dono");
  });

  it("mantém o selo de indicação sem afirmar que o perfil já foi assumido", () => {
    const selo = renderToStaticMarkup(createElement(SeloStatus, { status: "indicada" }));

    expect(selo).toContain("Indicado pela comunidade");
    expect(selo).not.toContain("Perfil assumido");
  });

  it("usa um marcador neutro no selo do perfil assumido e no card", () => {
    const selo = renderToStaticMarkup(createElement(SeloStatus, { status: "verificada" }));
    const card = renderToStaticMarkup(createElement(EmpresaCard, { empresa }));

    expect(selo).toMatch(/<span\b[^>]*aria-hidden="true"[^>]*>•<\/span>/);
    expect(selo).toContain("border-linha");
    expect(selo).toContain("O selo não certifica a identidade nem as causas do negócio.");
    expect(card).toContain(selo);
  });

  it("descreve o marcador neutro da lista sem afirmar certificação", () => {
    const linha = renderToStaticMarkup(createElement(EmpresaLinha, { empresa }));
    const indicador = linha.match(/<[^>]*aria-label="Perfil assumido"[^>]*>[\s\S]*?<\/(?:span|svg)>/)?.[0];

    expect(indicador).toBeDefined();
    expect(indicador).toContain('title="Uma conta assumiu o perfil. Identidade e causas não certificadas."');
    expect(indicador).toMatch(/>\s*•\s*<\/span>$/);
    expect(linha).toContain('href="/empresas/cafe_exemplo"');
    expect(linha).not.toContain("Verificado pelo dono");
  });

  it("não mostra um perfil indicado como assumido no card ou na lista", () => {
    const indicada = { ...empresa, status: "indicada" };
    const card = renderToStaticMarkup(createElement(EmpresaCard, { empresa: indicada }));
    const linha = renderToStaticMarkup(createElement(EmpresaLinha, { empresa: indicada }));

    expect(card).toContain("Indicado pela comunidade");
    expect(card).not.toContain("Perfil assumido");
    expect(linha).not.toContain('aria-label="Perfil assumido"');
    expect(linha).toContain('href="/empresas/cafe_exemplo"');
  });

  it("preserva o cadastro por etapas no painel sem prometer verificação", () => {
    const pagina = readFileSync(new URL("../../src/app/painel/page.tsx", import.meta.url), "utf8");
    expect(pagina).toContain("Você ainda não assumiu um perfil de negócio.");
    expect(pagina).toContain('href="/participar?dono=sim"');
  });

  it("usa o rótulo de perfil assumido na moderação sem perder o link de Instagram", () => {
    const pagina = readFileSync(new URL("../../src/app/moderacao/page.tsx", import.meta.url), "utf8");
    expect(pagina).toContain('"perfil já assumido" : "sem dono"');
    expect(pagina).toContain("<LinkInstagram endereco={r.empresa.instagramUsername}");
  });

  it("muda o rótulo da ordenação sem quebrar os parâmetros existentes", () => {
    expect(ORDENS.verificados).toBe("Assumidos primeiro");
    expect(lerFiltros({ verificados: "sim", ordem: "verificados" })).toMatchObject({
      verificados: true,
      ordem: "verificados",
    });
  });
});
