/** Peças compartilhadas pelas telas: texto seguro, banco de perguntas, teclado numérico, cronômetro. */
import { aplicarTecla, formatarDigitado, type Pergunta } from '../motor/motor.ts';
import { CATEGORIAS } from '../motor/regras.ts';

export type Tela = 'inicio' | 'conta' | 'solo' | 'sala' | 'tv';

/** Ponte entre as telas (cada uma só conhece isto, não as outras). */
export const ui = {
  tela: 'inicio' as Tela,
  msg: '',
  desenhar: () => {},
  ir: (_t: Tela) => {},
};

export const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export const $app = document.getElementById('app')!;
export const params = new URLSearchParams(location.search);
/** Só para testes: acelera os tempos (?speed=10). */
export const VELOCIDADE = Number(params.get('speed')) || 1;

export let PERGUNTAS = new Map<string, Pergunta>();
export async function carregarPerguntas() {
  if (PERGUNTAS.size) return;
  const r = await fetch(`${import.meta.env.BASE_URL}questions.json`);
  PERGUNTAS = new Map((await r.json() as Pergunta[]).map((q) => [q.id, q]));
}

export const inicial = (nome: string) => esc((nome[0] || '?').toUpperCase());
export const fichaHTML = (cor: string, nome: string) => `<i class="dot" style="--c:${cor}">${inicial(nome)}</i>`;

/** Cartão da pergunta: categoria, texto e a unidade da resposta. */
export function cartaoPerguntaHTML(q: Pergunta) {
  const dica = q.u === 'ano' ? 'Responda com o ano' : `Resposta em: ${q.u}`;
  return `<div class="card"><span class="cat">${esc(CATEGORIAS[q.cat] ?? '')}</span><div class="q">${esc(q.q)}</div><div class="un">${esc(dica)}</div></div>`;
}

/** Visor do número digitado + teclado grande. `bloqueado` = já chutou (ou esperando). */
export function chuteHTML(q: Pergunta, digitado: string, bloqueado: boolean, rotuloBotao = 'Chutar') {
  const ehAno = q.u === 'ano';
  const tecla = (k: string, txt = k, cls = '') => `<button class="k ${cls}" data-act="tecla" data-k="${k}" ${bloqueado || (k === ',' && ehAno) ? 'disabled' : ''}>${txt}</button>`;
  const visor = digitado ? esc(formatarDigitado(digitado, ehAno)) : '<span class="vazio">seu palpite</span>';
  return `<div class="chute"><div class="visor ${bloqueado ? 'trav' : ''}">${visor}</div>
  <div class="teclas">${'123456789'.split('').map((k) => tecla(k)).join('')}${tecla('apagar', '⌫', 'ap')}${tecla('0')}${tecla(',', ',')}</div>
  <button class="cta big" data-act="chutar" ${bloqueado || !digitado || digitado === ',' ? 'disabled' : ''}><span>${rotuloBotao}</span></button></div>`;
}

/** Trata um toque nas teclas; devolve o novo texto digitado. */
export const editar = (atual: string, el: HTMLElement, q: Pergunta) => aplicarTecla(atual, el.dataset.k!, q.u === 'ano');

/** Barra de tempo atualizada sem redesenhar a tela. */
export const tempoHTML = () => '<div class="tempo"><span id="tn">–</span><div class="trilho"><i id="tb"></i></div></div>';
export function atualizarTempo(restanteMs: number, totalMs: number) {
  const tn = document.getElementById('tn'), tb = document.getElementById('tb');
  if (!tn || !tb) return;
  const s = Math.ceil((restanteMs / 1000) * VELOCIDADE);
  tn.textContent = `${s} s`;
  tn.classList.toggle('low', s <= 5 && totalMs > 5000);
  tb.style.width = `${Math.max(0, Math.min(100, (100 * restanteMs) / totalMs))}%`;
}
