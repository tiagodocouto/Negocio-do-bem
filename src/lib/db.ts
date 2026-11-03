import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

export type { Prisma } from "@/generated/prisma/client";

// Em desenvolvimento o Next recarrega os módulos a cada mudança; guardar o
// cliente no globalThis evita abrir um pool de conexões novo a cada recarga.
const cache = globalThis as unknown as { prisma?: PrismaClient };

function criarCliente(connectionString = process.env.DATABASE_URL) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// No Cloudflare Workers, uma conexão aberta numa requisição não pode ser usada
// em outra: a segunda trava ou falha com "Cannot perform I/O on behalf of a
// different request". Lá, cada requisição ganha o seu cliente. O OpenNext guarda
// o contexto da requisição neste símbolo; fora do Worker ele não existe.
const CONTEXTO_CLOUDFLARE = Symbol.for("__cloudflare-context__");
const clientesPorRequisicao = new WeakMap<object, PrismaClient>();

type ContextoCloudflare = { ctx?: object; env?: { HYPERDRIVE?: { connectionString: string } } };

function clienteDaRequisicao(): PrismaClient | undefined {
  const contexto = (globalThis as unknown as Record<symbol, ContextoCloudflare | undefined>)[CONTEXTO_CLOUDFLARE];
  if (!contexto?.ctx) return undefined;
  let cliente = clientesPorRequisicao.get(contexto.ctx);
  if (!cliente) {
    // Com o binding HYPERDRIVE, a conexão de cada requisição vai até o Hyperdrive,
    // que mantém as conexões com o banco abertas. Ele só existe na produção (os
    // previews não herdam bindings); nos previews vale a DATABASE_URL.
    cliente = criarCliente(contexto.env?.HYPERDRIVE?.connectionString);
    clientesPorRequisicao.set(contexto.ctx, cliente);
  }
  return cliente;
}

let clienteUnico: PrismaClient | undefined = cache.prisma;

function cliente(): PrismaClient {
  const daRequisicao = clienteDaRequisicao();
  if (daRequisicao) return daRequisicao;
  if (!clienteUnico) {
    clienteUnico = criarCliente();
    if (process.env.NODE_ENV !== "production") cache.prisma = clienteUnico;
  }
  return clienteUnico;
}

// O que for definido no próprio db (como o vi.spyOn dos testes) vale antes do cliente.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(proprio, propriedade) {
    if (Object.hasOwn(proprio, propriedade)) return Reflect.get(proprio, propriedade);
    const alvo = cliente();
    const valor = Reflect.get(alvo, propriedade, alvo);
    return typeof valor === "function" ? valor.bind(alvo) : valor;
  },
  has(proprio, propriedade) {
    return Object.hasOwn(proprio, propriedade) || propriedade in cliente();
  },
  getOwnPropertyDescriptor(proprio, propriedade) {
    if (Object.hasOwn(proprio, propriedade)) return Reflect.getOwnPropertyDescriptor(proprio, propriedade);
    if (!(propriedade in cliente())) return undefined;
    return { configurable: true, enumerable: true, writable: true, value: Reflect.get(db, propriedade) };
  },
});
