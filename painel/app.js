/**
 * Painel da Perfumaria Eloá — entrada, rotas e telas de acesso.
 *
 * Sem framework e sem build: módulos ES nativos do navegador. Rotas por hash
 * (#/produtos, #/produtos/<id>, #/categorias, #/inicio, #/conta) para o botão
 * voltar do celular funcionar como esperado.
 */
import { api } from './api.js';
import { esc, $, $$, avisar, confirmar, ocupado, mostrarErros } from './ui.js';
import { derivarChave, novoSal, ITERACOES, problemaNaSenha } from './senha.js';
import { validarEmail } from './validacao.js';
import { telaProdutos, telaProduto } from './telas-produtos.js';
import { telaCategorias } from './telas-categorias.js';
import { telaInicio } from './tela-inicio.js';
import { telaConta } from './tela-conta.js';

export const estado = {
  usuario: null,
  catalogo: null,
  sujo: false,          // há alteração não salva na tela atual
};

export async function carregarCatalogo(forcar = false) {
  if (!estado.catalogo || forcar) estado.catalogo = await api('GET', '/api/admin/catalogo');
  return estado.catalogo;
}

export const tela = () => $('#tela');

export function marcarSujo(valor = true) { estado.sujo = valor; }

// ── Rotas ─────────────────────────────────────────────────────────────────
const ROTAS = [
  { re: /^#\/entrar$/, publica: true, abrir: telaEntrar },
  { re: /^#\/esqueci$/, publica: true, abrir: telaEsqueci },
  { re: /^#\/redefinir\/([A-Za-z0-9_-]{20,100})$/, publica: true, abrir: telaRedefinir },
  { re: /^#\/produtos$/, aba: 'produtos', abrir: telaProdutos },
  { re: /^#\/produtos\/novo$/, aba: 'produtos', abrir: () => telaProduto(null) },
  { re: /^#\/produtos\/([a-z0-9-]{1,80})$/, aba: 'produtos', abrir: telaProduto },
  { re: /^#\/categorias$/, aba: 'categorias', abrir: telaCategorias },
  { re: /^#\/inicio$/, aba: 'inicio', abrir: telaInicio },
  { re: /^#\/conta$/, aba: 'conta', abrir: telaConta },
];

let hashAtual = '';

export function ir(hash) {
  if (location.hash === hash) roteador();
  else location.hash = hash;
}

async function roteador() {
  const hash = location.hash || '#/produtos';
  if (estado.sujo && hash !== hashAtual) {
    const destino = hash;
    history.replaceState(null, '', hashAtual);
    const sair = await confirmar({
      titulo: 'Sair sem salvar?',
      texto: 'Você tem alterações que ainda não foram salvas. Se sair agora, elas serão perdidas.',
      sim: 'Sair sem salvar', nao: 'Continuar editando', perigo: true,
    });
    if (!sair) return;
    estado.sujo = false;
    location.hash = destino;
    return;
  }
  const rota = ROTAS.find((r) => r.re.test(hash));
  if (!rota) { location.replace('#/produtos'); return; }

  if (!rota.publica && !estado.usuario) {
    sessionStorage.setItem('painel:depois', hash);
    location.replace('#/entrar');
    return;
  }
  if (rota.publica && estado.usuario && !/redefinir/.test(hash)) { location.replace('#/produtos'); return; }

  hashAtual = hash;
  estado.sujo = false;
  document.body.classList.toggle('sem-abas', Boolean(rota.publica));
  $$('[data-so-logado]').forEach((el) => { el.hidden = Boolean(rota.publica) || !estado.usuario; });
  $$('.abas a').forEach((a) => (a.dataset.aba === rota.aba ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));

  const [, parametro] = hash.match(rota.re);
  tela().innerHTML = '<div class="carregando" role="status"><span class="girando" aria-hidden="true"></span> Carregando…</div>';
  window.scrollTo(0, 0);
  try {
    await rota.abrir(parametro);
  } catch (erro) {
    if (erro.status === 401) return;
    tela().innerHTML = `<div class="caixa caixa-erro">${esc(erro.message)}</div>
      <button class="botao botao-secundario" type="button" data-recarregar>Tentar de novo</button>`;
    $('[data-recarregar]', tela()).addEventListener('click', () => location.reload());
  }
  const titulo = $('h1', tela());
  document.title = `${titulo ? `${titulo.textContent.trim()} — ` : ''}Painel Eloá`;
}

window.addEventListener('hashchange', roteador);
window.addEventListener('beforeunload', (e) => { if (estado.sujo) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('painel:sessao-expirada', () => {
  if (!estado.usuario) return;
  estado.usuario = null;
  estado.catalogo = null;
  estado.sujo = false;
  avisar('Sua sessão terminou. Entre de novo.', 'erro');
  sessionStorage.setItem('painel:depois', location.hash);
  location.replace('#/entrar');
});

async function iniciar() {
  try {
    const { usuario } = await api('GET', '/api/auth/sessao');
    estado.usuario = usuario;
  } catch (_) { estado.usuario = null; }
  roteador();
}

function depoisDoLogin() {
  const destino = sessionStorage.getItem('painel:depois');
  sessionStorage.removeItem('painel:depois');
  location.replace(destino && !/entrar|esqueci|redefinir/.test(destino) ? destino : '#/produtos');
}

// ── Telas de acesso ───────────────────────────────────────────────────────
const marca = (titulo, sub) => `
  <div class="marca-login">
    <img src="/assets/img/logo-eloa.png" alt="" width="84" height="84">
    <h1>${esc(titulo)}</h1>
    ${sub ? `<p class="sub">${sub}</p>` : ''}
  </div>`;

const campoSenha = (id, rotulo, autocomplete) => `
  <div class="campo" data-campo="${id}">
    <label for="${id}">${esc(rotulo)}</label>
    <div class="senha">
      <input class="entrada" id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" required>
      <button type="button" data-mostrar="${id}" aria-label="Mostrar senha">Mostrar</button>
    </div>
  </div>`;

export function ligarMostrarSenha(raiz) {
  $$('[data-mostrar]', raiz).forEach((b) => b.addEventListener('click', () => {
    const input = $(`#${b.dataset.mostrar}`, raiz);
    const mostrar = input.type === 'password';
    input.type = mostrar ? 'text' : 'password';
    b.textContent = mostrar ? 'Ocultar' : 'Mostrar';
    b.setAttribute('aria-label', mostrar ? 'Ocultar senha' : 'Mostrar senha');
  }));
}

function telaEntrar() {
  tela().innerHTML = `<div class="tela-estreita">
    ${marca('Painel da loja', 'Entre para cadastrar e editar os produtos do site.')}
    <form class="cartao" id="form-entrar" novalidate>
      <div id="msg"></div>
      <div class="campo" data-campo="email">
        <label for="email">E-mail</label>
        <input class="entrada" id="email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" required>
      </div>
      ${campoSenha('senha', 'Senha', 'current-password')}
      <button class="botao botao-primario botao-largo" type="submit">Entrar</button>
    </form>
    <p style="text-align:center"><a class="link-botao" href="#/esqueci">Esqueci minha senha · Primeiro acesso</a></p>
  </div>`;
  const form = $('#form-entrar');
  ligarMostrarSenha(form);
  $('#email', form).focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = validarEmail(form.email.value);
    const senha = form.senha.value;
    const erros = {};
    if (!email) erros.email = 'Digite um e-mail válido.';
    if (!senha) erros.senha = 'Digite sua senha.';
    mostrarErros(form, erros);
    if (Object.keys(erros).length) return;
    $('#msg').innerHTML = '';
    await ocupado($('button[type=submit]', form), 'Entrando…', async () => {
      try {
        const { sal, iteracoes } = await api('POST', '/api/auth/parametros', { email });
        const chave = await derivarChave(senha, sal, iteracoes);
        await api('POST', '/api/auth/entrar', { email, chave });
        const { usuario } = await api('GET', '/api/auth/sessao');
        estado.usuario = usuario;
        depoisDoLogin();
      } catch (erro) {
        $('#msg').innerHTML = `<div class="caixa caixa-erro" role="alert">${esc(erro.message)}</div>`;
        form.senha.select();
      }
    });
  });
}

function telaEsqueci() {
  tela().innerHTML = `<div class="tela-estreita">
    ${marca('Criar ou recuperar senha', 'Vamos mandar um link para o seu e-mail. Use o mesmo e-mail cadastrado como responsável pela loja.')}
    <form class="cartao" id="form-esqueci" novalidate>
      <div id="msg"></div>
      <div class="campo" data-campo="email">
        <label for="email">Seu e-mail</label>
        <input class="entrada" id="email" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" required>
      </div>
      <button class="botao botao-primario botao-largo" type="submit">Enviar link</button>
    </form>
    <p style="text-align:center"><a class="link-botao" href="#/entrar">Voltar para entrar</a></p>
  </div>`;
  const form = $('#form-esqueci');
  form.email.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = validarEmail(form.email.value);
    mostrarErros(form, email ? null : { email: 'Digite um e-mail válido.' });
    if (!email) return;
    await ocupado($('button[type=submit]', form), 'Enviando…', async () => {
      try {
        await api('POST', '/api/auth/esqueci', { email });
        form.innerHTML = `<div class="caixa caixa-ok" role="status"><strong>Pronto!</strong> Se <strong>${esc(email)}</strong> tiver acesso ao painel, você vai receber um e-mail em alguns minutos com o link para criar a senha.</div>
          <p class="sub">Não chegou? Confira a pasta de <strong>spam</strong> ou <strong>promoções</strong>. O link vale por 30 minutos.</p>`;
      } catch (erro) {
        $('#msg').innerHTML = `<div class="caixa caixa-erro" role="alert">${esc(erro.message)}</div>`;
      }
    });
  });
}

function telaRedefinir(token) {
  tela().innerHTML = `<div class="tela-estreita">
    ${marca('Criar nova senha', 'Escolha uma senha que só você saiba.')}
    <form class="cartao" id="form-redefinir" novalidate>
      <div id="msg"></div>
      ${campoSenha('nova', 'Nova senha', 'new-password')}
      <p class="dica" style="margin:-6px 0 14px">Pelo menos 10 caracteres. Dica: uma frase fácil de lembrar, como <em>perfume rosa na vitrine</em>.</p>
      ${campoSenha('confirmar', 'Repita a nova senha', 'new-password')}
      <button class="botao botao-primario botao-largo" type="submit">Salvar senha e entrar</button>
    </form>
  </div>`;
  const form = $('#form-redefinir');
  ligarMostrarSenha(form);
  form.nova.focus();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nova = form.nova.value;
    const erros = {};
    const problema = problemaNaSenha(nova);
    if (problema) erros.nova = problema;
    else if (nova !== form.confirmar.value) erros.confirmar = 'As duas senhas estão diferentes.';
    mostrarErros(form, erros);
    if (Object.keys(erros).length) return;
    await ocupado($('button[type=submit]', form), 'Protegendo sua senha…', async () => {
      try {
        const sal = novoSal();
        const chave = await derivarChave(nova, sal, ITERACOES);
        await api('POST', '/api/auth/redefinir', { token, sal, iteracoes: ITERACOES, chave });
        const { usuario } = await api('GET', '/api/auth/sessao');
        estado.usuario = usuario;
        // Tira o token da barra de endereço e do histórico.
        history.replaceState(null, '', '#/produtos');
        avisar('Senha salva. Bem-vindo ao painel!', 'ok');
        roteador();
      } catch (erro) {
        $('#msg').innerHTML = `<div class="caixa caixa-erro" role="alert">${esc(erro.message)}</div>
          ${erro.status === 410 ? '<a class="botao botao-secundario botao-largo" href="#/esqueci">Pedir um novo link</a>' : ''}`;
      }
    });
  });
}

iniciar();
