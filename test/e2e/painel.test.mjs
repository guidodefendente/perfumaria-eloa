/**
 * Teste de interface: o dia a dia do painel num Chrome com tela de celular
 * (390 × 844), e o reflexo de cada ação no site que o cliente vê.
 * Rode com: scripts/testar-local.sh e2e   (precisa do Google Chrome instalado)
 *
 * Capturas de tela ficam em test/e2e/capturas/ para revisão visual.
 */
import { test as testeBase, before, after } from 'node:test';

const test = (nome, fn) => testeBase(nome, { timeout: 90000 }, fn);
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || 'http://localhost:8787';
const CHROME = process.env.CHROME || '/usr/bin/google-chrome';
const EMAIL = 'irmao@exemplo.com';
const SENHA = 'loja aberta todo dia 9h';
const CAPTURAS = resolve(AQUI, 'capturas');
mkdirSync(CAPTURAS, { recursive: true });

let navegador;
let pagina;
const errosDoConsole = [];

const capturar = (nome) => pagina.screenshot({ path: resolve(CAPTURAS, `${nome}.png`), fullPage: true });
const esperarTexto = (texto, timeout = 15000) => pagina.waitForFunction(
  (t) => document.body.innerText.includes(t), { timeout }, texto,
);
/** Toca no elemento em si (não numa coordenada): imune a rolagem em andamento. */
const tocar = (seletor) => pagina.$eval(seletor, (el) => { el.scrollIntoView({ block: 'center', behavior: 'instant' }); el.click(); });

async function clicarTexto(seletor, texto) {
  const alvos = await pagina.$$(seletor);
  for (const el of alvos) {
    const t = await el.evaluate((n) => n.innerText || n.textContent);
    if (t.includes(texto)) { await el.click(); return; }
  }
  throw new Error(`Não achei "${texto}" em ${seletor}`);
}

before(async () => {
  navegador = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 60000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  pagina = await navegador.newPage();
  await pagina.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  pagina.on('console', (m) => { if (m.type() === 'error') errosDoConsole.push(m.text()); });
  pagina.on('pageerror', (e) => errosDoConsole.push(String(e)));
  // Janelas de produto "Ver no site" não devem abrir abas no teste.
  await pagina.evaluateOnNewDocument(() => { window.open = () => null; });
});

after(async () => { if (navegador) await navegador.close(); });

test('primeiro acesso: pedir link, criar senha e cair na lista de produtos', async () => {
  await pagina.goto(`${BASE}/painel/`, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('#form-entrar');
  assert.match(pagina.url(), /#\/entrar$/);
  await capturar('01-entrar');

  await pagina.click('a[href="#/esqueci"]');
  await pagina.waitForSelector('#form-esqueci');
  await pagina.type('#email', EMAIL);
  await pagina.click('#form-esqueci button[type=submit]');
  await esperarTexto('Pronto!');

  const { emails } = await (await fetch(`${BASE}/api/dev/emails`)).json();
  const link = emails.filter((e) => e.para === EMAIL).pop().texto.match(/(http\S+#\/redefinir\/\S+)/)[1];
  await pagina.goto(link, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('#form-redefinir');

  await pagina.type('#nova', 'curta');
  await pagina.type('#confirmar', 'curta');
  await pagina.click('#form-redefinir button[type=submit]');
  await esperarTexto('Use pelo menos 10 caracteres');

  await pagina.$eval('#nova', (el) => { el.value = ''; });
  await pagina.$eval('#confirmar', (el) => { el.value = ''; });
  await pagina.type('#nova', SENHA);
  await pagina.type('#confirmar', SENHA);
  await pagina.click('#form-redefinir button[type=submit]');
  await pagina.waitForSelector('.lista .item', { timeout: 30000 });
  assert.match(pagina.url(), /#\/produtos$/);
  assert.ok(!pagina.url().includes('redefinir'), 'token sai da barra de endereço');
  await capturar('02-lista-produtos');
});

test('cadastrar produto com duas fotos do celular', async () => {
  await pagina.waitForSelector('a[href="#/produtos/novo"]');
  await pagina.click('a[href="#/produtos/novo"]');
  await pagina.waitForSelector('#form-produto');

  // Salvar vazio mostra os erros.
  await pagina.click('#salvar');
  await esperarTexto('Adicione pelo menos uma foto');

  const input = await pagina.$('#arquivo-fotos');
  await input.uploadFile(resolve(AQUI, 'fixtures/foto-celular.jpg'), resolve(AQUI, 'fixtures/foto-paisagem.png'));
  await pagina.waitForFunction(() => document.querySelectorAll('.foto').length === 2
    && !document.querySelector('.foto-estado'), { timeout: 30000 });

  await new Promise((r) => setTimeout(r, 600)); // deixa a rolagem até o erro terminar
  await pagina.type('#nome', 'Kit Presente Rosa');
  await pagina.type('#marca', 'Eloá Kits');
  await pagina.select('#categoria', 'pele');
  await pagina.type('#preco', '59,9');
  await pagina.type('#descricao', 'Kit com hidratante e body splash, embalado para presente.');
  await tocar('[data-campo="ficha"] summary');
  await tocar('#mais-ficha');
  await pagina.type('#ficha [data-parte="label"]', 'Conteúdo');
  await pagina.type('#ficha [data-parte="value"]', 'Hidratante 200 ml e body splash 200 ml');

  // Segunda foto vira a principal.
  await tocar('[data-principal="1"]');
  await capturar('03-novo-produto');

  await pagina.click('#previa');
  await esperarTexto('Prévia no site');
  await capturar('04-previa');
  await pagina.click('.janela [data-fechar]');

  await pagina.click('#salvar');
  await esperarTexto('Produto cadastrado', 20000);
  await capturar('05-cadastrado');
  await clicarTexto('.janela button', 'Voltar para a lista');
  await pagina.waitForSelector('.lista .item');
  await pagina.type('#busca', 'kit presente');
  await esperarTexto('Kit Presente Rosa');
});

test('o produto aparece no site com galeria de 2 fotos e foto principal certa', async () => {
  const site = await navegador.newPage();
  await site.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const erros = [];
  site.on('pageerror', (e) => erros.push(String(e)));
  site.on('console', (m) => { if (m.type() === 'error') erros.push(m.text()); });

  await site.goto(`${BASE}/#/produto/kit-presente-rosa`, { waitUntil: 'networkidle0' });
  await site.waitForSelector('#product-detail [data-galeria-ok]');
  assert.equal(await site.$$eval('#product-detail .galeria-foto', (n) => n.length), 2);
  assert.equal(await site.$eval('#product-detail h1', (n) => n.textContent.trim()), 'Kit Presente Rosa');
  assert.match(await site.$eval('#product-detail', (n) => n.innerText), /R\$\s?59,90/);
  await site.screenshot({ path: resolve(CAPTURAS, '06-site-produto.png'), fullPage: false });

  await site.click('#product-detail [data-galeria-ir="1"]');
  await site.waitForFunction(() => document.querySelector('#product-detail [data-galeria-atual]').textContent === '2');

  // Página com SEO, servida pelo Worker.
  await site.goto(`${BASE}/produto/kit-presente-rosa/`, { waitUntil: 'networkidle0' });
  assert.match(await site.title(), /Kit Presente Rosa — Eloá Kits/);
  assert.equal(await site.$$eval('.galeria-mini', (n) => n.length), 2);

  // Home e catálogo continuam funcionando.
  await site.goto(`${BASE}/#/catalogo`, { waitUntil: 'networkidle0' });
  await site.waitForSelector('#catalog-grid .card');
  assert.equal(await site.$$eval('#catalog-grid .card', (n) => n.length), 68);
  await site.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await site.waitForSelector('#home-featured .card');
  await site.screenshot({ path: resolve(CAPTURAS, '07-site-home.png'), fullPage: false });
  assert.deepEqual(erros, [], 'site sem erros no console');
  await site.close();
});

test('editar preço e ocultar pela lista', async () => {
  await pagina.goto(`${BASE}/painel/#/produtos/kit-presente-rosa`, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('#form-produto');
  await pagina.$eval('#preco', (el) => { el.value = ''; });
  await pagina.type('#preco', '64,90');
  await pagina.click('#salvar');
  await esperarTexto('Alterações salvas', 20000);
  await clicarTexto('.janela button', 'Voltar para a lista');
  await pagina.waitForSelector('.lista .item');

  const cat = await (await fetch(`${BASE}/api/catalogo`)).json();
  assert.equal(cat.produtos.find((p) => p.id === 'kit-presente-rosa').price, 64.9);

  await pagina.click('[data-ativo="kit-presente-rosa"]');
  await esperarTexto('foi ocultado do site');
  const depois = await (await fetch(`${BASE}/api/catalogo`)).json();
  assert.ok(!depois.produtos.some((p) => p.id === 'kit-presente-rosa'));
  await pagina.click('[data-ativo="kit-presente-rosa"]');
  await esperarTexto('voltou para o site');
});

test('aviso ao sair com alterações não salvas', async () => {
  await pagina.goto(`${BASE}/painel/#/produtos/kit-presente-rosa`, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('#form-produto');
  await pagina.type('#nome', ' X');
  await pagina.click('a[href="#/categorias"]');
  await esperarTexto('Sair sem salvar?');
  await clicarTexto('.janela button', 'Continuar editando');
  assert.match(pagina.url(), /kit-presente-rosa$/);
  assert.match(await pagina.$eval('#nome', (n) => n.value), /X/, 'o que foi digitado continua no campo');
});

test('página inicial: novo destaque em 1º lugar', async () => {
  await pagina.evaluate(() => { location.hash = '#/inicio'; });
  await esperarTexto('Sair sem salvar?');
  await clicarTexto('.janela button', 'Sair sem salvar');
  await pagina.waitForSelector('#destaques .item');
  await pagina.click('#add-destaque');
  await pagina.waitForSelector('#busca-dest');
  await pagina.type('#busca-dest', 'kit presente');
  await pagina.waitForSelector('[data-escolher="kit-presente-rosa"]');
  await pagina.click('[data-escolher="kit-presente-rosa"]');
  // Sobe até o topo (no máximo 30 toques).
  for (let n = 0; n < 30; n += 1) {
    const nomes = await pagina.$$eval('#destaques .item strong', (x) => x.map((t) => t.textContent));
    const i = nomes.findIndex((t) => t.includes('Kit Presente Rosa'));
    assert.ok(i >= 0, 'destaque adicionado');
    if (i === 0) break;
    await pagina.$eval(`#destaques [data-d-mover="${i}"][data-dir="-1"]`, (b) => b.click());
  }
  assert.match(await pagina.$eval('#destaques .item strong', (x) => x.textContent), /^1\. Kit Presente Rosa/);
  await capturar('08-pagina-inicial');
  await pagina.click('#salvar-inicio');
  await esperarTexto('Página inicial atualizada');
  const cat = await (await fetch(`${BASE}/api/catalogo`)).json();
  const primeiro = cat.produtos.filter((p) => p.featured).sort((a, b) => a.featuredOrder - b.featuredOrder)[0];
  assert.equal(primeiro.id, 'kit-presente-rosa');
});

test('categorias: criar e reordenar', async () => {
  await pagina.click('a[href="#/categorias"]');
  await pagina.waitForSelector('#lista-cats .item');
  await pagina.click('#nova');
  await pagina.waitForSelector('#form-cat');
  await pagina.type('#cat-nome', 'Presentes');
  await pagina.click('#form-cat input[value="sparkle"]');
  await pagina.click('#form-cat button[type=submit]');
  await esperarTexto('Categoria “Presentes” criada');
  await pagina.waitForFunction(() => document.querySelector('#lista-cats').innerText.includes('Presentes'));
  const n = await pagina.$$eval('#lista-cats .item', (x) => x.length);
  await pagina.click(`[data-mover="${n - 1}"][data-dir="-1"]`);
  await capturar('09-categorias');
  await new Promise((r) => setTimeout(r, 800));
  const cat = await (await fetch(`${BASE}/api/catalogo`)).json();
  assert.equal(cat.categorias[cat.categorias.length - 2].id, 'presentes');
});

test('excluir produto com confirmação', async () => {
  await pagina.goto(`${BASE}/painel/#/produtos/kit-presente-rosa`, { waitUntil: 'networkidle0' });
  await pagina.waitForSelector('#excluir');
  await pagina.click('#excluir');
  await esperarTexto('Excluir definitivamente?');
  await capturar('10-excluir');
  await clicarTexto('.janela button', 'Sim, excluir');
  await esperarTexto('foi excluído');
  await pagina.waitForFunction(() => location.hash === '#/produtos');
  const cat = await (await fetch(`${BASE}/api/catalogo`)).json();
  assert.ok(!cat.produtos.some((p) => p.id === 'kit-presente-rosa'));
});

test('conta: histórico e sair', async () => {
  await pagina.click('a[href="#/conta"]');
  await esperarTexto('Últimas alterações');
  await esperarTexto('Excluiu "Kit Presente Rosa"');
  await capturar('11-conta');
  await clicarTexto('button', 'Sair deste aparelho');
  await pagina.waitForSelector('#form-entrar');
  assert.deepEqual(errosDoConsole.filter((e) => !/401|Failed to load resource/.test(e)), [], 'painel sem erros no console');
});
