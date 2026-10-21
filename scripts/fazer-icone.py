#!/usr/bin/env python3
# Monta o icone do Asa (build/icon.icns e build/icon.png) a partir da imagem
# que o Pedro escolheu (build/icone-original.jpg: a asa branca no circulo azul).
#
# A imagem e' pequena (circulo de ~240 px) e em JPG; ampliar direto deixaria a
# borda borrada. Entao: amplia bastante, troca cada pixel pela cor mais proxima
# das tres do desenho (branco, azul escuro, azul claro) e reduz pela metade, o
# que deixa a borda lisa e as cores chapadas, como um desenho vetorial.
#
#   python3 scripts/fazer-icone.py      (precisa do Pillow: pip install pillow)

from pathlib import Path
from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
ORIGINAL = RAIZ / 'build' / 'icone-original.jpg'

# Circulo do logo na imagem original (medido): centro e raio, em px.
CX, CY, R = 306, 244.5, 119.5
CORES = [(255, 255, 255), (25, 69, 130), (31, 118, 189)]

N = 1024
DIAMETRO = 620          # do circulo, no icone de 1024
MARGEM, RAIO_CANTO = 100, 185   # quadrado arredondado do macOS


def mais_proxima(p):
    return min(CORES, key=lambda c: sum((a - b) ** 2 for a, b in zip(p, c)))


def logo(tamanho):
    """O logo (com a ponta da asa que sai do circulo) em tamanho x tamanho."""
    im = Image.open(ORIGINAL).convert('RGB')
    folga = R * 1.15
    recorte = im.crop((round(CX - folga), round(CY - folga), round(CX + folga), round(CY + folga)))
    grande = recorte.resize((tamanho * 2, tamanho * 2), Image.BICUBIC)
    # Paleta de 3 cores: quantiza com uma tabela por cor (rapido).
    cache = {}
    pixels = grande.get_flattened_data() if hasattr(grande, 'get_flattened_data') else grande.getdata()
    dados = [cache.setdefault(p, mais_proxima(p)) for p in pixels]
    grande.putdata(dados)
    return grande.resize((tamanho, tamanho), Image.LANCZOS)


def icone():
    tela = Image.new('RGBA', (N, N), (0, 0, 0, 0))
    # Quadrado arredondado branco com borda bem leve, desenhado em 4x e reduzido.
    k = 4
    fundo = Image.new('RGBA', (N * k, N * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(fundo)
    d.rounded_rectangle([MARGEM * k, MARGEM * k, (N - MARGEM) * k, (N - MARGEM) * k], RAIO_CANTO * k, fill=(214, 218, 224, 255))
    d.rounded_rectangle([(MARGEM + 3) * k, (MARGEM + 3) * k, (N - MARGEM - 3) * k, (N - MARGEM - 3) * k], (RAIO_CANTO - 3) * k, fill=(255, 255, 255, 255))
    tela.alpha_composite(fundo.resize((N, N), Image.LANCZOS))
    lado = round(DIAMETRO * 1.15)
    tela.paste(logo(lado), ((N - lado) // 2, (N - lado) // 2))
    return tela


if __name__ == '__main__':
    im = icone()
    im.save(RAIZ / 'build' / 'icon.png')
    im.save(RAIZ / 'build' / 'icon.icns', sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)])
    # Para o navegador e para o atalho na tela inicial do celular dos musicos.
    publico = RAIZ / 'ui' / 'public'
    publico.mkdir(exist_ok=True)
    corte = im.crop((MARGEM, MARGEM, N - MARGEM, N - MARGEM))
    corte.resize((180, 180), Image.LANCZOS).save(publico / 'icone-180.png')
    corte.resize((64, 64), Image.LANCZOS).save(publico / 'icone-64.png')
    print('build/icon.png, build/icon.icns e ui/public/icone-*.png prontos')
