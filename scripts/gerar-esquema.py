"""Gera app/main/esquema.json.gz a partir do propmap.jsonl do libwing (Apache-2.0).

Cada linha vira [caminho, id, tipo, unidade, min, max, passos, itens, nomeLongo].
Tipos: 0 no, 1 linear, 2 log, 3 fader, 4 inteiro, 5 enum texto, 6 enum float, 7 texto.
"""
import json, gzip, sys

TIPOS = {'node': 0, 'linear float': 1, 'log float': 2, 'fader level': 3,
         'integer': 4, 'string enum': 5, 'float enum': 6, 'string': 7}
UNID = {None: 0, 'dB': 1, '%': 2, 'ms': 3, 'Hz': 4, 'meters': 5, 'seconds': 6, 'octaves': 7}

orig, dest = sys.argv[1], sys.argv[2]
saida = []
for linha in open(orig):
    r = json.loads(linha)
    f = r['fullname']
    if f.startswith('/$ctl'):
        continue  # superficie de controle da mesa: nao usamos
    t = TIPOS[r['type']]
    mn = mx = st = None
    itens = None
    if 'minfloat' in r:
        mn, mx, st = r['minfloat'], r['maxfloat'], r.get('steps')
    elif 'minint' in r:
        mn, mx = r['minint'], r['maxint']
    elif t == 3:
        mn, mx = -144, 10
    if 'items' in r:
        itens = [[i['item'], i.get('longitem', '')] for i in r['items']]
    if t == 7:
        mx = r.get('maxstringlen')
    saida.append([f, r['id'], t, UNID[r.get('unit')], mn, mx, st, itens, r.get('longname', '')])

with gzip.open(dest, 'wt', encoding='utf8') as g:
    json.dump(saida, g, separators=(',', ':'))
print(len(saida), 'entradas')
