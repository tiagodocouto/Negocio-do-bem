import Link from "next/link";
import { CausaBadge } from "@/components/CausaBadge";
import { FotoEmpresa } from "@/components/FotoEmpresa";
import { SeloStatus } from "@/components/SeloStatus";
import { filtrarCausas } from "@/lib/causas";
import { temInstagram } from "@/lib/endereco";

export type EmpresaResumo = {
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
};

const MAX_BADGES = 3;

export function EmpresaCard({ empresa }: { empresa: EmpresaResumo }) {
  const causas = filtrarCausas(empresa.causas.map((c) => c.causa));
  const depoimentos = empresa._count.depoimentos;
  return (
    <Link
      href={`/empresas/${empresa.instagramUsername}`}
      className="group cartao flex flex-col p-5 transition duration-200 hover:-translate-y-0.5 hover:border-coral/30 hover:shadow-xl hover:shadow-coral/5"
    >
      <div className="flex items-start gap-3">
        <FotoEmpresa empresa={empresa} />
        <div className="min-w-0">
          <h3 className="truncate font-serif text-xl font-semibold leading-tight group-hover:text-coral-700">
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
        <SeloStatus status={empresa.status} />
        {depoimentos > 0 && (
          <span className="text-xs text-suave">
            {depoimentos} {depoimentos === 1 ? "depoimento" : "depoimentos"}
          </span>
        )}
      </div>
    </Link>
  );
}
