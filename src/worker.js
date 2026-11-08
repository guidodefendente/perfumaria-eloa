/**
 * Worker da Perfumaria Eloá.
 *
 * Só passam por aqui as rotas listadas em `assets.run_worker_first`
 * (wrangler.jsonc). Todo o resto (HTML, CSS, fontes, painel) é servido como
 * arquivo estático — grátis e sem contar no limite diário do plano Free.
 *
 *   /assets/js/products.js   catálogo publicado (o mesmo formato que app.js sempre usou)
 *   /api/catalogo            catálogo publicado em JSON
 *   /produto/<id>/           página do produto com SEO (gerada na hora)
 *   /sitemap.xml             sitemap (gerado na hora)
 *   /img/f/...               fotos enviadas pelo painel
 *   /api/auth/*              login, recuperação e troca de senha
 *   /api/admin/*             painel (exige sessão)
 *   /admin/*                 painel antigo → redireciona para /painel/
 */
import { ErroHttp, json, html, lerJson, respostaDeErro, exigirMesmaOrigem } from './lib/http.js';
import * as auth from './lib/auth.js';
import * as cat from './lib/catalogo.js';
import { receberFoto, servirFoto, limpeza, usoDeFotos } from './lib/fotos.js';
import { ultimosEmailsDeTeste } from './lib/email.js';
import { criarRenderizador } from './render/paginas.js';
import { pagina404 } from './render/nao-encontrado.js';

const SEM_CACHE = { 'cache-control': 'no-cache' };

async function catalogoPublico(env, request, tipo) {
  const pub = await cat.publicado(env);
  const etag = `"v${pub.versao}"`;
  const cabecalhos = {
    etag,
    // no-cache = o navegador sempre confere a versão (resposta 304 é leve).
    // Assim uma mudança no painel aparece no site no próximo carregamento.
    'cache-control': 'no-cache',
    'content-type': tipo === 'script' ? 'text/javascript; charset=utf-8' : 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
  };
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: cabecalhos });
  return new Response(tipo === 'script' ? pub.script : pub.json, { headers: cabecalhos });
}

async function renderizador(env) {
  const pub = await cat.publicado(env);
  const site = JSON.parse(pub.json);
  return criarRenderizador({ produtos: site.produtos, categorias: site.categorias, loja: site.loja }, env.SITE_URL);
}

async function paginaDeProduto(env, request, id) {
  const r = await renderizador(env);
  const p = r.getProduct(id);
  if (!p) return html(pagina404(), 404, { ...SEM_CACHE, 'x-robots-tag': 'noindex' });
  if (request.method === 'HEAD') return html('', 200, SEM_CACHE);
  return html(r.paginaProduto(p), 200, SEM_CACHE);
}

// ── API do painel ─────────────────────────────────────────────────────────
async function apiAuth(env, request, caminho) {
  exigirMesmaOrigem(request);
  const m = request.method;
  if (caminho === 'sessao' && m === 'GET') {
    const u = await auth.usuarioDaSessao(env, request);
    return json({ usuario: u ? { email: u.email, nome: u.nome } : null });
  }
  if (caminho === 'parametros' && m === 'POST') return json(await auth.parametrosDeLogin(env, await lerJson(request)));
  if (caminho === 'entrar' && m === 'POST') {
    const cookie = await auth.entrar(env, request, await lerJson(request));
    return json({ ok: true }, 200, { 'set-cookie': cookie });
  }
  if (caminho === 'esqueci' && m === 'POST') {
    await auth.pedirRedefinicao(env, request, await lerJson(request));
    return json({ ok: true });
  }
  if (caminho === 'redefinir' && m === 'POST') {
    const r = await auth.redefinir(env, request, await lerJson(request));
    return json({ ok: true, email: r.email }, 200, { 'set-cookie': r.cookie });
  }
  if (caminho === 'sair' && m === 'POST') {
    const u = await auth.exigirUsuario(env, request);
    const corpo = await lerJson(request);
    return json({ ok: true }, 200, { 'set-cookie': await auth.sair(env, u, Boolean(corpo.todas)) });
  }
  if (caminho === 'senha' && m === 'GET') return json(await auth.salParaTroca(env, await auth.exigirUsuario(env, request)));
  if (caminho === 'senha' && m === 'POST') {
    const u = await auth.exigirUsuario(env, request);
    await auth.trocarSenha(env, request, u, await lerJson(request));
    return json({ ok: true });
  }
  throw new ErroHttp(404, 'Endereço não encontrado.');
}

async function apiAdmin(env, request, caminho) {
  exigirMesmaOrigem(request);
  const u = await auth.exigirUsuario(env, request);
  const m = request.method;
  const partes = caminho.split('/').filter(Boolean).map(decodeURIComponent);
  const [recurso, id, extra] = partes;

  if (recurso === 'catalogo' && m === 'GET') return json(await cat.catalogoDoPainel(env));
  if (recurso === 'historico' && m === 'GET') return json({ itens: await cat.historicoRecente(env) });
  if (recurso === 'uso' && m === 'GET') return json(await usoDeFotos(env));

  if (recurso === 'fotos' && !id && m === 'POST') return json(await receberFoto(env, request), 201);

  if (recurso === 'produtos') {
    if (!id && m === 'POST') return json({ id: await cat.criarProduto(env, u, await lerJson(request)) }, 201);
    if (id && !extra && m === 'PUT') { await cat.atualizarProduto(env, u, id, await lerJson(request)); return json({ ok: true }); }
    if (id && !extra && m === 'DELETE') { await cat.excluirProduto(env, u, id); return json({ ok: true }); }
    if (id && extra === 'ativo' && m === 'PUT') {
      const corpo = await lerJson(request);
      await cat.definirAtivo(env, u, id, Boolean(corpo.ativo));
      return json({ ok: true });
    }
  }
  if (recurso === 'categorias') {
    if (!id && m === 'POST') return json({ id: await cat.criarCategoria(env, u, await lerJson(request)) }, 201);
    if (id === 'ordem' && m === 'PUT') { await cat.ordenarCategorias(env, u, (await lerJson(request)).ids); return json({ ok: true }); }
    if (id && m === 'PUT') { await cat.atualizarCategoria(env, u, id, await lerJson(request)); return json({ ok: true }); }
    if (id && m === 'DELETE') { await cat.excluirCategoria(env, u, id); return json({ ok: true }); }
  }
  if (recurso === 'pagina-inicial' && m === 'PUT') {
    await cat.salvarPaginaInicial(env, u, await lerJson(request));
    return json({ ok: true });
  }
  throw new ErroHttp(404, 'Endereço não encontrado.');
}

// ── Entrada ───────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    // www.perfumariaeloa.com.br → endereço principal (um só endereço para o Google).
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    try {
      if (p === '/assets/js/products.js') return await catalogoPublico(env, request, 'script');
      if (p === '/api/catalogo') return await catalogoPublico(env, request, 'json');

      if (p === '/sitemap.xml') {
        const r = await renderizador(env);
        return new Response(r.sitemap(), { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
      }

      const prod = p.match(/^\/produto\/([a-z0-9-]{1,80})(\/)?(index\.html)?$/);
      if (prod) {
        if (!prod[2] || prod[3]) return Response.redirect(`${url.origin}/produto/${prod[1]}/`, 301);
        return await paginaDeProduto(env, request, prod[1]);
      }
      if (p.startsWith('/produto/')) return html(pagina404(), 404, { 'x-robots-tag': 'noindex' });

      if (p.startsWith('/img/')) return await servirFoto(env, request, ctx, p.slice(5));

      if (p.startsWith('/api/auth/')) return await apiAuth(env, request, p.slice(10));
      if (p.startsWith('/api/admin/')) return await apiAdmin(env, request, p.slice(11));

      // Só em desenvolvimento local: e-mails "enviados" para os testes lerem.
      if (p === '/api/dev/emails' && env.EMAIL_MODE === 'console' && url.hostname === 'localhost') {
        return json({ emails: ultimosEmailsDeTeste() });
      }

      // O formulário antigo (FormSubmit → e-mail do Guido) foi substituído pelo painel.
      if (p === '/admin' || p.startsWith('/admin/')) return Response.redirect(`${url.origin}/painel/`, 301);

      if (p.startsWith('/api/')) throw new ErroHttp(404, 'Endereço não encontrado.');
      return env.ASSETS.fetch(request);
    } catch (erro) {
      return respostaDeErro(erro);
    }
  },

  async scheduled(_evento, env, ctx) {
    ctx.waitUntil(limpeza(env).then((r) => console.log('Limpeza diária:', JSON.stringify(r))));
  },
};
