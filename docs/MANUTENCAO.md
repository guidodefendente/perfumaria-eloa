# Manutenção técnica

Para quem for dar manutenção no código. O dia a dia da loja (produtos, preços,
fotos, categorias, destaques) é feito pelo painel — ver `GUIA-DO-PAINEL.md`.

## Arquitetura

```
Navegador do cliente ──► perfumariaeloa.com.br (Cloudflare)
                           │
                           ├─ arquivos estáticos (grátis, ilimitado)
                           │    index.html, assets/ (CSS, JS, fontes, fotos antigas WebP), painel/
                           │
                           └─ Worker src/worker.js (só as rotas abaixo)
                                /assets/js/products.js  catálogo publicado ─┐
                                /api/catalogo           (mesmo, em JSON)    │  D1 "eloa"
                                /produto/<id>/          página com SEO      ├─ (1 linha pronta
                                /sitemap.xml                                │   em `publicacao`)
                                /api/auth/*, /api/admin/*  painel ──────────┘
                                /img/f/...              fotos ─────────────── KV "FOTOS"
```

- **O site (`app.js`) não mudou de modelo:** continua lendo `CATEGORIES`, `PRODUCTS`
  e `STORE` de `assets/js/products.js` — só que esse arquivo agora é gerado pelo
  Worker a partir do banco.
- **Publicação:** toda alteração no painel remonta o catálogo ativo e grava pronto
  na tabela `publicacao` (`src/lib/catalogo.js → publicar`). Visitas leem 1 linha.
- **Páginas de produto e sitemap** são renderizadas na hora (`src/render/paginas.js`,
  portado do antigo `tools/gerar-paginas.mjs`, mesmo HTML e SEO).
- **Galeria:** `assets/js/galeria.js` é usado pelo site e importado pelo Worker
  (uma única fonte de markup).
- **Validação:** `painel/validacao.js` é importado pelo painel e pelo Worker —
  as mesmas regras nos dois lados.
- **Fotos:** otimizadas no celular (`painel/imagens.js`), conferidas e guardadas
  pelo Worker (`src/lib/fotos.js`). Órfãs são apagadas pelo cron após 7 dias.

Sem framework e sem passo de build no site. Dependências só de desenvolvimento:
`wrangler` (publicação e ambiente local) e `puppeteer-core` (teste de interface).

## Rodar localmente

```bash
npm install
cp .dev.vars.exemplo .dev.vars          # segredos de desenvolvimento (já tem valores de teste)
npm run db:migrar:local                  # cria o banco local com os 67 produtos
npm run dev                              # http://localhost:8787  e  /painel/
```

Login local: em `/painel/`, "Esqueci minha senha" com `dono@exemplo.com`. O
e-mail não é enviado — o link aparece no terminal do `wrangler dev`.

## Testes

```bash
scripts/testar-local.sh          # tudo (banco local zerado a cada bateria)
scripts/testar-local.sh unit     # regras puras: validação, preço, cripto, páginas
scripts/testar-local.sh api      # fluxo completo da API contra o Worker local
scripts/testar-local.sh e2e      # painel e site num Chrome com tela de celular
```

O teste de interface precisa do Google Chrome (`CHROME=/caminho/do/chrome` para mudar)
e grava capturas em `test/e2e/capturas/`.

## Publicar código

Merge no `main` → GitHub Actions **Publicar na Cloudflare**: roda os testes
unitários, aplica migrations e publica o Worker. Nada de deploy manual.

## Mudar a estrutura do banco

Crie `migrations/0003_<descricao>.sql` (nunca edite uma migration já aplicada).
A publicação aplica sozinha. Teste antes com `scripts/testar-local.sh`.

## Dar ou tirar acesso ao painel

Edite o segredo `ADMIN_EMAILS` no GitHub (Settings → Secrets → Actions) e rode
**Actions → Publicar na Cloudflare → Run workflow**. Quem sair da lista perde o
acesso na hora. Quem entrar precisa ter o e-mail verificado no Email Routing
(ver `IMPLANTACAO.md`, passo 3) e criar a senha pelo "Primeiro acesso".

## Backup e recuperação

- **D1 Time Travel** (grátis, últimos 7 dias): volta o banco a qualquer minuto.
  `npx wrangler d1 time-travel restore eloa --timestamp=<ISO>` (ver docs da Cloudflare).
- **Exportar o banco:** `npx wrangler d1 export eloa --remote --output=backup.sql`.
- Fotos excluídas ficam 7 dias no KV antes da limpeza — o mesmo prazo do Time Travel.

## Limites e custos

Ver `CUSTOS.md`. Resumo: tudo no plano gratuito, conta sem forma de pagamento.
**Não adicione serviços pagos** (R2, Images, Workers Paid…) sem autorização do Guido.
