/**
 * Eloá Admin — motor do formulário local de produtos.
 *
 * FERRAMENTA LOCAL: nunca publicada no GitHub Pages. Lê o PRODUCTS/CATEGORIES
 * de assets/js/products.js (carregado antes deste script), permite criar/editar
 * um produto, valida contra o schema consumido por assets/js/app.js e produz
 * o novo products.js + diff revisável. Nada toca a branch main — salvar aqui
 * apenas escreve os arquivos no working tree local; commit/push/PR é manual
 * (ou via Eloá Dev Agent) com revisão do Guido.
 *
 * Importação de imagem por URL usa o helper local admin/server.py (evita CORS):
 *   GET  /fetch_image?url=…&slug=…  → baixa, converte para PNG, grava em
 *                                     assets/img/products/<slug>.png
 * O formulário funciona também sem o helper para arquivo local? Não — a
 * escrita do products.js também depende do helper (/save), pois o browser
 * não escreve no disco. Instruções na tela inicial do servidor.
 */
(function () {
  'use strict';

  // ── Estado ──────────────────────────────────────────────────────────────
  const API = 'http://127.0.0.1:8642';
  let editingId = null;        // null = novo produto
  let imgState = { mode:'none', blob:null, ext:'png', originUrl:null }; // validated image
  let pendingProduct = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

  // ── Utilidades ──────────────────────────────────────────────────────────
  function slugify(str) {
    return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function slugExists(slug) {
    return PRODUCTS.some((p) => p.id === slug && p.id !== editingId);
  }
  /** Preço amigável "1.299,90" | "80,5" | "80.50" → número. */
  function parseBRL(raw) {
    if (!raw) return NaN;
    let s = String(raw).trim().replace(/[R$\s]/g, '');
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  function fmtBRL(n) {
    return n.toLocaleString('pt-BR', { style:'currency', currency:'BRL' });
  }

  // ── Lista inicial ───────────────────────────────────────────────────────
  function renderList(filter) {
    const q = (filter || '').toLowerCase();
    const rows = PRODUCTS
      .filter((p) => !q || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q))
      .map((p) => `<tr data-id="${p.id}">
        <td>${p.name}</td><td>${p.brand}</td>
        <td>${(CATEGORIES.find((c) => c.id === p.category) || {}).name || p.category}</td>
        <td>${fmtBRL(p.price)}</td></tr>`);
    $('#lista').innerHTML = rows.join('') || '<tr><td colspan="4">Nenhum resultado.</td></tr>';
    $('#count').textContent = PRODUCTS.length;
    $$('#lista tr[data-id]').forEach((tr) =>
      tr.addEventListener('click', () => openEditor(tr.dataset.id)));
  }

  function fillStaticControls() {
    $('#f-category').innerHTML =
      '<option value="">— selecione —</option>' +
      CATEGORIES.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    const brands = [...new Set(PRODUCTS.map((p) => p.brand))].sort();
    $('#brand-list').innerHTML = brands.map((b) => `<option value="${b}">`).join('');
  }

  // ── Form: abrir / fechar ────────────────────────────────────────────────
  function openNew() {
    editingId = null;
    resetForm();
    $('#form').style.display = '';
    $('#card-lista').style.display = 'none';
    window.scrollTo({ top:0 });
  }
  function openEditor(id) {
    const p = PRODUCTS.find((x) => x.id === id);
    if (!p) return alert('Produto não encontrado.');
    editingId = id;
    resetForm();
    $('#f-name').value = p.name;
    $('#f-brand').value = p.brand;
    $('#f-category').value = p.category;
    $('#f-id').value = p.id;
    $('#f-price').value = p.price.toFixed(2).replace('.', ',');
    $('#f-featured').checked = !!p.featured;
    if (p.audience) $$(`input[name=audience][value=${p.audience}]`).forEach(r => r.checked = true);
    $('#f-description').value = p.description;
    updateDescCount(); updateSlugHint();
    (p.specs || []).forEach(({ label, value }) => addSpecRow(label, value));
    if (p.fragrance) {
      for (const k of ['familia','acordes','saida','coracao','fundo','sensacao','ocasiao'])
        $(`#fg-${k}`).value = p.fragrance[k] || '';
    }
    showExistingImage(p);
    $('#form').style.display = '';
    $('#card-lista').style.display = 'none';
    window.scrollTo({ top:0 });
  }
  function backToList() {
    $('#form').style.display = 'none';
    $('#card-lista').style.display = '';
    renderList($('#filtro-lista').value);
  }

  function resetForm() {
    $('#form').reset();
    $$('#specs-container .spec-row').forEach((el) => el.remove());
    $('#specs-container').innerHTML = '';
    ['familia','acordes','saida','coracao','fundo','sensacao','ocasiao']
      .forEach((k) => ($(`#fg-${k}`).value = ''));
    imgState = { mode:'keep-if-editing', blob:null, ext:'png', originUrl:null };
    $('#img-preview-area').style.display = 'none';
    $('#img-url-wrap').style.display = '';
    $('#img-file-wrap').style.display = 'none';
    $$('.error').forEach((e) => (e.style.display = 'none'));
    $$('.invalid').forEach((e) => e.classList.remove('invalid'));
    $('#review-out').style.display = 'none';
    $('#btn-save').disabled = true;
    updateDescCount();
    // imagem existente: modo "manter atual" pré-selecionado na edição
    if (editingId) {
      $$('input[name=img-src]').forEach((r) => (r.checked = r.value === 'keep'));
      $('#img-src-keep-note')?.remove();
    } else {
      $$('input[name=img-src]').forEach((r) => (r.checked = r.value === 'url'));
    }
  }

  let currentImageShown = null; // path da imagem atual na edição
  function showExistingImage(p) {
    currentImageShown = p.image;
    const area = $('#img-preview-area');
    area.style.display = '';
    $('#img-preview').src = p.image + '?t=' + Date.now();
    $('#img-origin-label').textContent = 'imagem atual do catálogo';
    $('#img-final-name').textContent = p.image.split('/').pop();
    $('#img-final-path').textContent = p.image;
  }

  // ── Specs dinâmicas ─────────────────────────────────────────────────────
  function addSpecRow(label = '', value = '') {
    const div = document.createElement('div');
    div.className = 'spec-row';
    div.innerHTML = `
      <input type="text" class="spec-label" placeholder="Label (ex.: Volume)" value="${label}">
      <input type="text" class="spec-value" placeholder="Valor (ex.: 100 ml)" value="${value}">
      <button type="button" class="danger spec-del">✕</button>`;
    div.querySelector('.spec-del').addEventListener('click', () => div.remove());
    $('#specs-container').appendChild(div);
  }

  function collectSpecs() {
    const out = [];
    let dup = false;
    const seen = new Set();
    $$('#specs-container .spec-row').forEach((row) => {
      const label = row.querySelector('.spec-label').value.trim();
      const value = row.querySelector('.spec-value').value.trim();
      if (!label && !value) return;           // linha vazia ignorada
      if (!label || !value) dup = true;       // par incompleto
      const key = label.toLowerCase();
      if (seen.has(key)) dup = true;          // label duplicada
      seen.add(key);
      out.push({ label, value });
    });
    return { specs: out, invalid: dup };
  }

  // ── Fragrância ──────────────────────────────────────────────────────────
  function isPerfumeCategory() {
    return $('#f-category').value === 'perfumes';
  }
  function toggleFragBlock() {
    $('#frag-block').style.display = isPerfumeCategory() ? '' : 'none';
  }
  function collectFragrance() {
    if (!isPerfumeCategory()) return null;
    const f = {};
    for (const k of ['familia','acordes','saida','coracao','fundo','sensacao','ocasiao']) {
      const v = $(`#fg-${k}`).value.trim();
      if (v) f[k] = v;
    }
    return Object.keys(f).length ? f : null;
  }

  // ── Imagem ──────────────────────────────────────────────────────────────
  function currentSlug() {
    return editingId || slugify($('#f-name').value) || 'novo-produto';
  }

  async function checkImageUrl() {
    const url = $('#f-img-url').value.trim();
    hideErr('#err-img');
    if (!/^https?:\/\/.+/i.test(url)) return showErr('#err-img', 'URL inválida — deve começar com http(s)://');
    $('#btn-img-check').disabled = true;
    $('#btn-img-check').textContent = 'Verificando…';
    try {
      const resp = await fetch(`${API}/check_image?url=${encodeURIComponent(url)}`);
      if (!resp.ok) throw new Error((await resp.json()).error || 'Falha ao acessar a URL');
      const data = await resp.json(); // { content_type, size_bytes, convertible }
      if (!data.convertible) throw new Error(`Formato não suportado (${data.content_type})`);
      if (data.size_bytes > 8 * 1024 * 1024) throw new Error('Imagem maior que 8 MB');
      // preview via proxy local (evita hotlink/CORS no <img>)
      $('#img-preview').src = `${API}/proxy?url=${encodeURIComponent(url)}&_=${Date.now()}`;
      $('#img-preview-area').style.display = '';
      $('#img-origin-label').textContent = `URL externa (${data.content_type}, ${(data.size_bytes/1024).toFixed(0)} KB)`;
      const finalName = `${currentSlug()}.png`;
      $('#img-final-name').textContent = finalName;
      $('#img-final-path').textContent = `assets/img/products/${finalName}`;
      $('#btn-img-open').href = url; $('#btn-img-open').style.display = '';
      imgState = { mode:'url', url, originUrl:url };
      clearPreviewError();
    } catch (e) {
      showErr('#err-img', 'Não foi possível usar esta imagem: ' + e.message);
      $('#img-preview-area').style.display = 'none';
      imgState = { mode:'none' };
    } finally {
      $('#btn-img-check').disabled = false;
      $('#btn-img-check').textContent = 'Verificar & pré-visualizar';
    }
  }

  function onLocalFile(input) {
    hideErr('#err-img');
    const file = input.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) return showErr('#err-img', 'Arquivo não é uma imagem.');
    if (file.size > 8 * 1024 * 1024) return showErr('#err-img', 'Imagem maior que 8 MB.');
    const reader = new FileReader();
    reader.onload = () => {
      $('#img-preview').src = reader.result;
      $('#img-preview-area').style.display = '';
      $('#img-origin-label').textContent = `arquivo local (${file.type})`;
      const finalName = `${currentSlug()}.png`;
      $('#img-final-name').textContent = finalName;
      $('#img-final-path').textContent = `assets/img/products/${finalName}`;
      $('#btn-img-open').style.display = 'none';
      imgState = { mode:'file', file, originUrl:null };
      clearPreviewError();
    };
    reader.readAsDataURL(file);
  }

  function imageNeedsAction() {
    if (editingId && imgState.mode === 'none') {
      // edição sem troca explícita → "manter atual"
      const keepRadio = $$('input[name=img-src]').find((r) => r.value === 'keep');
      return !(keepRadio && keepRadio.checked) === false; // ok se keep marcado
    }
    return false;
  }

  // ── Validação de campos + schema ────────────────────────────────────────
  function fieldErrors() {
    const errs = [];
    const mark = (sel, errSel, msg, cond) => {
      if (cond) {
        errs.push(msg);
        $(errSel).textContent = msg; $(errSel).style.display = '';
        $(sel).closest('.card')?.classList.add('invalid'); $(errSel.previousElementSibling || $(errSel))?.classList.add('invalid');
      } else {
        $(errSel).style.display = 'none';
      }
    };
    const name = $('#f-name').value.trim();
    const brand = $('#f-brand').value.trim();
    const cat = $('#f-category').value;
    const price = parseBRL($('#f-price').value);
    const desc = $('#f-description').value.trim();
    const { specs, invalid: specsInvalid } = collectSpecs();
    const frag = collectFragrance();

    mark('#f-name','#err-name','Informe o nome.', !name);
    mark('#f-brand','#err-brand','Informe a marca.', !brand);
    mark('#f-category','#err-cat','Selecione uma categoria válida.', !CATEGORY_IDS.includes(cat));
    mark('#f-price','#err-price','Preço inválido — use formato brasileiro e valor maior que zero.',
      !Number.isFinite(price) || price <= 0);
    mark('#f-description','#err-desc','A descrição precisa ter pelo menos 30 caracteres.', desc.length < 30);
    mark('#frag-block','#err-frag','Família e acordes são obrigatórios quando o perfil olfativo é usado.',
      !!frag && (!frag.familia || !frag.acordes));
    mark('#specs-container','#err-specs','Há labels duplicadas ou pares incompletos nas especificações.', specsInvalid);

    // slug / id
    if (!editingId) {
      const slug = slugify(name);
      if (!slug) errs.push('Nome não gera um slug válido.');
      else if (slugExists(slug)) errs.push(`Já existe um produto com o slug "${slug}".`);
    }
    // imagem
    const keepChecked = $$('input[name=img-src]').find((r) => r.checked)?.value;
    if (keepChecked === 'url' && imgState.mode !== 'url')
      errs.push('Valide a URL da imagem (botão "Verificar & pré-visualizar") antes de salvar.');
    if (keepChecked === 'file' && imgState.mode !== 'file')
      errs.push('Selecione o arquivo local de imagem antes de salvar.');
    if (!editingId && keepChecked !== 'url' && keepChecked !== 'file')
      errs.push('Novo produto exige imagem (URL ou arquivo local).');

    return { errs, name, brand, cat, price, desc, specs, frag,
      audience: $$('input[name=audience]').find((r) => r.checked)?.value || '' };
  }

  function buildProduct(v) {
    const prod = {
      id: editingId || slugify(v.name),
      name: v.name,
      brand: v.brand,
      category: v.cat,
      ...(v.audience ? { audience: v.audience } : {}),
      price: v.price,
      description: v.desc,
      image: (imgState.mode === 'url' || imgState.mode === 'file')
        ? `assets/img/products/${prod_id(v)}.png`
        : (PRODUCTS.find((p) => p.id === editingId)?.image || ''),
      ...(v.specs.length ? { specs: v.specs } : {}),
      ...(v.frag ? { fragrance: v.frag } : {}),
    };
    if ($('#f-featured').checked) prod.featured = true;
    return prod;
  }
  function prod_id(_v) { return editingId || slugify($('#f-name').value); }

  function validateSchema(prod) {
    const checks = [];
    const add = (ok, label) => checks.push({ ok, label });
    add(!!prod.id && /^[a-z0-9-]+$/.test(prod.id), `id único e em slug (${prod.id})`);
    add(!slugExists(prod.id), 'id não colide com outro produto');
    add(!!prod.name, 'name presente');
    add(!!prod.brand, 'brand presente');
    add(CATEGORY_IDS.includes(prod.category), `category válida (${prod.category})`);
    add(typeof prod.price === 'number' && prod.price > 0, `price numérico > 0 (${fmtBRL(prod.price)})`);
    add(!!prod.description && prod.description.length >= 30, 'description válida (≥30 chars)');
    add(/^assets\/img\/products\/.+\.png$/.test(prod.image), `image aponta para PNG local (${prod.image})`);
    if ('audience' in prod)
      add(['feminino','masculino'].includes(prod.audience), `audience válido (${prod.audience})`);
    if ('specs' in prod)
      add(Array.isArray(prod.specs) && prod.specs.every((s) => s.label && s.value),
        `specs estruturadas (${prod.specs.length} itens)`);
    if ('fragrance' in prod) {
      const KEYS = ['familia','acordes','saida','coracao','fundo','sensacao','ocasiao'];
      add(Object.keys(prod.fragrance).every((k) => KEYS.includes(k)),
        'fragrance só com chaves conhecidas');
      add(!!prod.fragrance.familia && !!prod.fragrance.acordes, 'fragrance.familia/acordes presentes');
    }
    if ('featured' in prod) add(typeof prod.featured === 'boolean', 'featured boolean');
    return checks;
  }

  // ── Revisão & salvar ────────────────────────────────────────────────────
  function renderReview() {
    const v = fieldErrors();
    if (v.errs.length) {
      $('#review-out').style.display = 'none';
      $('#err-schema').textContent = v.errs.join(' · ');
      $('#err-schema').style.display = '';
      $('#btn-save').disabled = true;
      return;
    }
    hideErr('#err-schema');
    const prod = buildProduct(v);
    const checks = validateSchema(prod);
    const allOk = checks.every((c) => c.ok);

    const filled = [
      ['Categoria', (CATEGORIES.find((c) => c.id === prod.category)||{}).name],
      ['Preço', fmtBRL(prod.price)],
      ['Público', prod.audience || '—'],
      ['Destaque', prod.featured ? 'sim' : 'não'],
      ['Specs', prod.specs ? prod.specs.length + ' item(ns)' : '—'],
      ['Perfil olfativo', prod.fragrance ? 'sim' : '—'],
      ['Imagem', prod.image],
      ['Operação', editingId ? `EDIÇÃO de "${editingId}"` : 'NOVO produto'],
    ];
    $('#review-box').textContent =
      `• Nome: ${prod.name}\n• Marca: ${prod.brand}\n` +
      filled.map(([k, val]) => `• ${k}: ${val}`).join('\n');

    $('#schema-report').innerHTML = checks
      .map((c) => `<li class="${c.ok ? 'ok' : 'bad'}">${c.label}</li>`).join('');
    $('#review-out').style.display = '';
    $('#btn-save').disabled = !allOk;
    if (!allOk) { $('#err-schema').style.display = ''; $('#err-schema').textContent = 'Corrija os itens ✘ acima.'; }
    pendingProduct = prod;
  }

  async function saveProduct() {
    if (!pendingProduct) return;
    $('#btn-save').disabled = true;
    $('#btn-save').textContent = 'Processando imagem e salvando…';
    try {
      const body = new FormData();
      body.append('product', JSON.stringify(pendingProduct));
      body.append('previous', JSON.stringify(
        editingId ? PRODUCTS.find((p) => p.id === editingId) : null));
      body.append('image_mode', imgState.mode);
      if (imgState.mode === 'url') body.append('image_url', imgState.url);
      if (imgState.mode === 'file') body.append('image_file', imgState.file);
      if (editingId) body.append('editing_id', editingId);

      const resp = await fetch(`${API}/save`, { method:'POST', body });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Falha ao salvar');

      $('#result-pre').textContent =
        `✔ Produto ${data.action} com sucesso!\n\n` +
        `Arquivos alterados:\n${data.changed.join('\n')}\n\n` +
        `DIFF (${data.diff_file}):\n\n${data.diff}\n\n` +
        (data.orphan_note ? `⚠️ Imagem antiga ficou órfã: ${data.orphan_note}\n(registrada para limpeza futura pelo Curador)\n\n` : '') +
        `Próximo passo: revise o diff (git diff), teste o site localmente\n` +
        `e só então faça commit/push/PR. A branch main não foi tocada.`;
      document.getElementById('dlg-result').showModal();
    } catch (e) {
      $('#result-pre').textContent = '✘ ERRO: ' + e.message +
        '\n\nNenhum arquivo parcial foi deixado no repositório.';
      document.getElementById('dlg-result').showModal();
    } finally {
      $('#btn-save').disabled = false;
      $('#btn-save').textContent = 'Salvar em branch (gerar diff)';
    }
  }

  // ── helpers visuais ─────────────────────────────────────────────────────
  function showErr(sel, msg) { const e = $(sel); if (msg) e.textContent = msg; e.style.display = ''; }
  function hideErr(sel) { $(sel).style.display = 'none'; }
  function clearPreviewError() { hideErr('#err-img'); }
  function updateDescCount() {
    $('#desc-count').textContent = String($('#f-description').value.trim().length);
  }
  function updateSlugHint() {
    $('#slug-hint').textContent = editingId
      ? `id (somente leitura): ${editingId}`
      : `slug: ${slugify($('#f-name').value) || '—'}${slugExists(slugify($('#f-name').value)) ? ' ⚠️ JÁ EXISTE' : ''}`;
  }

  // ── Wiring ──────────────────────────────────────────────────────────────
  $('#btn-novo').addEventListener('click', openNew);
  $('#filtro-lista').addEventListener('input', (e) => renderList(e.target.value));
  $('#btn-cancel').addEventListener('click', backToList);
  $('#f-name').addEventListener('input', () => { if (!editingId) updateSlugHint(); });
  $('#f-description').addEventListener('input', updateDescCount);
  $('#f-category').addEventListener('change', toggleFragBlock);
  $('#btn-add-spec').addEventListener('click', () => addSpecRow());
  $('#btn-img-check').addEventListener('click', checkImageUrl);
  $('#f-img-file').addEventListener('change', (e) => onLocalFile(e.target));
  $$('input[name=img-src]').forEach((r) =>
    r.addEventListener('change', () => {
      $('#img-url-wrap').style.display = r.value === 'url' && r.checked ? '' : 'none';
      $('#img-file-wrap').style.display = r.value === 'file' && r.checked ? '' : 'none';
    }));
  $('#btn-review').addEventListener('click', renderReview);
  $('#btn-save').addEventListener('click', saveProduct);

  // init
  fillStaticControls();
  renderList();
})();
