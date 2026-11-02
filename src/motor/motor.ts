/** Funções puras do Chutômetro (sem tela, sem internet). Regras e números: src/motor/regras.ts. */
import { ANO_REF, LIMITE_DIGITOS, PONTOS, RODADAS_INATIVO } from './regras.ts';

/** `v: 1` = pergunta "veterana" (já saiu muito): só aparece depois que as outras acabarem. */
export interface Pergunta { id: string; q: string; u: string; r: number; cat: string; d: number; v?: 1 }

const arred = (n: number, casas = 6) => Math.round(n * 10 ** casas) / 10 ** casas;

/** Quanto o chute passou da resposta (sempre ≥ 0). */
export const distancia = (resposta: number, chute: number) => arred(Math.abs(resposta - chute));

/**
 * Erro relativo (0 = cravou, 1 = errou feio). Para anos mede em relação a "quantos anos atrás foi"
 * (1950 para 1969 = erro de 19 em 57 anos); para o resto, em relação ao tamanho da resposta.
 */
export function erroRelativo(p: Pergunta, chute: number | null): number {
  if (chute === null) return 1;
  const base = p.u === 'ano' ? Math.max(10, ANO_REF - p.r) : Math.abs(p.r) || 1;
  return Math.min(1, distancia(p.r, chute) / base);
}

/** Nota do solo: 10 − erro médio (em %). Sem chute conta como erro total. Uma casa decimal. */
export function notaSolo(erros: number[]): number {
  if (!erros.length) return 0;
  const media = erros.reduce((a, b) => a + b, 0) / erros.length;
  return Math.round((1 - media) * 100) / 10;
}
export const erroMedioPct = (erros: number[]) => (erros.length ? Math.round((erros.reduce((a, b) => a + b, 0) / erros.length) * 100) : 0);

export interface ResultadoRodada { vencedores: string[]; pontos: Record<string, number>; dist: Record<string, number | null> }
/**
 * Quem chegou mais perto. `chutes`: id → número (ou ausente/null = não chutou).
 * Empate de distância: vence o chute MAIS BAIXO; chutes iguais vencem juntos. Cravar vale 3, vencer vale 1.
 */
export function resultadoRodada(resposta: number, chutes: Record<string, number | null | undefined>): ResultadoRodada {
  const ids = Object.keys(chutes);
  const dist: Record<string, number | null> = {};
  const pontos: Record<string, number> = {};
  const validos: string[] = [];
  for (const id of ids) {
    const v = chutes[id];
    pontos[id] = 0;
    if (typeof v === 'number' && Number.isFinite(v)) { dist[id] = distancia(resposta, v); validos.push(id); } else dist[id] = null;
  }
  if (!validos.length) return { vencedores: [], pontos, dist };
  const menor = Math.min(...validos.map((id) => dist[id]!));
  const empatados = validos.filter((id) => dist[id] === menor);
  const melhorChute = Math.min(...empatados.map((id) => chutes[id] as number));
  const vencedores = empatados.filter((id) => chutes[id] === melhorChute);
  for (const id of vencedores) pontos[id] = menor === 0 ? PONTOS.cravou : PONTOS.perto;
  return { vencedores, pontos, dist };
}

/** Placar final: mais pontos primeiro (empate mantém a ordem de entrada). */
export const classificar = <T extends { pts: number; j: number }>(js: T[]) => [...js].sort((a, b) => b.pts - a.pts || a.j - b.j);
export function ganhadoresDaPartida(js: { id: string; pts: number }[]): string[] {
  const topo = Math.max(0, ...js.map((j) => j.pts));
  return topo > 0 ? js.filter((j) => j.pts === topo).map((j) => j.id) : [];
}

/**
 * Próxima pergunta: nunca uma já usada nesta partida/sala (`usadas`); deixa as veteranas (`v`) por último; prefere as que a pessoa ainda
 * não viu (`vistas`) e evita repetir a categoria da anterior. `undefined` = acabaram.
 */
export function sortearPergunta(todas: Pergunta[], usadas: Set<string>, vistas: Set<string>, ultimaCat?: string, rnd = Math.random): Pergunta | undefined {
  let pool = todas.filter((q) => !usadas.has(q.id));
  if (!pool.length) return undefined;
  const frescas = pool.filter((q) => !q.v); // veteranas ficam em segundo plano
  if (frescas.length) pool = frescas;
  const novas = pool.filter((q) => !vistas.has(q.id));
  if (novas.length) pool = novas;
  const outraCat = pool.filter((q) => q.cat !== ultimaCat);
  if (outraCat.length) pool = outraCat;
  return pool[Math.floor(rnd() * pool.length)];
}

/** Texto digitado no teclado → número. Vírgula é o separador decimal. Vazio/inválido = null. */
export function lerChute(s: string): number | null {
  if (!s || s === ',') return null;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Aplica uma tecla ao texto digitado ('0'-'9', ',', 'apagar'). Mantém o texto sem zeros à esquerda inúteis. */
export function aplicarTecla(atual: string, tecla: string, ehAno = false): string {
  if (tecla === 'apagar') return atual.slice(0, -1);
  if (tecla === ',') return ehAno || atual.includes(',') ? atual : (atual || '0') + ',';
  if (!/^\d$/.test(tecla) || atual.replace(',', '').length >= LIMITE_DIGITOS) return atual;
  if (atual === '0') return tecla;
  return atual + tecla;
}

/** 1234567 → "1.234.567" (anos sem ponto: 1969). */
export function formatar(n: number, u = ''): string {
  if (u === 'ano') return String(n);
  return arred(n, 4).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}
/** O que a pessoa está digitando, com pontinhos de milhar. */
export function formatarDigitado(s: string, ehAno = false): string {
  if (!s) return '';
  const [i, d] = s.split(',');
  const milhar = ehAno ? i : i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return d === undefined ? milhar : `${milhar},${d}`;
}

/** Comentário curtinho sobre o chute (solo). */
export function comentario(erro: number): string {
  if (erro === 0) return 'NA MOSCA!';
  if (erro <= 0.05) return 'Pertinho!';
  if (erro <= 0.2) return 'Boa, chegou perto';
  if (erro <= 0.5) return 'Dá pra melhorar';
  return 'Passou longe';
}

/** Passou várias rodadas seguidas sem chutar? (`miss` = rodadas seguidas sem chute; zera ao chutar.) */
export const estaInativo = (p: { miss?: number }) => (p.miss ?? 0) >= RODADAS_INATIVO;
