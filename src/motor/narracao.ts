/** Falas do narrador do modo TV e escolha da voz. Funções puras (sem tela, sem som). */
import { formatar, type Pergunta } from './motor.ts';

/**
 * Uma fala é uma lista de partes. Parte com `clip` tem áudio gravado (Edge TTS, pasta public/voz/, feito por
 * scripts/gerar-narracao.py a partir de scripts/lista-falas.ts); sem `clip`, ou se o áudio faltar, fala a voz do aparelho.
 */
export interface Parte { t: string; clip?: string }

export const TEXTOS_FIXOS: Record<string, string> = {
  'boas-vindas': 'Bem-vindos ao Chutômetro! Escaneiem o código na tela para entrar. Quem chegar mais perto da resposta, ganha!',
  'vamos-comecar': 'Vamos começar!',
  'tempo-esgotado': 'Tempo esgotado!',
  'ninguem-chutou': 'Ninguém chutou desta vez.',
  'fim-de-jogo': 'Fim de jogo!',
  'acabaram': 'Acabaram as perguntas!',
};
/** "Pergunta N." gravada de 1 até aqui; depois disso, voz do aparelho. */
export const MAX_NUMERO_GRAVADO = 300;

export const dicaDaResposta = (q: Pergunta) => (q.u === 'ano' ? 'Responda com o ano.' : `Resposta em ${q.u}.`);
export const textoQuestao = (q: Pergunta) => `${q.q} ${dicaDaResposta(q)}`;
export const textoCerta = (q: Pergunta) => (q.u === 'ano' ? `A resposta certa é o ano de ${q.r}.` : `A resposta certa é ${formatar(q.r, q.u)} ${q.u}.`);
export const textoNumero = (n: number) => `Pergunta ${n}.`;

const fixa = (clip: string): Parte => ({ t: TEXTOS_FIXOS[clip], clip });

export const partesBoasVindas = (): Parte[] => [fixa('boas-vindas')];
export const partesTempoEsgotado = (): Parte[] => [fixa('tempo-esgotado')];

/** "Pergunta 3. Quantos…? Resposta em metros." A 1ª pergunta abre o jogo. */
export function partesPergunta(n: number, q: Pergunta): Parte[] {
  return [
    ...(n === 1 ? [fixa('vamos-comecar')] : []),
    { t: textoNumero(n), ...(n <= MAX_NUMERO_GRAVADO ? { clip: `n-${n}` } : {}) },
    { t: textoQuestao(q), clip: `q-${q.id}` },
  ];
}

/** A resposta certa (gravada) e quem ganhou a rodada (voz do aparelho: tem nome). `dist` = quanto o vencedor errou. */
export function partesResposta(q: Pergunta, vencedores: string[], dist: number | null): Parte[] {
  const certa: Parte = { t: textoCerta(q), clip: `r-${q.id}` };
  if (!vencedores.length) return [certa, fixa('ninguem-chutou')];
  if (vencedores.length > 1) return [certa, { t: `${juntar(vencedores)} chegaram juntos e levam um ponto cada.` }];
  if (dist === 0) return [certa, { t: `${vencedores[0]} cravou o número exato e leva três pontos!` }];
  const erro = q.u === 'ano' ? `${formatar(dist ?? 0, '')} ${dist === 1 ? 'ano' : 'anos'}` : `${formatar(dist ?? 0, q.u)} ${q.u}`;
  return [certa, { t: `${vencedores[0]} chegou mais perto, errou por ${erro}. Um ponto!` }];
}

export function partesFim(nomes: string[], pontos: number, acabaram = false): Parte[] {
  const pts = `${pontos} ponto${pontos === 1 ? '' : 's'}`;
  const fala = !nomes.length ? 'Ninguém pontuou.' : nomes.length > 1 ? `Empate entre ${juntar(nomes)}, com ${pts} cada. Parabéns!` : `Vitória de ${nomes[0]}, com ${pts}. Parabéns!`;
  return [...(acabaram ? [fixa('acabaram')] : []), fixa('fim-de-jogo'), { t: fala }];
}

export const falaEntrou = (nomes: string[]) => (nomes.length === 1 ? `${nomes[0]} entrou!` : `${juntar(nomes)} entraram!`);
export const textoDasPartes = (ps: Parte[]) => ps.map((p) => p.t).join(' ');

function juntar(nomes: string[]): string {
  if (nomes.length <= 1) return nomes.join('');
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Melhor voz em português do Brasil entre as do aparelho. No Microsoft Edge aparecem as vozes neurais
 * do Edge TTS ("Microsoft Antonio Online (Natural)"); nos outros navegadores, a melhor que houver.
 */
export function escolherVoz<T extends { name: string; lang: string }>(vozes: T[]): T | undefined {
  const pt = vozes.filter((v) => /^pt[-_]BR$/i.test(v.lang));
  const nota = (v: T) =>
    (/Antonio/i.test(v.name) ? 100 : 0) + (/Online|Natural/i.test(v.name) ? 50 : 0) + (/Francisca|Thalita/i.test(v.name) ? 40 : 0)
    + (/Google/i.test(v.name) ? 20 : 0) + (/Luciana|Felipe|Eddy|Reed|Rocko/i.test(v.name) ? 10 : 0);
  return pt.reduce<T | undefined>((m, v) => (!m || nota(v) > nota(m) ? v : m), undefined);
}

/** Quanto tempo (ms) uma fala leva, no mínimo, para o jogo seguir mesmo se o som falhar. */
export const duracaoEstimada = (texto: string) => 1500 + texto.length * 75;
