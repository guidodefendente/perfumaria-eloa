# Decisões do protótipo — Perfumaria Eloá

Registro das escolhas feitas durante a construção do primeiro protótipo navegável.
Tudo marcado como **provisório** precisa ser confirmado com a loja antes de considerar o MVP entregue.

Data: 16/08/2026 · Sprint 1

---

## Stack

**HTML + CSS + JavaScript puro, com Tailwind e fontes servidos pelo próprio projeto.**

O documento do projeto define "MVP totalmente estático, sem backend, sem banco de dados".
Um framework com build (React/Vite, Next) adicionaria `npm install`, passo de build e
`node_modules` sem resolver nenhum problema que o projeto tenha hoje. Sem build, o
protótipo abre com um duplo clique no `index.html` — o que também facilita mostrar para a
dona da loja em qualquer computador.

Quando o painel administrativo entrar em escopo, essa decisão deve ser reavaliada.

### Por que não Tailwind via CDN

A intenção inicial era usar o Tailwind pelo CDN. Foi trocado por um CSS compilado e
versionado no projeto (`assets/css/tailwind.css`), com as fontes junto (`assets/fonts/`).
Três motivos:

1. **O público é mobile em rede 4G de bairro.** Com CDN a página depende de três conexões
   externas antes de pintar. Sem CDN, o catálogo abre com o que já está no ar.
2. O Play CDN do Tailwind compila no navegador e é explicitamente desaconselhado fora de
   desenvolvimento — causa um piscar de conteúdo sem estilo a cada carga.
3. O protótipo passa a funcionar offline e a renderizar igual em qualquer máquina.

Isso **não adiciona dependência ao projeto**: o CSS foi gerado fora e só o arquivo pronto
foi versionado. Continua sem `package.json` e sem `node_modules`.

Só as fontes usadas entraram, no subconjunto latino: Inter 400/500/600/700 e
Playfair Display 500/600 — 148 KB no total.

Para regerar o CSS depois de mexer em classes do Tailwind:

```bash
npx tailwindcss@3 -c tailwind.config.js -i input.css -o assets/css/tailwind.css --minify
```

O `tailwind.config.js` e o `input.css` estão em `build/` para essa finalidade.

## Arquitetura

Quatro arquivos, uma responsabilidade cada:

| Arquivo | Responsabilidade |
|---|---|
| `index.html` | Estrutura e conteúdo estático das quatro telas |
| `assets/css/styles.css` | Tokens de design e componentes visuais |
| `assets/js/products.js` | Dados: catálogo e informações da loja |
| `assets/js/app.js` | Estado, roteamento e interações |

Dados **separados da lógica** de propósito: atualizar preço ou adicionar produto é mexer em
`products.js` e nada mais. É o caminho mais curto para o dia em que a loja quiser um painel.

Roteamento por hash (`#/`, `#/catalogo`, `#/produto/<id>`, `#/sobre`) para o botão voltar do
navegador funcionar de forma previsível — apontado como severidade alta nas diretrizes de UX.

## Identidade visual

Paleta **extraída do logotipo oficial**, não escolhida por gosto. O rosa `#D88898` foi
amostrado direto do arquivo enviado pela loja e virou `--rose-500`; o preto é quente
(`#140E10`) para não brigar com o rosa.

> A skill `ui-ux-pro-max` sugeriu, para "beleza/e-commerce", uma paleta com rosa `#EC4899` e
> lavanda `#8B5CF6`. **Descartada**: o projeto já tem marca definida (preto + rosa + branco) e
> a marca manda mais que a recomendação genérica. A recomendação de tipografia da mesma skill
> foi aceita.

Tipografia **Playfair Display + Inter** (par "Classic Elegant" da `ui-ux-pro-max`, indicado
para beleza e e-commerce premium). O Playfair conversa diretamente com o serif de alto
contraste do logotipo.

Logotipo: recortado do arquivo original em círculo, com fundo transparente fora do disco.
O ícone de "mudo" que aparecia no canto do arquivo enviado ficou fora do recorte.

---

## Provisório — precisa de confirmação da loja

### 1. Preços

O documento não define preços. Os valores no catálogo são **estimativas plausíveis** para uma
perfumaria de bairro e existem só para o protótipo não ficar vazio.
→ **Ação:** levantar a tabela real de preços com a loja.

### 2. Descrições dos produtos

Escritas por nós, genéricas por categoria. Não afirmam nada específico sobre fórmula, volume,
rendimento ou benefício — justamente para não colocar na boca da marca algo que ela não disse.
→ **Ação:** revisar com a loja ou substituir pelo texto do fabricante.

### 3. Imagens dos produtos

Ilustrações que geramos (`assets/img/products/*.svg`), com sistema visual comum: mesmo
enquadramento, mesma luz vindo da esquerda, mesma sombra de contato, paleta da marca.

São **silhuetas abstratas de categoria com rótulo em branco** — sem texto, sem logotipo, sem
forma registrada. A escolha é deliberada: uma embalagem inventada com cara de oficial seria
uma representação falsa do produto.

Para trocar por foto real, basta alterar o campo `image` do produto em `products.js`.
Nenhuma outra mudança é necessária.
→ **Ação:** fotografar os produtos.

### 4. Produtos em destaque

Seis produtos marcados com `featured: true`, escolhidos por nós para cobrir categorias
diferentes. O documento não define critério de curadoria.
→ **Ação:** a loja escolhe os destaques reais.

### 5. Comportamento do carrinho após o pedido

**O carrinho não é limpo** ao finalizar pelo WhatsApp. O pedido só se confirma na conversa —
limpar antes disso faria o cliente perder tudo se o WhatsApp não abrisse ou se ele desistisse
no meio. Mostramos um aviso de que o pedido foi aberto.
→ **Ação:** validar com a loja depois dos primeiros pedidos reais.

### 6. Persistência do carrinho

Salvo em `localStorage`, com fallback para memória quando o navegador bloqueia (modo privado,
abertura via `file://`). O cliente pode fechar e voltar sem perder o carrinho.

### 7. Mapa na página "Sobre a loja"

Link para o Google Maps com o endereço, em vez de mapa embutido. Um embed carrega scripts de
terceiros e pesa numa página que hoje não precisa disso. O formato final não estava definido
no documento.

### 8. Estoque

Não há controle de estoque no MVP. Como um item no carrinho pode não estar disponível,
o protótipo avisa em três lugares — página do produto, rodapé do carrinho e rodapé do site —
que disponibilidade e preço se confirmam no atendimento. Isso responde a um risco levantado
na análise inicial do documento.

---

## Fora do escopo — não implementado de propósito

Login, cadastro de usuários, pagamento online, controle de estoque, painel administrativo e
integração com ERP seguem fora do MVP, conforme o documento.

Nenhuma funcionalidade além das listadas em "Funcionalidades do MVP" foi adicionada.

---

## Conferência com o documento do Obsidian

Catálogo transcrito de `Projeto - Perfumaria Eloá.md`: **17 produtos, 6 categorias**.
Nenhum produto ou marca inventado.

| Categoria | Itens |
|---|---|
| Cílios | 2 |
| Cabelo | 4 |
| Maquiagem | 6 |
| Perfumes | 2 |
| Cuidados com a pele | 2 |
| Unhas | 1 |

As categorias "Presentes" e "Infantil", levantadas na análise inicial, **não aparecem** na
versão atual do documento e por isso não foram criadas.

---

## Correções feitas na revisão visual

Problemas encontrados testando o protótipo em 375px, 768px e 1440px, e o que foi feito:

| Problema | Correção |
|---|---|
| Barra de navegação inferior aparecia também no desktop | `display` da `.tabbar` movido para dentro do media query — fora dele vencia a utilitária `md:hidden` por ordem de carregamento |
| Ícone "+" invisível nos cards (preto sobre preto) | `styles.css` passou a carregar **antes** do `tailwind.css`, para as utilitárias conseguirem sobrescrever os componentes |
| `hidden` não escondia elementos com classe de display (`.grid`, `.flex`) | Regra `[hidden] { display: none !important }` |
| Botão "Limpar filtros" ficava embaixo da barra inferior no celular | `main` e `footer` reservam a altura da barra + safe-area |
| Emenda visível no gradiente do hero | Halos viraram `background-image` do próprio hero, sem pseudo-elemento recortado |
| Aviso de "produto adicionado" cobria o botão de finalizar | No celular o aviso entra pelo topo |
| Preços com algarismos antigos do Playfair (o 9 descia da linha) | `font-variant-numeric: lining-nums tabular-nums` |
| Ícones de Perfumes e Unhas quase idênticos | Perfume virou flacon com spray; unhas viraram esmalte com pincel; cabelo virou pente |
| Cinza de metadados com contraste 4,02:1 (abaixo do AA) | Escurecido para `#867179` — 4,51:1 |
| Conteúdo podia ficar invisível se o IntersectionObserver não disparasse | Failsafe que revela tudo após 1,2 s |

### Contraste conferido (WCAG AA)

Todos os pares de texto do protótipo passam em 4,5:1. Os principais:
corpo sobre branco 6,90:1 · título sobre branco 19,09:1 · rosa-700 sobre branco 5,21:1 ·
preto sobre rosa da marca 7,18:1 · branco sobre verde do WhatsApp 5,00:1.
