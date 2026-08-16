/**
 * Catálogo da Perfumaria Eloá.
 *
 * FONTE DE VERDADE: "Projeto - Perfumaria Eloá.md" (Obsidian Vault).
 * Produtos, marcas e categorias foram transcritos exatamente do documento.
 * Nenhum produto ou marca foi inventado.
 *
 * PROVISÓRIO nesta versão (ver DECISOES.md):
 *   - `price`      → o documento não define preços. Valores plausíveis, a validar com a loja.
 *   - `description`→ redigida por nós, genérica por categoria, sem alegações de marca.
 *   - `image`      → ilustração provisória. Para usar a foto real, basta trocar o caminho
 *                    deste campo (ex.: 'assets/img/products/foto-real.jpg').
 */

const CATEGORIES = [
  { id: 'perfumes',  name: 'Perfumes',            icon: 'bottle' },
  { id: 'maquiagem', name: 'Maquiagem',           icon: 'lipstick' },
  { id: 'cabelo',    name: 'Cabelo',              icon: 'hair' },
  { id: 'pele',      name: 'Cuidados com a pele', icon: 'sparkle' },
  { id: 'cilios',    name: 'Cílios',              icon: 'eye' },
  { id: 'unhas',     name: 'Unhas',               icon: 'nail' },
];

const PRODUCTS = [
  {
    id: 'perfume-o-boticario',
    name: 'Perfume',
    brand: 'O Boticário',
    category: 'perfumes',
    price: 129.90,
    featured: true,
    description: 'Perfume da linha O Boticário. Consulte no atendimento as fragrâncias disponíveis na loja.',
    image: 'assets/img/products/perfume-o-boticario.svg',
  },
  {
    id: 'perfume-sea-blue',
    name: 'Perfume',
    brand: 'Sea Blue',
    category: 'perfumes',
    price: 89.90,
    featured: true,
    description: 'Perfume da marca Sea Blue. Consulte no atendimento as fragrâncias disponíveis na loja.',
    image: 'assets/img/products/perfume-sea-blue.svg',
  },
  {
    id: 'base-belle-angel',
    name: 'Base',
    brand: 'Belle Angel',
    category: 'maquiagem',
    price: 34.90,
    featured: true,
    description: 'Base facial Belle Angel. Consulte os tons disponíveis pelo WhatsApp.',
    image: 'assets/img/products/base-belle-angel.svg',
  },
  {
    id: 'base-alleva',
    name: 'Base',
    brand: 'Alleva',
    category: 'maquiagem',
    price: 29.90,
    description: 'Base facial Alleva. Consulte os tons disponíveis pelo WhatsApp.',
    image: 'assets/img/products/base-alleva.svg',
  },
  {
    id: 'lip-gloss-holding-morning',
    name: 'Lip Gloss',
    brand: 'Holding Morning',
    category: 'maquiagem',
    price: 19.90,
    featured: true,
    description: 'Gloss labial Holding Morning. Consulte as cores disponíveis pelo WhatsApp.',
    image: 'assets/img/products/lip-gloss-holding-morning.svg',
  },
  {
    id: 'rimel-panda-yalami',
    name: 'Rímel',
    brand: 'Panda Yalami',
    category: 'maquiagem',
    price: 22.90,
    description: 'Rímel Panda Yalami para volume e definição dos cílios.',
    image: 'assets/img/products/rimel-panda-yalami.svg',
  },
  {
    id: 'delineador-lua-e-neve',
    name: 'Delineador',
    brand: 'Lua e Neve',
    category: 'maquiagem',
    price: 14.90,
    description: 'Delineador Lua e Neve para traços precisos no olhar.',
    image: 'assets/img/products/delineador-lua-e-neve.svg',
  },
  {
    id: 'esponja-base-mango',
    name: 'Esponja para base',
    brand: 'Mango',
    category: 'maquiagem',
    price: 11.90,
    description: 'Esponja Mango para aplicação e acabamento da base.',
    image: 'assets/img/products/esponja-base-mango.svg',
  },
  {
    id: 'shampoo-alquimia',
    name: 'Shampoo',
    brand: 'Alquimia',
    category: 'cabelo',
    price: 32.90,
    featured: true,
    description: 'Shampoo Alquimia para a limpeza diária dos fios.',
    image: 'assets/img/products/shampoo-alquimia.svg',
  },
  {
    id: 'condicionador-alquimia',
    name: 'Condicionador',
    brand: 'Alquimia',
    category: 'cabelo',
    price: 32.90,
    description: 'Condicionador Alquimia para maciez e maleabilidade dos fios.',
    image: 'assets/img/products/condicionador-alquimia.svg',
  },
  {
    id: 'tinta-cabelo-probelle',
    name: 'Tinta para cabelo',
    brand: 'Probelle',
    category: 'cabelo',
    price: 24.90,
    description: 'Coloração capilar Probelle. Consulte os tons disponíveis pelo WhatsApp.',
    image: 'assets/img/products/tinta-cabelo-probelle.svg',
  },
  {
    id: 'tinta-cabelo-e-cor-e-tom',
    name: 'Tinta para cabelo',
    brand: 'E Cor e Tom',
    category: 'cabelo',
    price: 18.90,
    description: 'Coloração capilar E Cor e Tom. Consulte os tons disponíveis pelo WhatsApp.',
    image: 'assets/img/products/tinta-cabelo-e-cor-e-tom.svg',
  },
  {
    id: 'esfoliante-bio-instinto',
    name: 'Esfoliante',
    brand: 'Bio Instinto',
    category: 'pele',
    price: 26.90,
    featured: true,
    description: 'Esfoliante corporal Bio Instinto para a rotina de cuidados com a pele.',
    image: 'assets/img/products/esfoliante-bio-instinto.svg',
  },
  {
    id: 'esfoliante-apiderm',
    name: 'Esfoliante',
    brand: 'Apiderm',
    category: 'pele',
    price: 28.90,
    description: 'Esfoliante Apiderm para a rotina de cuidados com a pele.',
    image: 'assets/img/products/esfoliante-apiderm.svg',
  },
  {
    id: 'cilios-new-how',
    name: 'Cílios',
    brand: 'New How',
    category: 'cilios',
    price: 12.90,
    featured: true,
    description: 'Cílios postiços New How. Consulte os modelos disponíveis pelo WhatsApp.',
    image: 'assets/img/products/cilios-new-how.svg',
  },
  {
    id: 'cola-cilios-hair-bonding',
    name: 'Cola para cílios',
    brand: 'Hair Bonding',
    category: 'cilios',
    price: 9.90,
    description: 'Cola Hair Bonding para fixação de cílios postiços.',
    image: 'assets/img/products/cola-cilios-hair-bonding.svg',
  },
  {
    id: 'unha-postica-dafu',
    name: 'Unha postiça',
    brand: 'Dafu',
    category: 'unhas',
    price: 15.90,
    description: 'Kit de unhas postiças Dafu. Consulte os modelos disponíveis pelo WhatsApp.',
    image: 'assets/img/products/unha-postica-dafu.svg',
  },
];

/** Dados da loja — transcritos do documento do Obsidian. */
const STORE = {
  name: 'Perfumaria Eloá',
  tagline: 'Sua beleza, nossa essência',
  address: 'Rua Nascer do Sol, 243',
  city: 'Cidade Tiradentes — São Paulo/SP',
  hours: 'Segunda a domingo, das 09h00 às 18h00',
  delivery: 'Zona Leste de São Paulo',
  shipping: 'Frete calculado durante o atendimento via WhatsApp.',
  whatsappDisplay: '(11) 93341-4386',
  whatsappNumber: '5511933414386', // formato internacional para links wa.me
};
