#!/usr/bin/env python3
"""Gera public/questions.json (banco final) só com as perguntas em que autor e validador cego concordam
(data/validacao/relatorio.json = ok). Tira ainda as de Forbes cujo valor não foi confirmado.
CONGELADO depois de publicado: os ids (c0001…) entram em `vistas` no aparelho dos jogadores; não regerar sem motivo."""
import json, os, re
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
banco = json.load(open(f'{raiz}/data/banco-bruto.json'))
rel = json.load(open(f'{raiz}/data/validacao/relatorio.json'))
FORBES_CONFIRMADOS = ('211', '114', '83,4', '83.4')
def forbes_ruim(x):
    return 'forbes' in (x['q'] + x['fonte']).lower() and str(x['resposta']) not in FORBES_CONFIRMADOS
final = []
for x in banco:
    if rel[x['id']]['status'] != 'ok' or forbes_ruim(x):
        continue
    final.append({'id': x['id'], 'q': x['q'], 'u': x['unidade'], 'r': x['resposta'], 'cat': x['cat'], 'd': x.get('dificuldade', 2)})
os.makedirs(f'{raiz}/public', exist_ok=True)
json.dump(final, open(f'{raiz}/public/questions.json', 'w'), ensure_ascii=False, separators=(',', ':'))
por = {}
for x in final: por[x['cat']] = por.get(x['cat'], 0) + 1
print(len(final), por)
