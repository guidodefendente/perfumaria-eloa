/** Utilidades HTTP do Worker: respostas, erros, cookies e proteção CSRF. */

export class ErroHttp extends Error {
  /**
   * @param {number} status
   * @param {string} mensagem  texto para a pessoa que usa o painel (pt-BR, sem jargão)
   * @param {object} [extra]   ex.: { campos: { preco: 'Informe o preço' } }
   */
  constructor(status, mensagem, extra = {}) {
    super(mensagem);
    this.status = status;
    this.extra = extra;
  }
}

const CABECALHOS_API = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
};

export function json(dados, status = 200, cabecalhos = {}) {
  return new Response(JSON.stringify(dados), { status, headers: { ...CABECALHOS_API, ...cabecalhos } });
}

export function respostaDeErro(erro) {
  if (erro instanceof ErroHttp) {
    return json({ erro: erro.message, ...erro.extra }, erro.status);
  }
  console.error('Erro inesperado:', erro && erro.stack ? erro.stack : erro);
  return json({ erro: 'Algo deu errado do nosso lado. Tente de novo em instantes.' }, 500);
}

/** Lê JSON do corpo com limite de tamanho. */
export async function lerJson(request, limiteBytes = 64 * 1024) {
  const tipo = request.headers.get('content-type') || '';
  if (!tipo.includes('application/json')) throw new ErroHttp(415, 'Formato de envio inválido.');
  const texto = await request.text();
  if (texto.length > limiteBytes) throw new ErroHttp(413, 'Envio grande demais.');
  try {
    return JSON.parse(texto || '{}');
  } catch (_) {
    throw new ErroHttp(400, 'Não foi possível ler os dados enviados.');
  }
}

export function lerCookie(request, nome) {
  const header = request.headers.get('cookie') || '';
  for (const parte of header.split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === nome) return decodeURIComponent(v.join('='));
  }
  return null;
}

/**
 * Bloqueia requisições que mudam dados vindas de outro site (CSRF).
 * O cookie já é SameSite=Strict; isto é uma segunda trava, independente
 * do navegador: o Origin precisa ser o próprio site.
 */
export function exigirMesmaOrigem(request) {
  const metodo = request.method.toUpperCase();
  if (metodo === 'GET' || metodo === 'HEAD') return;
  const origem = request.headers.get('origin');
  const esperado = new URL(request.url).origin;
  if (!origem || origem !== esperado) {
    throw new ErroHttp(403, 'Requisição bloqueada por segurança. Recarregue a página e tente de novo.');
  }
}

export function ipDe(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'local';
}

export function html(texto, status = 200, cabecalhos = {}) {
  return new Response(texto, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
      ...cabecalhos,
    },
  });
}
