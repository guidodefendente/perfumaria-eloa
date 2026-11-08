/** Conta: troca de senha, sair, uso do espaço de fotos, histórico e ajuda. */
import { api } from './api.js';
import { esc, $, avisar, confirmar, ocupado, mostrarErros, quando } from './ui.js';
import { estado, tela, ligarMostrarSenha } from './app.js';
import { derivarChave, novoSal, ITERACOES, problemaNaSenha } from './senha.js';

const mb = (b) => `${(b / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;

export async function telaConta() {
  const [uso, { itens }] = await Promise.all([api('GET', '/api/admin/uso'), api('GET', '/api/admin/historico')]);
  const pct = Math.min(100, Math.round((uso.bytes / uso.limiteBytes) * 100));

  tela().innerHTML = `
    <div class="cabecalho"><div><h1>Conta</h1><p class="sub">${esc(estado.usuario.email)}</p></div></div>

    <section class="cartao">
      <h2>Como usar o painel</h2>
      <ul style="margin:8px 0 0;padding-left:20px;line-height:1.6;font-size:15px">
        <li><strong>Salvou, publicou:</strong> o site muda na hora, não precisa de mais nada.</li>
        <li><strong>Produto esgotado?</strong> Desligue “Mostrar no site” em vez de excluir — depois é só ligar de novo.</li>
        <li><strong>Foto principal</strong> é a primeira; use a ★ para trocar.</li>
        <li><strong>Destaques e ordem das categorias</strong> ficam em “Página inicial”.</li>
        <li><strong>Dica:</strong> no celular, use “Adicionar à tela de início” no navegador para abrir o painel como um aplicativo.</li>
      </ul>
    </section>

    <section class="cartao">
      <h2>Trocar senha</h2>
      <form id="form-senha" novalidate>
        <div id="msg-senha"></div>
        ${['atual:Senha atual:current-password', 'nova:Nova senha:new-password', 'confirmar:Repita a nova senha:new-password'].map((s) => {
          const [id, rotulo, ac] = s.split(':');
          return `<div class="campo" data-campo="${id}"><label for="${id}">${rotulo}</label>
            <div class="senha"><input class="entrada" id="${id}" name="${id}" type="password" autocomplete="${ac}">
            <button type="button" data-mostrar="${id}" aria-label="Mostrar senha">Mostrar</button></div></div>`;
        }).join('')}
        <button type="submit" class="botao botao-primario botao-largo">Salvar nova senha</button>
      </form>
    </section>

    <section class="cartao">
      <h2>Espaço para fotos</h2>
      <div class="medidor" role="img" aria-label="${pct}% usado"><i style="width:${Math.max(pct, 1)}%${pct > 85 ? ';background:var(--erro)' : ''}"></i></div>
      <p class="sub">${uso.fotos} fotos enviadas pelo painel · ${mb(uso.bytes)} de ${mb(uso.limiteBytes)} (gratuito). Limite de ${uso.limiteDia} fotos por dia.</p>
    </section>

    <section class="cartao">
      <h2>Últimas alterações</h2>
      ${itens.length ? `<ul class="historico">${itens.map((h) => `<li>${esc(h.resumo)}<small>${esc(quando(h.em))} · ${esc(h.usuario)}</small></li>`).join('')}</ul>`
        : '<p class="sub">Nenhuma alteração ainda.</p>'}
    </section>

    <section class="cartao">
      <h2>Sair</h2>
      <p class="sub" style="margin-bottom:12px">Perdeu o celular ou entrou em um aparelho de outra pessoa? Use “Sair de todos os aparelhos”.</p>
      <div class="duas-colunas quebra">
        <button type="button" class="botao botao-secundario" id="sair">Sair deste aparelho</button>
        <button type="button" class="botao botao-perigo-leve" id="sair-todos">Sair de todos os aparelhos</button>
      </div>
    </section>`;

  const form = $('#form-senha');
  ligarMostrarSenha(form);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const erros = {};
    if (!form.atual.value) erros.atual = 'Digite sua senha atual.';
    const problema = problemaNaSenha(form.nova.value, estado.usuario.email);
    if (problema) erros.nova = problema;
    else if (form.nova.value !== form.confirmar.value) erros.confirmar = 'As duas senhas estão diferentes.';
    else if (form.nova.value === form.atual.value) erros.nova = 'A nova senha precisa ser diferente da atual.';
    mostrarErros(form, erros);
    if (Object.keys(erros).length) return;
    await ocupado($('button[type=submit]', form), 'Protegendo sua senha…', async () => {
      try {
        const { sal, iteracoes } = await api('GET', '/api/auth/senha');
        const chaveAtual = await derivarChave(form.atual.value, sal, iteracoes);
        const salNovo = novoSal();
        const chave = await derivarChave(form.nova.value, salNovo, ITERACOES);
        await api('POST', '/api/auth/senha', { chaveAtual, sal: salNovo, iteracoes: ITERACOES, chave });
        form.reset();
        avisar('Senha trocada. Os outros aparelhos foram desconectados.', 'ok');
      } catch (erro) {
        mostrarErros(form, erro.campos);
        if (!erro.campos) $('#msg-senha').innerHTML = `<div class="caixa caixa-erro">${esc(erro.message)}</div>`;
      }
    });
  });

  const sair = async (todas) => {
    if (todas) {
      const ok = await confirmar({ titulo: 'Sair de todos os aparelhos?', texto: 'Você e qualquer outro aparelho conectado vão precisar entrar de novo.', sim: 'Sair de todos', perigo: true });
      if (!ok) return;
    }
    try { await api('POST', '/api/auth/sair', { todas }); } catch (_) { /* sai do mesmo jeito */ }
    estado.usuario = null;
    estado.catalogo = null;
    location.replace('#/entrar');
  };
  $('#sair').addEventListener('click', () => sair(false));
  $('#sair-todos').addEventListener('click', () => sair(true));
}
