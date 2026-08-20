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
identidade visual de cada item. Todos os 45 produtos usam esse padrão, em 1254 × 1254 PNG.

As 32 imagens da Sprint 4 vêm das fotografias reais enviadas pela loja: o tratamento é
recorte, limpeza, iluminação, fundo, sombra e reflexo. Nenhuma embalagem ou rótulo foi
redesenhado. As 13 restantes ainda são ilustrações da Sprint 2 — ver `DECISOES.md`.

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
`fundo`, `sensacao`, `ocasiao`, `fonte`) vira o bloco "Perfil olfativo".

**Destacar na página inicial:** adicione `featured: true`.

## Estado atual

Protótipo navegável, com o fluxo completo funcionando: encontrar produto → adicionar ao
carrinho → ajustar quantidade → finalizar no WhatsApp.

**45 produtos em 7 categorias.** Os 32 produtos da remessa fotográfica de agosto/2026 têm
preço, nome e ficha confirmados pela loja ou pela embalagem. Os 13 produtos restantes da
Sprint 1 continuam com preço, descrição e imagem provisórios, e a curadoria dos destaques
ainda é nossa. Ver `DECISOES.md`.
