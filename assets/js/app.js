/**
 * Perfumaria Eloá — lógica do catálogo digital.
 *
 * Sem build, sem dependências: um único objeto `App` exposto no window.
 * Roteamento por hash (#/, #/catalogo, #/produto/<id>, #/sobre) para que o
 * botão voltar do navegador funcione de forma previsível.
 */
const App = (() => {
  'use strict';

  // ── Estado ──────────────────────────────────────────────────────────────
  const STORAGE_KEY = 'eloa.cart.v1';
  let cart = [];          // [{ id, qty }]
  let filterCategory = 'todos';
  let filterAudience = 'todos';
  let searchQuery = '';
  let lastFocused = null;

  // localStorage pode falhar (file://, modo privado). Cai para memória.
  const storage = {
    read() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch (_) { return []; }
    },
    write(value) {
      try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) { /* segue em memória */ }
    },
  };

  // ── Utilidades ──────────────────────────────────────────────────────────
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const brl = (value) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  /** Remove acentos para que "cilios" encontre "cílios". */
  const normalize = (str) => String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const getProduct = (id) => PRODUCTS.find((p) => p.id === id);
  const getCategory = (id) => CATEGORIES.find((c) => c.id === id);

  // ── Ícones (SVG inline — nunca emoji) ───────────────────────────────────
  const ICONS = {
    // Perfume: flacon com válvula spray no topo
    bottle:   '<rect x="10" y="2" width="4" height="3" rx="1"/><path d="M15.5 4.5h1.8"/><path d="M11 5v2.6L8.6 10A2 2 0 0 0 8 11.4V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-7.6a2 2 0 0 0-.6-1.4L13 7.6V5"/>',
    lipstick: '<path d="M9 8V4.5A1.5 1.5 0 0 1 10.5 3h1A1.5 1.5 0 0 1 13 4.5V8"/><rect x="7" y="8" width="8" height="6" rx="1.5"/><rect x="8" y="14" width="6" height="7" rx="1"/>',
    // Cabelo: pente (mais legível que uma silhueta de cabelo)
    hair:     '<path d="M4 6.5h16"/><path d="M4 6.5v3M8 6.5v5M12 6.5v3M16 6.5v5M20 6.5v3"/><path d="M5 16.5c2.6-1.6 5.1-1.6 7 0s4.4 1.6 7 0"/>',
    sparkle:  '<path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z"/><path d="M18.5 16.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    eye:      '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/>',
    // Unhas: esmalte — corpo largo e baixo, com pincel comprido
    // Cuidados pessoais: sachê de lenço umedecido com a aba de abertura
    wipe:     '<rect x="3.5" y="6" width="17" height="14" rx="2.5"/><path d="M7.5 6V4.6a1.6 1.6 0 0 1 1.6-1.6h5.8a1.6 1.6 0 0 1 1.6 1.6V6"/><path d="M8.5 10.5h7a1.5 1.5 0 0 1 0 3h-4"/>',
    nail:     '<path d="M11 2h2v5h-2z"/><path d="M10.4 7h3.2a1 1 0 0 1 1 1v.7l1.6 2.2a2 2 0 0 1 .4 1.2V20a2 2 0 0 1-2 2H9.4a2 2 0 0 1-2-2v-7.9a2 2 0 0 1 .4-1.2L9.4 8.7V8a1 1 0 0 1 1-1Z"/><path d="M8 15h8"/>',
  };

  const icon = (name, cls = 'w-6 h-6') =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /** Linha da ficha do produto. */
  const specRow = (label, value) =>
    `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;

  const AUDIENCE_LABEL = { feminino: 'Feminino', masculino: 'Masculino' };

  /** Ficha do produto (volume, concentração, peso, variantes). */
  function specsBlock(product) {
    const rows = [...(product.specs || [])];
    if (product.audience) {
      rows.push({ label: 'Indicado para', value: AUDIENCE_LABEL[product.audience] });
    }
    if (!rows.length) return '';
    return `
      <section class="specs" aria-label="Ficha do produto">
        <p class="specs-title">Sobre o produto</p>
        <dl>${rows.map((r) => specRow(r.label, r.value)).join('')}</dl>
      </section>`;
  }

  /**
   * Perfil olfativo do perfume, em dois blocos: o perfil em si e, quando há
   * pirâmide confirmada, as notas de saída/coração/fundo. Campos sem dado
   * simplesmente não aparecem.
   */
  function fragranceBlock(product) {
    const f = product.fragrance;
    if (!f) return '';

    const perfil = [
      ['Família olfativa', f.familia],
      ['Acordes principais', f.acordes],
      ['Sensação', f.sensacao],
      ['Ocasião sugerida', f.ocasiao],
    ].filter(([, v]) => v);

    const piramide = [
      ['Saída', 'A primeira impressão', f.saida],
      ['Coração', 'O corpo da fragrância', f.coracao],
      ['Fundo', 'O rastro que fica', f.fundo],
    ].filter(([, , v]) => v);

    const blocoPerfil = perfil.length ? `
      <section class="specs" aria-label="Perfil olfativo">
        <p class="specs-title">Perfil olfativo</p>
        <dl>${perfil.map(([label, value]) => specRow(label, value)).join('')}</dl>
      </section>` : '';

    const blocoNotas = piramide.length ? `
      <section class="specs" aria-label="Notas olfativas">
        <p class="specs-title">Notas olfativas</p>
        <ol class="notes">
          ${piramide.map(([etapa, hint, value]) => `
            <li>
              <span class="notes-step">${escapeHtml(etapa)}</span>
              <span class="notes-value">${escapeHtml(value)}</span>
              <span class="notes-hint">${escapeHtml(hint)}</span>
            </li>`).join('')}
        </ol>
      </section>` : '';

    return blocoPerfil + blocoNotas;
  }

  // ── Componente: card de produto ─────────────────────────────────────────
  function productCard(product) {
    const category = getCategory(product.category);
    return `
      <article class="card group">
        <a href="#/produto/${product.id}" class="card-img block" aria-label="Ver ${escapeHtml(product.name)} ${escapeHtml(product.brand)}">
          <img src="${product.image}" alt="${escapeHtml(product.name)} da marca ${escapeHtml(product.brand)}"
               width="800" height="800" loading="lazy" decoding="async">
          ${product.featured ? '<span class="badge">Destaque</span>' : ''}
        </a>
        <div class="p-3.5 sm:p-4 flex flex-col flex-1">
          <p class="text-[11px] uppercase tracking-wider text-rose-700 font-semibold">${escapeHtml(category ? category.name : '')}</p>
          <h3 class="mt-1 font-medium text-ink-900 leading-snug">
            <a href="#/produto/${product.id}" class="hover:text-rose-700 transition-colors">${escapeHtml(product.name)}</a>
          </h3>
          <p class="text-sm text-ink-500">${escapeHtml(product.brand)}</p>
          <div class="mt-auto pt-3 border-t border-[#EAE0E3] flex items-center justify-between gap-2">
            <span class="font-display text-lg text-ink-900 tnum">${brl(product.price)}</span>
            <button class="icon-btn bg-ink-900 text-white hover:bg-rose-500 hover:text-ink-900 shrink-0"
                    onclick="App.addToCart('${product.id}')"
                    aria-label="Adicionar ${escapeHtml(product.name)} ${escapeHtml(product.brand)} ao carrinho">
              <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
        </div>
      </article>`;
  }

  // ── Renderização: Início ────────────────────────────────────────────────
  function renderHome() {
    $('#home-categories').innerHTML = CATEGORIES.map((category) => {
      const total = PRODUCTS.filter((p) => p.category === category.id).length;
      return `
        <a href="#/catalogo?cat=${category.id}"
           class="group flex flex-col items-center justify-center gap-2.5 p-5 rounded-[14px] border border-[#EAE0E3] bg-white hover:border-rose-300 hover:bg-rose-50 transition-all duration-200 text-center">
          <span class="w-12 h-12 grid place-items-center rounded-full bg-rose-100 text-rose-700 group-hover:bg-rose-500 group-hover:text-ink-900 transition-colors">
            ${icon(category.icon, 'w-6 h-6')}
          </span>
          <span class="text-sm font-medium text-ink-900 leading-tight">${escapeHtml(category.name)}</span>
          <span class="text-xs text-ink-400">${total} ${total === 1 ? 'item' : 'itens'}</span>
        </a>`;
    }).join('');

    $('#home-featured').innerHTML = PRODUCTS.filter((p) => p.featured).map(productCard).join('');
  }

  // ── Renderização: Catálogo ──────────────────────────────────────────────
  function renderCatalogChips() {
    const chips = [{ id: 'todos', name: 'Todos' }, ...CATEGORIES];
    $('#catalog-chips').innerHTML = chips.map((c) => `
      <button class="chip" aria-pressed="${filterCategory === c.id}" onclick="App.setCategory('${c.id}')">
        ${escapeHtml(c.name)}
      </button>`).join('');
    renderAudienceChips();
    updateChipFade();
  }

  /**
   * Filtro de perfumaria feminina/masculina. Só faz sentido dentro de
   * Perfumes — nas outras categorias os produtos não têm público definido,
   * então a linha inteira fica escondida.
   */
  function renderAudienceChips() {
    const box = $('#catalog-audience');
    if (!box) return;
    if (filterCategory !== 'perfumes') {
      box.innerHTML = '';
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const opcoes = [
      { id: 'todos', name: 'Todos' },
      { id: 'feminino', name: 'Feminino' },
      { id: 'masculino', name: 'Masculino' },
    ];
    box.innerHTML = opcoes.map((o) => `
      <button class="chip chip-sm" aria-pressed="${filterAudience === o.id}" onclick="App.setAudience('${o.id}')">
        ${escapeHtml(o.name)}
      </button>`).join('');
  }

  /**
   * Mostra/esconde o fade lateral da lista de categorias conforme há
   * conteúdo para rolar em cada direção. No desktop os chips quebram linha
   * (scrollWidth ≈ clientWidth), então os dois fades ficam sempre ocultos.
   */
  function updateChipFade() {
    const scroller = $('#catalog-chips-scroll');
    const left = $('#chip-fade-left');
    const right = $('#chip-fade-right');
    if (!scroller || !left || !right) return;
    const { scrollLeft, scrollWidth, clientWidth } = scroller;
    const maxScroll = scrollWidth - clientWidth;
    left.classList.toggle('is-visible', scrollLeft > 4);
    right.classList.toggle('is-visible', maxScroll > 4 && scrollLeft < maxScroll - 4);
  }

  function filteredProducts() {
    const q = normalize(searchQuery.trim());
    return PRODUCTS.filter((p) => {
      const matchCategory = filterCategory === 'todos' || p.category === filterCategory;
      if (!matchCategory) return false;
      if (filterAudience !== 'todos' && p.audience !== filterAudience) return false;
      if (!q) return true;
      const haystack = normalize(`${p.name} ${p.brand} ${getCategory(p.category)?.name || ''} ${p.audience || ''}`);
      return q.split(/\s+/).every((term) => haystack.includes(term));
    });
  }

  function renderCatalog() {
    renderCatalogChips();
    const results = filteredProducts();
    const grid = $('#catalog-grid');
    const empty = $('#catalog-empty');
    const count = $('#catalog-count');

    if (results.length === 0) {
      grid.innerHTML = '';
      grid.hidden = true;
      empty.classList.remove('hidden');
      count.textContent = '';
    } else {
      grid.hidden = false;
      empty.classList.add('hidden');
      grid.innerHTML = results.map(productCard).join('');
      const label = results.length === 1 ? '1 produto' : `${results.length} produtos`;
      count.textContent = searchQuery.trim()
        ? `${label} para “${searchQuery.trim()}”`
        : label;
    }
  }

  // ── Renderização: Produto ───────────────────────────────────────────────
  function renderProduct(id) {
    const product = getProduct(id);
    const container = $('#product-detail');

    if (!product) {
      $('#pd-crumb').textContent = 'Produto não encontrado';
      container.innerHTML = `
        <div class="py-20 text-center">
          <p class="font-display text-2xl text-ink-900">Produto não encontrado</p>
          <p class="mt-2 text-sm text-ink-500">Ele pode ter saído do catálogo.</p>
          <a href="#/catalogo" class="btn btn-primary mt-6">Voltar ao catálogo</a>
        </div>`;
      $('#product-related').innerHTML = '';
      return;
    }

    const category = getCategory(product.category);
    $('#pd-crumb').textContent = `${product.name} ${product.brand}`;

    container.innerHTML = `
      <div class="grid md:grid-cols-2 gap-6 lg:gap-12 items-start">
        <div class="rounded-[22px] overflow-hidden border border-[#EAE0E3] bg-sand-100 aspect-square">
          <img src="${product.image}" alt="${escapeHtml(product.name)} da marca ${escapeHtml(product.brand)}"
               width="800" height="800" class="w-full h-full object-cover" decoding="async">
        </div>

        <div class="md:pt-4">
          <a href="#/catalogo?cat=${product.category}" class="eyebrow hover:text-rose-600">${escapeHtml(category ? category.name : '')}</a>
          <h1 class="font-display text-[1.85rem] sm:text-4xl leading-tight font-semibold text-ink-900 mt-3">
            ${escapeHtml(product.name)}
          </h1>
          <p class="mt-1.5 text-base text-ink-500">${escapeHtml(product.brand)}</p>

          <p class="mt-6 font-display text-3xl sm:text-4xl text-ink-900 tnum">${brl(product.price)}</p>

          <p class="mt-5 text-[15px] text-ink-600 leading-relaxed max-w-prose">${escapeHtml(product.description)}</p>
          ${specsBlock(product)}${fragranceBlock(product)}

          <div class="mt-8 flex flex-col sm:flex-row gap-3">
            <button class="btn btn-primary flex-1" onclick="App.addToCart('${product.id}', true)">
              <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              Adicionar ao carrinho
            </button>
            <a class="btn btn-outline flex-1" target="_blank" rel="noopener"
               href="${whatsappLink(`Olá! Tenho interesse no produto: ${product.name} — ${product.brand} (${brl(product.price)}). Ele está disponível?`)}">
              Perguntar no WhatsApp
            </a>
          </div>

          <ul class="mt-8 space-y-2.5 text-sm text-ink-500">
            <li class="flex items-start gap-2.5">
              <svg class="w-[18px] h-[18px] mt-px text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/></svg>
              Entrega em toda a Zona Leste de São Paulo
            </li>
            <li class="flex items-start gap-2.5">
              <svg class="w-[18px] h-[18px] mt-px text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>
              ${escapeHtml(STORE.shipping)}
            </li>
            <li class="flex items-start gap-2.5">
              <svg class="w-[18px] h-[18px] mt-px text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
              Disponibilidade confirmada no atendimento
            </li>
          </ul>
        </div>
      </div>`;

    const related = PRODUCTS
      .filter((p) => p.category === product.category && p.id !== product.id)
      .concat(PRODUCTS.filter((p) => p.category !== product.category && p.featured))
      .slice(0, 4);
    $('#product-related').innerHTML = related.map(productCard).join('');
  }

  // ── Renderização: Sobre ─────────────────────────────────────────────────
  function renderAbout() {
    $('#about-address').innerHTML = `${escapeHtml(STORE.address)}<br>${escapeHtml(STORE.city)}`;
    $('#about-hours').textContent = STORE.hours;
    $('#about-delivery').textContent = STORE.delivery;
    $('#about-shipping').textContent = STORE.shipping;

    const mapQuery = encodeURIComponent(`${STORE.address}, ${STORE.city}`);
    $('#about-map').href = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

    const whatsHref = whatsappLink('Olá! Vim pelo catálogo digital da Perfumaria Eloá.');
    $('#about-whats').href = whatsHref;
    $('#about-whats-label').textContent = STORE.whatsappDisplay;
    $('#footer-whats').href = whatsHref;

    $('#footer-address').innerHTML = `${escapeHtml(STORE.address)} — ${escapeHtml(STORE.city)}`;
    $('#footer-hours').textContent = STORE.hours;
    // Nome, endereço e telefone em texto no rodapé: é o par NAP que a busca
    // local usa para casar o site com a ficha do Google da loja.
    $('#footer-phone').textContent = `WhatsApp ${STORE.whatsappDisplay}`;
  }

  // ── Carrinho ────────────────────────────────────────────────────────────
  const cartCount = () => cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = () => cart.reduce((sum, item) => {
    const p = getProduct(item.id);
    return sum + (p ? p.price * item.qty : 0);
  }, 0);

  function persist() {
    storage.write(cart);
    renderCartBadge();
    renderCartItems();
  }

  function renderCartBadge() {
    const n = cartCount();
    [$('#cart-count'), $('#tab-cart-count')].forEach((el) => {
      if (!el) return;
      el.textContent = n;
      el.classList.toggle('hidden', n === 0);
    });
    const btn = $('#btn-cart');
    if (btn) {
      btn.setAttribute('aria-label',
        n === 0 ? 'Abrir carrinho, vazio' : `Abrir carrinho, ${n} ${n === 1 ? 'item' : 'itens'}`);
    }
  }

  function renderCartItems() {
    const container = $('#cart-items');
    const footer = $('#cart-footer');

    if (cart.length === 0) {
      container.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center py-16">
          <span class="w-16 h-16 grid place-items-center rounded-full bg-rose-100 text-rose-600">
            <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </span>
          <p class="mt-5 font-display text-xl text-ink-900">Seu carrinho está vazio</p>
          <p class="mt-2 text-sm text-ink-500 max-w-[26ch]">Adicione produtos do catálogo para montar seu pedido.</p>
          <a href="#/catalogo" class="btn btn-primary mt-6" onclick="App.closeCart()">Ver catálogo</a>
        </div>`;
      footer.hidden = true;
      return;
    }

    footer.hidden = false;
    container.innerHTML = cart.map((item) => {
      const p = getProduct(item.id);
      if (!p) return '';
      return `
        <div class="flex gap-3 py-4 border-b border-[#EAE0E3] last:border-0">
          <a href="#/produto/${p.id}" onclick="App.closeCart()" class="shrink-0">
            <img src="${p.image}" alt="" width="80" height="80"
                 class="w-20 h-20 rounded-[10px] object-cover bg-sand-100" loading="lazy" decoding="async">
          </a>
          <div class="flex-1 min-w-0">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0">
                <p class="font-medium text-ink-900 leading-snug truncate">${escapeHtml(p.name)}</p>
                <p class="text-sm text-ink-500 truncate">${escapeHtml(p.brand)}</p>
              </div>
              <button class="icon-btn text-ink-400 hover:text-[#B3261E] hover:bg-[#FBEAE9] shrink-0"
                      onclick="App.removeFromCart('${p.id}')"
                      aria-label="Remover ${escapeHtml(p.name)} ${escapeHtml(p.brand)} do carrinho">
                <svg class="w-[17px] h-[17px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/></svg>
              </button>
            </div>
            <div class="mt-2.5 flex items-center justify-between gap-2">
              <div class="stepper">
                <button onclick="App.setQty('${p.id}', ${item.qty - 1})"
                        aria-label="Diminuir quantidade de ${escapeHtml(p.name)}" ${item.qty <= 1 ? 'disabled' : ''}>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>
                </button>
                <output aria-label="Quantidade de ${escapeHtml(p.name)}">${item.qty}</output>
                <button onclick="App.setQty('${p.id}', ${item.qty + 1})"
                        aria-label="Aumentar quantidade de ${escapeHtml(p.name)}" ${item.qty >= 99 ? 'disabled' : ''}>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                </button>
              </div>
              <span class="font-semibold text-ink-900 tnum">${brl(p.price * item.qty)}</span>
            </div>
          </div>
        </div>`;
    }).join('');

    $('#cart-total').textContent = brl(cartTotal());
  }

  // ── WhatsApp ────────────────────────────────────────────────────────────
  function whatsappLink(message) {
    return `https://wa.me/${STORE.whatsappNumber}?text=${encodeURIComponent(message)}`;
  }

  function buildOrderMessage() {
    const lines = ['Olá! Gostaria de fazer um pedido pelo catálogo:', ''];
    cart.forEach((item, index) => {
      const p = getProduct(item.id);
      if (!p) return;
      lines.push(`${index + 1}. ${p.name} — ${p.brand}`);
      lines.push(`   ${item.qty} × ${brl(p.price)} = ${brl(p.price * item.qty)}`);
    });
    lines.push('');
    lines.push(`Total estimado: ${brl(cartTotal())}`);
    lines.push('(sem frete — combinar no atendimento)');
    return lines.join('\n');
  }

  // ── Painel do carrinho (abrir/fechar + foco) ────────────────────────────
  function openCart() {
    lastFocused = document.activeElement;
    $('#cart-overlay').classList.add('is-open');
    $('#cart-panel').classList.add('is-open');
    document.body.classList.add('no-scroll');
    renderCartItems();
    // Foco no primeiro elemento útil do painel
    window.setTimeout(() => {
      const first = $('#cart-panel button, #cart-panel a');
      if (first) first.focus();
    }, 60);
  }

  function closeCart() {
    $('#cart-overlay').classList.remove('is-open');
    $('#cart-panel').classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  }

  const isCartOpen = () => $('#cart-panel').classList.contains('is-open');

  /** Mantém o Tab dentro do painel enquanto ele estiver aberto. */
  function trapFocus(event) {
    if (event.key !== 'Tab' || !isCartOpen()) return;
    const focusables = $$('#cart-panel a[href], #cart-panel button:not([disabled])')
      .filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault(); last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }

  // ── Aviso rápido (toast) ────────────────────────────────────────────────
  let toastTimer = null;
  function toast(message) {
    const el = $('#toast');
    $('#toast-msg').textContent = message;
    el.classList.add('is-open');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => el.classList.remove('is-open'), 2600);
  }

  // ── Roteamento ──────────────────────────────────────────────────────────
  function showView(name) {
    $$('[data-view]').forEach((section) => { section.hidden = section.dataset.view !== name; });
    $$('.tabbar a, .hdr-nav a, .hdr-nav-compact').forEach((tab) => {
      if (tab.dataset.tab === name) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
  }

  function router() {
    const raw = (window.location.hash || '#/').slice(1);          // "/catalogo?cat=perfumes"
    const [path, queryString] = raw.split('?');
    const params = new URLSearchParams(queryString || '');
    const segments = path.split('/').filter(Boolean);             // ["catalogo"]

    if (segments[0] === 'catalogo') {
      if (params.has('cat')) filterCategory = params.get('cat');
      if (params.has('q')) searchQuery = params.get('q');
      showView('catalogo');
      renderCatalog();
    } else if (segments[0] === 'produto') {
      showView('produto');
      renderProduct(segments[1]);
    } else if (segments[0] === 'sobre') {
      showView('sobre');
    } else {
      showView('home');
    }

    scrollToTop();
    observeReveals();
  }

  /**
   * Leva a página para o topo de forma instantânea ao trocar de rota.
   *
   * `window.scrollTo({ top: 0, behavior: 'auto' })` parece o jeito óbvio, mas
   * `behavior: 'auto'` delega para o `scroll-behavior` do CSS — que é
   * `smooth` neste projeto (para os links de âncora) — e o scroll acaba
   * animando por ~300ms em vez de saltar. Numa troca de rota isso lê como
   * "a página não voltou pro topo". Alternar o `scroll-behavior` para
   * `auto` via inline style (maior especificidade que a regra do CSS) força
   * o salto instantâneo, e o valor original é restaurado logo em seguida
   * para não afetar o scroll suave usado em outros lugares.
   */
  function scrollToTop() {
    const root = document.documentElement;
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    void root.offsetHeight; // força o navegador a aplicar o estilo antes do scrollTo (sem isso o scrollTo abaixo às vezes ainda lia o `smooth` antigo, a troca de volta interrompia a animação no meio, e a página ficava presa na posição de rolagem anterior)
    window.scrollTo(0, 0);
    root.style.scrollBehavior = previous;
  }

  // ── Entrada suave ao rolar ──────────────────────────────────────────────
  let revealObserver = null;
  function observeReveals() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach((el) => el.classList.add('is-visible'));
      return;
    }
    if (!revealObserver) {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px' });
    }
    $$('.reveal:not(.is-visible)').forEach((el) => revealObserver.observe(el));

    // Failsafe: conteúdo nunca pode ficar invisível porque o observer falhou.
    window.clearTimeout(revealFailsafe);
    revealFailsafe = window.setTimeout(() => {
      $$('.reveal:not(.is-visible)').forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight * 1.5) el.classList.add('is-visible');
      });
    }, 1200);
  }
  let revealFailsafe = null;

  // ── API pública ─────────────────────────────────────────────────────────
  const api = {
    addToCart(id, silent) {
      const product = getProduct(id);
      if (!product) return;
      const existing = cart.find((item) => item.id === id);
      if (existing) existing.qty = Math.min(99, existing.qty + 1);
      else cart.push({ id, qty: 1 });
      persist();
      toast(`${product.name} adicionado ao carrinho`);
      if (silent) openCart();
    },

    removeFromCart(id) {
      const product = getProduct(id);
      cart = cart.filter((item) => item.id !== id);
      persist();
      if (product) toast(`${product.name} removido`);
    },

    setQty(id, qty) {
      if (qty < 1) return api.removeFromCart(id);
      const item = cart.find((entry) => entry.id === id);
      if (item) { item.qty = Math.min(99, qty); persist(); }
    },

    checkout() {
      if (cart.length === 0) return;
      window.open(whatsappLink(buildOrderMessage()), '_blank', 'noopener');
      // O carrinho é mantido de propósito: o pedido só se confirma na conversa.
      closeCart();
      toast('Pedido aberto no WhatsApp');
    },

    openCart,
    closeCart,
    updateChipFade,

    setAudience(id) {
      filterAudience = id;
      renderCatalog();
    },

    setCategory(id) {
      if (id !== filterCategory) filterAudience = 'todos';
      filterCategory = id;
      const suffix = id === 'todos' ? '' : `?cat=${id}`;
      if (window.location.hash !== `#/catalogo${suffix}`) {
        window.history.replaceState(null, '', `#/catalogo${suffix}`);
      }
      renderCatalog();
    },

    onSearchInput(value) {
      searchQuery = value;
      // Mantém os dois campos de busca sincronizados
      ['#search-desktop', '#search-mobile'].forEach((sel) => {
        const input = $(sel);
        if (input && input.value !== value) input.value = value;
      });
      if (!window.location.hash.startsWith('#/catalogo')) {
        window.location.hash = '#/catalogo';
      } else {
        renderCatalog();
      }
    },

    submitSearch(event) {
      event.preventDefault();
      if (!window.location.hash.startsWith('#/catalogo')) window.location.hash = '#/catalogo';
      else renderCatalog();
      document.activeElement?.blur();
      return false;
    },

    clearFilters() {
      searchQuery = '';
      filterCategory = 'todos';
      filterAudience = 'todos';
      ['#search-desktop', '#search-mobile'].forEach((sel) => { const el = $(sel); if (el) el.value = ''; });
      window.history.replaceState(null, '', '#/catalogo');
      renderCatalog();
    },

    toggleMobileSearch() {
      const box = $('#mobile-search');
      const btn = $('#btn-mobile-search');
      const willOpen = box.classList.contains('hidden');
      box.classList.toggle('hidden');
      btn.setAttribute('aria-expanded', String(willOpen));
      if (willOpen) $('#search-mobile').focus();
    },

    init() {
      cart = storage.read().filter((item) => getProduct(item.id));
      renderHome();
      renderAbout();
      renderCartBadge();
      renderCartItems();
      router();

      window.addEventListener('hashchange', router);
      window.addEventListener('resize', updateChipFade);
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isCartOpen()) closeCart();
        trapFocus(event);
      });
    },
  };

  return api;
})();

document.addEventListener('DOMContentLoaded', App.init);
