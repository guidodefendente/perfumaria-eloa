/**
 * Página inicial do site: quais produtos são destaque (e em que ordem) e
 * quais categorias aparecem entre os atalhos (e em que ordem).
 *
 * Como o site usa os destaques (assets/js/app.js):
 *   1º ao 3º  → vitrine do topo da página e seção "Destaques"
 *   4º ao 6º  → seção "Destaques"
 *   7º em diante → só o selo "Destaque" no catálogo
 */
import { api } from './api.js';
import { esc, $, brl, icone, avisar, abrirJanela, ocupado } from './ui.js';
import { estado, carregarCatalogo, tela, marcarSujo } from './app.js';

const ondeAparece = (i) => (i < 3 ? 'Topo da página + Destaques' : i < 6 ? 'Seção Destaques' : 'Só o selo no catálogo');

export async function telaInicio() {
  const { produtos, categorias } = await carregarCatalogo(true);
  const porId = new Map(produtos.map((p) => [p.id, p]));
  let destaques = produtos.filter((p) => p.destaque).sort((a, b) => a.destaquePos - b.destaquePos).map((p) => p.id);
  const cats = categorias.map((c) => ({ id: c.id, nome: c.nome, icone: c.icone, naHome: c.naHome }));

  tela().innerHTML = `<div id="pagina-inicio">
    <div class="cabecalho">
      <div><h1>Página inicial</h1><p class="sub">O que o cliente vê primeiro ao abrir o site.</p></div>
      <a class="botao botao-secundario botao-pequeno" href="/" target="_blank" rel="noopener">${icone('olho')} Ver página</a>
    </div>

    <section class="cartao">
      <h2>Produtos em destaque</h2>
      <p class="sub">Os 3 primeiros aparecem no topo da página; os 6 primeiros, na seção “Destaques”. Todo produto em destaque que você cadastra ou salva vai automaticamente para o 1º lugar — aqui você pode ajustar a ordem à mão.</p>
      <ul class="lista" id="destaques" style="box-shadow:none"></ul>
      <button type="button" class="botao botao-secundario botao-largo" id="add-destaque" style="margin-top:12px">${icone('mais')} Adicionar destaque</button>
    </section>

    <section class="cartao">
      <h2>Categorias na página inicial</h2>
      <p class="sub">Ligue as que devem aparecer e ajuste a ordem. A ordem também vale para o catálogo.</p>
      <ul class="lista" id="cats" style="box-shadow:none"></ul>
    </section>

    <div class="barra-salvar">
      <p class="estado" id="estado-inicio" hidden>Alterações ainda não salvas</p>
      <button type="button" class="botao botao-primario" id="salvar-inicio" disabled>Salvar página inicial</button>
    </div></div>`;
  const pagina = $('#pagina-inicio');

  const sujo = () => { marcarSujo(); $('#salvar-inicio').disabled = false; $('#estado-inicio').hidden = false; };

  const desenhar = () => {
    $('#destaques').innerHTML = destaques.length ? destaques.map((id, i) => {
      const p = porId.get(id);
      return `<li class="item${p.ativo ? '' : ' oculto'}">
        <span class="item-link">
          <img class="item-foto" src="${esc(p.fotos[0] ? p.fotos[0].thumb : '')}" alt="" width="56" height="56" loading="lazy">
          <span class="item-texto">
            <strong>${i + 1}. ${esc(p.nome)}</strong>
            <span>${esc(p.marca)} · ${brl(p.preco)}</span>
            <span class="selos">${p.ativo ? `<span class="selo ${i < 6 ? 'selo-ok' : 'selo-oculto'}">${ondeAparece(i)}</span>` : '<span class="selo selo-oculto">Oculto — não aparece</span>'}</span>
          </span>
        </span>
        <span class="ordem">
          <button type="button" class="icone-botao" data-d-mover="${i}" data-dir="-1" aria-label="Subir ${esc(p.nome)}"${i === 0 ? ' disabled' : ''}>${icone('cima')}</button>
          <button type="button" class="icone-botao" data-d-mover="${i}" data-dir="1" aria-label="Descer ${esc(p.nome)}"${i === destaques.length - 1 ? ' disabled' : ''}>${icone('baixo')}</button>
          <button type="button" class="icone-botao" data-d-tirar="${i}" aria-label="Tirar ${esc(p.nome)} dos destaques">${icone('x')}</button>
        </span>
      </li>`;
    }).join('') : '<li class="vazio"><strong>Nenhum destaque</strong>Sem destaques, a página inicial mostra o logotipo no topo.</li>';

    $('#cats').innerHTML = cats.map((c, i) => `
      <li class="item">
        <span class="cat-icone">${icone(c.icone)}</span>
        <span class="item-texto"><strong>${esc(c.nome)}</strong></span>
        <label class="chave"><input type="checkbox" data-c-home="${i}"${c.naHome ? ' checked' : ''} aria-label="Mostrar ${esc(c.nome)} na página inicial"><i></i></label>
        <span class="ordem">
          <button type="button" class="icone-botao" data-c-mover="${i}" data-dir="-1" aria-label="Subir ${esc(c.nome)}"${i === 0 ? ' disabled' : ''}>${icone('cima')}</button>
          <button type="button" class="icone-botao" data-c-mover="${i}" data-dir="1" aria-label="Descer ${esc(c.nome)}"${i === cats.length - 1 ? ' disabled' : ''}>${icone('baixo')}</button>
        </span>
      </li>`).join('');
  };
  desenhar();

  const trocar = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; };
  pagina.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.dMover !== undefined) trocar(destaques, Number(b.dataset.dMover), Number(b.dataset.dMover) + Number(b.dataset.dir));
    else if (b.dataset.dTirar !== undefined) destaques.splice(Number(b.dataset.dTirar), 1);
    else if (b.dataset.cMover !== undefined) trocar(cats, Number(b.dataset.cMover), Number(b.dataset.cMover) + Number(b.dataset.dir));
    else return;
    sujo();
    desenhar();
  });
  pagina.addEventListener('change', (e) => {
    const chk = e.target.closest('[data-c-home]');
    if (!chk) return;
    cats[Number(chk.dataset.cHome)].naHome = chk.checked;
    sujo();
    desenhar();
  });

  $('#add-destaque').addEventListener('click', () => escolherProduto(produtos, destaques, (id) => {
    destaques.push(id);
    sujo();
    desenhar();
  }));

  $('#salvar-inicio').addEventListener('click', async (e) => {
    await ocupado(e.currentTarget, 'Salvando…', async () => {
      try {
        await api('PUT', '/api/admin/pagina-inicial', { destaques, categorias: cats.map((c) => ({ id: c.id, naHome: c.naHome })) });
        marcarSujo(false);
        estado.catalogo = null;
        $('#estado-inicio').hidden = true;
        avisar('Página inicial atualizada no site', 'ok');
      } catch (erro) {
        avisar(erro.message, 'erro');
      }
    });
    $('#salvar-inicio').disabled = !estado.sujo;
  });
}

function escolherProduto(produtos, jaEscolhidos, aoEscolher) {
  const disponiveis = produtos.filter((p) => p.ativo && !jaEscolhidos.includes(p.id));
  const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const { el, fechar } = abrirJanela(`
    <h2>Adicionar destaque</h2>
    <div class="busca">${icone('busca')}<input class="entrada" id="busca-dest" type="search" placeholder="Buscar produto" aria-label="Buscar produto" autofocus autocomplete="off"></div>
    <ul class="lista" id="opcoes" style="max-height:52vh;overflow-y:auto;box-shadow:none"></ul>
    <div class="janela-acoes"><button type="button" class="botao botao-secundario" data-fechar>Fechar</button></div>`);
  const desenhar = (q) => {
    const termos = normalizar(q).split(/\s+/).filter(Boolean);
    const lista = disponiveis.filter((p) => termos.every((t) => normalizar(`${p.nome} ${p.marca}`).includes(t))).slice(0, 60);
    $('#opcoes', el).innerHTML = lista.length ? lista.map((p) => `
      <li><button type="button" class="item" data-escolher="${esc(p.id)}" style="width:100%;background:none;border:0;text-align:left">
        <img class="item-foto" src="${esc(p.fotos[0] ? p.fotos[0].thumb : '')}" alt="" width="56" height="56" loading="lazy">
        <span class="item-texto"><strong>${esc(p.nome)}</strong><span>${esc(p.marca)} · ${brl(p.preco)}</span></span>
      </button></li>`).join('') : '<li class="vazio">Nenhum produto disponível.</li>';
  };
  desenhar('');
  $('#busca-dest', el).addEventListener('input', (e) => desenhar(e.target.value));
  $('#opcoes', el).addEventListener('click', (e) => {
    const b = e.target.closest('[data-escolher]');
    if (!b) return;
    aoEscolher(b.dataset.escolher);
    fechar();
    avisar('Destaque adicionado — não esqueça de salvar');
  });
}
