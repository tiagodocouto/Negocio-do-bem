import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MenuModeracao } from "@/app/moderacao/MenuModeracao";

describe("MenuModeracao", () => {
  // O texto "esperando" é um sr-only, que fica com position: absolute. Sem um ancestral
  // posicionado dentro da barra, ele escapa do overflow-x-auto e alarga a página no celular.
  it("a barra rola dentro dela mesma e prende o texto sr-only", () => {
    const html = renderToStaticMarkup(<MenuModeracao aba="visao-geral" pendentes={{ indicacoes: 1 }} />);
    const classes = html.match(/<nav[^>]*class="([^"]*)"/)?.[1].split(" ") ?? [];

    expect(html).toContain("sr-only");
    expect(classes).toContain("overflow-x-auto");
    expect(classes).toContain("relative");
  });
});
