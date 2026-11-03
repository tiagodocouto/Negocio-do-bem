// Como o site está aberto: no navegador ou instalado como app (PWA). As
// funções só funcionam no navegador.

/** O site aberto pelo ícone da tela de início, sem a barra do navegador. */
export function abertoComoApp(): boolean {
  // navigator.standalone só existe no iPhone e no iPad.
  return matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/**
 * iPhone ou iPad. Neles a instalação é pelo menu Compartilhar, e o app
 * instalado não divide o login com o Safari.
 */
export function ehAparelhoApple(): boolean {
  // O iPad se apresenta como Mac; a tela de toque o denuncia.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

/** Celular ou tablet Android. */
export function ehAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

/** O aparelho de quem visita, para sugerir o passo a passo certo em /instalacao. */
export function aparelhoDaVisita(): "iphone" | "android" | null {
  if (ehAparelhoApple()) return "iphone";
  return ehAndroid() ? "android" : null;
}
