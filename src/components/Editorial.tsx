import Link from "next/link";
import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`container-editorial ${className}`}>{children}</div>;
}

export function CabecalhoPagina({ titulo, descricao, children }: {
  titulo: string;
  descricao?: string;
  children?: ReactNode;
}) {
  return (
    <header className="cabecalho-publico">
      <div><h1>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>
      {children && <div className="cabecalho-publico-acoes">{children}</div>}
    </header>
  );
}

export function SectionHeader({ titulo, texto, href, acao }: { titulo: string; texto?: string; href?: string; acao?: string }) {
  return <div className="cabecalho-secao"><div><h2>{titulo}</h2>{texto && <p>{texto}</p>}</div>{href && <Link href={href} className="link-editorial">{acao} <span aria-hidden="true">↗</span></Link>}</div>;
}

export function EditorialPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`painel-editorial ${className}`}>{children}</div>;
}

export function MetricCard({ valor, rotulo }: { valor: number; rotulo: string }) {
  return <div className="metrica-editorial"><dt>{rotulo}</dt><dd>{valor.toLocaleString("pt-BR")}</dd></div>;
}

export function LoadingSkeleton({ quantidade = 3, tipo = "negocios" }: {
  quantidade?: number;
  tipo?: "negocios" | "categorias" | "metricas";
}) {
  const grade = { negocios: "grade-negocios", categorias: "grade-categorias", metricas: "grade-metricas" }[tipo];
  return (
    <div className={grade} role="status" aria-label="Carregando conteúdo">
      <span className="sr-only">Carregando conteúdo…</span>
      {Array.from({ length: quantidade }, (_, i) => (
        <div key={i} aria-hidden="true" className={tipo === "categorias"
          ? `categoria-editorial esqueleto-categoria ${i === 0 || i === 4 ? "categoria-ampla" : ""}`
          : tipo === "metricas" ? "metrica-editorial esqueleto-metrica" : "skeleton-editorial"} />
      ))}
    </div>
  );
}
