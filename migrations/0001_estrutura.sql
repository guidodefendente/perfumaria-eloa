-- Perfumaria Eloá — estrutura do banco (Cloudflare D1 / SQLite).
--
-- Convenções:
--   * datas em epoch ms (INTEGER), geradas pelo Worker;
--   * preço em centavos (INTEGER) — nunca ponto flutuante para dinheiro;
--   * ids de produto e categoria são slugs imutáveis: entram na URL
--     (/produto/<id>/), no carrinho salvo no navegador do cliente e no SEO.


CREATE TABLE categorias (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  icone         TEXT NOT NULL DEFAULT 'sparkle',
  posicao       INTEGER NOT NULL DEFAULT 0,
  na_home       INTEGER NOT NULL DEFAULT 1 CHECK (na_home IN (0, 1)),
  criado_em     INTEGER NOT NULL,
  atualizado_em INTEGER NOT NULL
);

CREATE TABLE produtos (
  id              TEXT PRIMARY KEY,
  nome            TEXT NOT NULL,
  marca           TEXT NOT NULL,
  categoria_id    TEXT NOT NULL REFERENCES categorias(id) ON UPDATE CASCADE,
  preco_centavos  INTEGER NOT NULL CHECK (preco_centavos > 0),
  descricao       TEXT NOT NULL,
  publico         TEXT CHECK (publico IN ('feminino', 'masculino')),
  ficha_json      TEXT,             -- [{ "label": "...", "value": "..." }]
  fragrancia_json TEXT,             -- { "familia": "...", "acordes": "...", ... }
  ativo           INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
  destaque_pos    INTEGER,          -- NULL = não é destaque; 1, 2, 3... = ordem na home
  posicao         INTEGER NOT NULL DEFAULT 0,  -- ordem no catálogo
  criado_em       INTEGER NOT NULL,
  atualizado_em   INTEGER NOT NULL
);
CREATE INDEX idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX idx_produtos_destaque  ON produtos(destaque_pos) WHERE destaque_pos IS NOT NULL;

-- Fotos. `origem` diz onde está o arquivo:
--   'estatica' → arquivo do próprio site (fotos migradas das sprints anteriores)
--   'kv'       → enviada pelo painel, guardada no KV (binding FOTOS)
-- produto_id NULL = foto órfã (enviada e não salva, ou removida do produto).
-- A limpeza diária apaga órfãs com mais de 7 dias — dá tempo de desfazer um
-- erro com o Time Travel do D1, que no plano gratuito também guarda 7 dias.
CREATE TABLE fotos (
  id             TEXT PRIMARY KEY,
  produto_id     TEXT REFERENCES produtos(id) ON DELETE SET NULL,
  posicao        INTEGER NOT NULL DEFAULT 0,
  origem         TEXT NOT NULL CHECK (origem IN ('estatica', 'kv')),
  src_grande     TEXT NOT NULL,     -- caminho público (/img/... ou /assets/...)
  src_miniatura  TEXT NOT NULL,
  chave_grande   TEXT,              -- chave no KV (só origem 'kv')
  chave_mini     TEXT,
  largura        INTEGER,
  altura         INTEGER,
  bytes          INTEGER NOT NULL DEFAULT 0,
  criado_em      INTEGER NOT NULL,
  solta_em       INTEGER            -- quando ficou órfã
);
CREATE INDEX idx_fotos_produto ON fotos(produto_id, posicao);
CREATE INDEX idx_fotos_orfas   ON fotos(solta_em) WHERE produto_id IS NULL;

-- Dados da loja (endereço, horário, WhatsApp...). Chave/valor em JSON.
CREATE TABLE configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

-- Catálogo publicado, já montado: o site lê 1 linha por visita em vez de
-- remontar o catálogo inteiro. Reescrito a cada alteração no painel.
CREATE TABLE publicacao (
  id        INTEGER PRIMARY KEY CHECK (id = 1),
  versao    INTEGER NOT NULL,
  json      TEXT NOT NULL,
  script    TEXT NOT NULL,
  gerado_em INTEGER NOT NULL
);

-- ── Acesso ao painel ────────────────────────────────────────────────────
-- Não existe cadastro público. Só entra quem está em ADMIN_EMAILS (segredo).
-- A senha nunca chega ao servidor: o navegador deriva uma chave com PBKDF2
-- (600 mil iterações) e o servidor guarda HMAC(pepper, chave). Ver docs/SEGURANCA.md.
CREATE TABLE usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nome           TEXT,
  sal            TEXT,              -- base64url, NULL até criar a senha
  iteracoes      INTEGER,
  verificador    TEXT,              -- base64url de HMAC-SHA256(pepper, chave)
  senha_em       INTEGER,
  criado_em      INTEGER NOT NULL,
  ultimo_acesso  INTEGER
);

CREATE TABLE sessoes (
  token_hash   TEXT PRIMARY KEY,    -- SHA-256 do token do cookie
  usuario_id   INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em    INTEGER NOT NULL,
  expira_em    INTEGER NOT NULL,
  visto_em     INTEGER NOT NULL,
  dispositivo  TEXT
);
CREATE INDEX idx_sessoes_usuario ON sessoes(usuario_id);

CREATE TABLE redefinicoes (
  token_hash  TEXT PRIMARY KEY,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em   INTEGER NOT NULL,
  expira_em   INTEGER NOT NULL,
  usado_em    INTEGER
);

-- Limite de tentativas (login, recuperação de senha, envio de fotos).
CREATE TABLE limites (
  chave     TEXT PRIMARY KEY,
  contagem  INTEGER NOT NULL,
  reinicia  INTEGER NOT NULL
);

-- Histórico de alterações feitas no painel ("quem mudou o quê e quando").
CREATE TABLE historico (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  em         INTEGER NOT NULL,
  usuario    TEXT NOT NULL,
  acao       TEXT NOT NULL,
  resumo     TEXT NOT NULL
);
CREATE INDEX idx_historico_em ON historico(em DESC);
