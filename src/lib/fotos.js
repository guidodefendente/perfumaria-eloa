/**
 * Fotos enviadas pelo painel.
 *
 * O celular já entrega as fotos otimizadas (WebP ou JPEG, até 1600 px, e uma
 * miniatura de 600 px) — ver painel/imagens.js. Aqui só se confere e guarda.
 *
 * Armazenamento: Workers KV (plano gratuito: 1 GB, 1.000 gravações/dia).
 * Travas para nunca bater nesses limites:
 *   - no máximo 150 fotos por dia (= 300 gravações);
 *   - no máximo 800 MB no total;
 *   - cada foto até 1,5 MB e cada miniatura até 400 KB.
 * Ao passar de um limite, o painel avisa — nada é cobrado, porque o KV no
 * plano gratuito simplesmente recusa a operação.
 */
import { ErroHttp } from './http.js';
import { tokenAleatorio } from './cripto.js';
import { limitar } from './auth.js';
import { formatoDe } from './formato.js';

export { formatoDe };

export const LIMITE_FOTOS_DIA = 150;
export const LIMITE_TOTAL_BYTES = 800 * 1024 * 1024;
const MAX_GRANDE = 1.5 * 1024 * 1024;
const MAX_MINI = 400 * 1024;
const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;

async function lerArquivo(form, nome, maximo) {
  const arq = form.get(nome);
  if (!arq || typeof arq === 'string') throw new ErroHttp(400, 'Foto não recebida. Tente enviar de novo.');
  if (arq.size > maximo) throw new ErroHttp(413, 'A foto ficou grande demais mesmo depois de otimizada. Tente outra foto.');
  const bytes = new Uint8Array(await arq.arrayBuffer());
  const tipo = formatoDe(bytes);
  if (!tipo) throw new ErroHttp(415, 'Formato de imagem não aceito. Use uma foto da câmera ou da galeria.');
  return { bytes, tipo };
}

export async function receberFoto(env, request) {
  const tamanho = Number(request.headers.get('content-length') || 0);
  if (tamanho > 2.5 * 1024 * 1024) throw new ErroHttp(413, 'Envio grande demais.');
  let form;
  try { form = await request.formData(); } catch (_) { throw new ErroHttp(400, 'Não foi possível ler a foto enviada.'); }

  const grande = await lerArquivo(form, 'grande', MAX_GRANDE);
  const mini = await lerArquivo(form, 'miniatura', MAX_MINI);
  const largura = Math.min(10000, Math.max(1, Number(form.get('largura')) || 0)) || null;
  const altura = Math.min(10000, Math.max(1, Number(form.get('altura')) || 0)) || null;

  const uso = await env.DB.prepare("SELECT COALESCE(SUM(bytes), 0) AS total FROM fotos WHERE origem = 'kv'").first();
  if (uso.total + grande.bytes.length + mini.bytes.length > LIMITE_TOTAL_BYTES) {
    throw new ErroHttp(507, 'O espaço gratuito para fotos está quase cheio. Exclua fotos ou produtos antigos antes de enviar novas — ou fale com o Guido.');
  }
  const dia = new Date().toISOString().slice(0, 10);
  await limitar(env, `fotos-dia:${dia}`, LIMITE_FOTOS_DIA, 26 * 60 * 60 * 1000,
    `Limite de ${LIMITE_FOTOS_DIA} fotos por dia atingido. Continue amanhã — o limite protege a conta gratuita.`);

  const id = tokenAleatorio(12);
  const ext = (t) => (t === 'image/webp' ? 'webp' : 'jpg');
  const chaveG = `f/${id}-g.${ext(grande.tipo)}`;
  const chaveM = `f/${id}-m.${ext(mini.tipo)}`;
  const opcoes = (tipo) => ({ metadata: { tipo } });
  await env.FOTOS.put(chaveG, grande.bytes, opcoes(grande.tipo));
  await env.FOTOS.put(chaveM, mini.bytes, opcoes(mini.tipo));

  const foto = {
    id: `f${id}`,
    src: `/img/${chaveG}`,
    thumb: `/img/${chaveM}`,
  };
  await env.DB.prepare(`INSERT INTO fotos (id, produto_id, posicao, origem, src_grande, src_miniatura, chave_grande, chave_mini,
      largura, altura, bytes, criado_em, solta_em) VALUES (?1, NULL, 0, 'kv', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)`)
    .bind(foto.id, foto.src, foto.thumb, chaveG, chaveM, largura, altura, grande.bytes.length + mini.bytes.length, Date.now()).run();
  return foto;
}

/**
 * GET /img/f/<id>-g.webp — entrega a foto. A URL nunca muda de conteúdo,
 * então o navegador e a borda da Cloudflare guardam por 1 ano: quem volta
 * ao site não baixa a foto de novo e o KV quase não é consultado.
 */
export async function servirFoto(env, request, ctx, chave) {
  if (!/^f\/[A-Za-z0-9_-]{16}-[gm]\.(webp|jpg)$/.test(chave)) return new Response('Não encontrado', { status: 404 });
  const cache = caches.default;
  const emCache = await cache.match(request);
  if (emCache) return emCache;

  const { value, metadata } = await env.FOTOS.getWithMetadata(chave, { type: 'stream' });
  if (!value) return new Response('Não encontrado', { status: 404, headers: { 'cache-control': 'public, max-age=60' } });
  const resposta = new Response(value, {
    headers: {
      'content-type': (metadata && metadata.tipo) || 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    },
  });
  ctx.waitUntil(cache.put(request, resposta.clone()));
  return resposta;
}

/** Limpeza diária (cron): fotos órfãs há mais de 7 dias e registros vencidos. */
export async function limpeza(env) {
  const limite = Date.now() - SETE_DIAS;
  const orfas = await env.DB.prepare(`SELECT id, origem, chave_grande, chave_mini FROM fotos
      WHERE produto_id IS NULL AND solta_em < ?1 LIMIT 200`).bind(limite).all();
  for (const f of orfas.results) {
    if (f.origem === 'kv') {
      await env.FOTOS.delete(f.chave_grande);
      await env.FOTOS.delete(f.chave_mini);
    }
    await env.DB.prepare('DELETE FROM fotos WHERE id = ?1 AND produto_id IS NULL').bind(f.id).run();
  }
  const t = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessoes WHERE expira_em < ?1').bind(t),
    env.DB.prepare('DELETE FROM redefinicoes WHERE expira_em < ?1').bind(t - SETE_DIAS),
    env.DB.prepare('DELETE FROM limites WHERE reinicia < ?1').bind(t),
    env.DB.prepare('DELETE FROM historico WHERE em < ?1').bind(t - 365 * 24 * 60 * 60 * 1000),
  ]);
  return { fotosRemovidas: orfas.results.length };
}

export async function usoDeFotos(env) {
  const r = await env.DB.prepare("SELECT COUNT(*) AS n, COALESCE(SUM(bytes), 0) AS bytes FROM fotos WHERE origem = 'kv'").first();
  return { fotos: r.n, bytes: r.bytes, limiteBytes: LIMITE_TOTAL_BYTES, limiteDia: LIMITE_FOTOS_DIA };
}
