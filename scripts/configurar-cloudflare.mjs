/**
 * Cria (se ainda não existirem) o banco D1 "eloa" e o namespace KV de fotos,
 * e grava os IDs no wrangler.jsonc. Idempotente: rodar de novo só reaproveita.
 *
 * Usado pelo fluxo "Configurar Cloudflare" (.github/workflows/configurar.yml).
 * Precisa de CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID no ambiente.
 *
 * Usa a API oficial da Cloudflare diretamente. Só toca em D1 e KV — produtos
 * do plano gratuito. Não cria R2, não muda plano, não cadastra pagamento.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_ACCOUNT_ID: CONTA } = process.env;
if (!TOKEN || !CONTA) {
  console.error('Defina CLOUDFLARE_API_TOKEN e CLOUDFLARE_ACCOUNT_ID.');
  process.exit(1);
}

const NOME_BANCO = 'eloa';
const NOME_KV = 'perfumaria-eloa-fotos';

async function cf(metodo, caminho, corpo) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CONTA}${caminho}`, {
    method: metodo,
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok || dados.success === false) {
    const erros = (dados.errors || []).map((e) => `${e.code}: ${e.message}`).join('; ');
    throw new Error(`${metodo} ${caminho} → HTTP ${r.status} ${erros}`);
  }
  return dados.result;
}

const bancos = await cf('GET', `/d1/database?name=${NOME_BANCO}&per_page=100`);
let banco = bancos.find((b) => b.name === NOME_BANCO);
if (banco) console.log(`Banco D1 "${NOME_BANCO}" já existe: ${banco.uuid}`);
else {
  // "enam" (leste da América do Norte) é a região mais próxima do Brasil oferecida pelo D1.
  banco = await cf('POST', '/d1/database', { name: NOME_BANCO, primary_location_hint: 'enam' });
  console.log(`Banco D1 "${NOME_BANCO}" criado: ${banco.uuid}`);
}

const namespaces = await cf('GET', '/storage/kv/namespaces?per_page=100');
let kv = namespaces.find((n) => n.title === NOME_KV);
if (kv) console.log(`KV "${NOME_KV}" já existe: ${kv.id}`);
else {
  kv = await cf('POST', '/storage/kv/namespaces', { title: NOME_KV });
  console.log(`KV "${NOME_KV}" criado: ${kv.id}`);
}

const arquivo = resolve(RAIZ, 'wrangler.jsonc');
const antes = readFileSync(arquivo, 'utf8');
const depois = antes
  .replace(/("database_id":\s*")[^"]*(")/, `$1${banco.uuid}$2`)
  .replace(/("binding":\s*"FOTOS",[\s\S]*?"id":\s*")[^"]*(")/, `$1${kv.id}$2`);
if (!depois.includes(banco.uuid) || !depois.includes(kv.id)) throw new Error('Não consegui gravar os IDs no wrangler.jsonc.');
if (depois !== antes) {
  writeFileSync(arquivo, depois);
  console.log('wrangler.jsonc atualizado.');
}
