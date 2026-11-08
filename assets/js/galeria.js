/**
 * Galeria de fotos do produto — usada na rota #/produto/<id> do site (app.js)
 * e nas páginas /produto/<id>/ geradas pelo Worker. Uma única fonte de markup
 * para os dois lugares: o Worker importa este mesmo arquivo.
 *
 * Celular: deslizar com o dedo (scroll-snap nativo, sem biblioteca).
 * Computador: setas e miniaturas. Teclado: ← → com a foto em foco.
 */
(function (raiz) {
  'use strict';

  const esc = (str) => String(str).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));

  const seta = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

  function fotosDe(p) {
    if (p.images && p.images.length) return p.images;
    return [{ src: p.image, thumb: p.thumb || p.image }];
  }

  /** Markup da galeria para um produto no formato do site. */
  function html(p) {
    const fotos = fotosDe(p);
    const n = fotos.length;
    const alt = `${p.name} da marca ${p.brand}`;
    const slides = fotos.map((f, i) => `<img class="galeria-foto" src="${esc(f.src)}" alt="${esc(n > 1 ? `${alt} — foto ${i + 1} de ${n}` : alt)}" width="1200" height="1200" decoding="async"${i ? ' loading="lazy"' : ' fetchpriority="high"'}>`).join('');

    if (n === 1) {
      return `<div class="galeria"><div class="galeria-moldura"><div class="galeria-palco">${slides}</div></div></div>`;
    }
    return `<div class="galeria" data-galeria>
        <div class="galeria-moldura">
          <div class="galeria-palco" tabindex="0" role="region" aria-roledescription="carrossel" aria-label="Fotos do produto, ${n} fotos">${slides}</div>
          <button type="button" class="galeria-seta galeria-ant" data-galeria-ant aria-label="Foto anterior">${seta('m15 18-6-6 6-6')}</button>
          <button type="button" class="galeria-seta galeria-prox" data-galeria-prox aria-label="Próxima foto">${seta('m9 18 6-6-6-6')}</button>
          <span class="galeria-contador" aria-hidden="true"><span data-galeria-atual>1</span>/${n}</span>
        </div>
        <div class="galeria-miniaturas" role="group" aria-label="Escolher foto">${fotos.map((f, i) => `
          <button type="button" class="galeria-mini" data-galeria-ir="${i}" aria-label="Ver foto ${i + 1} de ${n}"${i === 0 ? ' aria-current="true"' : ''}>
            <img src="${esc(f.thumb || f.src)}" alt="" width="120" height="120" loading="lazy" decoding="async">
          </button>`).join('')}
        </div>
      </div>`;
  }

  /** Liga os controles de todas as galerias dentro de `raizDom`. */
  function ativar(raizDom) {
    const doc = raizDom || document;
    doc.querySelectorAll('[data-galeria]:not([data-galeria-ok])').forEach((g) => {
      g.setAttribute('data-galeria-ok', '');
      const palco = g.querySelector('.galeria-palco');
      const minis = Array.from(g.querySelectorAll('[data-galeria-ir]'));
      const atual = g.querySelector('[data-galeria-atual]');
      const total = minis.length;
      const suave = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
      let indice = 0;

      const marcar = (i) => {
        indice = i;
        minis.forEach((m, j) => (j === i ? m.setAttribute('aria-current', 'true') : m.removeAttribute('aria-current')));
        if (atual) atual.textContent = String(i + 1);
        const mini = minis[i];
        if (mini && mini.scrollIntoView && mini.parentElement.scrollWidth > mini.parentElement.clientWidth) {
          mini.parentElement.scrollTo({ left: mini.offsetLeft - mini.parentElement.clientWidth / 2 + mini.clientWidth / 2, behavior: suave() });
        }
      };
      const ir = (i) => {
        const alvo = (i + total) % total;
        palco.scrollTo({ left: alvo * palco.clientWidth, behavior: suave() });
        marcar(alvo);
      };

      let quadro = 0;
      palco.addEventListener('scroll', () => {
        cancelAnimationFrame(quadro);
        quadro = requestAnimationFrame(() => {
          const i = Math.round(palco.scrollLeft / Math.max(1, palco.clientWidth));
          if (i !== indice && i >= 0 && i < total) marcar(i);
        });
      }, { passive: true });

      minis.forEach((m) => m.addEventListener('click', () => ir(Number(m.dataset.galeriaIr))));
      const ant = g.querySelector('[data-galeria-ant]');
      const prox = g.querySelector('[data-galeria-prox]');
      if (ant) ant.addEventListener('click', () => ir(indice - 1));
      if (prox) prox.addEventListener('click', () => ir(indice + 1));
      palco.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); ir(indice - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); ir(indice + 1); }
      });
    });
  }

  raiz.Galeria = { html, ativar };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ativar());
    else ativar();
  }
}(typeof window !== 'undefined' ? window : globalThis));
