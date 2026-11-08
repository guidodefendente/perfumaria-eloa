import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRenderizador } from '../../src/render/paginas.js';

const catalogo = {
  categorias: [{ id: 'perfumes', name: 'Perfumes', icon: 'bottle', home: true }],
  produtos: [
    {
      id: 'arbo', name: 'Arbo Desodorante Colônia', brand: 'O Boticário', category: 'perfumes', price: 159.9,
      description: 'Frescor de montanha <com> "aspas".', image: '/img/f/a-g.webp', thumb: '/img/f/a-m.webp',
      images: [{ src: '/img/f/a-g.webp', thumb: '/img/f/a-m.webp' }, { src: '/img/f/b-g.webp', thumb: '/img/f/b-m.webp' }],
      featured: true, featuredOrder: 1, audience: 'masculino',
    },
    { id: 'outro', name: 'Outro', brand: 'X', category: 'perfumes', price: 10, description: 'Outro produto qualquer.', image: '/x.webp', thumb: '/x-600.webp', images: [{ src: '/x.webp', thumb: '/x-600.webp' }] },
  ],
  loja: { address: 'Rua Nascer do Sol, 243', city: 'Cidade Tiradentes — São Paulo/SP', hours: '9h–18h', shipping: 'Frete no WhatsApp.', whatsappDisplay: '(11) 9', whatsappNumber: '5511' },
};

test('página do produto: SEO, dados estruturados, galeria e escape', () => {
  const r = criarRenderizador(catalogo, 'https://perfumariaeloa.com.br', '2026-11-08');
  const html = r.paginaProduto(r.getProduct('arbo'));
  assert.match(html, /<link rel="canonical" href="https:\/\/perfumariaeloa\.com\.br\/produto\/arbo\/">/);
  assert.match(html, /og:image" content="https:\/\/perfumariaeloa\.com\.br\/img\/f\/a-g\.webp"/);
  assert.match(html, /data-galeria/);
  assert.match(html, /foto 2 de 2/);
  assert.ok(!html.includes('<com>'), 'descrição precisa ser escapada');
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/)[1]);
  const produto = ld['@graph'].find((n) => n['@type'] === 'Product');
  assert.equal(produto.offers.price, '159.90');
  assert.equal(produto.image.length, 2);
  assert.ok(!('availability' in produto.offers), 'não promete estoque');
});

test('sitemap: home + um URL por produto', () => {
  const r = criarRenderizador(catalogo, 'https://perfumariaeloa.com.br', '2026-11-08');
  const xml = r.sitemap();
  assert.equal((xml.match(/<loc>/g) || []).length, 3);
  assert.match(xml, /<lastmod>2026-11-08<\/lastmod>/);
});
