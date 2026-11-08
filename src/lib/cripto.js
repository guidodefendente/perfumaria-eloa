/**
 * Primitivas criptográficas (WebCrypto, nativo do Worker — sem dependências).
 *
 * Modelo de senha (ver docs/SEGURANCA.md):
 *   navegador:  chave = PBKDF2-SHA256(senha, sal, 600.000 iterações)  ← trabalho pesado
 *   servidor:   verificador = HMAC-SHA256(AUTH_PEPPER, chave)          ← barato (< 1 ms)
 *
 * Por quê: o plano gratuito do Workers dá 10 ms de CPU por requisição, e um
 * PBKDF2 de 100 mil iterações já passa disso. Fazer o estiramento no
 * navegador mantém a senha cara de adivinhar sem estourar o limite. A senha
 * em si nunca sai do celular; se o banco vazar, sem o pepper (segredo do
 * Worker) não dá nem para testar palpites.
 */

export const ITERACOES_PADRAO = 600_000;
export const ITERACOES_MINIMAS = 300_000;

const codificador = new TextEncoder();

export function paraBase64Url(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deBase64Url(texto) {
  if (typeof texto !== 'string' || !/^[A-Za-z0-9_-]*$/.test(texto)) return null;
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((texto.length + 3) % 4);
  try {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  } catch (_) {
    return null;
  }
}

export function bytesAleatorios(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export const tokenAleatorio = (n = 32) => paraBase64Url(bytesAleatorios(n));

export async function sha256(texto) {
  const dig = await crypto.subtle.digest('SHA-256', codificador.encode(texto));
  return paraBase64Url(new Uint8Array(dig));
}

async function chaveHmac(pepper) {
  if (!pepper || pepper.length < 32) throw new Error('AUTH_PEPPER ausente ou curto demais (mínimo 32 caracteres).');
  return crypto.subtle.importKey('raw', codificador.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmac(pepper, dados) {
  const k = await chaveHmac(pepper);
  const bytes = typeof dados === 'string' ? codificador.encode(dados) : dados;
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes));
}

/** verificador = HMAC(pepper, "eloa:v1:" || chave) */
export async function verificadorDe(pepper, chaveBytes) {
  const prefixo = codificador.encode('eloa:v1:');
  const junto = new Uint8Array(prefixo.length + chaveBytes.length);
  junto.set(prefixo, 0);
  junto.set(chaveBytes, prefixo.length);
  return paraBase64Url(await hmac(pepper, junto));
}

/**
 * Sal falso e estável para e-mails que não têm senha: a resposta para um
 * e-mail desconhecido é indistinguível da de um e-mail real.
 */
export async function salFalso(pepper, email) {
  return paraBase64Url((await hmac(pepper, `sal-falso:${email}`)).slice(0, 16));
}

/** Comparação em tempo constante (não vaza, pelo tempo, onde difere). */
export function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let dif = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) dif |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return dif === 0;
}
