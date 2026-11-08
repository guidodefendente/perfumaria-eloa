/** Página 404 de produto (excluído, oculto ou endereço errado). */
export function pagina404() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Produto não encontrado | Perfumaria Eloá</title>
<meta name="theme-color" content="#140E10">
<link rel="icon" href="/assets/img/logo-eloa-96.png">
<link rel="stylesheet" href="/assets/css/styles.css">
<link rel="stylesheet" href="/assets/css/tailwind.css">
</head>
<body class="bg-white text-ink-800">
<main class="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
  <a href="/" aria-label="Perfumaria Eloá — página inicial">
    <img src="/assets/img/logo-eloa.png" alt="" width="88" height="88" class="rounded-full mx-auto" style="width:88px;height:88px">
  </a>
  <h1 class="font-display text-2xl text-ink-900 mt-8">Produto não encontrado</h1>
  <p class="mt-2 text-sm text-ink-500">Ele pode ter saído do catálogo. Veja o que temos hoje:</p>
  <p class="mt-8"><a href="/#/catalogo" class="btn btn-primary">Ver o catálogo</a></p>
</main>
</body>
</html>
`;
}
