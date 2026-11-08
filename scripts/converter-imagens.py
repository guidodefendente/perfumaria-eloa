#!/usr/bin/env python3
"""
Converte as fotos de catálogo (PNG 1254×1254, 1–2,5 MB cada) para WebP.

Gera, para cada PNG usado por products.js, duas versões em
assets/img/products/w/:
  <nome>.webp       1200 px — página do produto e galeria
  <nome>-600.webp    600 px — cards do catálogo e miniaturas

Os PNG originais continuam no repositório: são a matriz de qualidade e a
imagem de compartilhamento (og:image) mais compatível com WhatsApp/Facebook.

Uso único (já executado na migração para o painel). Requer Pillow:
    python3 scripts/converter-imagens.py
"""
import os, re, sys
from PIL import Image

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, 'assets', 'img', 'products')
DESTINO = os.path.join(ORIGEM, 'w')

src = open(os.path.join(RAIZ, 'assets', 'js', 'products.js'), encoding='utf-8').read()
usados = sorted(set(re.findall(r"image:\s*'assets/img/products/([^']+\.png)'", src)))
os.makedirs(DESTINO, exist_ok=True)

antes = depois = 0
for nome in usados:
    base = nome[:-4]
    caminho = os.path.join(ORIGEM, nome)
    img = Image.open(caminho).convert('RGB')
    antes += os.path.getsize(caminho)
    for lado, sufixo, qualidade in ((1200, '', 82), (600, '-600', 80)):
        copia = img.copy()
        copia.thumbnail((lado, lado), Image.LANCZOS)
        saida = os.path.join(DESTINO, f'{base}{sufixo}.webp')
        copia.save(saida, 'WEBP', quality=qualidade, method=6)
        if sufixo == '-600':
            depois += os.path.getsize(saida)
print(f'{len(usados)} imagens convertidas.')
print(f'PNG originais: {antes/1024/1024:.1f} MB · miniaturas WebP (o que o catálogo baixa): {depois/1024/1024:.1f} MB')
