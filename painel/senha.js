/**
 * Proteção da senha no próprio aparelho (ver docs/SEGURANCA.md).
 *
 * A senha digitada nunca é enviada: o navegador calcula uma chave com
 * PBKDF2-SHA256 e 600 mil iterações e envia só a chave. Isso leva de meio
 * segundo a uns 2 segundos no celular — é de propósito: deixa caríssimo
 * para alguém tentar adivinhar senhas.
 */
export const ITERACOES = 600_000;
export const TAMANHO_MINIMO = 10;

const paraB64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export function novoSal() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return paraB64(b);
}

export async function derivarChave(senha, sal, iteracoes) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deB64(sal), iterations: iteracoes }, base, 256);
  return paraB64(bits);
}

const FRACAS = ['1234567890', '0123456789', 'perfumaria', 'perfumariaeloa', 'senha12345', 'qwertyuiop', 'eloa123456', '1234512345'];

/** Retorna null se a senha serve, ou a mensagem do problema. */
export function problemaNaSenha(senha, email = '') {
  if (senha.length < TAMANHO_MINIMO) return `Use pelo menos ${TAMANHO_MINIMO} caracteres. Uma frase fácil de lembrar funciona bem, como "perfume rosa na vitrine".`;
  if (senha.length > 200) return 'Senha longa demais.';
  const simples = senha.toLowerCase().replace(/\s/g, '');
  if (FRACAS.some((f) => simples.includes(f)) || /^(.)\1+$/.test(simples)) return 'Essa senha é fácil demais de adivinhar. Escolha outra.';
  if (email && simples.includes(email.split('@')[0].toLowerCase())) return 'Não use o seu e-mail na senha.';
  return null;
}
