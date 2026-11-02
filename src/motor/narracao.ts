/** Falas do narrador do modo TV e escolha da voz. Funções puras (sem tela, sem som). */
import { formatar, type Pergunta } from './motor.ts';

/** "Pergunta 3. Quantos…? Resposta em metros." A 1ª pergunta abre o jogo. */
export function falaPergunta(n: number, q: Pergunta): string {
  const dica = q.u === 'ano' ? 'Responda com o ano.' : `Resposta em ${q.u}.`;
  return `${n === 1 ? 'Vamos começar! ' : ''}Pergunta ${n}. ${q.q} ${dica}`;
}

export const FALA_TEMPO_ESGOTADO = 'Tempo esgotado!';
export const FALA_BOAS_VINDAS = 'Bem-vindos ao Chutômetro! Escaneiem o código na tela para entrar. Quem chegar mais perto da resposta, ganha!';

/** A resposta certa e quem ganhou a rodada. `dist` = quanto o vencedor errou. */
export function falaResposta(q: Pergunta, vencedores: string[], dist: number | null): string {
  const certa = q.u === 'ano' ? `A resposta certa é o ano de ${q.r}.` : `A resposta certa é ${formatar(q.r, q.u)} ${q.u}.`;
  if (!vencedores.length) return `${certa} Ninguém chutou desta vez.`;
  if (vencedores.length > 1) return `${certa} ${juntar(vencedores)} chegaram juntos e levam um ponto cada.`;
  if (dist === 0) return `${certa} ${vencedores[0]} cravou o número exato e leva três pontos!`;
  const erro = q.u === 'ano' ? `${formatar(dist ?? 0, '')} ${dist === 1 ? 'ano' : 'anos'}` : `${formatar(dist ?? 0, q.u)} ${q.u}`;
  return `${certa} ${vencedores[0]} chegou mais perto, errou por ${erro}. Um ponto!`;
}

export function falaFim(nomes: string[], pontos: number, acabaram = false): string {
  const fim = acabaram ? 'Acabaram as perguntas! ' : '';
  if (!nomes.length) return `${fim}Fim de jogo! Ninguém pontuou.`;
  if (nomes.length > 1) return `${fim}Fim de jogo! Empate entre ${juntar(nomes)}, com ${pontos} ponto${pontos === 1 ? '' : 's'} cada. Parabéns!`;
  return `${fim}Fim de jogo! Vitória de ${nomes[0]}, com ${pontos} ponto${pontos === 1 ? '' : 's'}. Parabéns!`;
}

export const falaEntrou = (nomes: string[]) => (nomes.length === 1 ? `${nomes[0]} entrou!` : `${juntar(nomes)} entraram!`);

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
