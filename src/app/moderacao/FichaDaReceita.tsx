import { liberarDonoParaClube } from "@/acoes/clube";
import { BotaoEnviar } from "@/components/BotaoEnviar";
import { conferirIdentidade, quemBateComAConta } from "@/lib/clube";
import { formatarCnpj, type DadosCnpj } from "@/lib/cnpj";
import { formatarTelefone, normalizarTexto } from "@/lib/texto";
import { RemoverDono } from "./RemoverDono";

export type NegocioDaFicha = { id: string; instagramUsername: string; cidade: string; uf: string };

/**
 * A ficha do CNPJ na Receita, para a moderação decidir a liberação no Clube do Bem: a
 * situação, a cidade comparada com a do perfil, o contato, os sócios e, para cada dono,
 * se o nome bate com alguém da ficha. Usada na ficha do negócio e na fila do clube.
 */
export function FichaDaReceita({
  empresa,
  cnpj,
  ficha,
  donos,
  voltar,
}: {
  empresa: NegocioDaFicha;
  cnpj: string;
  ficha: DadosCnpj;
  donos: { id: string; nome: string; nomeCompleto?: string | null; cpfMascarado?: string | null }[];
  /** "fila": depois de liberar, volta para a fila do clube, e não para a ficha do negócio. */
  voltar?: "fila";
}) {
  const ativa = normalizarTexto(ficha.situacao ?? "") === "ativa";
  const mesmaCidade =
    normalizarTexto(ficha.municipio ?? "") === normalizarTexto(empresa.cidade) && (ficha.uf ?? "").toUpperCase() === empresa.uf;
  const linha = "grid gap-1 sm:grid-cols-[10rem_minmax(0,1fr)]";
  return (
    <div className="cartao space-y-4 p-4 text-sm">
      <h3 className="font-medium">Ficha da Receita · CNPJ {formatarCnpj(cnpj)}</h3>
      <dl className="space-y-2">
        <div className={linha}>
          <dt className="text-suave">Razão social</dt>
          <dd className="break-words">{ficha.razaoSocial}</dd>
        </div>
        {ficha.nomeFantasia && (
          <div className={linha}>
            <dt className="text-suave">Nome fantasia</dt>
            <dd className="break-words">{ficha.nomeFantasia}</dd>
          </div>
        )}
        <div className={linha}>
          <dt className="text-suave">Situação</dt>
          <dd className={ativa ? "font-medium text-folha" : "font-medium text-coral-700"}>{ficha.situacao ?? "Desconhecida"}</dd>
        </div>
        <div className={linha}>
          <dt className="text-suave">Cidade</dt>
          <dd>
            {ficha.municipio ? `${ficha.municipio}, ${ficha.uf}` : "Não informada"}{" "}
            <span className={mesmaCidade ? "text-folha" : "text-coral-700"}>
              {mesmaCidade ? "· a mesma do perfil" : `· o perfil diz ${empresa.cidade}, ${empresa.uf}`}
            </span>
          </dd>
        </div>
        {(ficha.telefone || ficha.email) && (
          <div className={linha}>
            <dt className="text-suave">Contato na Receita</dt>
            <dd className="break-words">
              {[ficha.telefone && formatarTelefone(`55${ficha.telefone}`), ficha.email].filter(Boolean).join(" · ")}
            </dd>
          </div>
        )}
        <div className={linha}>
          <dt className="text-suave">Sócios</dt>
          <dd>
            {ficha.socios.length === 0 ? (
              <span className="text-suave">Nenhum na Receita. No MEI, o nome da pessoa está na razão social.</span>
            ) : (
              <ul className="space-y-0.5">
                {ficha.socios.map((socio) => (
                  <li key={`${socio.nome}-${socio.qualificacao}`}>
                    {socio.nome}
                    {socio.qualificacao && <span className="text-suave"> · {socio.qualificacao}</span>}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      </dl>

      <ul className="space-y-3 border-t border-linha pt-4">
        {donos.map((dono) => {
          const bate = quemBateComAConta(dono.nome, ficha);
          return (
            <li key={dono.id} className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <p>
                  <span className="font-medium">{dono.nome}</span>{" "}
                  {bate ? (
                    <span className="text-folha">· o nome bate com {bate}</span>
                  ) : (
                    <span className="text-coral-700">· o nome não bate com ninguém da ficha. Confira com a pessoa antes de liberar.</span>
                  )}
                </p>
                {(dono.nomeCompleto || dono.cpfMascarado) && <IdentidadeInformada ficha={ficha} dono={dono} />}
                {/* Quem não é do negócio sai dos donos daqui mesmo, sem voltar à seção de donos. */}
                {!bate && <RemoverDono empresaId={empresa.id} username={empresa.instagramUsername} dono={dono} voltar={voltar} />}
              </div>
              {ativa ? (
                <form action={liberarDonoParaClube}>
                  <input type="hidden" name="empresaId" value={empresa.id} />
                  <input type="hidden" name="usuarioId" value={dono.id} />
                  <input type="hidden" name="cnpj" value={cnpj} />
                  {voltar && <input type="hidden" name="voltar" value={voltar} />}
                  <BotaoEnviar className="botao botao-pequeno whitespace-nowrap" enviando="Liberando…">
                    Liberar {dono.nome.split(" ")[0]}
                  </BotaoEnviar>
                </form>
              ) : (
                <span className="text-coral-700">O CNPJ precisa estar ativo para liberar.</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** O nome e o CPF que o dono informou no pedido, comparados com a ficha da Receita. Só apoio: quem decide é a moderação. */
function IdentidadeInformada({
  ficha,
  dono,
}: {
  ficha: DadosCnpj;
  dono: { nomeCompleto?: string | null; cpfMascarado?: string | null };
}) {
  const { nomeBate, cpfBate } = conferirIdentidade(ficha, { nomeCompleto: dono.nomeCompleto ?? null, cpfMascarado: dono.cpfMascarado ?? null });
  return (
    <ul className="space-y-0.5 text-sm">
      <li>
        <span className="text-suave">Nome informado:</span> {dono.nomeCompleto ?? "não informado"}{" "}
        {dono.nomeCompleto &&
          (nomeBate ? <span className="text-folha">· bate com {nomeBate}</span> : <span className="text-coral-700">· não bate com ninguém da ficha</span>)}
      </li>
      <li>
        <span className="text-suave">CPF informado:</span> {dono.cpfMascarado ?? "não informado"}{" "}
        {dono.cpfMascarado &&
          (cpfBate ? (
            <span className="text-folha">· os dígitos do meio batem com um sócio</span>
          ) : (
            <span className="text-coral-700">· não bate com nenhum sócio (a Receita pode não mostrar o CPF de todos)</span>
          ))}
      </li>
    </ul>
  );
}
