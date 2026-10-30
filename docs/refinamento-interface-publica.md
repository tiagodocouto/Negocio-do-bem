# Refinamento da interface pública

Contribuição sobre o head `4c391dc` do PR #156, preservando o cartaz, as figuras e técnicas do cortejo, a abertura e a cortina.

## Mudanças

- Paleta da interface ligada ao verde, laranja, marrom e creme da marca, com variantes para leitura nos dois temas. Os nomes das tintas dos negócios permanecem compatíveis. As figuras preservam materiais e tons de pele.
- Menu mobile com conta integrada, sem submenu aninhado que possa ficar recortado. Visitantes veem entrada e cadastro; pessoas autenticadas veem painel, saída e moderação conforme a permissão existente. A saída continua usando a ação original, sem nova rota.
- Atalho de teclado para o conteúdo, acesso às 16 categorias e quantidade real de negócios no hero, com espaço reservado no fallback.
- Perfil com fotografia maior, navegação por seções, história em coluna de leitura e painéis de contatos e causas. Markdown, fotos próprias, depoimentos, denúncias e reivindicação usam os componentes e regras existentes.
- Sobre e Cidades com navegação mais direta. Os textos de responsáveis e privacidade da base foram mantidos.
- Cortina respeita a pausa geral e não atrasa links acionados pelo teclado. O retorno pelo histórico também limpa o estado.

## Limites

Sem alterações em ações, autenticação, banco, esquema, migrações, consultas, permissões, moderação, sitemap ou variáveis de ambiente versionadas. Sem Participar, selo oficial ou código por DM do #114. Sem mudanças no painel do dono. Bricolage Grotesque e Figtree permanecem as fontes do PR.

## Validação

Lint e tipos aprovados; permanece um aviso preexistente do gerador Open Graph. 272 testes unitários em 18 arquivos passaram, incluindo conta integrada, navegação por teclado e pausa. A suíte completa foi tentada e encontrou o bloqueio de inicialização do Vite `code.charCodeAt is not a function` neste ambiente Windows.

As relações principais de contraste foram calculadas sobre os tokens; isso não equivale a medir todos os elementos renderizados. A revisão visual de desktop/mobile, temas, teclado, zoom e capturas do candidato continua pendente por indisponibilidade do host de navegador. A contribuição deve permanecer em rascunho até essas verificações.
