#!/usr/bin/env python3
"""Junta as 3 conferências do lote N (padrão 2) em data/validacaoN/relatorio.json.
cego (saida-NN): resposta independente bate com a do autor? · dica (dica-NN): texto entrega/ambíguo? · web (verif-NN): fonte confirma?
Situação final: ok só se cego bate (não ambígua), nenhuma dica e a web confirmou. Imprime o que sobrou em cada categoria."""
import json, glob, os, sys
LOTE = int(sys.argv[1]) if len(sys.argv) > 1 else 2
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = f'{raiz}/data/validacao{LOTE}'
banco = {x['id']: x for x in json.load(open(f'{raiz}/data/banco-bruto.json')) if x.get('lote') == LOTE}
def carregar(padrao):
    d = {}
    for f in sorted(glob.glob(f'{V}/{padrao}')):
        for s in json.load(open(f)):
            d[s['id']] = s
    return d
cego, dica, web = carregar('saida-*.json'), carregar('dica-*.json'), carregar('verif-*.json')
rel, cont = {}, {}
for i, x in banco.items():
    a = float(x['resposta']); motivos = []
    s = cego.get(i)
    if not s: motivos.append('sem-leitura-cega')
    else:
        b = float(s['resposta'])
        perto = a == b or (x['unidade'] != 'ano' and abs(a - b) / max(abs(a), 1e-9) <= 0.005)
        if not perto: motivos.append('cego-diverge')
        if s.get('ambigua'): motivos.append('cego-ambigua')
        if s.get('confianca') == 'baixa' and not perto: motivos.append('cego-baixa')
    if i in dica: motivos.append('dica:' + dica[i]['tipo'])
    w = web.get(i)
    if not w: motivos.append('sem-web')
    elif w['status'] not in ('confirmada', 'confirmada-memoria'): motivos.append('web-' + w['status'])
    st = 'ok' if not motivos else 'reprovada'
    rel[i] = {'status': st, 'motivos': motivos, 'autor': x['resposta'], 'cego': s and s['resposta'], 'web': w and w.get('valor_correto'), 'webfonte': 'memoria' if (w or {}).get('status') == 'confirmada-memoria' else 'web', 'dica': dica.get(i, {}).get('motivo', ''), 'webobs': (w or {}).get('obs', '')}
    cont[st] = cont.get(st, 0) + 1
json.dump(rel, open(f'{V}/relatorio.json', 'w'), ensure_ascii=False, indent=1)
print(cont, '| leituras cegas', len(cego), '| dicas marcadas', len(dica), '| web', len(web))
