/**
 * Teste de ponta a ponta da API contra o Worker rodando localmente
 * (wrangler dev com D1/KV locais). Rode com: scripts/testar-local.sh
 *
 * Percorre o dia a dia do painel: primeiro acesso por e-mail, login,
 * bloqueio por tentativas, cadastro com fotos, edição, ocultar, destaques,
 * categorias, exclusão — e confere o reflexo de cada passo no site público.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto as crypto } from 'node:crypto';

const BASE = process.env.BASE || 'http://localhost:8787';
const DONO = 'dono@exemplo.com';
const IRMAO = 'irmao@exemplo.com';
const SENHA = 'perfume rosa na vitrine';

const b64 = (bytes) => Buffer.from(bytes).toString('base64url');
async function derivar(senha, sal, iteracoes) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: Buffer.from(sal, 'base64url'), iterations: iteracoes }, k, 256));
}

let cookie = '';
async function chamar(metodo, caminho, corpo, { semOrigem = false, form, comCookie = true } = {}) {
  const headers = {};
  if (!semOrigem) headers.origin = BASE;
  if (comCookie && cookie) headers.cookie = cookie;
  let body;
  if (form) body = form;
  else if (corpo !== undefined) { headers['content-type'] = 'application/json'; body = JSON.stringify(corpo); }
  const r = await fetch(`${BASE}${caminho}`, { method: metodo, headers, body, redirect: 'manual' });
  const setCookie = r.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const texto = await r.text();
  let dados = null;
  try { dados = JSON.parse(texto); } catch (_) { dados = texto; }
  return { status: r.status, dados, headers: r.headers };
}

async function ultimoLink(email) {
  const { dados } = await chamar('GET', '/api/dev/emails');
  const m = dados.emails.filter((e) => e.para === email).pop();
  return m && m.texto.match(/#\/redefinir\/([A-Za-z0-9_-]+)/)[1];
}

async function catalogoPublico() {
  const r = await fetch(`${BASE}/api/catalogo`);
  return r.json();
}

const fotoFalsa = (rotulo) => {
  // Cabeçalho WebP válido (RIFF....WEBP) + conteúdo qualquer.
  const corpo = new TextEncoder().encode(`VP8 ${rotulo}`.padEnd(64, '.'));
  const b = new Uint8Array(12 + corpo.length);
  b.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  b.set(corpo, 12);
  return new Blob([b], { type: 'image/webp' });
};
async function enviarFoto(rotulo) {
  const form = new FormData();
  form.append('grande', fotoFalsa(`${rotulo}-g`), 'g.webp');
  form.append('miniatura', fotoFalsa(`${rotulo}-m`), 'm.webp');
  form.append('largura', '1600');
  form.append('altura', '1600');
  return chamar('POST', '/api/admin/fotos', undefined, { form });
}

const novo = (fotos, extra = {}) => ({
  nome: 'Body Splash Teste', marca: 'Marca Teste', categoria: 'pele', preco: '29,90',
  descricao: 'Body splash de teste com fragrância suave, 200 ml.', fotos, ativo: true, destaque: false, ...extra,
});

let produtoId;
let fotoA;
let fotoB;

test('site público continua igual ao catálogo migrado', async () => {
  const cat = await catalogoPublico();
  assert.equal(cat.produtos.length, 67);
  assert.equal(cat.categorias.length, 7);
  assert.equal(cat.produtos.filter((p) => p.featured).length, 12);
  const js = await (await fetch(`${BASE}/assets/js/products.js`)).text();
  assert.match(js, /^\/\* Catálogo/);
  assert.match(js, /const PRODUCTS = \[/);
  const pagina = await fetch(`${BASE}/produto/arbo/`);
  assert.equal(pagina.status, 200);
  assert.equal((await fetch(`${BASE}/produto/arbo`, { redirect: 'manual' })).status, 301);
  assert.equal((await fetch(`${BASE}/produto/nao-existe/`)).status, 404);
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  assert.equal((sitemap.match(/<loc>/g) || []).length, 68);
});

test('painel exige login e bloqueia outro site (CSRF)', async () => {
  assert.equal((await chamar('GET', '/api/admin/catalogo')).status, 401);
  assert.equal((await chamar('POST', '/api/admin/produtos', {}, { semOrigem: true })).status, 403);
  const r = await chamar('GET', '/api/auth/sessao');
  assert.equal(r.dados.usuario, null);
});

test('e-mail desconhecido não é revelado', async () => {
  const a = await chamar('POST', '/api/auth/parametros', { email: 'estranho@exemplo.com' });
  const b = await chamar('POST', '/api/auth/parametros', { email: 'estranho@exemplo.com' });
  assert.equal(a.dados.sal, b.dados.sal, 'sal falso precisa ser estável');
  assert.equal(a.dados.iteracoes, 600000);
  const esq = await chamar('POST', '/api/auth/esqueci', { email: 'estranho@exemplo.com' });
  assert.equal(esq.status, 200);
  assert.equal(await ultimoLink('estranho@exemplo.com'), undefined, 'não envia e-mail para quem não tem acesso');
});

test('primeiro acesso: cria a senha pelo link do e-mail', async () => {
  assert.equal((await chamar('POST', '/api/auth/esqueci', { email: DONO })).status, 200);
  const token = await ultimoLink(DONO);
  assert.ok(token);

  const sal = b64(crypto.getRandomValues(new Uint8Array(16)));
  const fraca = await chamar('POST', '/api/auth/redefinir', { token, sal, iteracoes: 1000, chave: await derivar(SENHA, sal, 1000) });
  assert.equal(fraca.status, 400, 'recusa poucas iterações');

  const r = await chamar('POST', '/api/auth/redefinir', { token, sal, iteracoes: 600000, chave: await derivar(SENHA, sal, 600000) });
  assert.equal(r.status, 200);
  assert.match(r.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await chamar('GET', '/api/auth/sessao')).dados.usuario.email, DONO);

  const reuso = await chamar('POST', '/api/auth/redefinir', { token, sal, iteracoes: 600000, chave: await derivar(SENHA, sal, 600000) });
  assert.equal(reuso.status, 410, 'link só vale uma vez');
});

test('login: senha errada, senha certa e bloqueio após 5 erros', async () => {
  cookie = '';
  const { dados: p } = await chamar('POST', '/api/auth/parametros', { email: DONO });
  const errada = await chamar('POST', '/api/auth/entrar', { email: DONO, chave: await derivar('senha errada!!', p.sal, p.iteracoes) });
  assert.equal(errada.status, 401);
  const certa = await chamar('POST', '/api/auth/entrar', { email: DONO, chave: await derivar(SENHA, p.sal, p.iteracoes) });
  assert.equal(certa.status, 200);
  const sessaoDono = cookie;

  // Bloqueio no outro usuário (sem senha criada): 5 erros → 429.
  const chaveQualquer = b64(new Uint8Array(32));
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await chamar('POST', '/api/auth/entrar', { email: IRMAO, chave: chaveQualquer }, { comCookie: false })).status, 401);
  }
  assert.equal((await chamar('POST', '/api/auth/entrar', { email: IRMAO, chave: chaveQualquer }, { comCookie: false })).status, 429);
  cookie = sessaoDono;
});

test('fotos: envio, entrega com cache longo e recusa de formato errado', async () => {
  const a = await enviarFoto('a');
  assert.equal(a.status, 201, JSON.stringify(a.dados));
  fotoA = a.dados;
  fotoB = (await enviarFoto('b')).dados;
  const img = await fetch(`${BASE}${fotoA.src}`);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/webp');
  assert.match(img.headers.get('cache-control'), /immutable/);

  const form = new FormData();
  form.append('grande', new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5, 6, 7, 8, 9])]), 'x.png');
  form.append('miniatura', fotoFalsa('m'), 'm.webp');
  assert.equal((await chamar('POST', '/api/admin/fotos', undefined, { form })).status, 415);
});

test('cadastrar produto: validação e publicação imediata no site', async () => {
  const ruim = await chamar('POST', '/api/admin/produtos', novo([fotoA.id], { preco: 'abc', nome: '' }));
  assert.equal(ruim.status, 422);
  assert.ok(ruim.dados.campos.preco && ruim.dados.campos.nome);

  const r = await chamar('POST', '/api/admin/produtos', novo([fotoA.id, fotoB.id]));
  assert.equal(r.status, 201, JSON.stringify(r.dados));
  produtoId = r.dados.id;
  assert.equal(produtoId, 'body-splash-teste');

  const cat = await catalogoPublico();
  const p = cat.produtos.find((x) => x.id === produtoId);
  assert.ok(p, 'aparece no site na hora');
  assert.equal(p.price, 29.9);
  assert.equal(p.images.length, 2);
  assert.equal(p.image, fotoA.src);
  assert.equal((await fetch(`${BASE}/produto/${produtoId}/`)).status, 200);
  assert.match(await (await fetch(`${BASE}/sitemap.xml`)).text(), new RegExp(`/produto/${produtoId}/`));

  const dup = await chamar('POST', '/api/admin/produtos', novo([fotoA.id]));
  assert.equal(dup.status, 422, 'foto de outro produto não pode ser reaproveitada');
});

test('editar: preço, ordem das fotos e foto principal', async () => {
  const r = await chamar('PUT', `/api/admin/produtos/${produtoId}`, novo([fotoB.id, fotoA.id], { preco: '34,50' }));
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  const p = (await catalogoPublico()).produtos.find((x) => x.id === produtoId);
  assert.equal(p.price, 34.5);
  assert.equal(p.image, fotoB.src, 'nova foto principal');
});

test('ocultar e mostrar de novo', async () => {
  assert.equal((await chamar('PUT', `/api/admin/produtos/${produtoId}/ativo`, { ativo: false })).status, 200);
  assert.ok(!(await catalogoPublico()).produtos.some((x) => x.id === produtoId));
  assert.equal((await fetch(`${BASE}/produto/${produtoId}/`)).status, 404);
  const painel = await chamar('GET', '/api/admin/catalogo');
  assert.equal(painel.dados.produtos.find((x) => x.id === produtoId).ativo, false, 'continua no painel');
  await chamar('PUT', `/api/admin/produtos/${produtoId}/ativo`, { ativo: true });
  assert.ok((await catalogoPublico()).produtos.some((x) => x.id === produtoId));
});

test('página inicial: ordem dos destaques e categorias visíveis', async () => {
  const { dados } = await chamar('GET', '/api/admin/catalogo');
  const cats = dados.categorias.map((c) => ({ id: c.id, naHome: c.id !== 'unhas' })).reverse();
  const r = await chamar('PUT', '/api/admin/pagina-inicial', { destaques: [produtoId, 'arbo'], categorias: cats });
  assert.equal(r.status, 200, JSON.stringify(r.dados));
  const pub = await catalogoPublico();
  const dest = pub.produtos.filter((p) => p.featured).sort((a, b) => a.featuredOrder - b.featuredOrder).map((p) => p.id);
  assert.deepEqual(dest, [produtoId, 'arbo']);
  assert.equal(pub.categorias[0].id, 'unhas', 'ordem invertida');
  assert.equal(pub.categorias.find((c) => c.id === 'unhas').home, false);
  const invalida = await chamar('PUT', '/api/admin/pagina-inicial', { destaques: ['nao-existe'], categorias: cats });
  assert.equal(invalida.status, 409);
});

test('categorias: criar, renomear, impedir exclusão com produtos, excluir vazia', async () => {
  const c = await chamar('POST', '/api/admin/categorias', { nome: 'Presentes', icone: 'sparkle', naHome: true });
  assert.equal(c.status, 201);
  assert.equal(c.dados.id, 'presentes');
  assert.equal((await chamar('POST', '/api/admin/categorias', { nome: 'presentes' })).status, 422, 'nome repetido');
  assert.equal((await chamar('PUT', '/api/admin/categorias/presentes', { nome: 'Kits e presentes', icone: 'sparkle', naHome: false })).status, 200);
  assert.equal((await chamar('DELETE', '/api/admin/categorias/pele')).status, 409);
  assert.equal((await chamar('DELETE', '/api/admin/categorias/presentes')).status, 200);
});

test('excluir produto: some do site e as fotos ficam para a limpeza', async () => {
  assert.equal((await chamar('DELETE', `/api/admin/produtos/${produtoId}`)).status, 200);
  assert.ok(!(await catalogoPublico()).produtos.some((x) => x.id === produtoId));
  assert.equal((await chamar('DELETE', `/api/admin/produtos/${produtoId}`)).status, 404);
  const hist = await chamar('GET', '/api/admin/historico');
  assert.ok(hist.dados.itens.some((h) => h.acao === 'produto.excluir'));
  assert.equal(hist.dados.itens[0].usuario, DONO);
});

test('sair encerra a sessão', async () => {
  assert.equal((await chamar('POST', '/api/auth/sair', { todas: true })).status, 200);
  assert.equal((await chamar('GET', '/api/admin/catalogo')).status, 401);
});
