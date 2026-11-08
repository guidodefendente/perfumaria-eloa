/** Peças de interface do painel: escape de HTML, avisos, janelas e ícones. */

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

export const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const precoTexto = (v) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function quando(ms) {
  const d = new Date(ms);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === hoje.toDateString()) return `hoje, ${hora}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem, ${hora}`;
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}, ${hora}`;
}

// ── Ícones (traço, mesmo estilo do site) ───────────────────────────────────
const P = {
  mais: '<path d="M12 5v14M5 12h14"/>',
  lixo: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>',
  esquerda: '<path d="m15 18-6-6 6-6"/>',
  direita: '<path d="m9 18 6-6-6-6"/>',
  cima: '<path d="m18 15-6-6-6 6"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  estrela: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  olho: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  lapis: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  // ícones de categoria (iguais aos do site, assets/js/app.js)
  bottle: '<rect x="10" y="2" width="4" height="3" rx="1"/><path d="M15.5 4.5h1.8"/><path d="M11 5v2.6L8.6 10A2 2 0 0 0 8 11.4V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-7.6a2 2 0 0 0-.6-1.4L13 7.6V5"/>',
  lipstick: '<path d="M9 8V4.5A1.5 1.5 0 0 1 10.5 3h1A1.5 1.5 0 0 1 13 4.5V8"/><rect x="7" y="8" width="8" height="6" rx="1.5"/><rect x="8" y="14" width="6" height="7" rx="1"/>',
  hair: '<path d="M4 6.5h16"/><path d="M4 6.5v3M8 6.5v5M12 6.5v3M16 6.5v5M20 6.5v3"/><path d="M5 16.5c2.6-1.6 5.1-1.6 7 0s4.4 1.6 7 0"/>',
  sparkle: '<path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>',
  wipe: '<rect x="3.5" y="6" width="17" height="14" rx="2.5"/><path d="M7.5 6V4.6a1.6 1.6 0 0 1 1.6-1.6h5.8a1.6 1.6 0 0 1 1.6 1.6V6"/><path d="M8.5 10.5h7a1.5 1.5 0 0 1 0 3h-4"/>',
  nail: '<path d="M11 2h2v5h-2z"/><path d="M10.4 7h3.2a1 1 0 0 1 1 1v.7l1.6 2.2a2 2 0 0 1 .4 1.2V20a2 2 0 0 1-2 2H9.4a2 2 0 0 1-2-2v-7.9a2 2 0 0 1 .4-1.2L9.4 8.7V8a1 1 0 0 1 1-1Z"/><path d="M8 15h8"/>',
};
export const NOMES_ICONES = {
  bottle: 'Perfume', lipstick: 'Batom', hair: 'Pente', sparkle: 'Brilho', eye: 'Olho', wipe: 'Lenço', nail: 'Esmalte',
};

export const icone = (nome, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[nome] || ''}</svg>`;

// ── Avisos rápidos ─────────────────────────────────────────────────────────
export function avisar(texto, tipo = '') {
  const caixa = $('#avisos');
  const el = document.createElement('div');
  el.className = `aviso ${tipo}`;
  el.textContent = texto;
  caixa.appendChild(el);
  while (caixa.children.length > 2) caixa.firstElementChild.remove();
  setTimeout(() => el.remove(), tipo === 'erro' ? 6000 : 3200);
}

// ── Janela (confirmação / formulário) ──────────────────────────────────────
let fecharAtual = null;

/**
 * Abre uma janela. `conteudo` é HTML. Retorna { el, fechar }.
 * Esc e toque fora fecham (exceto se `fixa`).
 */
export function abrirJanela(conteudo, { fixa = false, aoFechar } = {}) {
  if (fecharAtual) fecharAtual();
  const raiz = $('#janela-raiz');
  const anterior = document.activeElement;
  raiz.innerHTML = `<div class="fundo-janela"><div class="janela" role="dialog" aria-modal="true" tabindex="-1">${conteudo}</div></div>`;
  const fundo = raiz.firstElementChild;
  const el = fundo.firstElementChild;
  document.body.style.overflow = 'hidden';

  const fechar = () => {
    raiz.innerHTML = '';
    document.body.style.overflow = '';
    document.removeEventListener('keydown', tecla);
    fecharAtual = null;
    if (anterior && anterior.focus) anterior.focus();
    if (aoFechar) aoFechar();
  };
  const tecla = (e) => {
    if (e.key === 'Escape' && !fixa) fechar();
    if (e.key === 'Tab') {
      const focaveis = $$('button:not([disabled]), input, select, textarea, a[href]', el);
      if (!focaveis.length) return;
      const [primeiro, ultimo] = [focaveis[0], focaveis[focaveis.length - 1]];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }
  };
  document.addEventListener('keydown', tecla);
  fundo.addEventListener('click', (e) => { if (e.target === fundo && !fixa) fechar(); });
  $$('[data-fechar]', el).forEach((b) => b.addEventListener('click', fechar));
  const titulo = $('h2', el);
  if (titulo) { titulo.id = 'janela-titulo'; el.setAttribute('aria-labelledby', 'janela-titulo'); }
  setTimeout(() => ($('[autofocus]', el) || el).focus(), 30);
  fecharAtual = fechar;
  return { el, fechar };
}

/** Confirmação simples. Resolve true/false. */
export function confirmar({ titulo, texto, sim = 'Confirmar', nao = 'Cancelar', perigo = false }) {
  return new Promise((resolve) => {
    let resposta = false;
    const { el, fechar } = abrirJanela(`
      <h2>${esc(titulo)}</h2>
      <p>${texto}</p>
      <div class="janela-acoes">
        <button type="button" class="botao botao-secundario" data-fechar>${esc(nao)}</button>
        <button type="button" class="botao ${perigo ? 'botao-perigo' : 'botao-primario'}" data-sim>${esc(sim)}</button>
      </div>`, { aoFechar: () => resolve(resposta) });
    $('[data-sim]', el).addEventListener('click', () => { resposta = true; fechar(); });
  });
}

/** Desabilita o botão e mostra "carregando" enquanto a promessa roda. */
export async function ocupado(botao, texto, tarefa) {
  const original = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = `<span class="girando" aria-hidden="true"></span> ${esc(texto)}`;
  try {
    return await tarefa();
  } finally {
    botao.disabled = false;
    botao.innerHTML = original;
  }
}

/** Some com a mensagem de erro do campo assim que a pessoa começa a corrigir. */
document.addEventListener('input', (e) => limparErroDoCampo(e.target));
document.addEventListener('change', (e) => limparErroDoCampo(e.target));
function limparErroDoCampo(alvo) {
  const campo = alvo && alvo.closest && alvo.closest('[data-campo]');
  if (!campo) return;
  campo.querySelectorAll('.erro-campo').forEach((x) => x.remove());
  campo.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
}

/** Mostra os erros por campo vindos da API ou da validação local. */
export function mostrarErros(form, campos) {
  $$('.erro-campo', form).forEach((e) => e.remove());
  $$('[aria-invalid]', form).forEach((e) => e.removeAttribute('aria-invalid'));
  if (!campos) return;
  let primeiro = null;
  for (const [nome, msg] of Object.entries(campos)) {
    const alvo = $(`[data-campo="${nome}"]`, form);
    if (!alvo) continue;
    const entrada = $('input, select, textarea', alvo);
    if (entrada) entrada.setAttribute('aria-invalid', 'true');
    const p = document.createElement('p');
    p.className = 'erro-campo';
    p.textContent = msg;
    alvo.appendChild(p);
    primeiro = primeiro || alvo;
  }
  if (primeiro) primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
