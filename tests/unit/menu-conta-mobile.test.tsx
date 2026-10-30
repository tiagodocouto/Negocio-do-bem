import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MenuMobile } from "@/components/MenuMobile";
import { MenuUsuario } from "@/components/MenuUsuario";
import { usuarioAtual } from "@/lib/auth/sessao";

vi.mock("@/acoes/conta", () => ({ sair: vi.fn() }));

vi.mock("@/lib/auth/sessao", () => ({ usuarioAtual: vi.fn() }));

const usuario = { id: "conta-ficticia", nome: "Ana de Exemplo", email: "ana@exemplo.com", moderador: false, emailConfirmado: true };

beforeEach(() => { vi.mocked(usuarioAtual).mockReset(); });

describe("Conta integrada ao menu mobile", () => {
  it("mantém painel e saída disponíveis sem criar um segundo menu", async () => {
    vi.mocked(usuarioAtual).mockResolvedValue(usuario);
    const conta = await MenuUsuario({ modo: "painel" });
    const html = renderToStaticMarkup(<MenuMobile>{conta}</MenuMobile>);
    expect(html.match(/<details\b/g)).toHaveLength(1);
    expect(html).toContain('href="/painel"');
    expect(html).toContain("Sair da conta");
    expect(html).toContain(usuario.email);
    expect(html).not.toContain('href="/moderacao"');
  });

  it("mostra a moderação apenas para quem tem esse papel", async () => {
    vi.mocked(usuarioAtual).mockResolvedValue({ ...usuario, moderador: true });
    expect(renderToStaticMarkup(await MenuUsuario({ modo: "painel" }))).toContain('href="/moderacao"');
  });

  it("oferece entrada e cadastro para visitantes", async () => {
    vi.mocked(usuarioAtual).mockResolvedValue(null);
    const html = renderToStaticMarkup(await MenuUsuario({ modo: "painel" }));
    expect(html).toContain('href="/entrar"');
    expect(html).toContain('href="/cadastrar"');
    expect(html).not.toContain("Sair da conta");
  });

  it("preserva o menu de conta do desktop sem exigir a nova prop", async () => {
    vi.mocked(usuarioAtual).mockResolvedValue(usuario);
    const html = renderToStaticMarkup(await MenuUsuario());
    expect(html).toContain("<details");
    expect(html).toContain('href="/painel"');
    expect(html).toContain("Sair da conta");
  });
});
