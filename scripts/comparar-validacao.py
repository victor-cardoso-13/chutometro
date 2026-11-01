#!/usr/bin/env python3
"""Compara a resposta do autor (data/banco-bruto.json) com a do validador cego (data/validacao/saida-*.json).
Gera data/validacao/relatorio.json com a situação de cada pergunta: ok | divergente | ambigua | baixa | sem-saida."""
import json, glob, os
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
banco = {x['id']: x for x in json.load(open(f'{raiz}/data/banco-bruto.json'))}
saidas = {}
for f in sorted(glob.glob(f'{raiz}/data/validacao/saida-*.json')):
    for s in json.load(open(f)):
        saidas[s['id']] = s
rel, cont = {}, {}
for i, x in banco.items():
    s = saidas.get(i)
    if not s: st = 'sem-saida'
    else:
        a, b = float(x['resposta']), float(s['resposta'])
        exato = (a == b)
        dif = abs(a - b) / max(abs(a), 1e-9)
        pequena = dif <= 0.005 and x['unidade'] != 'ano'
        if not (exato or pequena): st = 'divergente'
        elif s.get('ambigua'): st = 'ambigua'
        elif s.get('confianca') == 'baixa': st = 'baixa'
        else: st = 'ok'
    rel[i] = {'status': st, 'autor': x['resposta'], 'validador': s and s['resposta'], 'obs': s and s.get('obs', '')}
    cont[st] = cont.get(st, 0) + 1
json.dump(rel, open(f'{raiz}/data/validacao/relatorio.json', 'w'), ensure_ascii=False, indent=1)
print(cont)
for i, r in rel.items():
    if r['status'] == 'divergente':
        print(i, banco[i]['q'][:90], '| autor', r['autor'], '| val', r['validador'])
