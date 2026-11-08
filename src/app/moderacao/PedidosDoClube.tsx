import Link from "next/link";
import { Suspense } from "react";
import { recusarPedidoDoClube } from "@/acoes/clube";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { LinkInstagram } from "@/components/LinkInstagram";
import { consultarCnpj, formatarCnpj } from "@/lib/cnpj";
import { apagarDocumentosVencidos } from "@/lib/clube";
import { db } from "@/lib/db";
import { comPontoFinal, formatarDataHora } from "@/lib/texto";
import { DocumentosDoPedido } from "./DocumentosDoPedido";
import { FichaDaReceita, type NegocioDaFicha } from "./FichaDaReceita";

/**
 * A fila do Clube do Bem: os donos que pediram a verificação com o CNPJ. Cada pedido já
 * traz a ficha da Receita, para a moderação liberar ou recusar sem sair da fila. O mais
 * antigo vem primeiro.
 */
export async function PedidosDoClube() {
  // Sem rotina agendada: os documentos de pedidos parados há mais de 30 dias saem quando a fila abre.
  await apagarDocumentosVencidos();
  const pedidos = await db.liberacaoClube.findMany({
    where: { status: "pendente" },
    orderBy: { decididoEm: "asc" },
    take: 50,
    include: {
      usuario: { select: { id: true, nome: true, email: true } },
      empresa: { select: { id: true, nome: true, instagramUsername: true, cidade: true, uf: true } },
    },
  });
  if (pedidos.length === 0) return <p className="cartao p-8 text-center text-suave">Nenhum pedido do clube esperando. 🎉</p>;

  return (
    <div id="pedidos" className="scroll-mt-24 space-y-4">
      <p className="text-sm leading-relaxed text-suave">
        Confira se o CNPJ está ativo, se a cidade é a do perfil e se o nome do dono bate com um sócio. Se não bater, fale com o
        negócio pelo telefone ou e-mail da ficha da Receita antes de liberar.
      </p>
      {pedidos.map((pedido) => (
        <article key={pedido.id} className="cartao space-y-4 p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link href={`/empresas/${pedido.empresa.instagramUsername}`} className="font-serif text-2xl font-semibold hover:text-coral-700">
                {pedido.empresa.nome}
              </Link>
              <p className="text-sm text-suave">
                <LinkInstagram endereco={pedido.empresa.instagramUsername} /> · {pedido.empresa.cidade}/{pedido.empresa.uf}
              </p>
            </div>
            <p className="text-right text-sm text-suave">pedido em {formatarDataHora(pedido.decididoEm)}</p>
          </header>

          <p className="text-sm">
            <span className="text-suave">Dono:</span>{" "}
            <Link href={`/moderacao/contas/${pedido.usuario.id}`} className="font-semibold hover:text-coral-700 hover:underline">
              {pedido.usuario.nome}
            </Link>{" "}
            ({pedido.usuario.email}) · <span className="text-suave">CNPJ</span> {formatarCnpj(pedido.cnpj)}
          </p>

          <DocumentosDoPedido liberacaoId={pedido.id} quantidade={pedido.documentoChaves.length} />

          {pedido.motivo && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Pediu de novo. Da última vez: {comPontoFinal(pedido.motivo)}
            </p>
          )}

          <Suspense fallback={<p className="cartao p-4 text-sm text-suave">Consultando a Receita…</p>}>
            <Ficha
              empresa={pedido.empresa}
              cnpj={pedido.cnpj}
              dono={{ ...pedido.usuario, nomeCompleto: pedido.nomeCompleto, cpfMascarado: pedido.cpfMascarado }}
            />
          </Suspense>

          <div className="flex flex-col gap-3 border-t border-linha pt-4 sm:flex-row sm:items-start sm:justify-between">
            <Link href={`/moderacao/negocios/${pedido.empresa.instagramUsername}#clube`} className="botao-claro botao-pequeno self-start">
              Ficha do negócio
            </Link>
            <form action={recusarPedidoDoClube} className="flex flex-1 gap-2 sm:max-w-md">
              <input type="hidden" name="liberacaoId" value={pedido.id} />
              <input type="hidden" name="voltar" value="fila" />
              <label htmlFor={`recusa-${pedido.id}`} className="sr-only">
                Motivo da recusa
              </label>
              <input
                id={`recusa-${pedido.id}`}
                name="motivo"
                maxLength={500}
                placeholder="Motivo da recusa (o dono vê)"
                className="campo py-1.5 sm:text-sm"
              />
              <BotaoEnviar className="botao-claro botao-pequeno" enviando="…">
                Recusar
              </BotaoEnviar>
            </form>
          </div>
        </article>
      ))}
    </div>
  );
}

async function Ficha({
  empresa,
  cnpj,
  dono,
}: {
  empresa: NegocioDaFicha;
  cnpj: string;
  dono: { id: string; nome: string; nomeCompleto: string | null; cpfMascarado: string | null };
}) {
  const ficha = await consultarCnpj(cnpj);
  if (!ficha) {
    return (
      <p className="cartao p-4 text-sm text-coral-700">
        Não foi possível consultar a Receita agora, e sem a consulta não há liberação. Recarregue a página em alguns minutos.
      </p>
    );
  }
  return <FichaDaReceita empresa={empresa} cnpj={cnpj} ficha={ficha} donos={[dono]} voltar="fila" />;
}
