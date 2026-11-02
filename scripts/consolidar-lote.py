#!/usr/bin/env python3
"""Junta data/src{LOTE}/*.json (lote novo) ao data/banco-bruto.json SEM mudar os ids antigos (novos ids continuam a numeração),
tira respostas negativas e perguntas repetidas (com o banco inteiro), e gera as entradas CEGAS do lote
em data/validacao{LOTE}/entrada-NN.json (só id, pergunta e unidade) e as de conferência em data/validacao{LOTE}/conf-NN.json (com resposta e fonte).
Idempotente: não duplica se rodar de novo. Uso: python3 scripts/consolidar-lote.py [lotes_cego] [lotes_web] [numero_do_lote=2]  (lê data/src<N>/, escreve data/validacao<N>/)"""
import json, glob, os, re, sys
raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 8        # lotes de leitura cega e de dicas
NW = int(sys.argv[2]) if len(sys.argv) > 2 else 15      # lotes de conferência na web (menores: cada pergunta é uma busca)
LOTE = int(sys.argv[3]) if len(sys.argv) > 3 else 2
banco = json.load(open(f'{raiz}/data/banco-bruto.json'))
norm = lambda q: re.sub(r'\W+', ' ', q.lower()).strip()
vistos = {norm(x['q']) for x in banco}
ja_lote = {x['id'] for x in banco if x.get('lote') == LOTE}
if ja_lote:
    print(f'lote {LOTE} já consolidado:', len(ja_lote)); sys.exit(0)
proximo = max(int(x['id'][1:]) for x in banco) + 1
novos = []
limpas = 0
for f in sorted(glob.glob(f'{raiz}/data/src{LOTE}/*.json')):
    cat = os.path.basename(f)[:-5]
    for x in json.load(open(f)):
        try:
            if float(x['resposta']) < 0: continue
        except Exception: continue
        q2 = re.sub(r'\s*\((?![^)]*\d)[^)]*\)', '', x['q']).strip()  # parêntese sem número ("(valor arredondado)") sai; com número fica para o revisor de dicas
        if q2 != x['q']: limpas += 1; x['q'] = q2
        c = norm(x['q'])
        if c in vistos: continue
        vistos.add(c)
        x['cat'] = cat; x['lote'] = LOTE; x['id'] = f'c{proximo:04d}'; proximo += 1
        novos.append(x)
json.dump(banco + novos, open(f'{raiz}/data/banco-bruto.json', 'w'), ensure_ascii=False, indent=1)
os.makedirs(f'{raiz}/data/validacao{LOTE}', exist_ok=True)
tam = -(-len(novos) // N)
for n in range(N):
    lote = novos[n*tam:(n+1)*tam]
    json.dump([{'id': x['id'], 'q': x['q'], 'unidade': x['unidade']} for x in lote], open(f'{raiz}/data/validacao{LOTE}/entrada-{n+1:02d}.json', 'w'), ensure_ascii=False, indent=1)
    json.dump([{'id': x['id'], 'q': x['q'], 'unidade': x['unidade'], 'resposta': x['resposta'], 'fonte': x['fonte']} for x in lote], open(f'{raiz}/data/validacao{LOTE}/conf-{n+1:02d}.json', 'w'), ensure_ascii=False, indent=1)
tamw = -(-len(novos) // NW)
for n in range(NW):
    lote = novos[n*tamw:(n+1)*tamw]
    json.dump([{'id': x['id'], 'q': x['q'], 'unidade': x['unidade'], 'resposta': x['resposta'], 'fonte': x['fonte']} for x in lote], open(f'{raiz}/data/validacao{LOTE}/web-{n+1:02d}.json', 'w'), ensure_ascii=False, indent=1)
print(limpas, 'perguntas tiveram parêntese sem número retirado')
print(len(novos), 'perguntas novas (ids', novos[0]['id'], '…', novos[-1]['id'], ') em', N, 'lotes de até', tam)
