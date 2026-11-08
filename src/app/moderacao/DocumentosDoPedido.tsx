/**
 * Os links para o documento (RG ou CNH) de um pedido do clube. Abrem pela rota protegida da
 * moderação, em outra aba, e cada abertura fica na auditoria.
 */
export function DocumentosDoPedido({ liberacaoId, quantidade }: { liberacaoId: string; quantidade: number }) {
  if (quantidade === 0) return <p className="text-sm text-suave">Documento: nenhum guardado (pedido antigo, ou o arquivo já foi apagado).</p>;
  return (
    <p className="text-sm">
      <span className="text-suave">Documento:</span>{" "}
      {Array.from({ length: quantidade }, (_, indice) => (
        <a
          key={indice}
          href={`/moderacao/documentos/${liberacaoId}/${indice}`}
          target="_blank"
          rel="noopener noreferrer"
          className="link mr-3"
        >
          {quantidade === 1 ? "Abrir o arquivo" : `Abrir o arquivo ${indice + 1}`}
        </a>
      ))}
      <span className="text-suave">(cada abertura fica na auditoria; o arquivo é apagado quando você decide)</span>
    </p>
  );
}
