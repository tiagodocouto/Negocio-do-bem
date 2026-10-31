// Dados de exemplo para desenvolvimento: `npx prisma db seed`.
// Todos os negócios são fictícios (os @ terminam em ".exemplo").

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ambienteDeDeploy } from "../src/lib/ambiente";
import { gerarHashSenha } from "../src/lib/auth/senha";
import { textoDeBusca } from "../src/lib/texto";

// O build dos previews também roda o seed, nunca o de produção.
const emProducao = ambienteDeDeploy()
  ? ambienteDeDeploy() === "production"
  : process.env.NODE_ENV === "production";
if (emProducao) {
  throw new Error("O seed cria contas com senha conhecida e não pode rodar em produção.");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const SENHA_DEMO = "senha-demo-123";

type NegocioExemplo = {
  instagramUsername: string;
  nome: string;
  resumo: string;
  categoria: string;
  cidade: string;
  uf: string;
  causas: string[];
  dono?: string;
  historia?: string;
  motivo?: string;
  moderacao?: string;
};

const NEGOCIOS: NegocioExemplo[] = [
  {
    instagramUsername: "padaria.florescer.exemplo",
    nome: "Padaria Florescer",
    resumo: "Pão de fermentação natural feito por mulheres do bairro, com farinha de pequenos produtores.",
    categoria: "Café e padaria",
    cidade: "Recife",
    uf: "PE",
    causas: ["escala-5x2", "liderado-por-mulheres", "agricultura-familiar", "negocio-de-bairro"],
    dono: "ana",
    historia: `Tudo começou em 2019, numa cozinha de 6 metros quadrados na Várzea. A Dona Lúcia, minha avó, fazia pão para a vizinhança aos sábados, e a fila na calçada foi crescendo até virar um compromisso.

Quando ela se aposentou, eu e mais três vizinhas decidimos transformar aquele cheiro de domingo num negócio de verdade. Sem patrão, sem pressa e sem atalho.

## O que nos move

A gente acredita que padaria é lugar de encontro. Por isso:

- **Ninguém trabalha mais de cinco dias por semana.** Pão bom precisa de gente descansada.
- Compramos farinha de duas cooperativas do agreste e pagamos à vista.
- Todo fim de tarde, o que sobra vai para a cozinha comunitária da rua de trás.

> "Fermentação natural ensina paciência. A gente aprendeu a crescer no mesmo ritmo."

---

Hoje somos onze pessoas, todas morando a menos de dois quilômetros da padaria. Se passar por aqui, pede um café e conta pra gente o que você achou.`,
  },
  {
    instagramUsername: "atelie.raizpreta.exemplo",
    nome: "Ateliê Raiz Preta",
    resumo: "Moda autoral com tecidos reaproveitados e estampas que contam histórias da diáspora africana.",
    categoria: "Moda e acessórios",
    cidade: "Salvador",
    uf: "BA",
    causas: ["afroempreendedor", "antirracista", "sustentavel", "remuneracao-justa"],
    dono: "joao",
    historia: `O Raiz Preta nasceu da vontade de vestir a nossa própria história. Cada coleção parte de uma pesquisa sobre a memória de um bairro de Salvador, e cada peça é cortada a partir de tecidos que iam para o lixo das confecções da cidade.

## Quem faz

Somos seis costureiras e costureiros, todos remunerados acima do piso da categoria e com participação nos resultados. Metade da equipe chegou até nós pelo nosso curso gratuito de costura, que acontece duas vezes por ano.

## Nosso compromisso

Racismo não se combate só com discurso. Por isso publicamos todo ano quanto pagamos, para quem compramos e quantas pessoas negras ocupam cargos de liderança aqui dentro. Spoiler: todas.`,
  },
  {
    instagramUsername: "cafe.arcoiris.exemplo",
    nome: "Café Arco-Íris",
    resumo: "Cafeteria acolhedora com cardápio vegano e espaço para eventos da comunidade LGBTQIA+.",
    categoria: "Café e padaria",
    cidade: "São Paulo",
    uf: "SP",
    causas: ["lgbtqia", "pet-friendly", "opcoes-veganas"],
    motivo:
      "É o lugar onde me senti segura pela primeira vez em São Paulo. A equipe é incrível, o bolo de banana é o melhor da cidade e meu cachorro é tratado como rei.",
  },
  {
    instagramUsername: "mercearia.coletiva.exemplo",
    nome: "Mercearia Coletiva",
    resumo: "Cooperativa de consumo com alimentos da agricultura familiar e venda a granel, sem plástico.",
    categoria: "Mercado e empório",
    cidade: "Belo Horizonte",
    uf: "MG",
    causas: ["economia-solidaria", "agricultura-familiar", "sustentavel", "escala-4x3"],
    dono: "bia",
    historia: `Somos uma cooperativa de 240 famílias que se cansaram de pagar caro por comida cheia de veneno e embalagem.

Compramos direto de 31 produtores da região metropolitana, vendemos a granel e devolvemos as sobras para quem planta, em forma de adubo.

## Semana de quatro dias

Desde 2024 a equipe trabalha quatro dias por semana, sem redução de salário. A produtividade subiu, as faltas caíram e a fila do caixa ficou mais simpática.`,
  },
  {
    instagramUsername: "livraria.encontro.exemplo",
    nome: "Livraria Ponto de Encontro",
    resumo: "Livraria de rua com sessões de leitura em Libras e clube do livro gratuito.",
    categoria: "Livraria e papelaria",
    cidade: "Porto Alegre",
    uf: "RS",
    causas: ["acessivel", "apoia-projetos-sociais", "negocio-de-bairro"],
    motivo: "Eles fazem sessões de leitura em Libras todo mês e doam livros para a biblioteca da escola do bairro.",
  },
  {
    instagramUsername: "cuidar.junto.exemplo",
    nome: "Clínica Cuidar Junto",
    resumo: "Clínica de fisioterapia com preço social e atendimento domiciliar para pessoas idosas.",
    categoria: "Saúde",
    cidade: "Curitiba",
    uf: "PR",
    causas: ["acessivel", "contrata-50-mais", "remuneracao-justa"],
    motivo: "Atenderam minha mãe em casa com um carinho que eu nunca vi. E cobram de acordo com o que cada família pode pagar.",
  },
  {
    instagramUsername: "studio.semente.exemplo",
    nome: "Studio Semente",
    resumo: "Estúdio de design e tecnologia que cria sites para negócios de impacto social.",
    categoria: "Tecnologia",
    cidade: "Florianópolis",
    uf: "SC",
    causas: ["escala-4x3", "liderado-por-mulheres", "lgbtqia", "remuneracao-justa"],
    dono: "bia",
    historia: `A gente faz sites, aplicativos e identidades visuais, mas só para quem está tentando deixar o mundo um pouco melhor.

Trabalhamos quatro dias por semana, todo mundo ganha a mesma faixa salarial publicada no nosso site, e 10% das horas vão para projetos de ONGs sem custo.`,
  },
  {
    instagramUsername: "pousada.maeterra.exemplo",
    nome: "Pousada Mãe Terra",
    resumo: "Pousada de base comunitária gerida por famílias indígenas às margens do Tapajós.",
    categoria: "Turismo e hospedagem",
    cidade: "Santarém",
    uf: "PA",
    causas: ["indigena", "sustentavel", "pet-friendly"],
    motivo: "Turismo de verdade: a comunidade decide como receber, a renda fica na aldeia e a floresta é tratada com respeito.",
  },
  {
    instagramUsername: "barbearia.doze.exemplo",
    nome: "Barbearia do Zé",
    resumo: "Barbearia de bairro que oferece corte gratuito para pessoas em entrevista de emprego.",
    categoria: "Beleza e bem-estar",
    cidade: "Fortaleza",
    uf: "CE",
    causas: ["apoia-projetos-sociais", "negocio-de-bairro"],
    motivo: "Cortou meu cabelo de graça no dia da minha entrevista. Consegui o emprego!",
    moderacao: "pendente",
  },
];

const DEPOIMENTOS: { negocio: string; autor: string; texto: string; resposta?: string }[] = [
  {
    negocio: "padaria.florescer.exemplo",
    autor: "carla",
    texto: "O pão de fermentação natural é maravilhoso, mas o que me ganhou foi saber que a equipe tem folga de verdade. Dá pra sentir no atendimento.",
    resposta: "Carla, obrigada! Volta sábado que tem pão de milho saindo às 7h. 💛",
  },
  {
    negocio: "padaria.florescer.exemplo",
    autor: "joao",
    texto: "Passo aqui toda manhã antes do trabalho. Preço justo, gente do bairro e a sobra do dia vai para a cozinha comunitária. Isso é negócio do bem.",
  },
  {
    negocio: "atelie.raizpreta.exemplo",
    autor: "ana",
    texto: "Comprei um vestido da coleção Liberdade e recebi junto um cartão contando a história da estampa. Peça linda, feita com respeito.",
  },
  {
    negocio: "cafe.arcoiris.exemplo",
    autor: "joao",
    texto: "Ambiente leve, gente acolhedora e um café coado excelente. Levei meu cachorro e ganhou até biscoito.",
  },
  {
    negocio: "mercearia.coletiva.exemplo",
    autor: "carla",
    texto: "Desde que entrei na cooperativa, meu lixo de plástico caiu pela metade. E conheço pelo nome quem planta o que eu como.",
  },
];

async function main() {
  // Em deploy, só preenche banco vazio. Um preview ligado por engano à produção
  // encontra usuários reais e não cria as contas de senha conhecida.
  if ((ambienteDeDeploy() || process.env.VERCEL) && (await db.usuario.count()) > 0) {
    console.log("O banco já tem usuários. Em deploy, o seed só preenche banco vazio.");
    return;
  }

  if (await db.usuario.findUnique({ where: { email: "moderacao@exemplo.com" } })) {
    console.log("Os dados de exemplo já existem. Nada a fazer.");
    return;
  }

  const senhaHash = await gerarHashSenha(SENHA_DEMO);
  // As contas de exemplo já vêm com o e-mail confirmado, para indicar e escrever sem abrir link nenhum.
  const emailConfirmadoEm = new Date();
  const pessoas = {
    moderacao: await db.usuario.create({ data: { nome: "Equipe de Moderação", email: "moderacao@exemplo.com", senhaHash, emailConfirmadoEm, papel: "moderador" } }),
    ana: await db.usuario.create({ data: { nome: "Ana Lúcia Santos", email: "ana@exemplo.com", senhaHash, emailConfirmadoEm } }),
    joao: await db.usuario.create({ data: { nome: "João Batista", email: "joao@exemplo.com", senhaHash, emailConfirmadoEm } }),
    bia: await db.usuario.create({ data: { nome: "Bia Fernandes", email: "bia@exemplo.com", senhaHash, emailConfirmadoEm } }),
    carla: await db.usuario.create({ data: { nome: "Carla Moreira", email: "carla@exemplo.com", senhaHash, emailConfirmadoEm } }),
  };

  const empresas = new Map<string, string>();
  for (const [i, n] of NEGOCIOS.entries()) {
    const empresa = await db.empresa.create({
      data: {
        instagramUsername: n.instagramUsername,
        nome: n.nome,
        resumo: n.resumo,
        categoria: n.categoria,
        cidade: n.cidade,
        uf: n.uf,
        historia: n.historia ?? "",
        motivoIndicacao: n.motivo ?? null,
        status: n.dono ? "verificada" : "indicada",
        moderacao: n.moderacao ?? "aprovada",
        indicadaPorId: n.dono ? pessoas[n.dono as keyof typeof pessoas].id : [pessoas.carla, pessoas.ana, pessoas.joao][i % 3]!.id,
        busca: textoDeBusca(n),
        causas: { create: n.causas.map((causa) => ({ causa })) },
        ...(n.dono ? { membros: { create: { usuarioId: pessoas[n.dono as keyof typeof pessoas].id } } } : {}),
      },
    });
    empresas.set(n.instagramUsername, empresa.id);
  }

  for (const d of DEPOIMENTOS) {
    await db.depoimento.create({
      data: {
        empresaId: empresas.get(d.negocio)!,
        autorId: pessoas[d.autor as keyof typeof pessoas].id,
        texto: d.texto,
        resposta: d.resposta ?? null,
        respondidoEm: d.resposta ? new Date() : null,
      },
    });
  }

  // Uma reivindicação esperando a moderação, para ver o fluxo funcionando.
  await db.reivindicacao.create({
    data: {
      empresaId: empresas.get("cafe.arcoiris.exemplo")!,
      usuarioId: pessoas.carla.id,
      metodo: "documento",
      cnpj: "11222333000181",
      site: "https://cafearcoiris.example.com/",
      relacao: "Sou sócia e cuido do Instagram do café",
      contato: "carla@exemplo.com",
      expiraEm: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log(`Dados de exemplo criados. Todas as contas usam a senha "${SENHA_DEMO}":`);
  for (const p of Object.values(pessoas)) console.log(`  ${p.email}`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
