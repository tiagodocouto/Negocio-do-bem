/** Adianta somente o relógio do processo filho descartável usado pela prova da CLI. */
const DateOriginal = globalThis.Date;
const adiantamento = 2 * 60 * 60 * 1000;

globalThis.Date = new Proxy(DateOriginal, {
  construct(alvo, argumentos, novoAlvo) {
    return Reflect.construct(alvo, argumentos.length ? argumentos : [DateOriginal.now() + adiantamento], novoAlvo);
  },
  get(alvo, propriedade) {
    if (propriedade === "now") return () => DateOriginal.now() + adiantamento;
    return Reflect.get(alvo, propriedade);
  },
});
