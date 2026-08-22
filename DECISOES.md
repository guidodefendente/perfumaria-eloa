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

**Atualização — Sprint 2 (16/08/2026):** as 17 ilustrações foram refeitas com tratamento de
"packshot" — fundo de estúdio, sombra suave desfocada, leve reflexo no chão, sheen de
vidro/plástico — usando 12 arquétipos de embalagem por tipo de produto (flaconete, pote,
tubo, caixa etc.). Não havia, nesta sessão, uma ferramenta de geração de imagem fotorrealista
disponível: continuavam sendo ilustrações vetoriais, só que com um acabamento editorial mais
próximo de foto de estúdio. A regra de não inventar embalagem oficial, rótulo ou logotipo se
manteve. Essas ilustrações foram substituídas pelo padrão descrito a seguir.

**Atualização — catálogo fotográfico (17/08/2026):** as ilustrações foram substituídas por
imagens de catálogo tratadas a partir de referências públicas dos produtos. O padrão da
Perfumaria Eloá é fundo marfim, luz de estúdio, sombra suave e reflexo discreto, mantendo a
embalagem e a identidade visual do item. **Os 17 produtos do catálogo usam PNG nesse padrão**
(`assets/img/products/*.png`) — é o único formato de imagem usado pelo catálogo hoje. As
ilustrações SVG da Sprint 2 voltaram ao estado original do Git e não são referenciadas por
nenhum produto em `products.js`.

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

---

## Sprint 2 (16/08/2026)

Refinamento sobre o protótipo validado na Sprint 1, a partir do relatório de validação no
Claude in Chrome. Sem mudança de stack, sem dados novos inventados (ver seção "Provisório"
acima — nada ali mudou de status nesta sprint).

### Scroll ao trocar de rota — causa raiz

O `router()` já chamava `window.scrollTo({ top: 0, behavior: 'auto' })` desde a Sprint 1 —
por que ainda parecia não funcionar? `behavior: 'auto'` **delega para o `scroll-behavior` do
CSS**, que neste projeto é `smooth` (para os links de âncora). O scroll ficava animando por
~300ms em vez de saltar, e em telas mais altas (rodapé → topo) a demora era grande o
suficiente para ler como "não voltou pro topo".

A correção óbvia — trocar o `scroll-behavior` do `<html>` para `auto` por um instante,
`scrollTo(0,0)`, e restaurar — **também falhava**, por um motivo mais sutil: alternar a
propriedade via inline style e chamar `scrollTo` na sequência seguinte, sem forçar o
navegador a recalcular o estilo entre as duas linhas, deixava a chamada de scroll ainda
lendo `smooth`; a restauração do estilo original interrompia a animação que mal tinha
começado, e a página ficava presa na posição antiga. A função `scrollToTop()` em `app.js`
agora força um reflow (`void root.offsetHeight`) entre trocar o estilo e chamar `scrollTo`,
o que garante o salto instantâneo. Validado nas quatro transições de rota (Home↔Catálogo↔
Produto↔Sobre) e por rodapé, breadcrumb e navegação do header, em desktop e mobile.

### Navegação do header desktop

Adicionados "Início" e "Catálogo" ao lado de "Sobre a loja", só visíveis a partir de
1024px — abaixo disso (768–1023px) só "Sobre a loja" cabe com folga ao lado da busca; entre
768 e 1023px o header já ficava justo mesmo antes da Sprint 2, e três links a mais não
caberiam sem apertar o campo de busca. A tabbar do celular cobre a navegação abaixo de
768px, então não há perda de acesso — só uma faixa intermediária em que o header mostra
menos itens.

Essa visibilidade por breakpoint é feita em `styles.css` (classes `.hdr-nav` /
`.hdr-nav-compact`), **não** com as utilitárias `hidden`/`md:`/`lg:` do Tailwind: nesta
sessão, `npx tailwindcss@3` não estava emitindo `md:inline-flex` nem `lg:hidden` no bloco de
regras responsivas final do `tailwind.css` (raiz não identificada — o seletor aparecia no
CSS bruto do arquivo mas não no `CSSStyleSheet` que o navegador realmente aplicava).
Escrever essas duas regras como componente, fora do CSS gerado, contorna o problema e evita
depender de reproduzir o bug para mantê-lo funcionando.

### Áreas de toque

`w-10 h-10` (40px) e `w-9 h-9` (36px) que sobrescreviam o `.icon-btn` removidos — os botões
voltam ao tamanho padrão do componente (44×44px). O stepper de quantidade do carrinho foi de
40px para 44px. Nenhum dos três precisou de classe nova: só remoção de overrides ou ajuste de
um valor já existente em `styles.css`.

### Fade nas categorias do catálogo (mobile)

`#catalog-chips-scroll` ganhou dois elementos de fade (`#chip-fade-left/right`,
`pointer-events: none`) que aparecem/somem conforme `scrollLeft` e `scrollWidth` do
container, atualizados em `onscroll` e no `resize`. No desktop os chips quebram linha
(`sm:flex-wrap`) e `scrollWidth === clientWidth`, então os dois fades ficam sempre ocultos
sem precisar de media query própria. Um primeiro rascunho usava um gradiente para a cor de
fundo (branco → transparente) — invisível sobre fundo branco; virou uma sombra sutil
(`rgba(20,14,16,.05)`), mais parecida com o "scroll shadow" de apps nativos.

### Imagens dos produtos

Ver seção "3. Imagens dos produtos" acima.

---

## Sprint 4 — Catálogo fotográfico de agosto (20/08/2026)

As 25 fotos/grupos enviados pela loja viraram 32 produtos no catálogo. O catálogo
passou de 17 para **45 produtos** e de 6 para **7 categorias**.

### Como as imagens foram feitas

O padrão visual foi **medido** nas imagens já publicadas, não escolhido de novo:
fundo marfim `rgb(252, 238, 220)`, halo de luz atrás do produto, vinheta discreta,
sombra de contato e reflexo de piso, em 1254 × 1254 PNG. As 32 novas peças usam
uma única placa de fundo gerada por programa, então os cantos das 32 medem
`rgb(244, 226, 205)` com desvio máximo de 3,0 entre canais — o conjunto novo é
internamente mais uniforme que o antigo, e encosta no tom das imagens da Sprint 2.

O processo foi **recorte + limpeza + iluminação + fundo + sombra + reflexo**. As
imagens são as fotografias recebidas; nenhuma embalagem, rótulo, texto, logotipo,
cor ou proporção foi redesenhado. Isso é a diferença central em relação às
imagens da Sprint 2, que eram ilustrações com rótulo inventado (ver seção 3).

**Por que não usamos um removedor de fundo genérico nos perfumes.** As fotos de
perfume são flyers do distribuidor: produto sobre painel branco, cercado de
moldura rosa, preço de atacado e logotipo da importadora. O `rembg` apagava as
caixas claras junto com o fundo — VIP, Victory e Sea Blue SB saíam sem caixa.
Trocamos por uma **chave de branco**: o painel é branco puro, então o produto é
exatamente o que não é branco, com preenchimento de furos para recuperar o miolo
das caixas claras. É exato e preserva embalagem branca.

**Dependências.** O tratamento usou Pillow, numpy, scipy e rembg num *virtualenv
descartável fora do repositório*. O projeto continua sem `package.json`, sem
`node_modules` e sem dependências de execução.

### Ficha do produto e perfil olfativo

`products.js` ganhou dois campos opcionais: `specs` (peso, volume, variantes) e
`fragrance` (dados olfativos). Ambos são renderizados na página de produto por
`specsBlock()` e `fragranceBlock()` em `app.js`.

O CSS desses blocos (`.specs`) foi escrito como **componente em `styles.css`**, e
não com utilitárias do Tailwind, pelo mesmo motivo já registrado na Sprint 2: o
`tailwind.css` é versionado pronto e não há passo de build disponível para emitir
classes novas. Mesma razão para a regra `#home-categories` — com 7 categorias, o
`lg:grid-cols-6` deixava um card órfão sozinho na segunda linha.

### Notas dos perfumes — o que foi publicado e o que não foi

Os flyers do distribuidor (Sea Blue Importadora Top Paris) trazem o campo
"AROMAS" de cada fragrância. Daí saíram **família olfativa e acordes dos 17
perfumes** — dado de fonte identificada, publicado no site com a fonte citada.

**A pirâmide olfativa não foi publicada.** O distribuidor não informa notas de
saída e de coração. Buscar essas notas na web retorna só texto de marketing de
revendedores, sem origem no fabricante e divergente entre lojas — um varejista
lista o Virtus sob outra marca. Preencher os campos com isso seria transformar
informação incerta em fato, então os três campos aparecem como *"Pendente de
confirmação com o fabricante"*. Nenhum perfume foi descrito como "inspirado em"
outra fragrância.

### Fotos sem unidade isolável

Pó Compacto Bella Femme e Corretivo Lua & Neve foram fotografados só como
expositor, sem nenhuma unidade recortável em resolução utilizável. Em vez de
publicar um recorte irreconhecível, usamos **o expositor inteiro** no padrão da
loja e a descrição diz que a venda é por unidade. Fica como melhoria pendente
uma foto individual desses itens — junto com Jelly Blush, Blush Fiore e
Iluminador Toque Special, cujas unidades recortadas ficaram entre 110 e 175 px e
são visivelmente mais macias que as demais.

### Skala: um registro com variantes

A foto reúne 12 potes diferentes da Skala Expert, todos de 1 kg e todos a
R$ 15,00. Sete variantes são legíveis; cinco não são. Criar 12 registros exigiria
recortar cada pote a ~180 px — quebrando o padrão visual — e adivinhar cinco
nomes. Ficou **um registro** com as sete variantes identificadas na ficha e as
demais marcadas como pendentes, seguindo o padrão que o catálogo já usa para
tintas de cabelo. O documento do Obsidian também registra essa orientação.

### IDs preservados

Quatro registros da Sprint 1 foram **atualizados, não duplicados**, mantendo o
`id` para não quebrar referências e não deixar item vago ao lado do item real:

| ID | Antes | Agora |
|---|---|---|
| `base-belle-angel` | Base, R$ 34,90 | Base Líquida Matte 30 ml, R$ 10,00 |
| `base-alleva` | Base, R$ 29,90 | Base Skin Bliss 25 g, R$ 10,00 |
| `esfoliante-bio-instinto` | Esfoliante, R$ 26,90 | Esfoliante Melancia 180 g, R$ 10,00 |
| `perfume-sea-blue` | Perfume, R$ 89,90 | Sea Blue Eau de Toilette 100 ml, R$ 80,00 |

Preços dos 13 produtos antigos restantes **não foram tocados**, e a curadoria de
destaques da Home ficou exatamente como estava — continua sendo decisão da loja
(seção 4), agora com 45 produtos para escolher.

### Divergências de nome resolvidas pela embalagem

"VIP Season**s**" (não "Season"), "Belli**s**ima Donna" (um s), "Virtus **X**",
"Toque **Special**" (não "Especial"). O VIP Seasons Pour Homme traz **Eau de
Parfum** na caixa e no frasco, embora o briefing dissesse Eau de Toilette;
seguimos a embalagem e sinalizamos na ficha.

Os flyers trazem preço de atacado (R$ 35,00 a R$ 80,00). Foi ignorado — valem os
preços de venda informados pela loja.

### Nova categoria

`higiene` — "Cuidados pessoais", com o lenço umedecido, seguindo a classificação
do documento do Obsidian. Ícone novo (`wipe`) para não repetir o de "Cuidados com
a pele", pelo mesmo motivo da Sprint 1 (ícones quase idênticos confundem).

### Validação

Playwright MCP em 1440 px e 390 px, com checagem extra em 768 px: Home,
catálogo, filtros, busca, 45 páginas de produto, carrinho e geração do link do
WhatsApp. **0 erros de console, 0 requisições com falha, nenhuma imagem quebrada,
nenhuma rolagem horizontal.** Nenhuma mensagem de WhatsApp foi enviada — a URL
foi capturada interceptando `window.open`.

### Ainda provisório

As 13 ilustrações da Sprint 2 que sobraram no catálogo continuam sendo
ilustrações, e o rodapé continua avisando "imagens ilustrativas". Os preços e as
descrições desses 13 produtos seguem como descrito na seção "Provisório".

---

## Sprint 5 — Nova remessa de perfumes (22/08/2026)

15 produtos de perfumaria entraram no catálogo (4 Hinode, 10 O Boticário, 1 AURA
Beauty Club). O catálogo foi de 45 para **59 produtos**; a perfumaria, de 18 para
**32**. Nenhuma categoria nova.

### Imagens vieram da página oficial de cada fabricante

Diferente das sprints anteriores, esta remessa não veio com fotografias: as
imagens foram buscadas na internet, sempre na **página oficial do fabricante**
(hinode.com.br, boticario.com.br, aurabeautyclub.com.br) — nenhuma de varejista
terceiro, nenhuma de produto semelhante ou de volume diferente.

O tratamento é o mesmo da Sprint 4 e os parâmetros foram reconstruídos a partir
desta documentação: fundo marfim `rgb(252, 238, 220)`, halo, vinheta, sombra de
contato, reflexo de piso, 1254 × 1254 PNG. **Os cantos das 15 novas imagens
medem `rgb(244, 226, 205)`** — idênticos aos das 32 imagens da Sprint 4.

O `www.boticario.com.br` responde 403 a `curl` e ao WebFetch. As páginas foram
lidas pelo navegador do Playwright; de lá, um `fetch` de mesma origem trouxe as
outras nove páginas de uma vez, e os JSON-LD deram nome, SKU e URL da imagem
oficial. As imagens em si estão num CDN aberto e foram baixadas direto.

#### Três armadilhas no recorte, e o que resolveu

1. **PNG com canal alfa (Hinode).** A chave de branco devolvia um retângulo
   cinza-azulado — a cor crua sob o alfa. O carregador passou a usar o alfa da
   própria imagem quando ele existe, e só cai na chave de branco quando não há.
2. **Sombra de estúdio virando produto (Boticário, AURA).** A sombra suave sob o
   frasco passava no limiar padrão (`thr=10`) e virava uma mancha branca opaca.
   Subir para `thr=32` descarta a sombra sem comer a base do frasco — testado
   contra `10/22/32/45` antes de fixar.
3. **Selo de premiação (AURA).** A imagem oficial do Afrodite Garden traz um
   selo "Prêmio Glamour de Beleza 2025" ao lado do frasco. Não faz parte da
   embalagem, então o recorte foi fechado só no frasco.

A Hinode publica sobretudo fotos de composição e peças com texto; para os quatro
produtos foi preciso garimpar o packshot limpo dentro da própria galeria oficial.

### Nada de bastidor na vitrine

Esta sprint mudou a regra editorial do catálogo, e a mudança vale para trás:

- saiu a linha **"Fonte: Material do distribuidor Sea Blue Importadora Top
  Paris"** das 17 fichas Sea Blue;
- saíram os **46 campos "Pendente de confirmação com o fabricante"** e os 6
  campos de ficha marcados como pendentes;
- o lenço umedecido deixou de mostrar "Marca a confirmar" e passou a "Sem marca".

O que não foi confirmado simplesmente não é publicado — e também não é anunciado
como faltando. A rastreabilidade continua inteira no documento do Obsidian.

Consequência prática: `specRow()` perdeu a marcação `is-pending`, a classe
`.specs .is-pending` saiu do CSS e `fragranceBlock()` não renderiza mais `fonte`.

### Ficha de perfume em três blocos

`fragranceBlock()` foi dividido. A página do perfume agora mostra:

1. **Sobre o produto** — linha, volume, concentração, fixação e público;
2. **Perfil olfativo** — família, acordes, sensação, ocasião sugerida;
3. **Notas olfativas** — pirâmide vertical de saída/coração/fundo, com legenda
   curta por etapa e barra lateral que escurece de cima para baixo.

O bloco 3 só existe quando há pirâmide confirmada — 7 dos 15 produtos novos. Nos
outros 8 o fabricante divulga apenas família e acordes, e a ficha fecha no bloco 2
sem qualquer aviso de dado faltando.

### Filtro feminino/masculino sem mexer nas categorias

Os produtos de perfumaria ganharam `audience: 'feminino' | 'masculino'`. Dentro
de Perfumes aparece uma segunda linha de chips (Todos / Feminino / Masculino);
fora dela a linha fica escondida, porque maquiagem, cabelo e unhas não têm
público definido — um filtro de gênero para batom seria ruído. Trocar de
categoria zera o filtro. O campo também entra na busca, então "masculino"
devolve os 19 masculinos.

Optou-se por isso em vez de dividir `perfumes` em duas categorias: dividir
quebraria os links `?cat=perfumes`, levaria a Home a 8 categorias e reclassificaria
18 produtos já publicados, sem ganho real para o cliente.

### Divergências de pesquisa

**O Enigma da Hinode é masculino, e o briefing dizia feminino.** Cadastrado como
masculino, com base na arte oficial de notas (couro da Toscana, patchouli), no
próprio texto de benefícios da Hinode ("desenvolvida para homens"), nas peças de
campanha da marca, no desenho do frasco e na classificação da Beleza na Web.
Está sinalizado para a loja confirmar antes de publicar.

**A página da Hinode se contradiz sozinha** em Stamina, Origini e Enigma: o bloco
principal dá uma família olfativa e a arte oficial de notas dá outra. Publicou-se
a versão da arte, que é específica de cada produto e coincide com o FAQ da mesma
página — o bloco principal aparenta ser texto templatizado.

### IDs e duplicidade

`perfume-o-boticario` era o registro genérico "Perfume — O Boticário" (R$ 129,90)
e sua imagem de catálogo já era o frasco redondo vermelho do Floratta Red. O `id`
foi preservado e o registro virou **Floratta Red Desodorante Colônia 75 ml**, a
R$ 134,90, com ficha, perfil olfativo e imagem oficial.

O **Floratta Red Passion** aparecia duas vezes no briefing (itens 7 e 11) e foi
cadastrado uma vez só.

### Rodapé

Saiu "Protótipo do Projeto Atlas · Imagens ilustrativas"; ficou "Preços e
disponibilidade confirmados no atendimento." Entrou o Instagram
**@perfumariap_eloa** com ícone, `target="_blank"` e `rel="noopener"`. Não há
mais nenhuma ocorrência de "Atlas" ou "protótipo" no HTML entregue ao navegador.

### Validação

Playwright MCP em 1440 px e 390 px: Home, catálogo, filtros de categoria e de
público, busca (Malbec, Floratta, Quasar, Lattitude, Uomini, Arbo, Egeo, Hinode,
"body splash", "masculino"), 59 páginas de produto, carrinho, link do WhatsApp e
link do Instagram. **0 erros de console, 0 requisições com falha, nenhuma imagem
quebrada, nenhuma rolagem horizontal.** Nenhuma mensagem de WhatsApp foi
enviada — a URL foi capturada interceptando `window.open`.
