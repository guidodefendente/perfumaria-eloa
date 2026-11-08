/**
 * Gera migrations/0002_catalogo_inicial.sql a partir de assets/js/products.js.
 *
 * Uso único, na migração do catálogo estático para o banco (D1). Depois que o
 * painel entra no ar, o banco passa a ser a fonte da verdade e products.js
 * deixa de ser editado — fica no repositório só como registro histórico e
 * como entrada deste script.
 *
 *   node scripts/gerar-seed.mjs
 *
 * O que preserva:
 *   - ids (URLs /produto/<id>/, carrinhos salvos no navegador e SEO);
 *   - ordem do catálogo e ordem das categorias;
 *   - destaques, na ordem em que aparecem hoje;
 *   - ficha (specs), perfil olfativo (fragrance) e público (audience);
 *   - dados da loja (STORE).
 * As fotos passam a apontar para as versões WebP geradas por
 * scripts/converter-imagens.py (o PNG original continua no repositório).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(resolve(RAIZ, 'assets/js/products.js'), 'utf8');
const { PRODUCTS, CATEGORIES, STORE } = new Function(`${src}\nreturn { PRODUCTS, CATEGORIES, STORE };`)();

const AGORA = Date.UTC(2026, 10, 8); // data fixa: o script é determinístico
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

const linhas = [
  '-- GERADO POR scripts/gerar-seed.mjs a partir de assets/js/products.js.',
  '-- Carga inicial: catálogo como estava publicado antes do painel.',
  '',
];

CATEGORIES.forEach((c, i) => {
  linhas.push(`INSERT INTO categorias (id, nome, icone, posicao, na_home, criado_em, atualizado_em) VALUES (${q(c.id)}, ${q(c.name)}, ${q(c.icon)}, ${i + 1}, 1, ${AGORA}, ${AGORA});`);
});
linhas.push('');

let destaque = 0;
PRODUCTS.forEach((p, i) => {
  const centavos = Math.round(p.price * 100);
  const ficha = p.specs && p.specs.length ? JSON.stringify(p.specs) : null;
  const frag = p.fragrance && Object.keys(p.fragrance).length ? JSON.stringify(p.fragrance) : null;
  const dpos = p.featured ? ++destaque : null;
  linhas.push(`INSERT INTO produtos (id, nome, marca, categoria_id, preco_centavos, descricao, publico, ficha_json, fragrancia_json, ativo, destaque_pos, posicao, criado_em, atualizado_em) VALUES (${q(p.id)}, ${q(p.name)}, ${q(p.brand)}, ${q(p.category)}, ${centavos}, ${q(p.description)}, ${q(p.audience || null)}, ${q(ficha)}, ${q(frag)}, 1, ${dpos ?? 'NULL'}, ${i + 1}, ${AGORA}, ${AGORA});`);

  const base = p.image.replace(/^assets\/img\/products\//, '').replace(/\.png$/, '');
  const grande = `/assets/img/products/w/${base}.webp`;
  const mini = `/assets/img/products/w/${base}-600.webp`;
  for (const f of [grande, mini]) {
    if (!existsSync(resolve(RAIZ, f.slice(1)))) throw new Error(`Falta ${f} — rode scripts/converter-imagens.py`);
  }
  linhas.push(`INSERT INTO fotos (id, produto_id, posicao, origem, src_grande, src_miniatura, largura, altura, bytes, criado_em) VALUES (${q(`legado-${p.id}`)}, ${q(p.id)}, 1, 'estatica', ${q(grande)}, ${q(mini)}, 1200, 1200, 0, ${AGORA});`);
});
linhas.push('');
linhas.push(`INSERT INTO configuracoes (chave, valor) VALUES ('loja', ${q(JSON.stringify(STORE))});`);
linhas.push('');

const destino = resolve(RAIZ, 'migrations/0002_catalogo_inicial.sql');
writeFileSync(destino, `${linhas.join('\n')}\n`);
console.log(`${CATEGORIES.length} categorias, ${PRODUCTS.length} produtos, ${destaque} destaques → ${destino}`);
