// Causas que um negócio pode abraçar. Aparecem como badges no perfil, como
// filtros na busca e com página própria (/causas/slug). Para criar uma causa
// nova basta adicioná-la aqui.

export type GrupoCausa = "trabalho" | "diversidade" | "planeta";

export type Causa = {
  slug: string;
  nome: string;
  /** Título da página da causa (/causas/slug), do jeito que as pessoas buscam. */
  titulo: string;
  emoji: string;
  descricao: string;
  grupo: GrupoCausa;
};

export const GRUPOS: Record<GrupoCausa, string> = {
  trabalho: "Trabalho digno",
  diversidade: "Diversidade e respeito",
  planeta: "Comunidade e planeta",
};

export const CAUSAS: Causa[] = [
  { slug: "escala-5x2", nome: "Escala 5x2", titulo: "Negócios com escala 5x2", emoji: "📅", grupo: "trabalho", descricao: "A equipe trabalha 5 dias e descansa 2." },
  { slug: "escala-4x3", nome: "Escala 4x3", titulo: "Negócios com escala 4x3", emoji: "🌤️", grupo: "trabalho", descricao: "Semana de 4 dias de trabalho." },
  { slug: "remuneracao-justa", nome: "Remuneração justa", titulo: "Negócios com remuneração justa", emoji: "🤝", grupo: "trabalho", descricao: "Paga acima do piso e com transparência." },
  { slug: "contrata-50-mais", nome: "Contrata pessoas 50+", titulo: "Negócios que contratam pessoas 50+", emoji: "🧓🏽", grupo: "trabalho", descricao: "Abre vagas para pessoas com mais de 50 anos." },
  { slug: "antirracista", nome: "Antirracista", titulo: "Negócios antirracistas", emoji: "✊🏾", grupo: "diversidade", descricao: "Compromisso ativo contra o racismo, dentro e fora do negócio." },
  { slug: "afroempreendedor", nome: "Afroempreendedor", titulo: "Negócios de afroempreendedores", emoji: "🌻", grupo: "diversidade", descricao: "Negócio fundado ou liderado por pessoas negras." },
  { slug: "lgbtqia", nome: "LGBTQIA+ friendly", titulo: "Negócios LGBTQIA+ friendly", emoji: "🏳️‍🌈", grupo: "diversidade", descricao: "Espaço seguro e acolhedor para pessoas LGBTQIA+." },
  { slug: "liderado-por-mulheres", nome: "Liderado por mulheres", titulo: "Negócios liderados por mulheres", emoji: "💜", grupo: "diversidade", descricao: "Negócio fundado ou liderado por mulheres." },
  { slug: "acessivel", nome: "Acessível", titulo: "Negócios acessíveis", emoji: "♿", grupo: "diversidade", descricao: "Estrutura e atendimento acessíveis para pessoas com deficiência." },
  { slug: "indigena", nome: "Empreendimento indígena", titulo: "Empreendimentos indígenas", emoji: "🪶", grupo: "diversidade", descricao: "Negócio de pessoas ou comunidades indígenas." },
  { slug: "pet-friendly", nome: "Pet friendly", titulo: "Negócios pet friendly", emoji: "🐾", grupo: "planeta", descricao: "Bichos de estimação são bem-vindos." },
  { slug: "sustentavel", nome: "Sustentável", titulo: "Negócios sustentáveis", emoji: "🌱", grupo: "planeta", descricao: "Reduz resíduos, reaproveita e cuida do impacto ambiental." },
  { slug: "opcoes-veganas", nome: "Opções veganas", titulo: "Negócios com opções veganas", emoji: "🥕", grupo: "planeta", descricao: "Tem opções sem nenhum ingrediente de origem animal." },
  { slug: "agricultura-familiar", nome: "Agricultura familiar", titulo: "Negócios que compram da agricultura familiar", emoji: "🌾", grupo: "planeta", descricao: "Compra de pequenos produtores e da agricultura familiar." },
  { slug: "negocio-de-bairro", nome: "Negócio de bairro", titulo: "Negócios de bairro", emoji: "🏘️", grupo: "planeta", descricao: "Gera renda e emprego na própria comunidade." },
  { slug: "apoia-projetos-sociais", nome: "Apoia projetos sociais", titulo: "Negócios que apoiam projetos sociais", emoji: "💛", grupo: "planeta", descricao: "Destina parte do que ganha a projetos sociais." },
  { slug: "economia-solidaria", nome: "Economia solidária", titulo: "Negócios de economia solidária", emoji: "🧺", grupo: "planeta", descricao: "Cooperativa ou empreendimento de economia solidária." },
];

const PORSLUG = new Map(CAUSAS.map((c) => [c.slug, c]));

export function buscarCausa(slug: string): Causa | undefined {
  return PORSLUG.get(slug);
}

/** Mantém só os slugs que existem, sem repetição, na ordem da lista oficial. */
export function filtrarCausas(slugs: readonly string[]): string[] {
  const pedidos = new Set(slugs);
  return CAUSAS.filter((c) => pedidos.has(c.slug)).map((c) => c.slug);
}
