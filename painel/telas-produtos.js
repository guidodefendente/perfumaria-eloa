/** Telas de produtos: lista (busca, filtros, mostrar/ocultar) e formulário. */
import { api } from './api.js';
import { esc, $, $$, brl, precoTexto, icone, avisar, confirmar, abrirJanela, ocupado, mostrarErros } from './ui.js';
import { estado, carregarCatalogo, tela, marcarSujo, ir } from './app.js';
import { prepararFoto } from './imagens.js';
import { validarProduto, CAMPOS_FRAGRANCIA, MAX_FOTOS, MAX_FICHA } from './validacao.js';

// ── Lista ─────────────────────────────────────────────────────────────────
const filtros = JSON.parse(sessionStorage.getItem('painel:filtros') || 'null') || { busca: '', situacao: 'todos', categoria: '' };
const salvarFiltros = () => sessionStorage.setItem('painel:filtros', JSON.stringify(filtros));
const normalizar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export async function telaProdutos() {
  const { produtos, categorias } = await carregarCatalogo(true);
  const nomeCat = Object.fromEntries(categorias.map((c) => [c.id, c.nome]));
  const conta = {
    todos: produtos.length,
    site: produtos.filter((p) => p.ativo).length,
    ocultos: produtos.filter((p) => !p.ativo).length,
    destaques: produtos.filter((p) => p.destaque).length,
  };

  tela().innerHTML = `
    <div class="cabecalho">
      <div><h1>Produtos</h1><p class="sub">${conta.site} no site${conta.ocultos ? ` · ${conta.ocultos} ocultos` : ''}</p></div>
      <a class="botao botao-primario flutuante" href="#/produtos/novo">${icone('mais')} Novo produto</a>
    </div>
    <div class="busca">${icone('busca')}
      <label class="pular" for="busca">Buscar produto</label>
      <input class="entrada" id="busca" type="search" placeholder="Buscar por nome ou marca" value="${esc(filtros.busca)}" autocomplete="off">
    </div>
    <div class="filtros" role="group" aria-label="Filtrar">
      ${[['todos', 'Todos'], ['site', 'No site'], ['ocultos', 'Ocultos'], ['destaques', 'Destaques']].map(([id, nome]) =>
        `<button type="button" class="filtro" data-situacao="${id}" aria-pressed="${filtros.situacao === id}">${nome}<b>${conta[id]}</b></button>`).join('')}
    </div>
    <div class="campo">
      <label class="pular" for="filtro-cat">Categoria</label>
      <select class="entrada" id="filtro-cat">
        <option value="">Todas as categorias</option>
        ${categorias.map((c) => `<option value="${esc(c.id)}"${filtros.categoria === c.id ? ' selected' : ''}>${esc(c.nome)} (${c.produtos})</option>`).join('')}
      </select>
    </div>
    <div id="resultado"></div>`;

  const desenhar = () => {
    const termos = normalizar(filtros.busca.trim()).split(/\s+/).filter(Boolean);
    const lista = produtos.filter((p) => {
      if (filtros.situacao === 'site' && !p.ativo) return false;
      if (filtros.situacao === 'ocultos' && p.ativo) return false;
      if (filtros.situacao === 'destaques' && !p.destaque) return false;
      if (filtros.categoria && p.categoria !== filtros.categoria) return false;
      const texto = normalizar(`${p.nome} ${p.marca} ${nomeCat[p.categoria] || ''}`);
      return termos.every((t) => texto.includes(t));
    });
    $('#resultado').innerHTML = lista.length ? `<ul class="lista">${lista.map((p) => `
      <li class="item${p.ativo ? '' : ' oculto'}">
        <a class="item-link" href="#/produtos/${esc(p.id)}">
          <img class="item-foto" src="${esc(p.fotos[0] ? p.fotos[0].thumb : '')}" alt="" width="56" height="56" loading="lazy">
          <span class="item-texto">
            <strong>${esc(p.nome)}</strong>
            <span>${esc(p.marca)} · <span class="item-preco" style="display:inline">${brl(p.preco)}</span></span>
            <span class="selos">${p.ativo ? '' : '<span class="selo selo-oculto">Oculto</span>'}${p.destaque ? '<span class="selo selo-destaque">Destaque</span>' : ''}<span class="selo" style="padding-left:0;color:var(--tinta-4)">${esc(nomeCat[p.categoria] || '')}</span></span>
          </span>
        </a>
        <label class="chave" title="${p.ativo ? 'Aparece no site' : 'Oculto do site'}">
          <input type="checkbox" data-ativo="${esc(p.id)}" ${p.ativo ? 'checked' : ''} aria-label="Mostrar ${esc(p.nome)} no site"><i></i>
        </label>
      </li>`).join('')}</ul>`
      : `<div class="vazio"><strong>Nenhum produto encontrado</strong>${filtros.busca || filtros.categoria || filtros.situacao !== 'todos' ? 'Tente limpar a busca ou os filtros.' : 'Toque em “Novo produto” para cadastrar o primeiro.'}</div>`;
  };
  desenhar();

  $('#busca').addEventListener('input', (e) => { filtros.busca = e.target.value; salvarFiltros(); desenhar(); });
  $('#filtro-cat').addEventListener('change', (e) => { filtros.categoria = e.target.value; salvarFiltros(); desenhar(); });
  $$('[data-situacao]').forEach((b) => b.addEventListener('click', () => {
    filtros.situacao = b.dataset.situacao;
    salvarFiltros();
    $$('[data-situacao]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    desenhar();
  }));
  $('#resultado').addEventListener('change', async (e) => {
    const chk = e.target.closest('[data-ativo]');
    if (!chk) return;
    const p = produtos.find((x) => x.id === chk.dataset.ativo);
    chk.disabled = true;
    try {
      await api('PUT', `/api/admin/produtos/${encodeURIComponent(p.id)}/ativo`, { ativo: chk.checked });
      p.ativo = chk.checked;
      avisar(p.ativo ? `“${p.nome}” voltou para o site` : `“${p.nome}” foi ocultado do site`, 'ok');
      desenhar();
    } catch (erro) {
      chk.checked = !chk.checked;
      avisar(erro.message, 'erro');
    } finally {
      chk.disabled = false;
    }
  });
}

// ── Formulário ────────────────────────────────────────────────────────────
const ROTULOS_FRAGRANCIA = {
  familia: ['Família olfativa', 'Ex.: Oriental floral'],
  acordes: ['Acordes principais', 'Ex.: Doce, baunilha e âmbar'],
  saida: ['Notas de saída', 'Ex.: Bergamota e pimenta rosa'],
  coracao: ['Notas de coração', 'Ex.: Rosa e jasmim'],
  fundo: ['Notas de fundo', 'Ex.: Âmbar e baunilha'],
  sensacao: ['Sensação', 'Ex.: Envolvente e marcante.'],
  ocasiao: ['Ocasião sugerida', 'Ex.: Noite e ocasiões especiais.'],
};

const ehPerfume = (categoria) => categoria === 'perfumes';

export async function telaProduto(id) {
  const { produtos, categorias } = await carregarCatalogo(true);
  const existente = id ? produtos.find((p) => p.id === id) : null;
  if (id && !existente) {
    tela().innerHTML = `<a class="voltar" href="#/produtos">${icone('esquerda', 'width="20" height="20"')} Produtos</a>
      <div class="vazio"><strong>Produto não encontrado</strong>Ele pode ter sido excluído.</div>`;
    return;
  }
  const p = existente || {
    nome: '', marca: '', categoria: (filtros.categoria || ''), preco: '', descricao: '', publico: null,
    ficha: [], fragrancia: {}, ativo: true, destaque: false, fotos: [],
  };
  // Fotos: cada item tem { id, src, thumb } quando já está salva no servidor.
  const fotos = p.fotos.map((f) => ({ ...f, estado: 'ok' }));
  const marcas = [...new Set(produtos.map((x) => x.marca))].sort((a, b) => a.localeCompare(b, 'pt-BR'));

  tela().innerHTML = `
    <a class="voltar" href="#/produtos">${icone('esquerda', 'width="20" height="20"')} Produtos</a>
    <div class="cabecalho">
      <div><h1>${existente ? 'Editar produto' : 'Novo produto'}</h1>
      ${existente ? `<p class="sub">${p.ativo ? '<span class="selo selo-ok">No site</span>' : '<span class="selo selo-oculto">Oculto do site</span>'}</p>` : ''}</div>
      ${existente && p.ativo ? `<a class="botao botao-secundario botao-pequeno" href="/produto/${esc(p.id)}/" target="_blank" rel="noopener">${icone('olho')} Ver no site</a>` : ''}
    </div>

    <form id="form-produto" novalidate>
      <section class="cartao" data-campo="fotos">
        <h2>Fotos</h2>
        <p class="sub">A primeira foto é a principal (aparece no catálogo). Até ${MAX_FOTOS} fotos.</p>
        <div class="fotos" id="fotos"></div>
      </section>

      <section class="cartao">
        <h2>Informações</h2>
        <div class="campo" data-campo="nome">
          <label for="nome">Nome do produto</label>
          <input class="entrada" id="nome" name="nome" value="${esc(p.nome)}" maxlength="120" autocomplete="off" placeholder="Ex.: Malbec Eau de Parfum">
        </div>
        <div class="campo" data-campo="marca">
          <label for="marca">Marca</label>
          <input class="entrada" id="marca" name="marca" value="${esc(p.marca)}" maxlength="80" list="lista-marcas" autocomplete="off" placeholder="Ex.: O Boticário (ou “Sem marca”)">
          <datalist id="lista-marcas">${marcas.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
        </div>
        <div class="duas-colunas quebra">
          <div class="campo" data-campo="categoria">
            <label for="categoria">Categoria</label>
            <select class="entrada" id="categoria" name="categoria">
              <option value="">Escolha…</option>
              ${categorias.map((c) => `<option value="${esc(c.id)}"${p.categoria === c.id ? ' selected' : ''}>${esc(c.nome)}</option>`).join('')}
            </select>
          </div>
          <div class="campo" data-campo="preco">
            <label for="preco">Preço</label>
            <div class="preco"><span aria-hidden="true">R$</span>
              <input class="entrada" id="preco" name="preco" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${p.preco !== '' ? precoTexto(p.preco) : ''}">
            </div>
          </div>
        </div>
        <div class="campo" data-campo="descricao">
          <label for="descricao">Descrição <span class="contador" id="cont-desc"></span></label>
          <textarea class="entrada" id="descricao" name="descricao" maxlength="2000" placeholder="O que é o produto, para que serve, volume ou tamanho…">${esc(p.descricao)}</textarea>
          <p class="dica">Escreva só o que tem certeza. Não precisa colocar o preço aqui.</p>
        </div>
      </section>

      <section class="cartao" id="bloco-publico" data-campo="publico">
        <h2>Para quem é</h2>
        <p class="sub">Usado no filtro Feminino/Masculino dos perfumes.</p>
        <div class="escolhas">
          ${[['', 'Não informar'], ['feminino', 'Feminino'], ['masculino', 'Masculino']].map(([v, n]) => `
            <label class="escolha"><input type="radio" name="publico" value="${v}"${(p.publico || '') === v ? ' checked' : ''}><span>${n}</span></label>`).join('')}
        </div>
      </section>

      <section class="cartao" data-campo="ficha">
        <details class="dobra"${p.ficha.length ? ' open' : ''}>
          <summary>Ficha do produto <span class="opcional" style="font-weight:400;font-size:14px;color:var(--tinta-4);margin-left:auto;margin-right:10px">opcional</span></summary>
          <p class="sub" style="margin-bottom:12px">Dados como volume, peso ou cores. Aparece em “Sobre o produto”.</p>
          <div id="ficha"></div>
          <button type="button" class="botao botao-secundario botao-pequeno" id="mais-ficha">${icone('mais')} Adicionar linha</button>
        </details>
      </section>

      <section class="cartao" id="bloco-fragrancia" data-campo="fragrancia">
        <details class="dobra"${Object.keys(p.fragrancia).length ? ' open' : ''}>
          <summary>Perfil olfativo <span class="opcional" style="font-weight:400;font-size:14px;color:var(--tinta-4);margin-left:auto;margin-right:10px">opcional</span></summary>
          <p class="sub" style="margin-bottom:12px">Preencha só o que estiver confirmado na embalagem ou no site do fabricante. Campos vazios não aparecem no site.</p>
          ${CAMPOS_FRAGRANCIA.map((k) => `
            <div class="campo">
              <label for="frag-${k}">${ROTULOS_FRAGRANCIA[k][0]}</label>
              <input class="entrada" id="frag-${k}" data-frag="${k}" maxlength="300" value="${esc(p.fragrancia[k] || '')}" placeholder="${esc(ROTULOS_FRAGRANCIA[k][1])}">
            </div>`).join('')}
        </details>
      </section>

      <section class="cartao">
        <h2>Publicação</h2>
        <label class="interruptor">
          <span class="interruptor-texto"><strong>Mostrar no site</strong><small>Desligado, o produto fica guardado aqui mas some do site.</small></span>
          <span class="chave"><input type="checkbox" name="ativo"${p.ativo ? ' checked' : ''}><i></i></span>
        </label>
        <label class="interruptor">
          <span class="interruptor-texto"><strong>Destaque na página inicial</strong><small>Ao salvar, o produto vai para o 1º lugar dos destaques. A ordem pode ser ajustada em “Página inicial”.</small></span>
          <span class="chave"><input type="checkbox" name="destaque"${p.destaque ? ' checked' : ''}><i></i></span>
        </label>
      </section>

      <div class="barra-salvar">
        <button type="button" class="botao botao-secundario" id="previa">${icone('olho')} Prévia</button>
        <button type="submit" class="botao botao-primario" id="salvar">Salvar</button>
      </div>
    </form>

    ${existente ? `<section class="zona-perigo">
      <h2>Excluir produto</h2>
      <p>Apaga o produto do site e do painel. Se for só por um tempo (ex.: esgotou), prefira desligar “Mostrar no site”.</p>
      <button type="button" class="botao botao-perigo-leve" id="excluir">${icone('lixo')} Excluir definitivamente</button>
    </section>` : ''}`;

  const form = $('#form-produto');

  // ── Ficha (linhas dinâmicas) ──
  const ficha = p.ficha.map((l) => ({ ...l }));
  const desenharFicha = () => {
    const perfume = ehPerfume(form.categoria.value);
    $('#ficha').innerHTML = ficha.map((l, i) => `
      <div class="ficha-linha">
        <input class="entrada" data-ficha="${i}" data-parte="label" value="${esc(l.label)}" maxlength="40" placeholder="${perfume ? 'Volume' : 'Peso'}" aria-label="Nome do dado ${i + 1}">
        <input class="entrada" data-ficha="${i}" data-parte="value" value="${esc(l.value)}" maxlength="200" placeholder="${perfume ? '100 ml' : '180 g'}" aria-label="Valor do dado ${i + 1}">
        <button type="button" class="icone-botao" data-tirar-ficha="${i}" aria-label="Remover linha ${i + 1}">${icone('x')}</button>
      </div>`).join('');
    $('#mais-ficha').disabled = ficha.length >= MAX_FICHA;
  };
  $('#ficha').addEventListener('input', (e) => {
    const el = e.target.closest('[data-ficha]');
    if (el) ficha[Number(el.dataset.ficha)][el.dataset.parte] = el.value;
  });
  $('#ficha').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tirar-ficha]');
    if (!b) return;
    ficha.splice(Number(b.dataset.tirarFicha), 1);
    desenharFicha();
    marcarSujo();
  });
  $('#mais-ficha').addEventListener('click', () => {
    ficha.push({ label: '', value: '' });
    desenharFicha();
    $$('#ficha [data-parte="label"]').pop().focus();
  });

  // ── Blocos que só valem para perfumes ──
  const ajustarCategoria = () => {
    const perfume = ehPerfume(form.categoria.value);
    $('#bloco-publico').hidden = !perfume;
    $('#bloco-fragrancia').hidden = !perfume;
    desenharFicha();
  };
  form.categoria.addEventListener('change', ajustarCategoria);
  ajustarCategoria();

  // ── Contador da descrição e preço ──
  const contar = () => { $('#cont-desc').textContent = `${form.descricao.value.length}/2000`; };
  form.descricao.addEventListener('input', contar);
  contar();
  form.preco.addEventListener('blur', () => {
    const v = form.preco.value.replace(/[^\d,.]/g, '');
    if (!v) return;
    const n = Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v);
    if (Number.isFinite(n) && n > 0) form.preco.value = precoTexto(n);
  });

  // ── Fotos ──
  const ocupadas = () => fotos.some((f) => f.estado === 'processando' || f.estado === 'enviando');
  const desenharFotos = () => {
    const prontas = fotos.filter((f) => f.estado === 'ok');
    $('#fotos').innerHTML = fotos.map((f, i) => `
      <div class="foto${i === 0 ? ' principal' : ''}" data-indice="${i}">
        <img src="${esc(f.previa || f.thumb || '')}" alt="Foto ${i + 1}${i === 0 ? ' (principal)' : ''}" width="300" height="300">
        ${i === 0 ? '<span class="foto-selo">Principal</span>' : ''}
        ${f.arquivo && f.estado === 'ok' ? `<button type="button" class="foto-ajuste" data-ajuste="${i}" aria-label="Mudar enquadramento da foto ${i + 1}">${f.modo === 'preencher' ? 'Mostrar inteira' : 'Preencher quadro'}</button>` : ''}
        ${f.estado === 'processando' ? '<div class="foto-estado"><span class="girando"></span>Otimizando…</div>' : ''}
        ${f.estado === 'enviando' ? '<div class="foto-estado"><span class="girando"></span>Enviando…</div>' : ''}
        ${f.estado === 'erro' ? `<div class="foto-estado erro">${esc(f.erro)}<button type="button" class="botao botao-secundario botao-pequeno" data-reenviar="${i}">Tentar de novo</button></div>` : ''}
        <div class="foto-acoes">
          <button type="button" data-mover="${i}" data-dir="-1" aria-label="Mover foto ${i + 1} para a esquerda"${i === 0 ? ' disabled' : ''}>${icone('esquerda')}</button>
          <button type="button" data-principal="${i}" aria-label="Usar foto ${i + 1} como principal"${i === 0 ? ' disabled' : ''}>${icone('estrela')}</button>
          <button type="button" data-mover="${i}" data-dir="1" aria-label="Mover foto ${i + 1} para a direita"${i === fotos.length - 1 ? ' disabled' : ''}>${icone('direita')}</button>
          <button type="button" data-tirar="${i}" aria-label="Remover foto ${i + 1}">${icone('lixo')}</button>
        </div>
      </div>`).join('') + (fotos.length < MAX_FOTOS ? `
      <label class="adicionar-fotos">
        ${icone('camera')}
        ${fotos.length ? 'Adicionar mais fotos' : 'Adicionar fotos'}
        <small>Câmera ou galeria</small>
        <input type="file" id="arquivo-fotos" accept="image/*" multiple>
      </label>` : '');
    $('#salvar').disabled = ocupadas();
    const aviso = fotos.find((f) => f.aviso && f.estado === 'ok');
    let caixa = $('#aviso-fotos');
    if (aviso && !caixa) {
      caixa = document.createElement('p');
      caixa.id = 'aviso-fotos';
      caixa.className = 'caixa caixa-alerta';
      caixa.style.margin = '12px 0 0';
      $('#fotos').after(caixa);
    }
    if (caixa) { if (aviso) caixa.textContent = aviso.aviso; else caixa.remove(); }
    return prontas;
  };

  let fila = Promise.resolve();
  const processar = (foto) => {
    fila = fila.then(async () => {
      if (!fotos.includes(foto)) return;
      try {
        foto.estado = 'processando';
        desenharFotos();
        const pronta = await prepararFoto(foto.arquivo, foto.modo);
        if (foto.previa) URL.revokeObjectURL(foto.previa);
        foto.previa = pronta.previa;
        foto.aviso = pronta.aviso;
        foto.estado = 'enviando';
        desenharFotos();
        const dados = new FormData();
        dados.append('grande', pronta.grande, 'grande');
        dados.append('miniatura', pronta.miniatura, 'miniatura');
        dados.append('largura', String(pronta.lado));
        dados.append('altura', String(pronta.lado));
        const salva = await api('POST', '/api/admin/fotos', undefined, { form: dados });
        Object.assign(foto, { id: salva.id, src: salva.src, thumb: salva.thumb, estado: 'ok' });
      } catch (erro) {
        foto.estado = 'erro';
        foto.erro = erro.message;
      }
      desenharFotos();
    });
  };

  $('#fotos').addEventListener('change', (e) => {
    if (e.target.id !== 'arquivo-fotos') return;
    const arquivos = Array.from(e.target.files || []);
    const vagas = MAX_FOTOS - fotos.length;
    if (arquivos.length > vagas) avisar(`Só cabem mais ${vagas} ${vagas === 1 ? 'foto' : 'fotos'}. As outras foram ignoradas.`, 'erro');
    arquivos.slice(0, vagas).forEach((arquivo) => {
      const foto = { arquivo, modo: 'encaixar', estado: 'processando' };
      fotos.push(foto);
      processar(foto);
    });
    marcarSujo();
    desenharFotos();
  });

  $('#fotos').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mover !== undefined) {
      const i = Number(b.dataset.mover);
      const j = i + Number(b.dataset.dir);
      [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
    } else if (b.dataset.principal !== undefined) {
      fotos.unshift(...fotos.splice(Number(b.dataset.principal), 1));
      avisar('Foto principal alterada');
    } else if (b.dataset.tirar !== undefined) {
      const i = Number(b.dataset.tirar);
      const ok = await confirmar({ titulo: 'Remover esta foto?', texto: 'A foto sai deste produto quando você salvar.', sim: 'Remover', perigo: true });
      if (!ok) return;
      const [foto] = fotos.splice(i, 1);
      if (foto.previa) URL.revokeObjectURL(foto.previa);
    } else if (b.dataset.reenviar !== undefined) {
      processar(fotos[Number(b.dataset.reenviar)]);
      return;
    } else if (b.dataset.ajuste !== undefined) {
      const foto = fotos[Number(b.dataset.ajuste)];
      foto.modo = foto.modo === 'preencher' ? 'encaixar' : 'preencher';
      processar(foto);
      return;
    } else return;
    marcarSujo();
    desenharFotos();
  });
  desenharFotos();

  // ── Dados do formulário ──
  const coletar = () => {
    const perfume = ehPerfume(form.categoria.value);
    const fragrancia = {};
    if (perfume) $$('[data-frag]', form).forEach((el) => { if (el.value.trim()) fragrancia[el.dataset.frag] = el.value; });
    return {
      nome: form.nome.value,
      marca: form.marca.value,
      categoria: form.categoria.value,
      preco: form.preco.value,
      descricao: form.descricao.value,
      publico: perfume ? (form.querySelector('[name=publico]:checked') || {}).value || null : null,
      ficha: ficha.filter((l) => l.label.trim() || l.value.trim()),
      fragrancia: perfume ? fragrancia : null,
      fotos: fotos.filter((f) => f.estado === 'ok' && f.id).map((f) => f.id),
      ativo: form.ativo.checked,
      destaque: form.destaque.checked,
    };
  };

  form.addEventListener('input', () => marcarSujo());
  form.addEventListener('change', () => marcarSujo());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (ocupadas()) { avisar('Espere as fotos terminarem de enviar.'); return; }
    if (fotos.some((f) => f.estado === 'erro')) {
      mostrarErros(form, { fotos: 'Uma das fotos não foi enviada. Toque em “Tentar de novo” ou remova a foto.' });
      return;
    }
    const dados = coletar();
    const v = validarProduto(dados, categorias.map((c) => c.id));
    mostrarErros(form, v.ok ? null : v.campos);
    if (!v.ok) { avisar('Confira os campos destacados em vermelho.', 'erro'); return; }

    await ocupado($('#salvar'), 'Salvando…', async () => {
      try {
        let idSalvo = existente ? existente.id : null;
        if (existente) await api('PUT', `/api/admin/produtos/${encodeURIComponent(existente.id)}`, dados);
        else idSalvo = (await api('POST', '/api/admin/produtos', dados)).id;
        marcarSujo(false);
        estado.catalogo = null;
        concluir(idSalvo, dados, Boolean(existente));
      } catch (erro) {
        mostrarErros(form, erro.campos);
        avisar(erro.message, 'erro');
      }
    });
  });

  $('#previa').addEventListener('click', () => previa(coletar(), fotos, categorias));

  const botaoExcluir = $('#excluir');
  if (botaoExcluir) botaoExcluir.addEventListener('click', async () => {
    const ok = await confirmar({
      titulo: 'Excluir definitivamente?',
      texto: `<strong>${esc(existente.nome)}</strong> (${esc(existente.marca)}) vai sair do site e do painel. Essa ação não pode ser desfeita por aqui.`,
      sim: 'Sim, excluir', nao: 'Cancelar', perigo: true,
    });
    if (!ok) return;
    await ocupado(botaoExcluir, 'Excluindo…', async () => {
      try {
        await api('DELETE', `/api/admin/produtos/${encodeURIComponent(existente.id)}`);
        marcarSujo(false);
        estado.catalogo = null;
        avisar(`“${existente.nome}” foi excluído.`, 'ok');
        ir('#/produtos');
      } catch (erro) {
        avisar(erro.message, 'erro');
      }
    });
  });
}

function concluir(id, dados, editando) {
  const noSite = dados.ativo;
  let escolheu = false;
  // Fechar a janela sem escolher leva à página do produto salvo (dados frescos):
  // nunca deixa o formulário de "novo produto" preenchido, o que poderia
  // gerar um cadastro duplicado.
  const { el, fechar } = abrirJanela(`
    <h2>${editando ? 'Alterações salvas' : 'Produto cadastrado'} ✓</h2>
    <p>${noSite ? 'Já está no site — os clientes veem a mudança ao abrir ou atualizar a página.' : 'Ele está <strong>oculto</strong>: guardado no painel, mas fora do site.'}</p>
    <div class="janela-acoes" style="flex-direction:column">
      ${noSite ? `<a class="botao botao-secundario" href="/produto/${esc(id)}/" target="_blank" rel="noopener">${icone('olho')} Ver no site</a>` : ''}
      ${editando ? '' : '<button type="button" class="botao botao-secundario" data-outro>Cadastrar outro produto</button>'}
      <button type="button" class="botao botao-primario" data-lista autofocus>Voltar para a lista</button>
    </div>`, { aoFechar: () => { if (!escolheu) ir(`#/produtos/${id}`); } });
  const escolher = (destino) => { escolheu = true; fechar(); ir(destino); };
  const outro = $('[data-outro]', el);
  if (outro) outro.addEventListener('click', () => escolher('#/produtos/novo'));
  $('[data-lista]', el).addEventListener('click', () => escolher('#/produtos'));
}

function previa(dados, fotos, categorias) {
  const prontas = fotos.filter((f) => f.estado === 'ok');
  const capa = prontas[0] ? (prontas[0].previa || prontas[0].thumb) : '';
  const cat = categorias.find((c) => c.id === dados.categoria);
  const v = Number(String(dados.preco).replace(/\./g, '').replace(',', '.'));
  abrirJanela(`
    <h2>Prévia no site</h2>
    <p class="sub" style="margin-bottom:14px">Assim o produto aparece no catálogo. Nada foi salvo ainda.</p>
    <div class="previa-card">
      ${capa ? `<img src="${esc(capa)}" alt="">` : '<div style="aspect-ratio:1;background:#f4eff0;display:grid;place-items:center;color:var(--tinta-4)">Sem foto</div>'}
      <div>
        <small>${esc(cat ? cat.nome : 'Categoria')}</small>
        <strong>${esc(dados.nome || 'Nome do produto')}</strong>
        <span>${esc(dados.marca || 'Marca')}</span>
        <b>${Number.isFinite(v) && v > 0 ? brl(v) : 'R$ —'}</b>
      </div>
    </div>
    ${prontas.length > 1 ? `<p class="rotulo" style="margin-top:16px">Galeria (${prontas.length} fotos)</p>
      <div class="previa-fotos">${prontas.map((f) => `<img src="${esc(f.previa || f.thumb)}" alt="">`).join('')}</div>` : ''}
    ${dados.descricao ? `<p style="margin-top:14px;white-space:pre-line">${esc(dados.descricao)}</p>` : ''}
    ${dados.ativo ? '' : '<div class="caixa caixa-alerta">“Mostrar no site” está desligado: ao salvar, o produto fica oculto.</div>'}
    <div class="janela-acoes"><button type="button" class="botao botao-primario" data-fechar autofocus>Fechar prévia</button></div>`);
}
