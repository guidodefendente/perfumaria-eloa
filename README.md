# Perfumaria Eloá

Catálogo digital da Perfumaria Eloá, desenvolvido durante o Projeto Atlas.

Loja física na Rua Nascer do Sol, 243 — Cidade Tiradentes, São Paulo/SP.
Os pedidos são montados no site e finalizados pelo WhatsApp.

## Como funciona (a partir do painel administrativo)

- **Produtos, preços, fotos, categorias e destaques** são administrados pelo
  painel em **https://perfumariaeloa.com.br/painel/** — no celular, sem
  código, sem commit e sem deploy. Salvou, está no site.
- O site roda na **Cloudflare** (Workers + D1 + KV), inteiramente no **plano
  gratuito** e numa conta **sem forma de pagamento** — ver [`docs/CUSTOS.md`](docs/CUSTOS.md).
- O site do cliente continua sendo HTML/CSS/JS puro, sem build; o catálogo
  (`assets/js/products.js`) passa a ser gerado pelo Worker a partir do banco.

| Documento | Para quem |
|---|---|
| [`docs/GUIA-DO-PAINEL.md`](docs/GUIA-DO-PAINEL.md) | Quem cuida da loja — passo a passo do painel |
| [`docs/IMPLANTACAO.md`](docs/IMPLANTACAO.md) | Roteiro único de troca do GitHub Pages para a Cloudflare |
| [`docs/CUSTOS.md`](docs/CUSTOS.md) | Por que não há cobrança, limites e o que nunca ativar |
| [`docs/SEGURANCA.md`](docs/SEGURANCA.md) | Login, senhas, sessões e proteções |
| [`docs/MANUTENCAO.md`](docs/MANUTENCAO.md) | Arquitetura, ambiente local, testes, backup |
| [`DECISOES.md`](DECISOES.md) | Histórico de decisões de todas as sprints |

## Como rodar localmente

```bash
npm install
cp .dev.vars.exemplo .dev.vars
npm run db:migrar:local      # banco local com o catálogo atual
npm run dev                  # site em http://localhost:8787 e painel em /painel/
scripts/testar-local.sh      # testes unitários, de API e de interface
```

Sem a Cloudflare, o site estático também abre com `python3 -m http.server 8000`
(usa o `assets/js/products.js` versionado, retrato do catálogo antes do painel).

## Estrutura

```
index.html                    estrutura e conteúdo das quatro telas do site
assets/
  css/styles.css              tokens de design e componentes (inclui a galeria)
  css/tailwind.css            utilitárias compiladas (gerado — não editar à mão)
  js/app.js                   estado, roteamento e interações do site
  js/galeria.js               galeria de fotos do produto (site e Worker)
  js/products.js              catálogo estático pré-painel (no Worker, é gerado do banco)
  img/products/w/*.webp       fotos do catálogo em WebP (1200 px e miniatura 600 px)
  img/products/*.png          originais em PNG (matriz de qualidade; não vão para o site)
  fonts/*.woff2               Inter e Playfair Display (subconjunto latino)
painel/                       painel administrativo (HTML/CSS/JS, módulos ES, sem build)
src/                          Worker da Cloudflare (API, autenticação, fotos, páginas de produto)
migrations/                   estrutura do banco D1 e carga inicial do catálogo
scripts/                      carga inicial, conversão de fotos, configuração e testes
test/                         testes unitários, de API e de interface
docs/                         guias (painel, implantação, custos, segurança, manutenção)
wrangler.jsonc                configuração do Worker (só serviços gratuitos)
.github/workflows/            publicação automática e configuração inicial da Cloudflare
produto/, sitemap.xml         versão estática pré-painel (o Worker gera na hora; sai após a virada)
tools/                        geradores da versão estática (saem após a virada)
build/                        config para regerar o tailwind.css
DECISOES.md                   decisões tomadas e o que ainda é provisório
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

**Pelo painel** — ver [`docs/GUIA-DO-PAINEL.md`](docs/GUIA-DO-PAINEL.md).

A regra editorial continua valendo: a vitrine do cliente não recebe fonte de
pesquisa, código interno nem aviso de "pendente de confirmação" — o que não foi
confirmado simplesmente não é publicado.

Até a virada para a Cloudflare (ver [`docs/IMPLANTACAO.md`](docs/IMPLANTACAO.md)),
o site no ar ainda é o do GitHub Pages, alimentado por `assets/js/products.js` +
`node tools/gerar-paginas.mjs`. Depois da virada, esse arquivo deixa de ser editado.

## Estado atual

**67 produtos em 7 categorias.** Painel administrativo pronto e testado
(Sprint 7, ver `DECISOES.md`), aguardando a implantação na Cloudflare.
