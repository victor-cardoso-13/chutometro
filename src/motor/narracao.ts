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
  'chegou-mais-perto': 'chegou mais perto. Um ponto!',
  'chegaram-juntos': 'chegaram juntos e levam um ponto cada.',
  'cravou': 'cravou o número exato e leva três pontos!',
  'vitoria-de': 'Vitória de',
  'empate-entre': 'Empate entre',
  'e': 'e',
  'entrou': 'entrou!',
  'entraram': 'entraram!',
  'ninguem-pontuou': 'Ninguém pontuou.',
};
/** Nomes gravados na voz do Antonio (frases com esses nomes saem 100% gravadas). Outro nome: voz do aparelho só nele. */
export const NOMES_GRAVADOS = ['Samuel', 'Celinha', 'Victor', 'Carla', 'Giovanna', 'Andressa', 'Edinho'];
/** "com N ponto(s)." (um vencedor) e "com N pontos cada." (empate), gravados de 0 até aqui. */
export const MAX_PONTOS_GRAVADO = 300;
export const textoPontos = (n: number) => `com ${n} ponto${n === 1 ? '' : 's'}. Parabéns!`;
export const textoPontosCada = (n: number) => `com ${n} ponto${n === 1 ? '' : 's'} cada. Parabéns!`;
export const slugNome = (n: string) => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const nomeGravado = (n: string) => NOMES_GRAVADOS.find((g) => slugNome(g) === slugNome(n));
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

/** Nome do jogador: gravado se for um dos conhecidos (texto = grafia gravada), senão voz do aparelho. */
const parteNome = (n: string): Parte => { const g = nomeGravado(n); return g ? { t: g, clip: `nome-${slugNome(g)}` } : { t: n }; };
/** "A B e C" (sem vírgulas: cada nome é um áudio, com uma pausa natural entre eles). */
const partesNomes = (nomes: string[]): Parte[] => (nomes.length <= 1 ? nomes.map(parteNome) : [...nomes.slice(0, -1).map(parteNome), fixa('e'), parteNome(nomes[nomes.length - 1])]);
const pontosParte = (n: number, cada: boolean): Parte => ({ t: cada ? textoPontosCada(n) : textoPontos(n), ...(n <= MAX_PONTOS_GRAVADO ? { clip: `${cada ? 'ptsc' : 'pts'}-${n}` } : {}) });

/** A resposta certa (gravada) e quem ganhou a rodada. `dist` só importa se foi 0 (cravou). */
export function partesResposta(q: Pergunta, vencedores: string[], dist: number | null): Parte[] {
  const certa: Parte = { t: textoCerta(q), clip: `r-${q.id}` };
  if (!vencedores.length) return [certa, fixa('ninguem-chutou')];
  const quem = partesNomes(vencedores);
  if (vencedores.length > 1) return [certa, ...quem, fixa('chegaram-juntos')];
  return [certa, ...quem, fixa(dist === 0 ? 'cravou' : 'chegou-mais-perto')];
}

export function partesFim(nomes: string[], pontos: number, acabaram = false): Parte[] {
  const ini = [...(acabaram ? [fixa('acabaram')] : []), fixa('fim-de-jogo')];
  if (!nomes.length) return [...ini, fixa('ninguem-pontuou')];
  if (nomes.length > 1) return [...ini, fixa('empate-entre'), ...partesNomes(nomes), pontosParte(pontos, true)];
  return [...ini, fixa('vitoria-de'), parteNome(nomes[0]), pontosParte(pontos, false)];
}

export const partesEntrou = (nomes: string[]): Parte[] => [...partesNomes(nomes), fixa(nomes.length === 1 ? 'entrou' : 'entraram')];
export const textoDasPartes = (ps: Parte[]) => ps.map((p) => p.t).join(' ');

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
