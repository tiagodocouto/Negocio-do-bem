import { InstagramIcone } from "@/components/Icones";
import { temInstagram } from "@/lib/endereco";
import { linkPerfil } from "@/lib/instagram";
import { medirContato } from "@/lib/medicao";

type Props = {
  endereco: string;
  seta?: boolean;
  icone?: boolean;
  /** Com o negócio, o clique conta no Analytics como contato pelo Instagram. */
  contato?: { categoria: string; uf: string };
};

/**
 * O @ do negócio com o link do perfil no Instagram, ou "sem Instagram" para quem não tem.
 * Abre numa aba nova, para a pessoa não sair do site.
 */
export function LinkInstagram({ endereco, seta = false, icone = false, contato }: Props) {
  if (!temInstagram(endereco)) return <span>sem Instagram</span>;
  return (
    <a
      href={linkPerfil(endereco)}
      target="_blank"
      rel="noopener noreferrer"
      className={icone ? "link inline-flex items-center gap-1.5" : "link"}
      {...(contato && medirContato("instagram", contato))}
    >
      {icone && <InstagramIcone className="h-4 w-4 shrink-0" />}@{endereco}
      {seta && " ↗"}
    </a>
  );
}
