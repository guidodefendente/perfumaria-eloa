/**
 * Ponte para a galeria do site: o Worker usa o MESMO arquivo que o navegador
 * (assets/js/galeria.js), para o HTML da página do produto sair idêntico nos
 * dois lugares.
 */
import '../../assets/js/galeria.js';

export const galeriaHtml = (produto) => globalThis.Galeria.html(produto);
