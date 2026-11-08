/**
 * Envio de e-mail (recuperação de senha).
 *
 * Produção: binding `send_email` da Cloudflare (Email Routing). Só entrega
 * para endereços VERIFICADOS na conta — gratuito em qualquer plano. É uma
 * trava extra: mesmo com um bug, o Worker não consegue mandar e-mail para
 * fora da lista de verificados.
 *
 * Desenvolvimento (EMAIL_MODE=console): o e-mail é só registrado no log e
 * guardado em memória para os testes automatizados lerem.
 */

import { EmailMessage } from 'cloudflare:email';

const caixaDeTeste = [];
export const ultimosEmailsDeTeste = () => caixaDeTeste.slice(-10);

const codificarCabecalho = (s) => `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(s)))}?=`;

function base64Linhas(texto) {
  const bytes = new TextEncoder().encode(texto);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/.{1,76}/g, '$&\r\n');
}

/** Monta uma mensagem MIME simples (texto + HTML) sem bibliotecas. */
export function montarMime({ de, nomeDe, para, assunto, texto, html }) {
  const fronteira = `eloa-${crypto.randomUUID()}`;
  const id = `<${crypto.randomUUID()}@${de.split('@')[1]}>`;
  return [
    `From: ${codificarCabecalho(nomeDe)} <${de}>`,
    `To: <${para}>`,
    `Subject: ${codificarCabecalho(assunto)}`,
    `Message-ID: ${id}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${fronteira}"`,
    '',
    `--${fronteira}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Linhas(texto),
    `--${fronteira}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Linhas(html),
    `--${fronteira}--`,
    '',
  ].join('\r\n');
}

export async function enviarEmail(env, { para, assunto, texto, html }) {
  if (env.EMAIL_MODE === 'console') {
    caixaDeTeste.push({ para, assunto, texto, em: Date.now() });
    console.log(`[e-mail de teste] para ${para}: ${assunto}\n${texto}`);
    return;
  }
  const raw = montarMime({ de: env.EMAIL_FROM, nomeDe: 'Perfumaria Eloá', para, assunto, texto, html });
  await env.EMAIL.send(new EmailMessage(env.EMAIL_FROM, para, raw));
}

export function emailRedefinicao(link, primeiraVez) {
  const titulo = primeiraVez ? 'Crie sua senha do painel' : 'Redefinir a senha do painel';
  const texto = [
    'Olá!',
    '',
    primeiraVez
      ? 'Para criar sua senha do painel da Perfumaria Eloá, abra o link abaixo:'
      : 'Recebemos um pedido para redefinir a senha do painel da Perfumaria Eloá. Para criar uma nova senha, abra o link abaixo:',
    '',
    link,
    '',
    'O link vale por 30 minutos e só pode ser usado uma vez.',
    'Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.',
  ].join('\n');
  const html = `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#faf7f8;font-family:Arial,Helvetica,sans-serif;color:#140E10">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
  <p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#9d2c4e;margin:0 0 6px">Perfumaria Eloá</p>
  <h1 style="font-size:22px;margin:0 0 16px">${titulo}</h1>
  <p style="font-size:15px;line-height:1.5;margin:0 0 22px">${primeiraVez ? 'Toque no botão para criar a senha do painel.' : 'Toque no botão para criar uma nova senha.'}</p>
  <p style="margin:0 0 22px"><a href="${link}" style="display:inline-block;background:#140E10;color:#fff;text-decoration:none;padding:14px 22px;border-radius:12px;font-weight:bold;font-size:16px">${primeiraVez ? 'Criar minha senha' : 'Criar nova senha'}</a></p>
  <p style="font-size:13px;line-height:1.5;color:#5c4d53;margin:0">O link vale por 30 minutos e só pode ser usado uma vez. Se não foi você que pediu, ignore este e-mail: sua senha continua a mesma.</p>
</div></body></html>`;
  return { assunto: `${titulo} — Perfumaria Eloá`, texto, html };
}
