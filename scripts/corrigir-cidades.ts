// Grava o nome oficial do IBGE nas cidades escritas de outro jeito ("Sao Paulo",
// "FLORIANOPOLIS", "Tubarão-SC"), que vêm de cadastros de antes do campo de cidade com a lista.
// O diretório já junta essas grafias; o script arruma o nome que aparece no perfil
// e nos cartões. Sem --aplicar, só mostra o que mudaria.
//
// Uso (no banco do DATABASE_URL do .env):
//   npm run cidades:corrigir
//   npm run cidades:corrigir -- --aplicar
//
// Em outro banco, como o de produção, passe a conexão na frente:
//   DATABASE_URL="postgresql://..." npm run cidades:corrigir

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { nomeOficial } from "../src/lib/municipios";
import { textoDeBusca } from "../src/lib/texto";

const urlDoBanco = process.env.DATABASE_URL;
if (!urlDoBanco) {
  console.error("Falta DATABASE_URL. Configure no .env ou passe na frente do comando.");
  process.exit(1);
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: urlDoBanco }) });
const negocios = (total: number) => (total === 1 ? "1 negócio" : `${total} negócios`);

async function main() {
  const { host, pathname } = new URL(urlDoBanco!);
  console.log(`Banco: ${host}${pathname}\n`);
  const aplicar = process.argv.includes("--aplicar");

  const grupos = await db.empresa.groupBy({
    by: ["uf", "cidade"],
    _count: { _all: true },
    orderBy: [{ uf: "asc" }, { cidade: "asc" }],
  });
  const trocas = grupos.flatMap((g) => {
    const nome = nomeOficial(g.cidade, g.uf);
    return nome && nome !== g.cidade ? [{ cidade: g.cidade, uf: g.uf, nome, total: g._count._all }] : [];
  });
  const foraDaLista = grupos.filter((g) => !nomeOficial(g.cidade, g.uf));

  console.log(trocas.length ? `Cidades com outra grafia (${trocas.length}):` : "Todas as cidades da lista já estão com o nome oficial.");
  for (const t of trocas) console.log(`  "${t.cidade}", ${t.uf} → ${t.nome} (${negocios(t.total)})`);

  if (foraDaLista.length) {
    console.log(`\nFora da lista do IBGE (${foraDaLista.length}). Corrija pelo painel da moderação:`);
    for (const g of foraDaLista) console.log(`  "${g.cidade}", ${g.uf} (${negocios(g._count._all)})`);
  }

  if (!trocas.length) return;
  if (!aplicar) {
    console.log("\nNada foi gravado. Para corrigir, rode de novo com --aplicar.");
    return;
  }
  const empresas = await db.empresa.findMany({
    where: { OR: trocas.map((t) => ({ cidade: t.cidade, uf: t.uf })) },
    select: { id: true, nome: true, resumo: true, categoria: true, cidade: true, uf: true, instagramUsername: true },
  });
  // Direto no SQL para não mudar o atualizadoEm, que ordena o diretório. O campo busca é
  // refeito, porque um hífen ou a UF no fim da cidade ("Tubarão-SC") mudam o texto dele.
  await db.$transaction(
    empresas.map((e) => {
      const cidade = nomeOficial(e.cidade, e.uf)!;
      return db.$executeRaw`UPDATE "Empresa" SET "cidade" = ${cidade}, "busca" = ${textoDeBusca({ ...e, cidade })} WHERE "id" = ${e.id}`;
    }),
  );
  console.log(`\nCorrigido: ${negocios(empresas.length)}.`);
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
