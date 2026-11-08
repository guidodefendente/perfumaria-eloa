/** Chamadas ao Worker, com mensagens de erro prontas para mostrar na tela. */

export class ErroApi extends Error {
  constructor(mensagem, status, campos) {
    super(mensagem);
    this.status = status;
    this.campos = campos || null;
  }
}

export async function api(metodo, caminho, corpo, { form } = {}) {
  const opcoes = { method: metodo, credentials: 'same-origin', headers: {} };
  if (form) opcoes.body = form;
  else if (corpo !== undefined) {
    opcoes.headers['content-type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  let resposta;
  try {
    resposta = await fetch(caminho, opcoes);
  } catch (_) {
    throw new ErroApi('Sem conexão com a internet. Confira o sinal e tente de novo.', 0);
  }
  let dados = {};
  try { dados = await resposta.json(); } catch (_) { /* resposta sem corpo */ }
  if (!resposta.ok) {
    if (resposta.status === 401 && !caminho.startsWith('/api/auth/')) {
      window.dispatchEvent(new CustomEvent('painel:sessao-expirada'));
    }
    const padrao = resposta.status === 429 || resposta.status === 503
      ? 'O sistema está temporariamente no limite de uso. Tente de novo mais tarde.'
      : 'Algo deu errado. Tente de novo em instantes.';
    throw new ErroApi(dados.erro || padrao, resposta.status, dados.campos);
  }
  return dados;
}
