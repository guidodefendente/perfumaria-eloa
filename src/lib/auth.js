/**
 * Autenticação do painel: login, sessões, recuperação e troca de senha.
 *
 * Regras:
 *   - não existe cadastro: só entra e-mail listado no segredo ADMIN_EMAILS.
 *     Tirar um e-mail da lista corta o acesso na hora, mesmo com sessão aberta;
 *   - a primeira senha é criada pelo próprio dono do e-mail, pelo link de
 *     "Esqueci minha senha" (nenhuma senha passa por terceiros);
 *   - sessão em cookie HttpOnly + Secure + SameSite=Strict, 30 dias;
 *   - 5 erros de senha seguidos bloqueiam o e-mail por 15 minutos.
 */
import { ErroHttp, lerCookie, ipDe } from './http.js';
import {
  ITERACOES_PADRAO, ITERACOES_MINIMAS, deBase64Url, tokenAleatorio, sha256,
  verificadorDe, salFalso, iguais,
} from './cripto.js';
import { enviarEmail, emailRedefinicao } from './email.js';
import { validarEmail } from '../../painel/validacao.js';

export const COOKIE = '__Host-eloa_sessao';
const DIA = 24 * 60 * 60 * 1000;
const DURACAO_SESSAO = 30 * DIA;
const DURACAO_LINK = 30 * 60 * 1000;
const JANELA_LOGIN = 15 * 60 * 1000;

export function emailsAutorizados(env) {
  return new Set(String(env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean));
}

// ── Limite de tentativas ──────────────────────────────────────────────────
async function contagem(env, chave) {
  const r = await env.DB.prepare('SELECT contagem, reinicia FROM limites WHERE chave = ?1').bind(chave).first();
  if (!r || r.reinicia < Date.now()) return 0;
  return r.contagem;
}

async function somar(env, chave, janela) {
  const agora = Date.now();
  await env.DB.prepare(`INSERT INTO limites (chave, contagem, reinicia) VALUES (?1, 1, ?2)
    ON CONFLICT(chave) DO UPDATE SET
      contagem = CASE WHEN reinicia < ?3 THEN 1 ELSE contagem + 1 END,
      reinicia = CASE WHEN reinicia < ?3 THEN ?2 ELSE reinicia END`)
    .bind(chave, agora + janela, agora).run();
}

/** Conta uma tentativa e barra quando passa do máximo. */
export async function limitar(env, chave, maximo, janela, mensagem) {
  if (await contagem(env, chave) >= maximo) throw new ErroHttp(429, mensagem);
  await somar(env, chave, janela);
}

// ── Sessão ────────────────────────────────────────────────────────────────
function cookieSessao(token, maxAge) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function resumoDispositivo(request) {
  const ua = request.headers.get('user-agent') || '';
  const so = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Outro';
  const nav = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'navegador';
  return `${nav} · ${so}`;
}

async function abrirSessao(env, request, usuarioId) {
  const token = tokenAleatorio(32);
  const agora = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO sessoes (token_hash, usuario_id, criado_em, expira_em, visto_em, dispositivo) VALUES (?1, ?2, ?3, ?4, ?3, ?5)')
      .bind(await sha256(token), usuarioId, agora, agora + DURACAO_SESSAO, resumoDispositivo(request)),
    env.DB.prepare('UPDATE usuarios SET ultimo_acesso = ?1 WHERE id = ?2').bind(agora, usuarioId),
  ]);
  return cookieSessao(token, Math.floor(DURACAO_SESSAO / 1000));
}

/** Usuário da sessão atual, ou null. */
export async function usuarioDaSessao(env, request) {
  const token = lerCookie(request, COOKIE);
  if (!token || token.length > 100) return null;
  const hash = await sha256(token);
  const r = await env.DB.prepare(`SELECT s.token_hash, s.expira_em, s.visto_em, u.id, u.email, u.nome
      FROM sessoes s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ?1`).bind(hash).first();
  if (!r) return null;
  const agora = Date.now();
  if (r.expira_em < agora || !emailsAutorizados(env).has(r.email.toLowerCase())) {
    await env.DB.prepare('DELETE FROM sessoes WHERE token_hash = ?1').bind(hash).run();
    return null;
  }
  // Atualiza o "visto por último" no máximo 1x/hora: poupa escritas no banco.
  if (agora - r.visto_em > 60 * 60 * 1000) {
    await env.DB.prepare('UPDATE sessoes SET visto_em = ?1 WHERE token_hash = ?2').bind(agora, hash).run();
  }
  return { id: r.id, email: r.email, nome: r.nome, sessao: hash };
}

export async function exigirUsuario(env, request) {
  const u = await usuarioDaSessao(env, request);
  if (!u) throw new ErroHttp(401, 'Sua sessão terminou. Entre de novo.');
  return u;
}

// ── Endpoints ─────────────────────────────────────────────────────────────

/** 1º passo do login: devolve sal e iterações para o navegador derivar a chave. */
export async function parametrosDeLogin(env, dados) {
  const email = validarEmail(dados.email);
  if (!email) throw new ErroHttp(400, 'Digite um e-mail válido.', { campos: { email: 'Digite um e-mail válido.' } });
  const u = await env.DB.prepare('SELECT sal, iteracoes FROM usuarios WHERE email = ?1').bind(email).first();
  if (u && u.sal && emailsAutorizados(env).has(email)) return { sal: u.sal, iteracoes: u.iteracoes };
  return { sal: await salFalso(env.AUTH_PEPPER, email), iteracoes: ITERACOES_PADRAO };
}

export async function entrar(env, request, dados) {
  const email = validarEmail(dados.email);
  const chave = deBase64Url(dados.chave);
  if (!email || !chave || chave.length !== 32) throw new ErroHttp(400, 'E-mail ou senha incorretos.');

  const msgBloqueio = 'Muitas tentativas. Por segurança, espere 15 minutos e tente de novo — ou use "Esqueci minha senha".';
  const chaveEmail = `login:${email}`;
  const chaveIp = `login-ip:${ipDe(request)}`;
  if (await contagem(env, chaveEmail) >= 5 || await contagem(env, chaveIp) >= 30) throw new ErroHttp(429, msgBloqueio);

  const u = await env.DB.prepare('SELECT id, verificador FROM usuarios WHERE email = ?1').bind(email).first();
  const esperado = u && u.verificador ? u.verificador : null;
  const recebido = await verificadorDe(env.AUTH_PEPPER, chave);
  const ok = esperado !== null && iguais(recebido, esperado) && emailsAutorizados(env).has(email);

  if (!ok) {
    await Promise.all([somar(env, chaveEmail, JANELA_LOGIN), somar(env, chaveIp, JANELA_LOGIN)]);
    throw new ErroHttp(401, 'E-mail ou senha incorretos.');
  }
  await env.DB.prepare('DELETE FROM limites WHERE chave = ?1').bind(chaveEmail).run();
  return abrirSessao(env, request, u.id);
}

export async function sair(env, usuario, todas = false) {
  if (todas) await env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ?1').bind(usuario.id).run();
  else await env.DB.prepare('DELETE FROM sessoes WHERE token_hash = ?1').bind(usuario.sessao).run();
  return cookieSessao('', 0);
}

/**
 * "Esqueci minha senha" (e também "criar minha senha" no primeiro acesso).
 * Responde sempre igual, exista o e-mail ou não.
 */
export async function pedirRedefinicao(env, request, dados) {
  const email = validarEmail(dados.email);
  if (!email) throw new ErroHttp(400, 'Digite um e-mail válido.', { campos: { email: 'Digite um e-mail válido.' } });

  await limitar(env, `esqueci-ip:${ipDe(request)}`, 10, 60 * 60 * 1000,
    'Muitos pedidos seguidos. Espere uma hora e tente de novo.');
  if (!emailsAutorizados(env).has(email)) return;
  // No máximo 3 e-mails por hora para o mesmo endereço (silencioso, sem revelar).
  if (await contagem(env, `esqueci:${email}`) >= 3) return;
  await somar(env, `esqueci:${email}`, 60 * 60 * 1000);

  const agora = Date.now();
  let u = await env.DB.prepare('SELECT id, verificador FROM usuarios WHERE email = ?1').bind(email).first();
  if (!u) {
    u = await env.DB.prepare('INSERT INTO usuarios (email, criado_em) VALUES (?1, ?2) RETURNING id, verificador').bind(email, agora).first();
  }
  const token = tokenAleatorio(32);
  await env.DB.prepare('INSERT INTO redefinicoes (token_hash, usuario_id, criado_em, expira_em) VALUES (?1, ?2, ?3, ?4)')
    .bind(await sha256(token), u.id, agora, agora + DURACAO_LINK).run();

  const link = `${origemPermitida(env, request)}/painel/#/redefinir/${token}`;
  const msg = emailRedefinicao(link, !u.verificador);
  try {
    await enviarEmail(env, { para: email, ...msg });
  } catch (erro) {
    // Causa real no log (ex.: domínio ainda não ativo no Email Routing,
    // destinatário não verificado); para a pessoa, uma mensagem que diz o que houve.
    console.error(`Falha ao enviar e-mail de redefinição para ${email}:`, erro && erro.message ? erro.message : erro);
    throw new ErroHttp(503, 'Não conseguimos enviar o e-mail agora. Tente de novo em alguns minutos. Se continuar, avise o Guido.');
  }
}

/**
 * Endereço usado no link do e-mail: o mesmo em que o pedido foi feito, desde
 * que seja o domínio oficial ou o endereço *.workers.dev deste Worker. Assim o
 * link nunca leva para um endereço que ainda não atende o painel.
 */
export function origemPermitida(env, request) {
  const oficial = new URL(env.SITE_URL);
  try {
    const pedido = new URL(request.url);
    const ok = pedido.protocol === 'https:'
      && (pedido.hostname === oficial.hostname || /^perfumaria-eloa\.[a-z0-9-]+\.workers\.dev$/.test(pedido.hostname));
    if (ok) return pedido.origin;
  } catch (_) { /* usa o oficial */ }
  return oficial.origin;
}

function validarNovaChave(dados) {
  const chave = deBase64Url(dados.chave);
  const sal = deBase64Url(dados.sal);
  const iteracoes = Number(dados.iteracoes);
  if (!chave || chave.length !== 32 || !sal || sal.length < 16 || !Number.isInteger(iteracoes)
      || iteracoes < ITERACOES_MINIMAS || iteracoes > 5_000_000) {
    throw new ErroHttp(400, 'Não foi possível salvar a senha. Atualize a página e tente de novo.');
  }
  return { chave, sal: dados.sal, iteracoes };
}

/** Conclui a redefinição pelo link do e-mail; já deixa a pessoa logada. */
export async function redefinir(env, request, dados) {
  const token = typeof dados.token === 'string' ? dados.token : '';
  if (!token || token.length > 100) throw new ErroHttp(400, 'Link inválido.');
  const hash = await sha256(token);
  const r = await env.DB.prepare(`SELECT r.usuario_id, r.expira_em, r.usado_em, u.email FROM redefinicoes r
      JOIN usuarios u ON u.id = r.usuario_id WHERE r.token_hash = ?1`).bind(hash).first();
  if (!r || r.usado_em || r.expira_em < Date.now() || !emailsAutorizados(env).has(r.email.toLowerCase())) {
    throw new ErroHttp(410, 'Este link venceu ou já foi usado. Peça um novo em "Esqueci minha senha".');
  }
  const { chave, sal, iteracoes } = validarNovaChave(dados);
  const agora = Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE usuarios SET sal = ?1, iteracoes = ?2, verificador = ?3, senha_em = ?4 WHERE id = ?5')
      .bind(sal, iteracoes, await verificadorDe(env.AUTH_PEPPER, chave), agora, r.usuario_id),
    env.DB.prepare('UPDATE redefinicoes SET usado_em = ?1 WHERE usuario_id = ?2 AND usado_em IS NULL').bind(agora, r.usuario_id),
    // Senha nova derruba todas as sessões antigas (ex.: celular perdido).
    env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ?1').bind(r.usuario_id),
    env.DB.prepare('DELETE FROM limites WHERE chave = ?1').bind(`login:${r.email.toLowerCase()}`),
  ]);
  return { cookie: await abrirSessao(env, request, r.usuario_id), email: r.email };
}

/** Troca de senha estando logado: exige a senha atual. */
export async function trocarSenha(env, request, usuario, dados) {
  const atual = deBase64Url(dados.chaveAtual);
  if (!atual || atual.length !== 32) throw new ErroHttp(400, 'Senha atual incorreta.', { campos: { atual: 'Senha atual incorreta.' } });
  await limitar(env, `troca:${usuario.id}`, 5, JANELA_LOGIN, 'Muitas tentativas. Espere 15 minutos.');
  const u = await env.DB.prepare('SELECT verificador FROM usuarios WHERE id = ?1').bind(usuario.id).first();
  if (!u || !iguais(await verificadorDe(env.AUTH_PEPPER, atual), u.verificador)) {
    throw new ErroHttp(401, 'Senha atual incorreta.', { campos: { atual: 'Senha atual incorreta.' } });
  }
  const { chave, sal, iteracoes } = validarNovaChave(dados);
  await env.DB.batch([
    env.DB.prepare('UPDATE usuarios SET sal = ?1, iteracoes = ?2, verificador = ?3, senha_em = ?4 WHERE id = ?5')
      .bind(sal, iteracoes, await verificadorDe(env.AUTH_PEPPER, chave), Date.now(), usuario.id),
    // Mantém só a sessão atual; as outras caem.
    env.DB.prepare('DELETE FROM sessoes WHERE usuario_id = ?1 AND token_hash <> ?2').bind(usuario.id, usuario.sessao),
  ]);
}

export async function salParaTroca(env, usuario) {
  const u = await env.DB.prepare('SELECT sal, iteracoes FROM usuarios WHERE id = ?1').bind(usuario.id).first();
  return { sal: u.sal, iteracoes: u.iteracoes };
}
