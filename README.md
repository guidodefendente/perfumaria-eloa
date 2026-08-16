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
  img/products/*.svg          imagens dos produtos (provisórias)
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

**Destacar na página inicial:** adicione `featured: true`.

## Estado atual

Protótipo navegável, com o fluxo completo funcionando: encontrar produto → adicionar ao
carrinho → ajustar quantidade → finalizar no WhatsApp.

Preços, descrições, imagens e a curadoria dos destaques ainda são provisórios.
Ver `DECISOES.md`.
