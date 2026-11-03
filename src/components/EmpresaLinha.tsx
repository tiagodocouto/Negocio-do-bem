import Link from "next/link";
import type { EmpresaResumo } from "@/components/EmpresaCard";
import { FotoEmpresa } from "@/components/FotoEmpresa";

/** O negócio numa linha, para o diretório em modo lista. */
export function EmpresaLinha({ empresa }: { empresa: EmpresaResumo }) {
  return (
    <Link
      href={`/empresas/${empresa.instagramUsername}`}
      className="group cartao flex items-center gap-4 rounded-2xl px-4 py-3.5 transition hover:border-coral/30 hover:bg-coral-50/40"
    >
      <FotoEmpresa empresa={empresa} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-serif text-lg leading-tight font-semibold group-hover:text-coral-700">{empresa.nome}</span>
          {empresa.status === "verificada" && (
            <span
              role="img"
              aria-label="Perfil assumido"
              title="Uma conta assumiu o perfil. Identidade e causas não certificadas."
              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-linha bg-superficie text-sm text-suave"
            >
              •
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm text-tinta/85">{empresa.resumo}</span>
        <span className="mt-0.5 block truncate text-xs text-suave sm:hidden">
          {empresa.categoria} · {empresa.cidade}, {empresa.uf}
        </span>
      </span>
      <span className="hidden shrink-0 text-right text-sm leading-snug text-suave sm:block">
        {empresa.categoria}
        <br />
        {empresa.cidade}, {empresa.uf}
      </span>
      <span aria-hidden="true" className="text-suave transition group-hover:translate-x-0.5 group-hover:text-coral-700">
        →
      </span>
    </Link>
  );
}
