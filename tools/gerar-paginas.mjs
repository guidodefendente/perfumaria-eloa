/**
 * Gerador das páginas estáticas de produto — Perfumaria Eloá.
 *
 * Sem dependências: roda com o Node instalado na máquina.
 *
 *   node tools/gerar-paginas.mjs
 *
 * O que faz:
 *   1. lê assets/js/products.js (fonte única da verdade — nunca é modificado);
 *   2. escreve produto/<id>/index.html para cada produto;
 *   3. apaga pastas de produto que não existem mais em products.js;
 *   4. regenera sitemap.xml com a home + uma URL por produto.
 *
 * É idempotente: rodar duas vezes seguidas produz exatamente os mesmos bytes.
 * (O <lastmod> do sitemap usa a data de hoje, então rodar em outro dia muda
 * essa linha — é o comportamento desejado, já que só se regenera ao publicar.)
 *
 * REGRA: nunca edite produto/<id>/index.html à mão. A próxima execução
 * sobrescreve. Para mudar uma página, mude products.js e rode de novo.
 *
 * SOBRE O CSS: as páginas reaproveitam styles.css e tailwind.css do site.
 * O tailwind.css é compilado com content: ['../index.html', '../assets/js/*.js']
 * — a pasta produto/ NÃO é varrida. Por isso este gerador só usa classes que
 * já aparecem no index.html ou no app.js: assim, se alguém regerar o Tailwind,
 * nenhuma classe destas páginas é purgada. O verificar-seo.mjs checa isso
 * mecanicamente a cada execução.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://perfumariaeloa.com.br';
const DIR_PRODUTOS = resolve(RAIZ, 'produto');

// ── Catálogo ───────────────────────────────────────────────────────────────
const src = readFileSync(resolve(RAIZ, 'assets/js/products.js'), 'utf8');
const { PRODUCTS, CATEGORIES, STORE } = new Function(
  `${src}\nreturn { PRODUCTS, CATEGORIES, STORE };`
)();

// ── Utilidades (espelham as do app.js para o HTML sair igual) ─────────────
const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
));

const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getCategory = (id) => CATEGORIES.find((c) => c.id === id);

const AUDIENCE_LABEL = { feminino: 'Feminino', masculino: 'Masculino' };

const whatsappLink = (message) => `https://wa.me/${STORE.whatsappNumber}?text=${encodeURIComponent(message)}`;

const urlProduto = (id) => `${SITE}/produto/${id}/`;

/**
 * Meta description. Parte da descrição real do produto; quando ela é curta
 * demais para uma meta description útil, completa com dados que já existem
 * (nome, marca, loja, cidade). Nada é inventado — só recombinado.
 */
function metaDescription(p) {
  let texto = p.description.trim();
  if (texto.length < 110) {
    // A descrição do produto nem sempre termina em pontuação ("Creme para o
    // corpo"); sem o ponto, a emenda vira uma frase só e fica ilegível.
    if (!/[.!?…]$/.test(texto)) texto += '.';
    texto += ` ${p.name} da marca ${p.brand} na Perfumaria Eloá — Cidade Tiradentes, São Paulo.`;
  }
  texto = texto.replace(/\s+/g, ' ').trim();
  if (texto.length <= 155) return texto;
  const corte = texto.slice(0, 155);
  return `${corte.slice(0, corte.lastIndexOf(' '))}…`;
}

// ── Blocos de conteúdo (mesmo markup do app.js) ───────────────────────────
const specRow = (label, value) =>
  `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;

function specsBlock(p) {
  const rows = [...(p.specs || [])];
  if (p.audience) rows.push({ label: 'Indicado para', value: AUDIENCE_LABEL[p.audience] });
  if (!rows.length) return '';
  return `
      <section class="specs" aria-label="Ficha do produto">
        <p class="specs-title">Sobre o produto</p>
        <dl>${rows.map((r) => specRow(r.label, r.value)).join('')}</dl>
      </section>`;
}

function fragranceBlock(p) {
  const f = p.fragrance;
  if (!f) return '';

  const perfil = [
    ['Família olfativa', f.familia],
    ['Acordes principais', f.acordes],
    ['Sensação', f.sensacao],
    ['Ocasião sugerida', f.ocasiao],
  ].filter(([, v]) => v);

  const piramide = [
    ['Saída', 'A primeira impressão', f.saida],
    ['Coração', 'O corpo da fragrância', f.coracao],
    ['Fundo', 'O rastro que fica', f.fundo],
  ].filter(([, , v]) => v);

  const blocoPerfil = perfil.length ? `
      <section class="specs" aria-label="Perfil olfativo">
        <p class="specs-title">Perfil olfativo</p>
        <dl>${perfil.map(([label, value]) => specRow(label, value)).join('')}</dl>
      </section>` : '';

  const blocoNotas = piramide.length ? `
      <section class="specs" aria-label="Notas olfativas">
        <p class="specs-title">Notas olfativas</p>
        <ol class="notes">
          ${piramide.map(([etapa, hint, value]) => `
            <li>
              <span class="notes-step">${escapeHtml(etapa)}</span>
              <span class="notes-value">${escapeHtml(value)}</span>
              <span class="notes-hint">${escapeHtml(hint)}</span>
            </li>`).join('')}
        </ol>
      </section>` : '';

  return blocoPerfil + blocoNotas;
}

/** Mesmos relacionados do app.js: irmãos de categoria, completando com destaques. */
function relacionados(p) {
  return PRODUCTS
    .filter((o) => o.category === p.category && o.id !== p.id)
    .concat(PRODUCTS.filter((o) => o.category !== p.category && o.featured))
    .slice(0, 4);
}

/** Card estático — aponta para a página do produto, não para a rota da SPA. */
function cardRelacionado(p) {
  const categoria = getCategory(p.category);
  return `
        <article class="card">
          <a href="/produto/${p.id}/" class="card-img block" aria-label="Ver ${escapeHtml(p.name)} ${escapeHtml(p.brand)}">
            <img src="/${p.image}" alt="${escapeHtml(p.name)} da marca ${escapeHtml(p.brand)}"
                 width="800" height="800" loading="lazy" decoding="async">
          </a>
          <div class="p-3.5 sm:p-4 flex flex-col flex-1">
            <p class="text-[11px] uppercase tracking-wider text-rose-700 font-semibold">${escapeHtml(categoria ? categoria.name : '')}</p>
            <h3 class="mt-1 font-medium text-ink-900 leading-snug">
              <a href="/produto/${p.id}/" class="hover:text-rose-700 transition-colors">${escapeHtml(p.name)}</a>
            </h3>
            <p class="text-sm text-ink-500">${escapeHtml(p.brand)}</p>
            <div class="mt-auto pt-3 border-t border-[#EAE0E3] flex items-center justify-between gap-2">
              <span class="font-display text-lg text-ink-900 tnum">${brl(p.price)}</span>
            </div>
          </div>
        </article>`;
}

// ── Dados estruturados ─────────────────────────────────────────────────────
/**
 * Product + BreadcrumbList.
 *
 * `offers` traz price e priceCurrency porque o preço já é apresentado como
 * número firme em toda a vitrine (card, ficha do produto e até na mensagem
 * pronta do WhatsApp). `availability` é OMITIDO de propósito: a própria página
 * diz "Disponibilidade confirmada no atendimento", e products.js não tem
 * campo de estoque — afirmar InStock seria uma promessa que a loja não faz.
 * `priceValidUntil` também fica de fora: não existe esse dado.
 */
function dadosEstruturados(p) {
  const categoria = getCategory(p.category);
  const grafo = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': `${urlProduto(p.id)}#produto`,
        name: p.name,
        sku: p.id,
        description: p.description,
        image: `${SITE}/${p.image}`,
        brand: { '@type': 'Brand', name: p.brand },
        ...(categoria ? { category: categoria.name } : {}),
        offers: {
          '@type': 'Offer',
          url: urlProduto(p.id),
          price: p.price.toFixed(2),
          priceCurrency: 'BRL',
          seller: { '@id': `${SITE}/#loja` },
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Catálogo', item: `${SITE}/#/catalogo` },
          ...(categoria
            ? [{ '@type': 'ListItem', position: 3, name: categoria.name, item: `${SITE}/#/catalogo?cat=${categoria.id}` }]
            : []),
          { '@type': 'ListItem', position: categoria ? 4 : 3, name: p.name, item: urlProduto(p.id) },
        ],
      },
    ],
  };
  return JSON.stringify(grafo, null, 2);
}

// ── Página ─────────────────────────────────────────────────────────────────
function paginaProduto(p) {
  const categoria = getCategory(p.category);
  const nomeCategoria = categoria ? categoria.name : '';
  const title = `${p.name} — ${p.brand} | Perfumaria Eloá`;
  const desc = metaDescription(p);
  const url = urlProduto(p.id);
  const relacionadas = relacionados(p);
  const whatsApp = whatsappLink(
    `Olá! Tenho interesse no produto: ${p.name} — ${p.brand} (${brl(p.price)}). Ele está disponível?`
  );

  return `<!DOCTYPE html>
<!--
  ARQUIVO GERADO AUTOMATICAMENTE — NÃO EDITE À MÃO.
  Fonte: assets/js/products.js (produto "${p.id}")
  Gerador: tools/gerar-paginas.mjs
  Para alterar esta página, mude products.js e rode: node tools/gerar-paginas.mjs
-->
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#140E10">
<link rel="icon" href="/assets/img/logo-eloa-96.png">
<link rel="apple-touch-icon" href="/assets/img/logo-eloa.png">

<meta property="og:type" content="product">
<meta property="og:site_name" content="Perfumaria Eloá">
<meta property="og:locale" content="pt_BR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeHtml(`${p.name} — ${p.brand}`)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:image" content="${SITE}/${p.image}">
<meta property="og:image:alt" content="${escapeHtml(`${p.name} da marca ${p.brand}`)}">
<meta name="twitter:card" content="summary_large_image">

<link rel="stylesheet" href="/assets/css/styles.css">
<link rel="stylesheet" href="/assets/css/tailwind.css">

<script type="application/ld+json">
${dadosEstruturados(p)}
</script>
</head>

<body class="bg-white text-ink-800">

<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-3 focus:left-3 focus:bg-ink-900 focus:text-white focus:px-4 focus:py-2 focus:rounded-full">Pular para o conteúdo</a>

<div class="bg-ink-900 text-sand-50 text-center text-[11px] sm:text-xs tracking-wide py-2 px-4">
  Entrega em toda a Zona Leste · Pedidos pelo WhatsApp
</div>

<header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#EAE0E3]">
  <div class="max-w-6xl mx-auto px-4 sm:px-6">
    <div class="flex items-center gap-3 h-[68px]">
      <a href="/" class="flex items-center gap-2.5 shrink-0" aria-label="Perfumaria Eloá — página inicial">
        <img src="/assets/img/logo-eloa.png" alt="" width="44" height="44" class="w-11 h-11 rounded-full" decoding="async">
        <span class="leading-none">
          <span class="block font-display text-[17px] sm:text-[19px] font-semibold text-ink-900 tracking-tight">Perfumaria Eloá</span>
          <span class="hidden sm:block text-[10px] tracking-[.16em] uppercase text-rose-700 mt-1">Sua beleza, nossa essência</span>
        </span>
      </a>
      <nav class="hdr-nav ml-auto" aria-label="Navegação principal">
        <a href="/">Início</a>
        <a href="/#/catalogo">Catálogo</a>
        <a href="/#/sobre">Sobre a loja</a>
      </nav>
    </div>
  </div>
</header>

<main id="main">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">

    <nav class="text-sm" aria-label="Você está em">
      <ol class="flex items-center gap-1.5 text-ink-500 flex-wrap">
        <li><a href="/" class="hover:text-rose-700">Início</a></li>
        <li aria-hidden="true" class="text-ink-400">/</li>
        <li><a href="/#/catalogo" class="hover:text-rose-700">Catálogo</a></li>
        <li aria-hidden="true" class="text-ink-400">/</li>
        <li><a href="/#/catalogo?cat=${p.category}" class="hover:text-rose-700">${escapeHtml(nomeCategoria)}</a></li>
        <li aria-hidden="true" class="text-ink-400">/</li>
        <li class="text-ink-800 font-medium">${escapeHtml(p.name)}</li>
      </ol>
    </nav>

    <div class="mt-6 grid md:grid-cols-2 gap-6 lg:gap-12 items-start">
      <div class="rounded-[22px] overflow-hidden border border-[#EAE0E3] bg-sand-100 aspect-square">
        <img src="/${p.image}" alt="${escapeHtml(`${p.name} da marca ${p.brand}`)}"
             width="800" height="800" class="w-full h-full object-cover" decoding="async">
      </div>

      <div class="md:pt-4">
        <a href="/#/catalogo?cat=${p.category}" class="eyebrow hover:text-rose-600">${escapeHtml(nomeCategoria)}</a>
        <h1 class="font-display text-[1.85rem] sm:text-4xl leading-tight font-semibold text-ink-900 mt-3">
          ${escapeHtml(p.name)}
        </h1>
        <p class="mt-1.5 text-base text-ink-500">${escapeHtml(p.brand)}</p>

        <p class="mt-6 font-display text-3xl sm:text-4xl text-ink-900 tnum">${brl(p.price)}</p>

        <p class="mt-5 text-[15px] text-ink-600 leading-relaxed max-w-prose">${escapeHtml(p.description)}</p>
${specsBlock(p)}${fragranceBlock(p)}

        <div class="mt-8 flex flex-col sm:flex-row gap-3">
          <a class="btn btn-whats flex-1" target="_blank" rel="noopener" href="${escapeHtml(whatsApp)}">
            <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm5.8 14.17c-.25.7-1.44 1.33-1.99 1.38-.53.05-1.02.24-3.44-.72-2.9-1.14-4.74-4.11-4.88-4.3-.14-.19-1.16-1.55-1.16-2.95 0-1.4.73-2.09.99-2.37.26-.29.57-.36.76-.36l.54.01c.17.01.41-.07.64.49.25.6.83 2.06.9 2.21.07.14.12.31.02.5-.09.19-.14.31-.28.48l-.42.49c-.14.14-.28.3-.12.58.16.29.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.17-.19.7-.81.88-1.09.19-.29.37-.24.63-.14.26.09 1.65.78 1.93.92.28.14.47.21.54.33.07.12.07.68-.18 1.34Z"/></svg>
            Pedir pelo WhatsApp
          </a>
          <a class="btn btn-outline flex-1" href="/#/produto/${p.id}">
            Ver no catálogo
          </a>
        </div>

        <ul class="mt-8 space-y-2.5 text-sm text-ink-500">
          <li class="flex items-start gap-2.5">
            <svg class="w-[18px] h-[18px] mt-px text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>
            Entrega em toda a Zona Leste de São Paulo
          </li>
          <li class="flex items-start gap-2.5">
            <svg class="w-[18px] h-[18px] mt-px text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
            ${escapeHtml(STORE.shipping)}
          </li>
          <li class="flex items-start gap-2.5">
            <svg class="w-[18px] h-[18px] mt-px text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            Disponibilidade confirmada no atendimento
          </li>
        </ul>
      </div>
    </div>
${relacionadas.length ? `
    <div class="mt-16">
      <h2 class="section-title">Você também pode gostar</h2>
      <div class="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">${relacionadas.map(cardRelacionado).join('')}
      </div>
    </div>` : ''}

    <p class="mt-16 text-center">
      <a href="/#/catalogo" class="btn btn-outline">Ver o catálogo completo</a>
    </p>
  </div>
</main>

<footer class="border-t border-[#EAE0E3] bg-sand-50 mt-8">
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid sm:grid-cols-[auto_1fr] gap-8 items-start">
    <img src="/assets/img/logo-eloa.png" alt="" width="64" height="64" class="w-16 h-16 rounded-full" loading="lazy" decoding="async">
    <div>
      <p class="font-display text-lg text-ink-900">Perfumaria Eloá</p>
      <p class="text-sm text-ink-500 mt-1">${escapeHtml(`${STORE.address} — ${STORE.city}`)}</p>
      <p class="text-sm text-ink-500">${escapeHtml(STORE.hours)}</p>
      <p class="text-sm text-ink-500">WhatsApp ${escapeHtml(STORE.whatsappDisplay)}</p>
      <nav class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <a href="/" class="text-ink-600 hover:text-rose-700">Início</a>
        <a href="/#/catalogo" class="text-ink-600 hover:text-rose-700">Catálogo</a>
        <a href="/#/sobre" class="text-ink-600 hover:text-rose-700">Sobre a loja</a>
        <a href="${escapeHtml(whatsappLink('Olá! Vim pelo catálogo digital da Perfumaria Eloá.'))}" target="_blank" rel="noopener" class="text-ink-600 hover:text-rose-700">WhatsApp</a>
      </nav>
      <a href="https://www.instagram.com/perfumariap_eloa/" target="_blank" rel="noopener"
         class="mt-5 inline-flex items-center gap-2 text-sm text-ink-600 hover:text-rose-700 transition-colors">
        <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2"/></svg>
        @perfumariap_eloa
      </a>
      <p class="mt-6 text-xs text-ink-400">
        Preços e disponibilidade confirmados no atendimento.
      </p>
    </div>
  </div>
</footer>

</body>
</html>
`;
}

// ── Sitemap ────────────────────────────────────────────────────────────────
function sitemap() {
  const hoje = new Date().toISOString().slice(0, 10);
  const entradas = [
    { loc: `${SITE}/`, changefreq: 'weekly', priority: '1.0' },
    ...PRODUCTS.map((p) => ({ loc: urlProduto(p.id), changefreq: 'monthly', priority: '0.7' })),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  ARQUIVO GERADO AUTOMATICAMENTE — NÃO EDITE À MÃO.
  Gerador: tools/gerar-paginas.mjs (a partir de assets/js/products.js)

  Contém a home e uma URL por produto. As rotas da SPA (#/catalogo, #/sobre)
  não entram: fragmento não é URL para buscador — o Google as trata como a
  própria home, e listá-las seria enviar a mesma URL várias vezes.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entradas.map(({ loc, changefreq, priority }) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${hoje}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
}

// ── Execução ───────────────────────────────────────────────────────────────
mkdirSync(DIR_PRODUTOS, { recursive: true });

const ids = new Set(PRODUCTS.map((p) => p.id));
let escritas = 0;
let inalteradas = 0;

for (const p of PRODUCTS) {
  const dir = join(DIR_PRODUTOS, p.id);
  const arquivo = join(dir, 'index.html');
  const html = paginaProduto(p);
  const anterior = existsSync(arquivo) ? readFileSync(arquivo, 'utf8') : null;
  if (anterior === html) { inalteradas += 1; continue; }
  mkdirSync(dir, { recursive: true });
  writeFileSync(arquivo, html);
  escritas += 1;
}

// Pastas órfãs: produto removido de products.js perde a página.
const removidas = [];
for (const entrada of readdirSync(DIR_PRODUTOS, { withFileTypes: true })) {
  if (!entrada.isDirectory() || ids.has(entrada.name)) continue;
  rmSync(join(DIR_PRODUTOS, entrada.name), { recursive: true, force: true });
  removidas.push(entrada.name);
}

const arquivoSitemap = resolve(RAIZ, 'sitemap.xml');
const xml = sitemap();
const sitemapMudou = !existsSync(arquivoSitemap) || readFileSync(arquivoSitemap, 'utf8') !== xml;
if (sitemapMudou) writeFileSync(arquivoSitemap, xml);

// ── Relatório ──────────────────────────────────────────────────────────────
console.log('Gerador de páginas de produto — Perfumaria Eloá\n');
console.log(`  produtos em products.js : ${PRODUCTS.length}`);
console.log(`  páginas escritas        : ${escritas}`);
console.log(`  páginas já atualizadas  : ${inalteradas}`);
console.log(`  pastas órfãs removidas  : ${removidas.length}${removidas.length ? ` (${removidas.join(', ')})` : ''}`);
console.log(`  sitemap.xml             : ${sitemapMudou ? 'regravado' : 'sem alteração'}, ${PRODUCTS.length + 1} URLs`);
console.log(`\nTamanho total das páginas: ${(
  PRODUCTS.reduce((s, p) => s + statSync(join(DIR_PRODUTOS, p.id, 'index.html')).size, 0) / 1024
).toFixed(0)} KB`);
