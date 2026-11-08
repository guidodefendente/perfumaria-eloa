/**
 * Catálogo: leitura, alterações do painel e publicação para o site.
 *
 * Publicação: a cada alteração o catálogo ativo é remontado e gravado pronto
 * na tabela `publicacao` (1 linha). O site lê essa linha — 1 leitura no banco
 * por visita, em vez de remontar 67+ produtos e fotos toda vez. Isso mantém o
 * uso muito abaixo da franquia gratuita do D1 (5 milhões de linhas/dia).
 */
import { ErroHttp } from './http.js';
import { gerarSlug, validarProduto, validarCategoria, validarOrdem, MAX_FOTOS } from '../../painel/validacao.js';

const agora = () => Date.now();
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch (_) { return null; } };

// ── Leitura ───────────────────────────────────────────────────────────────
async function lerTudo(env) {
  const [cats, prods, fotos, loja] = await env.DB.batch([
    env.DB.prepare('SELECT * FROM categorias ORDER BY posicao, nome'),
    env.DB.prepare(`SELECT p.* FROM produtos p JOIN categorias c ON c.id = p.categoria_id
                    ORDER BY c.posicao, p.posicao, p.nome`),
    env.DB.prepare('SELECT id, produto_id, posicao, origem, src_grande, src_miniatura FROM fotos WHERE produto_id IS NOT NULL ORDER BY produto_id, posicao'),
    env.DB.prepare("SELECT valor FROM configuracoes WHERE chave = 'loja'"),
  ]);
  const fotosPor = new Map();
  for (const f of fotos.results) {
    if (!fotosPor.has(f.produto_id)) fotosPor.set(f.produto_id, []);
    fotosPor.get(f.produto_id).push(f);
  }
  return {
    categorias: cats.results,
    produtos: prods.results,
    fotosPor,
    loja: parse(loja.results[0] && loja.results[0].valor) || {},
  };
}

/** Produto no formato que o site (app.js) já usa — campos em inglês, preço em reais. */
function paraSite(p, fotos) {
  const imagens = fotos.map((f) => ({ src: f.src_grande, thumb: f.src_miniatura }));
  const out = {
    id: p.id,
    name: p.nome,
    brand: p.marca,
    category: p.categoria_id,
    price: p.preco_centavos / 100,
    description: p.descricao,
    image: imagens[0].src,
    thumb: imagens[0].thumb,
    images: imagens,
  };
  if (p.publico) out.audience = p.publico;
  const ficha = parse(p.ficha_json);
  if (ficha && ficha.length) out.specs = ficha;
  const frag = parse(p.fragrancia_json);
  if (frag && Object.keys(frag).length) out.fragrance = frag;
  if (p.destaque_pos !== null && p.destaque_pos !== undefined) {
    out.featured = true;
    out.featuredOrder = p.destaque_pos;
  }
  return out;
}

/** Monta e grava o catálogo publicado. Chamado depois de toda alteração. */
export async function publicar(env) {
  const { categorias, produtos, fotosPor, loja } = await lerTudo(env);
  const site = {
    categorias: categorias.map((c) => ({ id: c.id, name: c.nome, icon: c.icone, home: c.na_home === 1 })),
    // Produto sem foto não vai para o site (o painel já impede, isto é defesa extra).
    produtos: produtos.filter((p) => p.ativo === 1 && fotosPor.has(p.id)).map((p) => paraSite(p, fotosPor.get(p.id))),
    loja,
  };
  const anterior = await env.DB.prepare('SELECT versao FROM publicacao WHERE id = 1').first();
  const versao = (anterior ? anterior.versao : 0) + 1;
  const json = JSON.stringify({ versao, ...site });
  const script = [
    '/* Catálogo da Perfumaria Eloá — gerado automaticamente pelo painel. */',
    `const CATALOG_VERSION = ${versao};`,
    `const CATEGORIES = ${JSON.stringify(site.categorias)};`,
    `const PRODUCTS = ${JSON.stringify(site.produtos)};`,
    `const STORE = ${JSON.stringify(site.loja)};`,
    '',
  ].join('\n');
  await env.DB.prepare(`INSERT INTO publicacao (id, versao, json, script, gerado_em) VALUES (1, ?1, ?2, ?3, ?4)
      ON CONFLICT(id) DO UPDATE SET versao = ?1, json = ?2, script = ?3, gerado_em = ?4`)
    .bind(versao, json, script, agora()).run();
  return { versao, json, script };
}

/** Catálogo publicado (1 leitura). Monta na hora se ainda não existir. */
export async function publicado(env) {
  const r = await env.DB.prepare('SELECT versao, json, script FROM publicacao WHERE id = 1').first();
  return r || publicar(env);
}

/** Visão completa para o painel — inclui ocultos, fotos com id e posições. */
export async function catalogoDoPainel(env) {
  const { categorias, produtos, fotosPor } = await lerTudo(env);
  const total = new Map();
  for (const p of produtos) total.set(p.categoria_id, (total.get(p.categoria_id) || 0) + 1);
  return {
    categorias: categorias.map((c) => ({
      id: c.id, nome: c.nome, icone: c.icone, posicao: c.posicao, naHome: c.na_home === 1, produtos: total.get(c.id) || 0,
    })),
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      marca: p.marca,
      categoria: p.categoria_id,
      preco: p.preco_centavos / 100,
      descricao: p.descricao,
      publico: p.publico,
      ficha: parse(p.ficha_json) || [],
      fragrancia: parse(p.fragrancia_json) || {},
      ativo: p.ativo === 1,
      destaque: p.destaque_pos !== null,
      destaquePos: p.destaque_pos,
      atualizadoEm: p.atualizado_em,
      fotos: (fotosPor.get(p.id) || []).map((f) => ({ id: f.id, src: f.src_grande, thumb: f.src_miniatura })),
    })),
  };
}

// ── Histórico ─────────────────────────────────────────────────────────────
const registro = (env, usuario, acao, resumo) =>
  env.DB.prepare('INSERT INTO historico (em, usuario, acao, resumo) VALUES (?1, ?2, ?3, ?4)')
    .bind(agora(), usuario.email, acao, resumo.slice(0, 300));

export async function historicoRecente(env, limite = 30) {
  const r = await env.DB.prepare('SELECT em, usuario, acao, resumo FROM historico ORDER BY em DESC LIMIT ?1').bind(limite).all();
  return r.results;
}

// ── Produtos ──────────────────────────────────────────────────────────────
async function idsCategorias(env) {
  const r = await env.DB.prepare('SELECT id FROM categorias').all();
  return r.results.map((c) => c.id);
}

async function slugLivre(env, tabela, base) {
  const raiz = base || 'item';
  const usados = new Set((await env.DB.prepare(`SELECT id FROM ${tabela} WHERE id = ?1 OR id LIKE ?2`)
    .bind(raiz, `${raiz}-%`).all()).results.map((r) => r.id));
  if (!usados.has(raiz)) return raiz;
  for (let n = 2; n < 1000; n += 1) if (!usados.has(`${raiz}-${n}`)) return `${raiz}-${n}`;
  throw new ErroHttp(409, 'Não foi possível gerar um endereço para este item.');
}

function falhaDeValidacao(campos) {
  return new ErroHttp(422, 'Confira os campos destacados.', { campos });
}

/** Confere que as fotos existem e estão livres (ou já são deste produto). */
async function conferirFotos(env, fotos, produtoId) {
  const marcadores = fotos.map((_, i) => `?${i + 1}`).join(',');
  const r = await env.DB.prepare(`SELECT id, produto_id FROM fotos WHERE id IN (${marcadores})`).bind(...fotos).all();
  if (r.results.length !== fotos.length) {
    throw falhaDeValidacao({ fotos: 'Uma das fotos não foi encontrada. Envie a foto de novo.' });
  }
  if (r.results.some((f) => f.produto_id && f.produto_id !== produtoId)) {
    throw falhaDeValidacao({ fotos: 'Uma das fotos pertence a outro produto.' });
  }
}

function instrucoesDeFotos(env, produtoId, fotos) {
  const t = agora();
  const marcadores = fotos.map((_, i) => `?${i + 3}`).join(',');
  return [
    // Fotos que saíram do produto ficam órfãs (limpeza em 7 dias).
    env.DB.prepare(`UPDATE fotos SET produto_id = NULL, solta_em = ?2 WHERE produto_id = ?1 AND id NOT IN (${marcadores})`)
      .bind(produtoId, t, ...fotos),
    ...fotos.map((id, i) => env.DB.prepare(
      'UPDATE fotos SET produto_id = ?1, posicao = ?2, solta_em = NULL WHERE id = ?3 AND (produto_id IS NULL OR produto_id = ?1)',
    ).bind(produtoId, i + 1, id)),
  ];
}

/**
 * Regra dos destaques: o produto em destaque que acabou de ser cadastrado ou
 * salvo vai para o 1º lugar, e os outros descem uma posição. Assim a página
 * inicial mostra primeiro os destaques alterados mais recentemente. A ordem
 * ainda pode ser ajustada à mão em "Página inicial".
 * (O produto recebe destaque_pos = 0 antes destas instruções.)
 */
function subirParaPrimeiroDestaque(env, id) {
  return [
    env.DB.prepare('UPDATE produtos SET destaque_pos = destaque_pos + 1 WHERE destaque_pos IS NOT NULL AND id <> ?1').bind(id),
    env.DB.prepare('UPDATE produtos SET destaque_pos = 1 WHERE id = ?1').bind(id),
  ];
}

const brl = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export async function criarProduto(env, usuario, dados) {
  const v = validarProduto(dados, await idsCategorias(env));
  if (!v.ok) throw falhaDeValidacao(v.campos);
  const p = v.produto;
  await conferirFotos(env, p.fotos, null);

  let base = gerarSlug(p.nome);
  const existe = await env.DB.prepare('SELECT 1 FROM produtos WHERE id = ?1').bind(base).first();
  if (existe) base = gerarSlug(`${p.nome} ${p.marca}`);
  const id = await slugLivre(env, 'produtos', base);

  const t = agora();
  const max = await env.DB.prepare('SELECT COALESCE(MAX(posicao), 0) AS pos FROM produtos WHERE categoria_id = ?1').bind(p.categoria).first();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO produtos (id, nome, marca, categoria_id, preco_centavos, descricao, publico, ficha_json,
        fragrancia_json, ativo, destaque_pos, posicao, criado_em, atualizado_em)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13)`)
      .bind(id, p.nome, p.marca, p.categoria, p.centavos, p.descricao, p.publico,
        p.ficha && JSON.stringify(p.ficha), p.fragrancia && JSON.stringify(p.fragrancia),
        p.ativo ? 1 : 0, p.destaque ? 0 : null, max.pos + 1, t),
    ...instrucoesDeFotos(env, id, p.fotos),
    ...(p.destaque ? subirParaPrimeiroDestaque(env, id) : []),
    registro(env, usuario, 'produto.criar', `Cadastrou "${p.nome}" (${p.marca}) por ${brl(p.centavos)}${p.ativo ? '' : ' — oculto'}`),
  ]);
  await publicar(env);
  return id;
}

export async function atualizarProduto(env, usuario, id, dados) {
  const atual = await env.DB.prepare('SELECT * FROM produtos WHERE id = ?1').bind(id).first();
  if (!atual) throw new ErroHttp(404, 'Este produto não existe mais. Ele pode ter sido excluído.');
  const v = validarProduto(dados, await idsCategorias(env));
  if (!v.ok) throw falhaDeValidacao(v.campos);
  const p = v.produto;
  await conferirFotos(env, p.fotos, id);

  const destaquePos = p.destaque ? 0 : null;

  const mudancas = [];
  if (atual.preco_centavos !== p.centavos) mudancas.push(`preço ${brl(atual.preco_centavos)} → ${brl(p.centavos)}`);
  if (atual.nome !== p.nome) mudancas.push(`nome "${atual.nome}" → "${p.nome}"`);
  if ((atual.ativo === 1) !== p.ativo) mudancas.push(p.ativo ? 'voltou ao site' : 'ocultado do site');

  await env.DB.batch([
    env.DB.prepare(`UPDATE produtos SET nome = ?2, marca = ?3, categoria_id = ?4, preco_centavos = ?5, descricao = ?6,
        publico = ?7, ficha_json = ?8, fragrancia_json = ?9, ativo = ?10, destaque_pos = ?11, atualizado_em = ?12 WHERE id = ?1`)
      .bind(id, p.nome, p.marca, p.categoria, p.centavos, p.descricao, p.publico,
        p.ficha && JSON.stringify(p.ficha), p.fragrancia && JSON.stringify(p.fragrancia),
        p.ativo ? 1 : 0, destaquePos, agora()),
    ...instrucoesDeFotos(env, id, p.fotos),
    ...(p.destaque ? subirParaPrimeiroDestaque(env, id) : []),
    registro(env, usuario, 'produto.editar', `Editou "${p.nome}"${mudancas.length ? `: ${mudancas.join('; ')}` : ''}`),
  ]);
  await publicar(env);
}

export async function definirAtivo(env, usuario, id, ativo) {
  const atual = await env.DB.prepare('SELECT nome FROM produtos WHERE id = ?1').bind(id).first();
  if (!atual) throw new ErroHttp(404, 'Este produto não existe mais.');
  await env.DB.batch([
    env.DB.prepare('UPDATE produtos SET ativo = ?2, atualizado_em = ?3 WHERE id = ?1').bind(id, ativo ? 1 : 0, agora()),
    registro(env, usuario, ativo ? 'produto.mostrar' : 'produto.ocultar', `${ativo ? 'Mostrou' : 'Ocultou'} "${atual.nome}" ${ativo ? 'no' : 'do'} site`),
  ]);
  await publicar(env);
}

export async function excluirProduto(env, usuario, id) {
  const atual = await env.DB.prepare('SELECT nome, marca FROM produtos WHERE id = ?1').bind(id).first();
  if (!atual) throw new ErroHttp(404, 'Este produto já foi excluído.');
  await env.DB.batch([
    env.DB.prepare('UPDATE fotos SET produto_id = NULL, solta_em = ?2 WHERE produto_id = ?1').bind(id, agora()),
    env.DB.prepare('DELETE FROM produtos WHERE id = ?1').bind(id),
    registro(env, usuario, 'produto.excluir', `Excluiu "${atual.nome}" (${atual.marca})`),
  ]);
  await publicar(env);
}

// ── Categorias ────────────────────────────────────────────────────────────
export async function criarCategoria(env, usuario, dados) {
  const v = validarCategoria(dados);
  if (!v.ok) throw falhaDeValidacao(v.campos);
  const c = v.categoria;
  const mesmoNome = await env.DB.prepare('SELECT 1 FROM categorias WHERE nome = ?1 COLLATE NOCASE').bind(c.nome).first();
  if (mesmoNome) throw falhaDeValidacao({ nome: 'Já existe uma categoria com esse nome.' });
  const id = await slugLivre(env, 'categorias', gerarSlug(c.nome));
  const t = agora();
  const m = await env.DB.prepare('SELECT COALESCE(MAX(posicao), 0) AS m FROM categorias').first();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO categorias (id, nome, icone, posicao, na_home, criado_em, atualizado_em) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)')
      .bind(id, c.nome, c.icone, m.m + 1, c.naHome ? 1 : 0, t),
    registro(env, usuario, 'categoria.criar', `Criou a categoria "${c.nome}"`),
  ]);
  await publicar(env);
  return id;
}

export async function atualizarCategoria(env, usuario, id, dados) {
  const atual = await env.DB.prepare('SELECT nome FROM categorias WHERE id = ?1').bind(id).first();
  if (!atual) throw new ErroHttp(404, 'Esta categoria não existe mais.');
  const v = validarCategoria(dados);
  if (!v.ok) throw falhaDeValidacao(v.campos);
  const c = v.categoria;
  const mesmoNome = await env.DB.prepare('SELECT 1 FROM categorias WHERE nome = ?1 COLLATE NOCASE AND id <> ?2').bind(c.nome, id).first();
  if (mesmoNome) throw falhaDeValidacao({ nome: 'Já existe uma categoria com esse nome.' });
  await env.DB.batch([
    env.DB.prepare('UPDATE categorias SET nome = ?2, icone = ?3, na_home = ?4, atualizado_em = ?5 WHERE id = ?1')
      .bind(id, c.nome, c.icone, c.naHome ? 1 : 0, agora()),
    registro(env, usuario, 'categoria.editar', atual.nome === c.nome ? `Editou a categoria "${c.nome}"` : `Renomeou a categoria "${atual.nome}" para "${c.nome}"`),
  ]);
  await publicar(env);
}

export async function excluirCategoria(env, usuario, id) {
  const atual = await env.DB.prepare('SELECT nome, (SELECT COUNT(*) FROM produtos WHERE categoria_id = ?1) AS total FROM categorias WHERE id = ?1').bind(id).first();
  if (!atual) throw new ErroHttp(404, 'Esta categoria já foi excluída.');
  if (atual.total > 0) {
    throw new ErroHttp(409, `A categoria "${atual.nome}" ainda tem ${atual.total} ${atual.total === 1 ? 'produto' : 'produtos'}. Mude esses produtos de categoria (ou exclua-os) antes de excluir a categoria.`);
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM categorias WHERE id = ?1').bind(id),
    registro(env, usuario, 'categoria.excluir', `Excluiu a categoria "${atual.nome}"`),
  ]);
  await publicar(env);
}

/**
 * Página inicial: ordem e visibilidade das categorias + lista ordenada de destaques.
 * dados = { categorias: [{ id, naHome }...] na ordem desejada, destaques: [idProduto...] na ordem }
 */
export async function salvarPaginaInicial(env, usuario, dados) {
  const cats = (await env.DB.prepare('SELECT id FROM categorias').all()).results.map((r) => r.id);
  const prods = (await env.DB.prepare('SELECT id FROM produtos').all()).results.map((r) => r.id);
  const listaCats = Array.isArray(dados.categorias) ? dados.categorias : null;
  const destaques = Array.isArray(dados.destaques) ? dados.destaques : null;
  if (!listaCats || !destaques) throw new ErroHttp(400, 'Dados da página inicial inválidos.');

  const idsCats = listaCats.map((c) => c && c.id);
  const erroCats = validarOrdem(idsCats, new Set(cats), 'categorias');
  if (erroCats) throw new ErroHttp(409, erroCats);
  if (idsCats.length !== cats.length) throw new ErroHttp(409, 'A lista de categorias mudou. Recarregue a página.');
  const erroDest = validarOrdem(destaques, new Set(prods), 'produtos');
  if (erroDest) throw new ErroHttp(409, erroDest);
  if (destaques.length > 24) throw new ErroHttp(422, 'Escolha no máximo 24 destaques.');

  const t = agora();
  const marcadores = destaques.map((_, i) => `?${i + 1}`).join(',');
  await env.DB.batch([
    ...listaCats.map((c, i) => env.DB.prepare('UPDATE categorias SET posicao = ?2, na_home = ?3, atualizado_em = ?4 WHERE id = ?1')
      .bind(c.id, i + 1, c.naHome ? 1 : 0, t)),
    destaques.length
      ? env.DB.prepare(`UPDATE produtos SET destaque_pos = NULL WHERE destaque_pos IS NOT NULL AND id NOT IN (${marcadores})`).bind(...destaques)
      : env.DB.prepare('UPDATE produtos SET destaque_pos = NULL WHERE destaque_pos IS NOT NULL'),
    ...destaques.map((id, i) => env.DB.prepare('UPDATE produtos SET destaque_pos = ?2 WHERE id = ?1').bind(id, i + 1)),
    registro(env, usuario, 'home.salvar', `Atualizou a página inicial: ${destaques.length} destaques, ${listaCats.filter((c) => c.naHome).length} categorias visíveis`),
  ]);
  await publicar(env);
}

export async function ordenarCategorias(env, usuario, ids) {
  const cats = (await env.DB.prepare('SELECT id FROM categorias').all()).results.map((r) => r.id);
  const erro = validarOrdem(ids, new Set(cats), 'categorias');
  if (erro) throw new ErroHttp(409, erro);
  if (ids.length !== cats.length) throw new ErroHttp(409, 'A lista de categorias mudou. Recarregue a página.');
  const t = agora();
  await env.DB.batch([
    ...ids.map((id, i) => env.DB.prepare('UPDATE categorias SET posicao = ?2, atualizado_em = ?3 WHERE id = ?1').bind(id, i + 1, t)),
    registro(env, usuario, 'categoria.ordenar', 'Mudou a ordem das categorias'),
  ]);
  await publicar(env);
}

export { MAX_FOTOS };
