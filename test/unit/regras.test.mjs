import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarSlug, precoEmCentavos, validarProduto, validarCategoria, validarEmail, validarOrdem } from '../../painel/validacao.js';
import { paraBase64Url, deBase64Url, iguais, verificadorDe, salFalso } from '../../src/lib/cripto.js';
import { formatoDe } from '../../src/lib/formato.js';

const valido = {
  nome: 'Malbec Eau de Parfum', marca: 'O Boticário', categoria: 'perfumes', preco: '219,90',
  descricao: 'Perfume masculino amadeirado de 100 ml.', fotos: ['fabc'],
};

test('slug: acentos, & e espaços viram um endereço limpo', () => {
  assert.equal(gerarSlug('Pó Iluminador — Amor & Anjo'), 'po-iluminador-amor-e-anjo');
  assert.equal(gerarSlug('  VIP Seasons  Pour Femme '), 'vip-seasons-pour-femme');
  assert.equal(gerarSlug('Pompom💖'), 'pompom');
  assert.ok(gerarSlug('x'.repeat(200)).length <= 70);
});

test('preço: formatos brasileiros e números', () => {
  assert.equal(precoEmCentavos('12,90'), 1290);
  assert.equal(precoEmCentavos('R$ 1.234,50'), 123450);
  assert.equal(precoEmCentavos('80'), 8000);
  assert.equal(precoEmCentavos(19.9), 1990);
  assert.ok(Number.isNaN(precoEmCentavos('doze')));
  assert.ok(Number.isNaN(precoEmCentavos('12,999')));
  assert.ok(Number.isNaN(precoEmCentavos('')));
});

test('produto válido é normalizado', () => {
  const r = validarProduto({ ...valido, nome: '  Malbec   Eau de Parfum ', ficha: [{ label: 'Volume', value: '100 ml' }, { label: '', value: '' }] }, ['perfumes']);
  assert.equal(r.ok, true);
  assert.equal(r.produto.nome, 'Malbec Eau de Parfum');
  assert.equal(r.produto.centavos, 21990);
  assert.deepEqual(r.produto.ficha, [{ label: 'Volume', value: '100 ml' }]);
  assert.equal(r.produto.ativo, true);
});

test('produto inválido devolve mensagens por campo', () => {
  const r = validarProduto({ nome: 'A', marca: '', categoria: 'nao-existe', preco: '0', descricao: 'curta', fotos: [] }, ['perfumes']);
  assert.equal(r.ok, false);
  for (const campo of ['nome', 'marca', 'categoria', 'preco', 'descricao', 'fotos']) assert.ok(r.campos[campo], campo);
});

test('produto: limites de fotos, ficha e público', () => {
  assert.ok(validarProduto({ ...valido, fotos: Array.from({ length: 9 }, (_, i) => `f${i}`) }, ['perfumes']).campos.fotos);
  assert.ok(validarProduto({ ...valido, fotos: ['a', 'a'] }, ['perfumes']).campos.fotos);
  assert.ok(validarProduto({ ...valido, ficha: [{ label: 'Volume', value: '' }] }, ['perfumes']).campos.ficha);
  assert.ok(validarProduto({ ...valido, publico: 'infantil' }, ['perfumes']).campos.publico);
  const f = validarProduto({ ...valido, fragrancia: { familia: 'Amadeirado', inventado: 'x', saida: '  ' } }, ['perfumes']);
  assert.deepEqual(f.produto.fragrancia, { familia: 'Amadeirado' });
});

test('categoria, e-mail e ordem', () => {
  assert.equal(validarCategoria({ nome: 'Presentes' }).categoria.icone, 'sparkle');
  assert.ok(validarCategoria({ nome: 'Presentes', icone: 'foguete' }).campos.icone);
  assert.equal(validarEmail(' Fulano@Exemplo.com '), 'fulano@exemplo.com');
  assert.equal(validarEmail('sem-arroba'), null);
  assert.equal(validarOrdem(['a', 'b'], new Set(['a', 'b'])), null);
  assert.ok(validarOrdem(['a', 'a'], new Set(['a'])));
  assert.ok(validarOrdem(['z'], new Set(['a'])));
});

test('base64url e comparação em tempo constante', () => {
  const bytes = new Uint8Array([0, 255, 62, 63, 1, 2]);
  assert.deepEqual(deBase64Url(paraBase64Url(bytes)), bytes);
  assert.equal(deBase64Url('com espaço'), null);
  assert.equal(iguais('abc', 'abc'), true);
  assert.equal(iguais('abc', 'abd'), false);
  assert.equal(iguais('abc', 'abcd'), false);
});

test('verificador depende do pepper; sal falso é estável', async () => {
  const pepper = 'p'.repeat(40);
  const chave = new Uint8Array(32).fill(7);
  const v1 = await verificadorDe(pepper, chave);
  assert.equal(v1, await verificadorDe(pepper, chave));
  assert.notEqual(v1, await verificadorDe('q'.repeat(40), chave));
  assert.equal(await salFalso(pepper, 'a@b.com'), await salFalso(pepper, 'a@b.com'));
  assert.notEqual(await salFalso(pepper, 'a@b.com'), await salFalso(pepper, 'c@b.com'));
  await assert.rejects(() => verificadorDe('curto', chave));
});

test('formato da imagem pelos bytes, não pelo nome', () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]);
  assert.equal(formatoDe(webp), 'image/webp');
  assert.equal(formatoDe(jpg), 'image/jpeg');
  assert.equal(formatoDe(png), null);
});
