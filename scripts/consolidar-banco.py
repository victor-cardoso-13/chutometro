#!/usr/bin/env python3
"""Junta data/src/*.json em data/banco-bruto.json (ids c001…), tira respostas negativas e perguntas repetidas,
e gera as entradas CEGAS para validação (só id, pergunta e unidade) em data/validacao/entrada-N.json."""
import json, glob, os, re
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
banco, vistos = [], set()
for f in sorted(glob.glob(f'{raiz}/data/src/*.json')):
    cat = os.path.basename(f)[:-5]
    for x in json.load(open(f)):
        chave = re.sub(r'\W+', ' ', x['q'].lower()).strip()
        if x['resposta'] < 0 or chave in vistos:
            continue
        vistos.add(chave)
        x['cat'] = cat
        banco.append(x)
for i, x in enumerate(banco, 1):
    x['id'] = f'c{i:04d}'
json.dump(banco, open(f'{raiz}/data/banco-bruto.json', 'w'), ensure_ascii=False, indent=1)
os.makedirs(f'{raiz}/data/validacao', exist_ok=True)
N = 11
tam = -(-len(banco) // N)
for n in range(N):
    lote = [{'id': x['id'], 'q': x['q'], 'unidade': x['unidade']} for x in banco[n*tam:(n+1)*tam]]
    json.dump(lote, open(f'{raiz}/data/validacao/entrada-{n+1:02d}.json', 'w'), ensure_ascii=False, indent=1)
print(len(banco), 'perguntas em', N, 'lotes de até', tam)
