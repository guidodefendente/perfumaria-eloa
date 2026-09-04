/**
 * Verificação de SEO e integridade do catálogo — Perfumaria Eloá.
 *
 * Sem dependências: roda com o Node instalado na máquina, direto no repositório.
 *
 *   node tools/verificar-seo.mjs
 *
 * Sai com código 1 se qualquer verificação falhar, para poder ser usado em CI
 * mais tarde sem mudar nada. Não altera nenhum arquivo.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://perfumariaeloa.com.br';

let falhas = 0;
let total = 0;

function checar(descricao, condicao, detalhe = '') {
  total += 1;
  if (condicao) {
    console.log(`  ok   ${descricao}`);
  } else {
    falhas += 1;
    console.log(`  FALHA ${descricao}${detalhe ? ` — ${detalhe}` : ''}`);
  }
}

const secao = (titulo) => console.log(`\n${titulo}`);
const ler = (rel) => readFileSync(resolve(RAIZ, rel), 'utf8');

const html = ler('index.html');

/** Carrega products.js sem module system: o arquivo declara consts no escopo. */
function carregarCatalogo() {
  const src = ler('assets/js/products.js');
  return new Function(`${src}\nreturn { PRODUCTS, CATEGORIES, STORE };`)();
}
const { PRODUCTS, CATEGORIES, STORE } = carregarCatalogo();

// ── 1. Metadados da home ───────────────────────────────────────────────────
secao('1. Metadados da página inicial');

const title = html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
checar('possui <title>', title.length > 0);
checar('title tem entre 30 e 70 caracteres', title.length >= 30 && title.length <= 70, `${title.length} caracteres`);
checar('title cita a marca', /Perfumaria Elo[áa]/i.test(title));

const desc = html.match(/<meta\s+name="description"\s+content="([^"]+)"/)?.[1] ?? '';
checar('possui meta description', desc.length > 0);
checar('meta description tem entre 70 e 165 caracteres', desc.length >= 70 && desc.length <= 165, `${desc.length} caracteres`);

const canonical = html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/)?.[1] ?? '';
checar('possui canonical', canonical.length > 0);
checar('canonical aponta para a home em https', canonical === `${SITE}/`, canonical);

checar('idioma declarado como pt-BR', /<html\s+lang="pt-BR">/.test(html));
checar('possui viewport', /<meta\s+name="viewport"/.test(html));
checar('possui favicon (rel=icon)', /<link\s+rel="icon"\s+href="([^"]+)"/.test(html));

const favicon = html.match(/<link\s+rel="icon"\s+href="([^"]+)"/)?.[1];
checar('arquivo do favicon existe', existsSync(resolve(RAIZ, favicon)), favicon);

// ── 2. Headings ────────────────────────────────────────────────────────────
secao('2. Headings');
// A tela de produto é a única cujo <h1> não está no HTML: ele é montado por
// renderProduct() a partir do nome do produto. As outras três trazem o seu.
const telas = html.split(/<section\s+data-view="/).slice(1)
  .map((bloco) => [bloco.slice(0, bloco.indexOf('"')), (bloco.match(/<h1[\s>]/g) || []).length]);
const estaticas = telas.filter(([nome]) => nome !== 'produto');
checar('cada tela estática tem exatamente um <h1>', estaticas.every(([, n]) => n === 1),
  estaticas.map(([nome, n]) => `${nome}: ${n}`).join(', '));
checar('a tela de produto tem <h1> gerado por app.js',
  /<h1[^>]*>\s*\$\{escapeHtml\(product\.name\)\}/.test(ler('assets/js/app.js')));
checar('existe <h2> na página', /<h2[\s>]/.test(html));

// ── 3. Open Graph ──────────────────────────────────────────────────────────
secao('3. Compartilhamento social');
for (const prop of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:site_name', 'og:locale']) {
  checar(`possui ${prop}`, new RegExp(`property="${prop}"`).test(html));
}
const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1] ?? '';
checar('og:image é URL absoluta', ogImage.startsWith('https://'), ogImage);
checar('arquivo do og:image existe', existsSync(resolve(RAIZ, ogImage.replace(`${SITE}/`, ''))), ogImage);
checar('og:url igual ao canonical', html.includes(`property="og:url" content="${canonical}"`));

// ── 4. robots.txt ──────────────────────────────────────────────────────────
secao('4. robots.txt');
checar('robots.txt existe', existsSync(resolve(RAIZ, 'robots.txt')));
const robots = ler('robots.txt');
checar('robots.txt libera o site', /^\s*Allow:\s*\/\s*$/m.test(robots));
checar('robots.txt não bloqueia a home', !/^\s*Disallow:\s*\/\s*$/m.test(robots));
checar('robots.txt aponta o sitemap', robots.includes(`Sitemap: ${SITE}/sitemap.xml`));

// ── 5. sitemap.xml ─────────────────────────────────────────────────────────
secao('5. sitemap.xml');
checar('sitemap.xml existe', existsSync(resolve(RAIZ, 'sitemap.xml')));
const sitemap = ler('sitemap.xml');
checar('sitemap declara o namespace correto', sitemap.includes('http://www.sitemaps.org/schemas/sitemap/0.9'));
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
checar('sitemap tem ao menos uma URL', locs.length > 0);
checar('todas as URLs do sitemap são absolutas e https', locs.every((u) => u.startsWith(`${SITE}/`)), locs.join(', '));
for (const loc of locs) {
  const rel = loc.replace(`${SITE}/`, '') || 'index.html';
  const alvo = rel.endsWith('/') ? `${rel}index.html` : rel;
  checar(`URL do sitemap existe no repositório: ${loc}`, existsSync(resolve(RAIZ, alvo)));
}
checar('a home canônica está no sitemap', locs.includes(canonical));
const lastmod = sitemap.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1] ?? '';
checar('lastmod no formato AAAA-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(lastmod), lastmod);

// ── 6. Dados estruturados ──────────────────────────────────────────────────
secao('6. Schema.org');
const blocos = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
checar('existe bloco JSON-LD', blocos.length > 0);
let grafo = [];
for (const [i, bruto] of blocos.entries()) {
  let dados = null;
  try { dados = JSON.parse(bruto); } catch (e) { /* reportado abaixo */ }
  checar(`JSON-LD #${i + 1} é JSON válido`, dados !== null);
  if (dados) grafo = grafo.concat(dados['@graph'] ?? [dados]);
}
const negocio = grafo.find((n) => String(n['@type']).includes('Business') || n['@type'] === 'LocalBusiness');
checar('declara um LocalBusiness', Boolean(negocio));
if (negocio) {
  checar('LocalBusiness tem name, url, telephone e address',
    Boolean(negocio.name && negocio.url && negocio.telephone && negocio.address));
  checar('endereço do schema bate com STORE.address',
    String(negocio.address.streetAddress).startsWith(STORE.address),
    `${negocio.address.streetAddress} vs ${STORE.address}`);
  const telSchema = negocio.telephone.replace(/\D/g, '');
  checar('telefone do schema bate com STORE.whatsappNumber',
    telSchema === STORE.whatsappNumber, `${telSchema} vs ${STORE.whatsappNumber}`);
  checar('nome do schema bate com STORE.name', negocio.name === STORE.name);
  checar('horário do schema tem abertura e fechamento',
    Boolean(negocio.openingHoursSpecification?.[0]?.opens && negocio.openingHoursSpecification?.[0]?.closes));
}
checar('declara um WebSite', grafo.some((n) => n['@type'] === 'WebSite'));

// ── 7. Catálogo: dados comerciais preservados ──────────────────────────────
secao('7. Catálogo e dados comerciais');
checar('há produtos no catálogo', PRODUCTS.length > 0, `${PRODUCTS.length} produtos`);
console.log(`       (${PRODUCTS.length} produtos, ${CATEGORIES.length} categorias, ${PRODUCTS.filter((p) => p.featured).length} em destaque)`);

const ids = PRODUCTS.map((p) => p.id);
checar('todos os ids de produto são únicos', new Set(ids).size === ids.length,
  ids.filter((v, i) => ids.indexOf(v) !== i).join(', '));
const idsCategoria = new Set(CATEGORIES.map((c) => c.id));
const semCategoria = PRODUCTS.filter((p) => !idsCategoria.has(p.category)).map((p) => p.id);
checar('todo produto aponta para uma categoria existente', semCategoria.length === 0, semCategoria.join(', '));
const semPreco = PRODUCTS.filter((p) => typeof p.price !== 'number' || !(p.price > 0)).map((p) => p.id);
checar('todo produto tem preço numérico positivo', semPreco.length === 0, semPreco.join(', '));
const semCampos = PRODUCTS.filter((p) => !p.name || !p.brand || !p.description).map((p) => p.id);
checar('todo produto tem nome, marca e descrição', semCampos.length === 0, semCampos.join(', '));
const semImagem = PRODUCTS.filter((p) => !p.image || !existsSync(resolve(RAIZ, p.image))).map((p) => p.id);
checar('a imagem de todo produto existe no repositório', semImagem.length === 0, semImagem.join(', '));
const categoriasVazias = CATEGORIES.filter((c) => !PRODUCTS.some((p) => p.category === c.id)).map((c) => c.id);
checar('nenhuma categoria está vazia', categoriasVazias.length === 0, categoriasVazias.join(', '));

checar('dados da loja completos',
  Boolean(STORE.name && STORE.address && STORE.city && STORE.hours && STORE.whatsappNumber));

// ── 8. Links e arquivos referenciados ──────────────────────────────────────
secao('8. Links e arquivos');
const refs = [...html.matchAll(/(?:href|src)="([^"#][^"]*)"/g)].map((m) => m[1]);
const locais = refs.filter((u) => !/^(https?:)?\/\//.test(u) && !u.startsWith('mailto:') && !u.startsWith('#'));
const quebrados = locais.filter((u) => !existsSync(resolve(RAIZ, u.split('?')[0])));
checar('nenhum arquivo local referenciado está faltando', quebrados.length === 0, quebrados.join(', '));

const rotas = [...new Set([...html.matchAll(/href="#\/([^"?]*)/g)].map((m) => m[1].split('/')[0]))].filter(Boolean);
const rotasValidas = ['catalogo', 'sobre', 'produto'];
checar('todos os links internos apontam para rotas conhecidas',
  rotas.every((r) => rotasValidas.includes(r)), rotas.join(', '));

checar('o formulário público continua com noindex',
  /<meta\s+name="robots"\s+content="noindex">/.test(ler('admin/enviar.html')));

// ── Resultado ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(60)}`);
console.log(falhas === 0
  ? `Tudo certo: ${total} verificações, 0 falhas.`
  : `${falhas} de ${total} verificações falharam.`);
process.exit(falhas === 0 ? 0 : 1);
