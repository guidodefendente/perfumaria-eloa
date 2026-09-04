# Perfumaria Eloá

Catálogo digital da Perfumaria Eloá, desenvolvido durante o Projeto Atlas.

Loja física na Rua Nascer do Sol, 243 — Cidade Tiradentes, São Paulo/SP.
Os pedidos são montados no site e finalizados pelo WhatsApp.

## Como rodar

Não há build nem dependências para instalar.

**Opção 1 — abrir direto:** dê um duplo clique em `index.html`.

**Opção 2 — servidor local** (recomendado, evita restrições do `file://`):

```bash
python3 -m http.server 8000
```

Depois acesse <http://localhost:8000>.

Não precisa de internet: o CSS e as fontes são servidos pelo próprio projeto.

## Estrutura

```
index.html                    estrutura e conteúdo das quatro telas
assets/
  css/styles.css              tokens de design e componentes
  css/tailwind.css            utilitárias compiladas (gerado — não editar à mão)
  js/products.js              catálogo e dados da loja  ← edite aqui para mudar produtos
  js/app.js                   estado, roteamento e interações
  img/logo-eloa.png           logotipo oficial
  img/products/*.png          imagens de catálogo tratadas dos produtos (provisórias)
  fonts/*.woff2               Inter e Playfair Display (subconjunto latino)
build/                        config para regerar o tailwind.css
produto/<id>/index.html       páginas estáticas de produto (GERADAS — não editar)
robots.txt                    liberado, aponta o sitemap
sitemap.xml                   home + 60 produtos (GERADO — não editar)
tools/gerar-paginas.mjs       gera as páginas de produto e o sitemap
tools/verificar-seo.mjs       verificações de SEO e integridade do catálogo
DECISOES.md                   decisões tomadas e o que ainda é provisório
```

O projeto não tem `package.json` nem `node_modules`. O `assets/css/tailwind.css` é um
arquivo pronto e versionado; só precisa ser regerado se você usar uma classe do Tailwind
que ainda não aparecia no projeto:

```bash
cd build && npx tailwindcss@3 -c tailwind.config.js -i input.css -o ../assets/css/tailwind.css --minify
```

As imagens dos produtos (`assets/img/products/*.png`) são fotos de catálogo tratadas —
fundo marfim, luz de estúdio, sombra suave e reflexo discreto — mantendo a embalagem e a
identidade visual de cada item. Todos os 59 produtos usam esse padrão, em 1254 × 1254 PNG.

As 32 imagens da Sprint 4 vêm das fotografias enviadas pela loja e as 15 da Sprint 5 da
página oficial de cada fabricante; em ambos os casos o tratamento é recorte, limpeza,
iluminação, fundo, sombra e reflexo, sem redesenhar embalagem ou rótulo. As 13 restantes
ainda são ilustrações da Sprint 2 — ver `DECISOES.md`.

## Telas

| Rota | Tela |
|---|---|
| `#/` | Início — banner, categorias, destaques, como pedir |
| `#/catalogo` | Catálogo — busca e filtro por categoria |
| `#/produto/<id>` | Detalhe do produto |
| `#/sobre` | Sobre a loja — endereço, horário, entrega, frete |

O carrinho é um painel lateral no desktop e um *bottom sheet* no celular.

## Como atualizar o catálogo

Tudo em `assets/js/products.js`.

**Trocar um preço:** altere o campo `price` (número, sem símbolo de moeda).

**Usar a foto real de um produto:** coloque o arquivo em `assets/img/products/` e aponte o
campo `image` para ele.

```js
image: 'assets/img/products/perfume-o-boticario.jpg',
```

**Adicionar um produto:** copie um bloco existente, troque os campos e use um `id` único.
O `category` precisa ser um dos ids de `CATEGORIES`.

**Ficha do produto:** o campo opcional `specs` é uma lista de `{ label, value }` que vira o
bloco "Sobre o produto" na página do produto. Um valor que comece com "Pendente" aparece em
itálico e cinza — use isso em vez de inventar o dado.

**Perfumes:** o campo opcional `fragrance` (`familia`, `acordes`, `saida`, `coracao`,
`fundo`, `sensacao`, `ocasiao`) vira os blocos "Perfil olfativo" e "Notas olfativas". A
pirâmide de notas só aparece quando `saida`/`coracao`/`fundo` existem.

**Público:** `audience` (`'feminino'` ou `'masculino'`) alimenta o filtro que aparece
dentro da categoria Perfumes e entra na busca.

**Regra editorial:** `products.js` alimenta a vitrine do cliente. Não entra ali fonte de
pesquisa, código interno nem aviso de "pendente de confirmação" — o que não foi confirmado
simplesmente não é publicado. A rastreabilidade fica em `DECISOES.md`.

**Destacar na página inicial:** adicione `featured: true`.

**Depois de qualquer mudança em `products.js`, rode o gerador:**

```bash
node tools/gerar-paginas.mjs
```

Ele reescreve `produto/<id>/index.html` para cada produto e regenera o
`sitemap.xml`. Sem esse passo, a página estática do produto fica desatualizada
(ou nem existe, no caso de um produto novo). Em seguida, confirme tudo com:

```bash
node tools/verificar-seo.mjs
```

A verificação falha se algum produto estiver sem página, se sobrar página de
produto removido ou se o sitemap não bater com o catálogo. Ao publicar ou
remover um produto, atualize também a constante `ESPERADO` no topo do
`verificar-seo.mjs` — é o único contador manual do projeto.

**Nunca edite `produto/<id>/index.html` à mão:** o arquivo é gerado e a próxima
execução sobrescreve. Para mudar a página, mude `products.js`.

## Estado atual

Protótipo navegável, com o fluxo completo funcionando: encontrar produto → adicionar ao
carrinho → ajustar quantidade → finalizar no WhatsApp.

**59 produtos em 7 categorias**, sendo 32 de perfumaria. Os 47 produtos das remessas de
agosto/2026 têm preço, nome e ficha confirmados pela loja, pela embalagem ou pela página
oficial do fabricante. Os 12 produtos restantes da Sprint 1 continuam com preço, descrição
e imagem provisórios, e a curadoria dos destaques ainda é nossa. Ver `DECISOES.md`.
