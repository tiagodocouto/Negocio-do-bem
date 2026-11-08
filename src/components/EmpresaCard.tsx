import Link from "next/link";
import { CausaBadge } from "@/components/CausaBadge";
import { CoracaoFavorito, type EstadoFavorito } from "@/components/CoracaoFavorito";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { SeloStatus } from "@/components/SeloStatus";
import { filtrarCausas } from "@/lib/causas";
import { temInstagram } from "@/lib/endereco";

export type EmpresaResumo = {
  id: string;
  instagramUsername: string;
  nome: string;
  fotoUrl: string | null;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
  status: string;
  causas: { causa: string }[];
  _count: { depoimentos: number };
  // A oferta do Clube do Bem que está valendo, se houver (o selo de cupom).
  ofertas?: { id: string }[];
};

const MAX_BADGES = 3;

/**
 * O negócio num card do diretório. Com `favorito`, ganha o coração no canto, fora do link
 * do card (um botão não pode ficar dentro de um link).
 */
export function EmpresaCard({ empresa, favorito }: { empresa: EmpresaResumo; favorito?: EstadoFavorito }) {
  const causas = filtrarCausas(empresa.causas.map((c) => c.causa));
  const depoimentos = empresa._count.depoimentos;
  return (
    <div className="group relative flex flex-col transition duration-200 hover:-translate-y-0.5">
      <Link
        href={`/empresas/${empresa.instagramUsername}`}
        className="cartao flex flex-1 flex-col p-5 transition duration-200 group-hover:border-coral/30 group-hover:shadow-xl group-hover:shadow-coral/5"
      >
        <div className={`flex items-start gap-3 ${favorito ? "pr-10" : ""}`}>
          <FotoEmpresa empresa={empresa} />
          <div className="min-w-0">
            <h3 className="line-clamp-2 break-words font-serif text-xl font-semibold leading-tight group-hover:text-coral-700">
              {empresa.nome}
            </h3>
            {temInstagram(empresa.instagramUsername) && <p className="truncate text-sm text-suave">@{empresa.instagramUsername}</p>}
          </div>
        </div>

        <p className="mt-3 text-xs font-medium tracking-wide text-suave uppercase">
          {empresa.categoria} · {empresa.cidade}, {empresa.uf}
        </p>
        <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed text-tinta/85">{empresa.resumo}</p>

        {causas.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {causas.slice(0, MAX_BADGES).map((slug) => (
              <CausaBadge key={slug} slug={slug} />
            ))}
            {causas.length > MAX_BADGES && (
              <span className="rounded-full bg-papel px-2.5 py-1 text-xs font-medium text-suave">
                +{causas.length - MAX_BADGES}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-5">
          <span className="flex flex-wrap items-center gap-1.5">
            <SeloStatus status={empresa.status} />
            {!!empresa.ofertas?.length && (
              <span className="rounded-full bg-coral-50 px-2.5 py-1 text-xs font-semibold text-coral-700">🎟️ Cupom</span>
            )}
          </span>
          {depoimentos > 0 && (
            <span className="text-xs text-suave">
              {depoimentos} {depoimentos === 1 ? "depoimento" : "depoimentos"}
            </span>
          )}
        </div>
      </Link>
      {favorito && <CoracaoFavorito estado={favorito} nome={empresa.nome} className="absolute top-3 right-3" />}
    </div>
  );
}
