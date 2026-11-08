-- Descarta o catálogo publicado em cache (tabela `publicacao`) para que a
-- nova ordem dos destaques (0003) apareça no site já na próxima visita:
-- o Worker remonta a publicação automaticamente quando ela não existe.
DELETE FROM publicacao;
