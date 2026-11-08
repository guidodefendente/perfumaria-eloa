/** Categorias: criar, editar, excluir, ordenar e escolher se aparece na página inicial. */
import { api } from './api.js';
import { esc, $, icone, NOMES_ICONES, avisar, confirmar, abrirJanela, ocupado, mostrarErros } from './ui.js';
import { estado, carregarCatalogo, tela } from './app.js';
import { validarCategoria, ICONES } from './validacao.js';

export async function telaCategorias() {
  const { categorias } = await carregarCatalogo(true);
  const lista = categorias.map((c) => ({ ...c }));

  tela().innerHTML = `
    <div class="cabecalho">
      <div><h1>Categorias</h1><p class="sub">A ordem aqui é a ordem do site.</p></div>
      <button type="button" class="botao botao-primario" id="nova">${icone('mais')} Nova categoria</button>
    </div>
    <ul class="lista" id="lista-cats"></ul>
    <p class="dica" style="margin-top:12px">Use as setas para mudar a ordem. Toque no nome para editar ou excluir.</p>`;

  const desenhar = () => {
    $('#lista-cats').innerHTML = lista.map((c, i) => `
      <li class="item">
        <button type="button" class="item-link" data-editar="${esc(c.id)}" style="background:none;border:0;padding:0;text-align:left">
          <span class="cat-icone">${icone(c.icone)}</span>
          <span class="item-texto">
            <strong>${esc(c.nome)}</strong>
            <span>${c.produtos} ${c.produtos === 1 ? 'produto' : 'produtos'}</span>
            <span class="selos">${c.naHome ? '<span class="selo selo-ok">Na página inicial</span>' : '<span class="selo selo-oculto">Fora da página inicial</span>'}</span>
          </span>
        </button>
        <span class="ordem">
          <button type="button" class="icone-botao" data-mover="${i}" data-dir="-1" aria-label="Subir ${esc(c.nome)}"${i === 0 ? ' disabled' : ''}>${icone('cima')}</button>
          <button type="button" class="icone-botao" data-mover="${i}" data-dir="1" aria-label="Descer ${esc(c.nome)}"${i === lista.length - 1 ? ' disabled' : ''}>${icone('baixo')}</button>
        </span>
      </li>`).join('');
  };
  desenhar();

  let salvando = Promise.resolve();
  $('#lista-cats').addEventListener('click', (e) => {
    const mover = e.target.closest('[data-mover]');
    if (mover) {
      const i = Number(mover.dataset.mover);
      const j = i + Number(mover.dataset.dir);
      [lista[i], lista[j]] = [lista[j], lista[i]];
      desenhar();
      const foco = $(`[data-mover="${j}"][data-dir="${mover.dataset.dir}"]`) || $(`[data-mover="${j}"]`);
      if (foco && !foco.disabled) foco.focus();
      const ids = lista.map((c) => c.id);
      salvando = salvando.then(() => api('PUT', '/api/admin/categorias/ordem', { ids }))
        .then(() => { estado.catalogo = null; })
        .catch((erro) => avisar(erro.message, 'erro'));
      return;
    }
    const editar = e.target.closest('[data-editar]');
    if (editar) janelaCategoria(lista.find((c) => c.id === editar.dataset.editar));
  });
  $('#nova').addEventListener('click', () => janelaCategoria(null));
}

function janelaCategoria(cat) {
  const c = cat || { nome: '', icone: 'sparkle', naHome: true, produtos: 0 };
  const { el, fechar } = abrirJanela(`
    <h2>${cat ? 'Editar categoria' : 'Nova categoria'}</h2>
    <form id="form-cat" novalidate>
      <div class="campo" data-campo="nome">
        <label for="cat-nome">Nome</label>
        <input class="entrada" id="cat-nome" name="nome" value="${esc(c.nome)}" maxlength="40" placeholder="Ex.: Presentes" autofocus>
      </div>
      <div class="campo" data-campo="icone">
        <span class="rotulo" id="rot-icone">Ícone</span>
        <div class="icones" role="radiogroup" aria-labelledby="rot-icone">
          ${ICONES.map((i) => `<label title="${NOMES_ICONES[i]}"><input type="radio" name="icone" value="${i}"${c.icone === i ? ' checked' : ''} aria-label="${NOMES_ICONES[i]}"><span>${icone(i)}</span></label>`).join('')}
        </div>
      </div>
      <label class="interruptor">
        <span class="interruptor-texto"><strong>Mostrar na página inicial</strong><small>Desligada, a categoria continua no catálogo, só não aparece entre os atalhos da página inicial.</small></span>
        <span class="chave"><input type="checkbox" name="naHome"${c.naHome ? ' checked' : ''}><i></i></span>
      </label>
      <div class="janela-acoes">
        <button type="button" class="botao botao-secundario" data-fechar>Cancelar</button>
        <button type="submit" class="botao botao-primario">Salvar</button>
      </div>
      ${cat ? `<div class="zona-perigo" style="margin-top:20px">
        <p>${c.produtos ? `Para excluir esta categoria, primeiro mude os ${c.produtos === 1 ? 'o produto dela' : `${c.produtos} produtos dela`} de categoria.` : 'Esta categoria não tem produtos e pode ser excluída.'}</p>
        <button type="button" class="botao botao-perigo-leve botao-largo" data-excluir${c.produtos ? ' disabled' : ''}>${icone('lixo')} Excluir categoria</button>
      </div>` : ''}
    </form>`);

  const form = $('#form-cat', el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const dados = { nome: form.nome.value, icone: (form.querySelector('[name=icone]:checked') || {}).value, naHome: form.naHome.checked };
    const v = validarCategoria(dados);
    mostrarErros(form, v.ok ? null : v.campos);
    if (!v.ok) return;
    await ocupado($('button[type=submit]', form), 'Salvando…', async () => {
      try {
        if (cat) await api('PUT', `/api/admin/categorias/${encodeURIComponent(cat.id)}`, dados);
        else await api('POST', '/api/admin/categorias', dados);
        estado.catalogo = null;
        fechar();
        avisar(cat ? 'Categoria atualizada' : `Categoria “${v.categoria.nome}” criada`, 'ok');
        telaCategorias();
      } catch (erro) {
        mostrarErros(form, erro.campos);
        if (!erro.campos) avisar(erro.message, 'erro');
      }
    });
  });

  const excluir = $('[data-excluir]', el);
  if (excluir) excluir.addEventListener('click', async () => {
    fechar();
    const ok = await confirmar({ titulo: 'Excluir categoria?', texto: `A categoria <strong>${esc(cat.nome)}</strong> vai sair do site.`, sim: 'Excluir', perigo: true });
    if (!ok) return;
    try {
      await api('DELETE', `/api/admin/categorias/${encodeURIComponent(cat.id)}`);
      estado.catalogo = null;
      avisar('Categoria excluída', 'ok');
      telaCategorias();
    } catch (erro) {
      avisar(erro.message, 'erro');
    }
  });
}
