#!/usr/bin/env python3
"""Acrescenta ao public/questions.json as perguntas do lote 2 aprovadas (data/validacao{LOTE}/relatorio.json = ok) e marca como
veteranas (v:1) as de data/veteranas.json (já saíram numa partida: ficam em segundo plano). Não mexe nos ids existentes.
Idempotente. Depois: node scripts/lista-falas.ts > data/falas.json && python3 scripts/gerar-narracao.py"""
import json, os, sys
LOTE = int(sys.argv[1]) if len(sys.argv) > 1 else 2
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
banco = {x['id']: x for x in json.load(open(f'{raiz}/data/banco-bruto.json'))}
rel = json.load(open(f'{raiz}/data/validacao{LOTE}/relatorio.json'))
vet = set(json.load(open(f'{raiz}/data/veteranas.json'))['ids'])
final = json.load(open(f'{raiz}/public/questions.json'))
tem = {q['id'] for q in final}
novas = 0
for i, r in rel.items():
    if r['status'] == 'ok' and i not in tem:
        x = banco[i]
        final.append({'id': i, 'q': x['q'], 'u': x['unidade'], 'r': x['resposta'], 'cat': x['cat'], 'd': x.get('dificuldade', 2)})
        novas += 1
marc = 0
for q in final:
    if q['id'] in vet and not q.get('v'):
        q['v'] = 1; marc += 1
json.dump(final, open(f'{raiz}/public/questions.json', 'w'), ensure_ascii=False, separators=(',', ':'))
por = {}
for q in final: por[q['cat']] = por.get(q['cat'], 0) + 1
print(f'+{novas} novas, {marc} marcadas veteranas; total {len(final)}', por)
