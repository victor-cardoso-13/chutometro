#!/usr/bin/env python3
"""Grava as falas do narrador (voz Edge TTS pt-BR Antonio) em public/voz/<clip>.mp3 e escreve public/voz/indice.json.
Só ESCREVE arquivos (não toca som). Retomável: pula o que já existe. Várias gravações ao mesmo tempo.
Uso: node scripts/lista-falas.ts > data/falas.json && python3 scripts/gerar-narracao.py [simultaneas]"""
import asyncio, json, sys
from pathlib import Path
import edge_tts

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / 'public' / 'voz'
VOZ = 'pt-BR-AntonioNeural'
SIMULTANEAS = int(sys.argv[1]) if len(sys.argv) > 1 else 10

async def gravar(sem, clip, texto, falhas):
    destino = SAIDA / f'{clip}.mp3'
    if destino.exists() and destino.stat().st_size > 500:
        return
    async with sem:
        for tentativa in range(4):
            try:
                tmp = destino.with_suffix('.tmp')
                await edge_tts.Communicate(texto, VOZ).save(str(tmp))
                if tmp.stat().st_size < 500:
                    raise RuntimeError('arquivo vazio')
                tmp.rename(destino)
                return
            except Exception as e:  # noqa: BLE001
                await asyncio.sleep(1.5 * (tentativa + 1))
                ultimo = e
        falhas.append((clip, str(ultimo)))

async def main():
    falas = json.loads((RAIZ / 'data' / 'falas.json').read_text(encoding='utf-8'))
    SAIDA.mkdir(parents=True, exist_ok=True)
    sem, falhas = asyncio.Semaphore(SIMULTANEAS), []
    feitas = 0
    tarefas = [asyncio.create_task(gravar(sem, c, t, falhas)) for c, t in falas.items()]
    for t in asyncio.as_completed(tarefas):
        await t
        feitas += 1
        if feitas % 100 == 0:
            print(f'{feitas}/{len(tarefas)}', flush=True)
    ok = {c: t for c, t in falas.items() if (SAIDA / f'{c}.mp3').exists()}
    (SAIDA / 'indice.json').write_text(json.dumps(ok, ensure_ascii=False), encoding='utf-8')
    print(f'prontas: {len(ok)}/{len(falas)}; falhas: {len(falhas)}')
    for c, e in falhas[:10]:
        print('FALHA', c, e)

asyncio.run(main())
