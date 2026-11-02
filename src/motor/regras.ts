/**
 * TODAS as regras da casa do Chutômetro num lugar só. Este arquivo não sabe que existe tela.
 *
 * Rodada (sala): chuta-se um número; vence quem chega MAIS PERTO da resposta.
 *   Resposta 10, chutes 8 e 12 → empatam na distância (2): vence o que chutou PARA BAIXO (o 8).
 *   Dois chutes iguais (8 e 8) → os dois vencem. Quem não chutou não pontua.
 *   Vencer vale 1 ponto; CRAVAR o número exato vale 3.
 * Solo: 10 perguntas, no fim uma nota de 0 a 10 (10 − erro médio em %).
 */
export const ANO_REF = 2026;
export const PERGUNTAS_SOLO = 10;
export const MAX_JOGADORES = 10;
/** Sala com TV: a noite toda, mais gente. */
export const MAX_JOGADORES_TV = 30;
/** 0 = sem limite de perguntas (só termina quando o anfitrião encerra ou as perguntas acabam). */
export const SEM_LIMITE = 0;
export const TAMANHOS = [5, 10, 15, SEM_LIMITE] as const;
export const TAMANHO_PADRAO = 10;
export const TEMPOS = [15, 30, 60] as const;
export const TEMPO_PADRAO = 30;
export const REVELA_MS = 8000;
/** Modo TV: pausa depois que o narrador termina de falar a resposta. */
export const PAUSA_TV_MS = 5000;
export const PONTOS = { perto: 1, cravou: 3 } as const;
export const LIMITE_DIGITOS = 12;

export const CATEGORIAS: Record<string, string> = {
  'animais-cotidiano': 'Animais e cotidiano',
  brasil: 'Brasil',
  'corpo-saude': 'Corpo e saúde',
  cultura: 'Cultura',
  'espaco-ciencia': 'Espaço e ciência',
  esportes: 'Esportes',
  'geografia-natureza': 'Geografia e natureza',
  'historia-mundial': 'História',
  'mundo-arquitetura': 'Mundo e arquitetura',
  tecnologia: 'Tecnologia',
};
