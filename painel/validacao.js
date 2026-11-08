/**
 * Compartilhado: o painel (navegador) e o Worker importam ESTE arquivo, então
 * as regras de validação são exatamente as mesmas nos dois lados.
 *
 * Validação dos dados que chegam do painel. Funções puras (sem banco), para
 * poderem ser testadas isoladamente e reaproveitadas no navegador.
 *
 * As mensagens são escritas para quem usa o painel, não para programador.
 */

export const ICONES = ['bottle', 'lipstick', 'hair', 'sparkle', 'wipe', 'eye', 'nail'];
export const PUBLICOS = ['feminino', 'masculino'];
export const CAMPOS_FRAGRANCIA = ['familia', 'acordes', 'saida', 'coracao', 'fundo', 'sensacao', 'ocasiao'];
export const MAX_FOTOS = 8;
export const MAX_FICHA = 12;

/** "Pó Iluminador — Amor & Anjo" → "po-iluminador-amor-anjo" */
export function gerarSlug(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' e ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
}

const texto = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const textoLongo = (v) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '');

/**
 * Converte o preço digitado em centavos. Aceita número (12.9) ou texto no
 * formato brasileiro ("12,90", "R$ 1.234,50", "12").
 */
export function precoEmCentavos(valor) {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Math.round(valor * 100);
  if (typeof valor !== 'string') return NaN;
  let s = valor.replace(/[R$\s]/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Math.round(Number(s) * 100);
}

function exigirTamanho(erros, campo, valor, min, max, rotulo) {
  if (valor.length < min) erros[campo] = min <= 1 ? `Informe ${rotulo}.` : `${rotulo[0].toUpperCase()}${rotulo.slice(1)} precisa ter pelo menos ${min} letras.`;
  else if (valor.length > max) erros[campo] = `${rotulo[0].toUpperCase()}${rotulo.slice(1)} pode ter no máximo ${max} caracteres.`;
}

/**
 * Valida e normaliza um produto vindo do painel.
 * @returns {{ ok: true, produto: object } | { ok: false, campos: object }}
 */
export function validarProduto(entrada, idsCategorias) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const erros = {};

  const nome = texto(e.nome);
  exigirTamanho(erros, 'nome', nome, 2, 120, 'o nome');

  const marca = texto(e.marca);
  exigirTamanho(erros, 'marca', marca, 1, 80, 'a marca');

  const categoria = texto(e.categoria);
  if (!categoria) erros.categoria = 'Escolha a categoria.';
  else if (!idsCategorias.includes(categoria)) erros.categoria = 'Essa categoria não existe mais. Escolha outra.';

  const centavos = precoEmCentavos(e.preco);
  if (!Number.isInteger(centavos) || centavos <= 0) erros.preco = 'Informe o preço, por exemplo 49,90.';
  else if (centavos > 9_999_999) erros.preco = 'Preço alto demais. Confira o valor.';

  const descricao = textoLongo(e.descricao);
  exigirTamanho(erros, 'descricao', descricao, 10, 2000, 'a descrição');

  let publico = e.publico ? texto(e.publico) : null;
  if (publico && !PUBLICOS.includes(publico)) erros.publico = 'Escolha feminino ou masculino.';
  if (!publico) publico = null;

  const ficha = [];
  if (e.ficha !== undefined && e.ficha !== null) {
    if (!Array.isArray(e.ficha)) erros.ficha = 'Ficha do produto inválida.';
    else {
      for (const linha of e.ficha) {
        const label = texto(linha && linha.label);
        const value = texto(linha && linha.value);
        if (!label && !value) continue; // linha vazia: ignora
        if (!label || !value) { erros.ficha = 'Cada linha da ficha precisa do nome e do valor (ex.: Volume — 100 ml).'; break; }
        if (label.length > 40 || value.length > 200) { erros.ficha = 'Linha da ficha longa demais.'; break; }
        ficha.push({ label, value });
      }
      if (ficha.length > MAX_FICHA) erros.ficha = `A ficha pode ter no máximo ${MAX_FICHA} linhas.`;
    }
  }

  const fragrancia = {};
  if (e.fragrancia && typeof e.fragrancia === 'object') {
    for (const chave of CAMPOS_FRAGRANCIA) {
      const v = texto(e.fragrancia[chave]);
      if (!v) continue;
      if (v.length > 300) { erros.fragrancia = 'Um dos campos do perfil olfativo está longo demais.'; break; }
      fragrancia[chave] = v;
    }
  }

  const fotos = Array.isArray(e.fotos) ? e.fotos.filter((id) => typeof id === 'string' && id.length <= 64) : [];
  if (Array.isArray(e.fotos) && fotos.length !== e.fotos.length) erros.fotos = 'Lista de fotos inválida.';
  if (new Set(fotos).size !== fotos.length) erros.fotos = 'A mesma foto aparece duas vezes.';
  if (fotos.length > MAX_FOTOS) erros.fotos = `Cada produto pode ter no máximo ${MAX_FOTOS} fotos.`;
  if (!fotos.length) erros.fotos = 'Adicione pelo menos uma foto do produto.';

  const ativo = e.ativo === undefined ? true : Boolean(e.ativo);
  const destaque = Boolean(e.destaque);

  if (Object.keys(erros).length) return { ok: false, campos: erros };
  return {
    ok: true,
    produto: {
      nome, marca, categoria, centavos, descricao, publico,
      ficha: ficha.length ? ficha : null,
      fragrancia: Object.keys(fragrancia).length ? fragrancia : null,
      fotos, ativo, destaque,
    },
  };
}

export function validarCategoria(entrada) {
  const e = entrada && typeof entrada === 'object' ? entrada : {};
  const erros = {};
  const nome = texto(e.nome);
  exigirTamanho(erros, 'nome', nome, 2, 40, 'o nome');
  const icone = texto(e.icone) || 'sparkle';
  if (!ICONES.includes(icone)) erros.icone = 'Escolha um dos ícones da lista.';
  const naHome = e.naHome === undefined ? true : Boolean(e.naHome);
  if (Object.keys(erros).length) return { ok: false, campos: erros };
  return { ok: true, categoria: { nome, icone, naHome } };
}

export function validarEmail(valor) {
  const email = texto(valor).toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Lista de ids sem repetição e todos conhecidos. */
export function validarOrdem(ids, conhecidos, rotulo = 'itens') {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) return `Lista de ${rotulo} inválida.`;
  if (new Set(ids).size !== ids.length) return `Há ${rotulo} repetidos na lista.`;
  const desconhecido = ids.find((id) => !conhecidos.has(id));
  if (desconhecido) return `Um dos ${rotulo} não existe mais. Recarregue a página.`;
  return null;
}
