#!/usr/bin/env python3
"""
Eloá — ciclo automático de cadastro/exclusão de produtos.

Lê a caixa de e-mail configurada (GMAIL_USER/GMAIL_APP_PASSWORD), pega as
submissões do formulário público (admin/enviar.html) que ainda não estão em
submissoes.md, e aplica cada uma direto em assets/js/products.js.

De propósito, NÃO faz:
  · tratamento de imagem — o arquivo enviado é salvo como chegou;
  · validação de dado de negócio — nome, marca, preço, categoria e descrição
    entram exatamente como o formulário enviou, sem revisão de conteúdo.

A única trava é técnica, não editorial: depois de cada mudança, roda o gerador
de páginas e a suíte de verificação (tools/verificar-seo.mjs). Se a mudança
quebraria o site — id duplicado, JavaScript inválido, sitemap inconsistente —
ela é desfeita automaticamente, sem pedir aprovação de ninguém. A submissão
fica registrada em submissoes.md como revertida, para quem quiser investigar.

Roda inteiro no GitHub Actions (.github/workflows/eloa-catalogo.yml) — não
depende de nenhuma máquina ou conta pessoal.
"""

import email
import hashlib
import hmac
import html as H
import imaplib
import json
import os
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timezone
from email import policy
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PRODUCTS_JS = REPO / 'assets/js/products.js'
IMG_DIR = REPO / 'assets/img/products'
LEDGER = REPO / 'submissoes.md'

GMAIL_USER = os.environ['GMAIL_USER']
GMAIL_PASSWORD = os.environ['GMAIL_APP_PASSWORD'].replace(' ', '')
FORM_KEY = os.environ.get('ELOA_FORM_KEY', '').strip()

SUBJECT_CADASTRO = 'NOVO PRODUTO'
SUBJECT_EXCLUSAO = 'EXCLUIR PRODUTO:'
KNOWN_FIELDS = ['Nome', 'Marca', 'Categoria', 'Preco_BRL', 'Destaque', 'Publico',
                'Descricao', 'Slug', 'NomeProduto', 'Motivo', 'Chave']


class Erro(Exception):
    pass


def slugify(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'^-+|-+$', '', re.sub(r'[^a-z0-9]+', '-', s))


def parse_fields(body_html: str) -> dict:
    fields = {}
    for row in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', body_html):
        tds = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row)
        vals = [H.unescape(re.sub(r'<[^>]+>', '', td)).strip() for td in tds]
        if len(vals) >= 2 and vals[0] in KNOWN_FIELDS:
            fields[vals[0]] = vals[1]
    return fields


def preco_float(s):
    s = (s or '').strip().replace('R$', '').strip()
    s = s.replace('.', '').replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return None


# ── ledger (submissoes.md, dentro do próprio repositório) ──────────────────

def ledger_ids() -> set:
    if not LEDGER.exists():
        return set()
    ids = set()
    for linha in LEDGER.read_text().splitlines():
        cols = linha.split('|')
        if len(cols) >= 3 and cols[1].strip().startswith('<'):
            ids.add(cols[1].strip())
    return ids


def ledger_append(mid: str, produto: str, slug: str, status: str) -> None:
    if not LEDGER.exists():
        LEDGER.write_text(
            '# Submissões — Perfumaria Eloá\n\n'
            'Registro automático de cada submissão do formulário público '
            'processada pelo GitHub Actions '
            '(`.github/workflows/eloa-catalogo.yml`). Um Message-ID por linha, '
            'nunca removida — é o histórico de auditoria.\n\n'
            '| Message-ID | Data | Produto | Slug | Status |\n'
            '|---|---|---|---|---|\n')
    when = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')
    with open(LEDGER, 'a') as f:
        f.write(f'| {mid} | {when} | {produto} | {slug} | {status} |\n')


# ── leitura via node (fonte da verdade, não regex) ──────────────────────────

def ler_catalogo() -> list:
    js = (
        "const fs=require('fs');"
        "const P=new Function(fs.readFileSync(%r,'utf8')+'; return PRODUCTS;')();"
        "console.log(JSON.stringify(P.map(p=>({id:p.id,image:p.image||''}))));"
        % str(PRODUCTS_JS)
    )
    r = subprocess.run(['node', '-e', js], capture_output=True, text=True)
    if r.returncode != 0:
        raise Erro('products.js inválido: ' + r.stderr.strip())
    return json.loads(r.stdout)


def slug_livre(base: str, existentes: set) -> str:
    if base not in existentes:
        return base
    i = 2
    while f'{base}-{i}' in existentes:
        i += 1
    return f'{base}-{i}'


# ── inserir/remover objeto no texto (mesma técnica dos scripts do Hermes) ──

ORDEM = ['id', 'name', 'brand', 'category', 'audience', 'price', 'featured',
         'description', 'image']


def js_valor(v) -> str:
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return f'{float(v):.2f}'
    return "'" + str(v).replace('\\', '\\\\').replace("'", "\\'") + "'"


def render(prod: dict) -> str:
    linhas = ''.join(f'    {k}: {js_valor(prod[k])},\n'
                      for k in ORDEM if prod.get(k) not in (None, ''))
    return '  {\n' + linhas + '  },\n'


def inserir(src: str, prod: dict) -> str:
    marca = 'const PRODUCTS = ['
    ini = src.find(marca)
    if ini < 0:
        raise Erro('"const PRODUCTS = [" não encontrado em products.js')
    i = ini + len(marca) - 1
    prof, aspas = 0, None
    while i < len(src):
        c = src[i]
        if aspas:
            if c == '\\':
                i += 2
                continue
            if c == aspas:
                aspas = None
        elif c in "'\"`":
            aspas = c
        elif c == '[':
            prof += 1
        elif c == ']':
            prof -= 1
            if prof == 0:
                break
        i += 1
    linha = src.rfind('\n', 0, i) + 1
    return src[:linha] + render(prod) + src[linha:]


def remover(src: str, slug: str) -> str:
    marcador = f"id: '{slug}'"
    pos = src.find(marcador)
    if pos < 0:
        raise Erro(f'id "{slug}" não encontrado em products.js')
    i = pos
    while i > 0 and src[i] != '{':
        i -= 1
    ini = i
    while ini > 0 and src[ini - 1] in (' ', '\n', '\r'):
        ini -= 1
    j, prof, aspas = i, 0, None
    while j < len(src):
        c = src[j]
        if aspas:
            if c == '\\':
                j += 2
                continue
            if c == aspas:
                aspas = None
        elif c in "'\"` ":
            if c != ' ':
                aspas = c
        elif c == '{':
            prof += 1
        elif c == '}':
            prof -= 1
            if prof == 0:
                break
        j += 1
    fim = j + 1
    k = fim
    while k < len(src) and src[k] in (',', ' ', '\n', '\r'):
        if src[k] == ',':
            fim = k + 1
            break
        k += 1
    return src[:ini] + src[fim:]


# ── trava técnica (não é revisão de negócio) ────────────────────────────────

def gerar_paginas() -> None:
    subprocess.run(['node', 'tools/gerar-paginas.mjs'], cwd=REPO, capture_output=True, text=True)


def build_e_verificar() -> tuple:
    r1 = subprocess.run(['node', 'tools/gerar-paginas.mjs'], cwd=REPO,
                         capture_output=True, text=True)
    if r1.returncode != 0:
        return False, 'gerar-paginas: ' + (r1.stderr or r1.stdout)[-300:]
    r2 = subprocess.run(['node', 'tools/verificar-seo.mjs'], cwd=REPO,
                         capture_output=True, text=True)
    if r2.returncode != 0:
        return False, 'verificar-seo: ' + (r2.stdout or r2.stderr)[-500:]
    return True, ''


# ── cadastro ─────────────────────────────────────────────────────────────────

def aplicar_cadastro(fields: dict, attachment) -> tuple:
    nome = (fields.get('Nome') or '').strip()
    if not nome:
        return None, 'sem nome — ignorada'

    catalogo = ler_catalogo()
    ids = {p['id'] for p in catalogo}
    slug = slug_livre(slugify(nome), ids)

    preco = preco_float(fields.get('Preco_BRL'))
    prod = {
        'id': slug,
        'name': nome,
        'brand': (fields.get('Marca') or '').strip(),
        'category': (fields.get('Categoria') or '').strip(),
        'audience': (fields.get('Publico') or '').strip() or None,
        'price': preco if preco is not None else 0,
        'featured': (fields.get('Destaque') or '').strip().lower() == 'sim',
        'description': (fields.get('Descricao') or '').strip(),
    }

    img_path = None
    if attachment and attachment[1]:
        ext = Path(attachment[0] or '').suffix.lower()
        if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
            ext = '.jpg'
        img_path = IMG_DIR / f'{slug}{ext}'
        IMG_DIR.mkdir(parents=True, exist_ok=True)
        img_path.write_bytes(attachment[1])
        prod['image'] = f'assets/img/products/{slug}{ext}'
    else:
        prod['image'] = ''

    src = PRODUCTS_JS.read_text()
    PRODUCTS_JS.write_text(inserir(src, prod))

    ok, erro = build_e_verificar()
    if not ok:
        PRODUCTS_JS.write_text(src)
        if img_path and img_path.exists():
            img_path.unlink()
        gerar_paginas()
        return slug, f'REVERTIDO (quebraria o site): {erro[:200]}'

    return slug, f'PUBLICADO — {nome}'


# ── exclusão ─────────────────────────────────────────────────────────────────

def aplicar_exclusao(fields: dict, subject: str) -> tuple:
    slug = (fields.get('Slug') or '').strip().lower()
    if not slug:
        m = re.search(r'EXCLUIR PRODUTO:\s*([a-z0-9][a-z0-9\-]*)', subject, re.I)
        slug = m.group(1).lower() if m else ''
    if not slug:
        return None, 'sem slug — ignorada'

    catalogo = ler_catalogo()
    prod = next((p for p in catalogo if p['id'] == slug), None)
    if not prod:
        return slug, 'produto não encontrado — ignorada'

    src = PRODUCTS_JS.read_text()
    try:
        novo = remover(src, slug)
    except Erro as e:
        return slug, f'erro ao remover: {e}'
    PRODUCTS_JS.write_text(novo)

    img_rel = prod.get('image') or ''
    usos = sum(1 for p in catalogo if p.get('image') == img_rel and p['id'] != slug)
    img_path = REPO / img_rel if img_rel else None
    removeu_imagem = img_path is not None and usos == 0 and img_path.exists()
    if removeu_imagem:
        img_path.unlink()

    ok, erro = build_e_verificar()
    if not ok:
        PRODUCTS_JS.write_text(src)
        if removeu_imagem:
            subprocess.run(['git', 'checkout', '--', img_rel], cwd=REPO)
        gerar_paginas()
        return slug, f'REVERTIDO (quebraria o site): {erro[:200]}'

    return slug, 'REMOVIDO'


# ── main ───────────────────────────────────────────────────────────────────

def main() -> None:
    processados = ledger_ids()
    m = imaplib.IMAP4_SSL('imap.gmail.com', 993)
    m.login(GMAIL_USER, GMAIL_PASSWORD)
    m.select('INBOX')
    typ, ids = m.search(None, 'FROM', '"formsubmit.co"')
    targets = ids[0].split()

    for num in targets:
        typ, d = m.fetch(num, '(RFC822)')
        msg = email.message_from_bytes(d[0][1], policy=policy.default)
        mid = msg['Message-ID']
        if not mid or mid in processados:
            continue

        subject = str(msg['Subject'] or '')
        if subject.startswith(SUBJECT_CADASTRO):
            acao = 'cadastrar'
        elif subject.startswith(SUBJECT_EXCLUSAO):
            acao = 'excluir'
        else:
            continue  # não é do formulário — nunca registrado, nunca reprocessado

        body_html, attachment = None, None
        for part in msg.walk():
            ctype = part.get_content_type()
            if ctype == 'text/html' and body_html is None:
                body_html = part.get_payload(decode=True).decode(errors='replace')
            elif str(part.get_content_disposition()) == 'attachment':
                attachment = (part.get_filename(), part.get_payload(decode=True))

        fields = parse_fields(body_html) if body_html else {}

        if FORM_KEY:
            enviada = (fields.get('Chave') or '').strip()
            if not hmac.compare_digest(enviada, FORM_KEY):
                ledger_append(mid, fields.get('Nome') or fields.get('Slug') or '—',
                              '—', 'IGNORADA (chave incorreta)')
                processados.add(mid)
                continue

        if acao == 'cadastrar':
            slug, status = aplicar_cadastro(fields, attachment)
        else:
            slug, status = aplicar_exclusao(fields, subject)

        nome = fields.get('Nome') or fields.get('NomeProduto') or slug or '—'
        ledger_append(mid, nome, slug or '—', status)
        processados.add(mid)
        print(f'{mid}: {status}', file=sys.stderr)

    m.logout()


if __name__ == '__main__':
    main()
