/**
 * Otimização das fotos NO CELULAR, antes do envio.
 *
 * Uma foto de celular tem 3–8 MB; o site precisa de ~150 KB. Reduzir aqui:
 *   - deixa o envio rápido mesmo no 4G;
 *   - não gasta nada de servidor (sem serviço de imagens pago);
 *   - garante que o site continue leve.
 *
 * Gera duas versões quadradas (o catálogo usa fotos quadradas):
 *   grande      até 1600 × 1600  → página do produto
 *   miniatura   600 × 600        → cards e miniaturas
 *
 * Dois enquadramentos:
 *   'encaixar' (padrão)  a foto inteira aparece, com fundo da cor das bordas
 *                        da própria foto — nunca corta o produto;
 *   'preencher'          corta as sobras para preencher o quadrado.
 */
const LADO_GRANDE = 1600;
const LADO_MINI = 600;
const MAX_BYTES_GRANDE = 1.4 * 1024 * 1024;

async function decodificar(arquivo) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    } catch (_) { /* tenta pelo <img> */ }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } catch (_) {
    throw new Error('Não foi possível abrir esta imagem. Tente outra foto (JPG ou PNG). No iPhone, se der erro, ajuste em Ajustes → Câmera → Formatos → "Mais Compatível".');
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

const dimensoes = (img) => ({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });

/** Cor média das bordas da foto — fundo "invisível" no modo encaixar. */
function corDasBordas(img) {
  const { w, h } = dimensoes(img);
  const c = document.createElement('canvas');
  c.width = 48; c.height = Math.max(1, Math.round(48 * h / w));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let y = 0; y < c.height; y += 1) {
    for (let x = 0; x < c.width; x += 1) {
      if (x > 1 && x < c.width - 2 && y > 1 && y < c.height - 2) continue;
      const i = (y * c.width + x) * 4;
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1;
    }
  }
  return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
}

function desenhar(img, lado, modo, fundo) {
  const { w, h } = dimensoes(img);
  const c = document.createElement('canvas');
  c.width = lado; c.height = lado;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (modo === 'preencher') {
    const s = Math.min(w, h);
    ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, lado, lado);
  } else {
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, lado, lado);
    const escala = Math.min(lado / w, lado / h);
    const dw = w * escala; const dh = h * escala;
    ctx.drawImage(img, (lado - dw) / 2, (lado - dh) / 2, dw, dh);
  }
  return c;
}

function codificar(canvas, qualidade) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((webp) => {
      // Navegadores antigos (Safari < 14) ignoram WebP e devolvem PNG: usa JPEG.
      if (webp && webp.type === 'image/webp') return resolve(webp);
      canvas.toBlob((jpg) => (jpg ? resolve(jpg) : reject(new Error('Não foi possível processar a foto.'))), 'image/jpeg', qualidade);
    }, 'image/webp', qualidade);
  });
}

/**
 * @returns {Promise<{ grande: Blob, miniatura: Blob, lado: number, previa: string, aviso: string|null }>}
 */
export async function prepararFoto(arquivo, modo = 'encaixar') {
  if (!arquivo.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp)$/i.test(arquivo.name)) {
    throw new Error('Esse arquivo não é uma foto.');
  }
  if (arquivo.size > 40 * 1024 * 1024) throw new Error('Foto grande demais (acima de 40 MB).');
  const img = await decodificar(arquivo);
  const { w, h } = dimensoes(img);
  const fundo = modo === 'encaixar' ? corDasBordas(img) : '#fff';
  const ladoOriginal = modo === 'preencher' ? Math.min(w, h) : Math.max(w, h);
  const lado = Math.min(LADO_GRANDE, ladoOriginal);

  const canvasGrande = desenhar(img, lado, modo, fundo);
  let grande = await codificar(canvasGrande, 0.85);
  if (grande.size > MAX_BYTES_GRANDE) grande = await codificar(canvasGrande, 0.72);
  const miniatura = await codificar(desenhar(img, Math.min(LADO_MINI, lado), modo, fundo), 0.8);
  if (img.close) img.close();

  return {
    grande,
    miniatura,
    lado,
    previa: URL.createObjectURL(miniatura),
    aviso: ladoOriginal < 500 ? 'Foto pequena: pode ficar borrada no site. Se puder, use uma foto maior.' : null,
  };
}
