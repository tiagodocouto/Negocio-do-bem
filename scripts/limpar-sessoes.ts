import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  FalhaLimpezaSessoes,
  lerOpcoesLimpezaSessoes,
  limparSessoesVencidas,
  referenciaLimpezaSessoes,
  type ResultadoLimpezaSessoes,
  UsoLimpezaSessoes,
} from "../src/lib/limpeza-sessoes";

/** A manutenção é manual. Não imprime erros do driver, que podem conter a conexão. */
async function main() {
  let db: PrismaClient | undefined;
  let resultado: ResultadoLimpezaSessoes | undefined;
  let banco = "";
  try {
    const opcoes = lerOpcoesLimpezaSessoes(process.argv.slice(2));
    const conexao = process.env.DATABASE_URL;
    if (!conexao) throw new FalhaLimpezaSessoes("Falta DATABASE_URL. Nenhuma exclusão foi solicitada.");
    let url: URL;
    try {
      url = new URL(conexao);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length < 2) throw new Error();
    } catch {
      throw new FalhaLimpezaSessoes("DATABASE_URL inválida. Nenhuma exclusão foi solicitada.");
    }
    banco = `${url.hostname}${url.pathname}`;
    const inicio = new Date();
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: conexao }) });
    const [relogio] = await db.$queryRaw<{ agora: Date }[]>`SELECT CURRENT_TIMESTAMP AT TIME ZONE 'UTC' AS "agora"`;
    const referencia = referenciaLimpezaSessoes(inicio, relogio.agora);
    resultado = await limparSessoesVencidas(db, opcoes, referencia);
  } catch (erro) {
    console.error(erro instanceof UsoLimpezaSessoes || erro instanceof FalhaLimpezaSessoes
      ? erro.message
      : "Falha ao consultar o banco. Nenhuma exclusão foi solicitada.");
    process.exitCode = 1;
  } finally {
    try {
      await db?.$disconnect();
    } catch {
      console.error("Falha ao encerrar a conexão. Confira o banco antes de repetir a operação.");
      process.exitCode = 1;
    }
  }
  if (!resultado || process.exitCode === 1) return;
  console.log(`Banco: ${banco}`);
  console.log(`Modo: ${resultado.aplicar ? "aplicação" : "diagnóstico"}`);
  console.log(`Referência UTC: ${resultado.referencia.toISOString()}`);
  console.log(`Limite do lote: ${resultado.lote}.`);
  console.log(`Sessões vencidas: ${resultado.vencidas}.`);
  if (!resultado.aplicar) {
    console.log("Nada foi gravado. Para remover um lote, rode de novo com --aplicar.");
    return;
  }
  console.log(`Sessões selecionadas: ${resultado.selecionadas}.`);
  console.log(`Sessões removidas: ${resultado.removidas}.`);
}

void main();
