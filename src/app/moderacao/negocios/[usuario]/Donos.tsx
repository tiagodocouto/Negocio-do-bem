import Link from "next/link";
import { AvisoDaUrl } from "@/components/Avisos";
import { db } from "@/lib/db";
import { formatarDataCurta } from "@/lib/texto";
import { RemoverDono } from "../../RemoverDono";

/**
 * Os donos do negócio, com o botão para tirar cada um. A página volta para cá depois de
 * remover, com o aviso `dono_*`.
 */
export async function Donos({ empresa, aviso }: { empresa: { id: string; instagramUsername: string }; aviso?: string }) {
  const membros = await db.empresaMembro.findMany({
    where: { empresaId: empresa.id },
    include: { usuario: { select: { id: true, nome: true, email: true } } },
    orderBy: { criadoEm: "asc" },
  });

  return (
    <section id="donos" className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="font-serif text-2xl font-semibold">Donos</h2>
        <p className="mt-1 text-sm leading-relaxed text-suave">
          Quem assumiu o perfil e pode editá-lo. Remova quem não é do negócio: a pessoa recebe o motivo por e-mail, e um
          pedido novo dela para este negócio vai para a moderação.
        </p>
      </div>

      <AvisoDaUrl codigo={aviso} />

      {membros.length === 0 ? (
        <p className="cartao p-5 text-sm text-suave">Este negócio não tem dono.</p>
      ) : (
        <ul className="cartao divide-y divide-linha">
          {membros.map(({ usuario, criadoEm }) => (
            <li key={usuario.id} className="space-y-2 p-4 text-sm">
              <p>
                <Link href={`/moderacao/contas/${usuario.id}`} className="font-medium hover:underline">
                  {usuario.nome}
                </Link>{" "}
                <span className="text-suave">
                  · {usuario.email} · dono desde {formatarDataCurta(criadoEm)}
                </span>
              </p>
              <RemoverDono empresaId={empresa.id} username={empresa.instagramUsername} dono={usuario} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
