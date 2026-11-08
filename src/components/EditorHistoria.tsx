"use client";

import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { Markdown } from "@tiptap/markdown";
import {
  EditorContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditor,
  useEditorState,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { useRef, useState } from "react";
import { enviarFotoDaHistoria } from "@/acoes/empresas";
import { reduzirFoto } from "@/components/reduzirFoto";
import { ehFotoDoSite } from "@/lib/fotos";

// Editor visual da história, no estilo do Substack. O texto continua guardado
// em Markdown (o mesmo que o componente Historia mostra no perfil), então só
// entra aqui o que o Markdown consegue guardar: nada de sublinhado ou cores.

/** Foto dentro do editor, com a legenda editável logo abaixo. */
function FotoNoEditor({ node, updateAttributes, selected }: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  return (
    <NodeViewWrapper as="figure" className={`foto-editor ${selected ? "selecionada" : ""}`} data-drag-handle>
      {ehFotoDoSite(src) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <p className="foto-de-fora">Esta imagem veio de outro site e não aparece no perfil. Apague e envie pela barra.</p>
      )}
      <input
        value={String(node.attrs.alt ?? "")}
        // Colchetes e quebras de linha quebrariam o Markdown da foto.
        onChange={(evento) => updateAttributes({ alt: evento.target.value.replace(/[[\]\n]/g, "") })}
        // Enter aqui enviaria o formulário inteiro.
        onKeyDown={(evento) => evento.key === "Enter" && evento.preventDefault()}
        placeholder="Escreva uma legenda (opcional)"
        aria-label="Legenda da foto"
        className="legenda-editor"
      />
    </NodeViewWrapper>
  );
}

const Foto = Image.extend({
  addNodeView() {
    // Deixa o campo da legenda receber o teclado sem o editor interferir.
    return ReactNodeViewRenderer(FotoNoEditor, { stopEvent: ({ event }) => event.target instanceof HTMLInputElement });
  },
}).configure({ inline: false, allowBase64: false });

export function EditorHistoria({
  empresaId,
  valorInicial,
  aoMudar,
}: {
  empresaId: string;
  valorInicial: string;
  aoMudar: (markdown: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        underline: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      Foto,
      Placeholder.configure({ placeholder: "Conte como tudo começou…" }),
      Markdown,
    ],
    content: valorInicial,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: { attributes: { class: "historia editor-historia", "aria-label": "Nossa história" } },
    onUpdate: ({ editor }) => aoMudar(editor.getMarkdown()),
  });

  // overflow-clip, e não hidden, para a barra de ferramentas continuar presa no topo ao rolar um texto longo.
  return (
    <div className="overflow-clip rounded-2xl border border-linha bg-superficie">
      {editor && <BarraDeFerramentas editor={editor} empresaId={empresaId} />}
      <EditorContent editor={editor} className="px-5 py-6 sm:px-8" />
    </div>
  );
}

function BarraDeFerramentas({ editor, empresaId }: { editor: Editor; empresaId: string }) {
  const estado = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      estilo: e.isActive("heading", { level: 2 }) ? "titulo" : e.isActive("heading", { level: 3 }) ? "subtitulo" : "paragrafo",
      negrito: e.isActive("bold"),
      italico: e.isActive("italic"),
      tachado: e.isActive("strike"),
      link: e.isActive("link"),
      citacao: e.isActive("blockquote"),
      lista: e.isActive("bulletList"),
      numerada: e.isActive("orderedList"),
      podeDesfazer: e.can().undo(),
      podeRefazer: e.can().redo(),
    }),
  });
  const [editandoLink, setEditandoLink] = useState(false);
  const [endereco, setEndereco] = useState("");
  const entradaFoto = useRef<HTMLInputElement>(null);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erroFoto, setErroFoto] = useState<string | null>(null);

  function mudarEstilo(estilo: string) {
    const cadeia = editor.chain().focus();
    if (estilo === "titulo") cadeia.setHeading({ level: 2 }).run();
    else if (estilo === "subtitulo") cadeia.setHeading({ level: 3 }).run();
    else cadeia.setParagraph().run();
  }

  function abrirLink() {
    setEndereco(String(editor.getAttributes("link").href ?? ""));
    setEditandoLink(true);
  }

  function aplicarLink() {
    const valor = endereco.trim();
    const cadeia = editor.chain().focus().extendMarkRange("link");
    if (!valor) cadeia.unsetLink().run();
    else cadeia.setLink({ href: /^(https?:|mailto:)/i.test(valor) ? valor : `https://${valor}` }).run();
    setEditandoLink(false);
  }

  async function inserirFoto(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!arquivo) return;
    setErroFoto(null);
    setEnviandoFoto(true);
    try {
      let foto: File;
      try {
        foto = await reduzirFoto(arquivo, { lado: 1600 });
      } catch {
        setErroFoto("Não conseguimos abrir essa imagem. Use uma foto JPG, PNG ou WebP.");
        return;
      }
      const dados = new FormData();
      dados.set("empresaId", empresaId);
      dados.set("foto", foto);
      const resposta = await enviarFotoDaHistoria(dados);
      if (!resposta.url) {
        setErroFoto(resposta.erro ?? "Não conseguimos enviar a foto.");
        return;
      }
      editor.chain().focus().setImage({ src: resposta.url, alt: "" }).run();
    } catch {
      setErroFoto("Não conseguimos enviar a foto. Confira a conexão e tente de novo.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  return (
    <div className="sticky top-16 z-10 border-b border-linha bg-superficie/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-1 px-3 py-2" role="toolbar" aria-label="Formatação da história">
        <select
          value={estado.estilo}
          onChange={(evento) => mudarEstilo(evento.target.value)}
          aria-label="Estilo do texto"
          className="mr-1 rounded-lg border border-linha bg-superficie px-2 py-1.5 text-base sm:text-sm"
        >
          <option value="paragrafo">Parágrafo</option>
          <option value="titulo">Título</option>
          <option value="subtitulo">Subtítulo</option>
        </select>
        <Botao rotulo="Negrito" ativo={estado.negrito} onClick={() => editor.chain().focus().toggleBold().run()}>
          <strong>B</strong>
        </Botao>
        <Botao rotulo="Itálico" ativo={estado.italico} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <em className="font-serif">I</em>
        </Botao>
        <Botao rotulo="Tachado" ativo={estado.tachado} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <s>S</s>
        </Botao>
        <Botao rotulo="Link" ativo={estado.link || editandoLink} onClick={abrirLink}>
          Link
        </Botao>
        <Separador />
        <Botao rotulo="Citação" ativo={estado.citacao} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <span className="font-serif text-lg leading-none">“</span>
        </Botao>
        <Botao rotulo="Lista" ativo={estado.lista} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • Lista
        </Botao>
        <Botao rotulo="Lista numerada" ativo={estado.numerada} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. Lista
        </Botao>
        <Botao rotulo="Separador" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          ✦
        </Botao>
        <Separador />
        <input ref={entradaFoto} type="file" accept="image/*" className="hidden" onChange={inserirFoto} />
        <Botao rotulo="Inserir foto" onClick={() => entradaFoto.current?.click()} disabled={enviandoFoto}>
          {enviandoFoto ? "Enviando…" : "Foto"}
        </Botao>
        <Separador />
        <Botao rotulo="Desfazer" onClick={() => editor.chain().focus().undo().run()} disabled={!estado.podeDesfazer}>
          ↶
        </Botao>
        <Botao rotulo="Refazer" onClick={() => editor.chain().focus().redo().run()} disabled={!estado.podeRefazer}>
          ↷
        </Botao>
      </div>

      {editandoLink && (
        <div className="flex flex-wrap items-center gap-2 border-t border-linha px-3 py-2">
          <input
            autoFocus
            value={endereco}
            onChange={(evento) => setEndereco(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                aplicarLink();
              } else if (evento.key === "Escape") setEditandoLink(false);
            }}
            placeholder="Cole o endereço (ex.: www.meunegocio.com.br)"
            aria-label="Endereço do link"
            className="campo min-w-0 flex-1 py-1.5 sm:text-sm"
          />
          <button type="button" className="botao botao-pequeno" onClick={aplicarLink}>
            {endereco.trim() ? "Aplicar" : "Tirar link"}
          </button>
          <button type="button" className="botao-claro botao-pequeno" onClick={() => setEditandoLink(false)}>
            Cancelar
          </button>
        </div>
      )}

      {erroFoto && <p className="erro-campo border-t border-linha px-3 py-2">{erroFoto}</p>}
    </div>
  );
}

// `ativo` só nos botões que ligam e desligam algo (negrito, lista…).
function Botao({
  rotulo,
  ativo,
  children,
  ...props
}: { rotulo: string; ativo?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      aria-pressed={ativo}
      // Sem roubar o foco do editor, para a formatação valer no trecho selecionado.
      onMouseDown={(evento) => evento.preventDefault()}
      className={`min-w-9 rounded-lg px-2.5 py-1.5 text-sm transition disabled:opacity-40 ${
        ativo ? "bg-tinta text-papel" : "text-tinta hover:bg-papel"
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

function Separador() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-linha" />;
}
