// Lista TODAS as falas gravadas do narrador (clip → texto), a partir do mesmo código que o jogo usa.
// Uso: node scripts/lista-falas.ts > data/falas.json   (depois: python3 scripts/gerar-narracao.py)
import { readFileSync } from 'node:fs';
import { MAX_NUMERO_GRAVADO, MAX_PONTOS_GRAVADO, NOMES_GRAVADOS, TEXTOS_FIXOS, slugNome, textoCerta, textoNumero, textoPontos, textoPontosCada, textoEntrou, textoQuestao, textoVitoria } from '../src/motor/narracao.ts';
import type { Pergunta } from '../src/motor/motor.ts';

const perguntas: Pergunta[] = JSON.parse(readFileSync(new URL('../public/questions.json', import.meta.url), 'utf8'));
const falas: Record<string, string> = { ...TEXTOS_FIXOS };
for (let n = 1; n <= MAX_NUMERO_GRAVADO; n++) falas[`n-${n}`] = textoNumero(n);
for (const n of NOMES_GRAVADOS) falas[`nome-${slugNome(n)}`] = n;
for (const n of NOMES_GRAVADOS) { falas[`entrou-${slugNome(n)}`] = textoEntrou(n); falas[`vit-${slugNome(n)}`] = textoVitoria(n, false); falas[`vita-${slugNome(n)}`] = textoVitoria(n, true); }
for (let n = 0; n <= MAX_PONTOS_GRAVADO; n++) { falas[`pts-${n}`] = textoPontos(n); falas[`ptsc-${n}`] = textoPontosCada(n); }
for (const q of perguntas) { falas[`q-${q.id}`] = textoQuestao(q); falas[`r-${q.id}`] = textoCerta(q); }
process.stdout.write(JSON.stringify(falas));
