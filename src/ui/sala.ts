/**
 * Sala online: várias pessoas, cada uma no seu celular. O anfitrião (host) conduz as rodadas;
 * todos escrevem só o próprio chute. Regras da rodada em src/motor/regras.ts (mais perto vence, empate vai
 * para quem chutou abaixo, cravar vale 3). Salas ficam em rooms/AAAA com jogo:'chutometro'.
 */
import {
  classificar, formatar, ganhadoresDaPartida, lerChute, resultadoRodada, sortearPergunta, type Pergunta,
} from '../motor/motor.ts';
import { falaPergunta, falaResposta, FALA_TEMPO_ESGOTADO } from '../motor/narracao.ts';
import { MAX_JOGADORES, MAX_JOGADORES_TV, PAUSA_TV_MS, REVELA_MS, SEM_LIMITE, TAMANHOS, TAMANHO_PADRAO, TEMPOS, TEMPO_PADRAO } from '../motor/regras.ts';
import { abrirSalas, local, type Db } from '../nuvem/salas-db.ts';
import { atualizar, ler } from './dados.ts';
import {
  PERGUNTAS, VELOCIDADE, atualizarTempo, cartaoPerguntaHTML, chuteHTML, editar, esc, fichaHTML, params, tempoHTML, ui,
} from './comum.ts';
import { usuarioAtual } from '../nuvem/sincronia.ts';

const CORES = ['#ff6b81', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9', '#4dabf7', '#748ffc', '#da77f2', '#f783ac', '#a9b4c2'];
const SAIR_ICONE = '<svg class="ic" viewBox="0 0 24 24" width="18" height="18"><path d="M10 5H6a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h4M14 8l4 4-4 4M18 12H9"/></svg>';

interface Jogador { name: string; j: number; color: string; pts: number; wins: number }
interface Entrada { n: number; v: number }
/** read = TV lendo a pergunta · timeup = TV dizendo "tempo esgotado" (só no modo TV). */
interface Rodada { n: number; qid?: string; cat?: string; phase?: 'read' | 'question' | 'timeup' | 'reveal'; ends?: number; start?: number }
interface Resultado { v: number | null; d: number | null; pts: number }
interface Sala {
  jogo?: string; host: string; status: 'lobby' | 'playing' | 'finished'; game: number; total: number; tempo: number; created?: number;
  players?: Record<string, Jogador>; in?: Record<string, Entrada>; res?: Record<string, Resultado>;
  cur?: Rodada; used?: Record<string, boolean>; winners?: string; exhausted?: boolean;
  /** Modo TV: a TV (host) conduz e narra mas não joga; `ctl` é o jogador que manda (iniciar, pular, encerrar). */
  tv?: boolean; ctl?: string;
  /** Modo TV: o tempo corre junto com a leitura da pergunta (padrão: só começa depois que o narrador termina). */
  junto?: boolean;
}
type J = Jogador & { id: string };
export type { Sala, J };

/** Pontos de ligação com a TV (src/ui/tv.ts preenche): falar, calar, e avisar que a sala mudou. */
export const ganchos = {
  narrar: (_texto: string): Promise<void> => Promise.resolve(),
  parar: () => {},
  aoMudar: (_s: Sala | null) => {},
};

let db: Db;
let S: Sala | null = null;
let code = (params.get('sala') || '').toUpperCase();
let unsub: (() => void) | null = null;
let confirmando: '' | 'sair' | 'encerrar' = '';
let busy = false, handled = '', contadaKey = '', lido = '';
let digitado = '', digitadoN = -1; // o que a pessoa está digitando nesta rodada
const idStore = local ? sessionStorage : localStorage;
let pid = params.get('as') || idStore.getItem('chutometro.pid') || '';
if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); idStore.setItem('chutometro.pid', pid); }

export const codigoDaUrl = () => code;
const players = (): J[] => Object.entries(S?.players || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.j - b.j);
const me = () => S?.players?.[pid];
const isHost = () => S?.host === pid;
const cur = () => S?.cur;
const total = () => S?.total ?? TAMANHO_PADRAO; // 0 = sem limite
const semLimite = () => total() === SEM_LIMITE;
const maxJogadores = (r: Sala | null = S) => (r?.tv ? MAX_JOGADORES_TV : MAX_JOGADORES);
/** Quem manda no jogo: o anfitrião; no modo TV, o jogador-controle (a TV só conduz). */
const mestre = () => (S?.tv ? S.ctl === pid : isHost());
const progresso = (n: number) => (semLimite() ? `Pergunta ${n}` : `${n} de ${total()}`);
const tempoSeg = () => S?.tempo || TEMPO_PADRAO;
const minhaEntrada = () => (S?.in?.[pid]?.n === cur()?.n ? S!.in![pid] : null);
const room = (p = '') => `rooms/${code}${p ? '/' + p : ''}`;
const nomeAtual = () => (document.getElementById('nome') as HTMLInputElement | null)?.value.trim() || ler().nome || usuarioAtual()?.email.split('@')[0].slice(0, 14) || '';
const perguntaAtual = (): Pergunta | undefined => PERGUNTAS.get(cur()?.qid ?? '');

function novoCodigo() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  return Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join('');
}

function observar() {
  history.replaceState(null, '', `?${params.has('tv') ? 'tv&' : ''}sala=${code}${params.get('as') ? '&as=' + params.get('as') : ''}${params.get('speed') ? '&speed=' + params.get('speed') : ''}${local ? '&local' : ''}`);
  unsub?.();
  unsub = db.on(room(), (v: Sala | null) => {
    S = v;
    ganchos.aoMudar(v);
    if (!v) { ui.msg = 'Sala encerrada.'; sairLocal(); return; }
    ui.desenhar();
  });
}

function sairLocal() {
  unsub?.(); unsub = null; S = null; code = ''; confirmando = ''; handled = ''; digitado = '';
  history.replaceState(null, '', location.pathname + (params.has('tv') ? '?tv' : ''));
  ganchos.parar();
  ui.ir(params.has('tv') ? 'tv' : 'inicio');
}

async function entrar(nome: string) {
  const ex = await db.get(room(`players/${pid}`));
  if (ex) { await db.update(room(`players/${pid}`), { name: nome }); return; }
  const ps = Object.values((await db.get(room('players'))) || {}) as Jogador[];
  const j = ps.reduce((m, p) => Math.max(m, p.j), -1) + 1;
  await db.set(room(`players/${pid}`), { name: nome, j, color: CORES[j % CORES.length], pts: 0, wins: 0 });
  const r = (await db.get(room())) as Sala | null;
  if (r?.tv && !r.ctl) await db.update(room(), { ctl: pid }); // o 1º a entrar manda no jogo
}

export async function criarSala(nome: string) {
  db = await abrirSalas();
  let c: string;
  do { c = novoCodigo(); } while (await db.get(`rooms/${c}`));
  code = c;
  await db.set(room(), { jogo: 'chutometro', host: pid, status: 'lobby', game: 1, total: TAMANHO_PADRAO, tempo: TEMPO_PADRAO, created: db.now() });
  await entrar(nome);
  observar(); ui.ir('sala');
}

/** Modo TV: a TV cria a sala e conduz o jogo, mas não é jogadora. Por padrão, sem limite de perguntas. */
export async function criarSalaTV() {
  db = await abrirSalas();
  let c: string;
  do { c = novoCodigo(); } while (await db.get(`rooms/${c}`));
  code = c;
  await db.set(room(), { jogo: 'chutometro', host: pid, tv: true, status: 'lobby', game: 1, total: SEM_LIMITE, tempo: TEMPO_PADRAO, created: db.now() });
  observar(); ui.ir('tv');
}

/** TV recarregada: volta para a mesma sala (só quem a criou). Devolve false se não dá. */
export async function retomarSalaTV(): Promise<boolean> {
  db = await abrirSalas();
  const r = (await db.get(`rooms/${code}`)) as Sala | null;
  if (!ehDoChutometro(r) || !r!.tv || r!.host !== pid) { code = ''; history.replaceState(null, '', location.pathname + '?tv'); return false; }
  observar();
  return true;
}

/** Sala do QI (ou inexistente) com o mesmo código não serve: tem de ser do Chutômetro. */
const ehDoChutometro = (r: Sala | null) => !!r && r.jogo === 'chutometro';

export async function entrarNaSala(c: string, nome: string) {
  db = await abrirSalas();
  const r = (await db.get(`rooms/${c}`)) as Sala | null;
  if (!ehDoChutometro(r)) { ui.msg = 'Sala não encontrada.'; ui.desenhar(); return; }
  if (!r!.players?.[pid] && Object.keys(r!.players || {}).length >= maxJogadores(r)) { ui.msg = `Sala cheia (máx. ${maxJogadores(r)}).`; ui.desenhar(); return; }
  code = c;
  await entrar(nome);
  observar(); ui.ir('sala');
}

/** Abre a sala da URL (?sala=). Devolve false se não existe. */
export async function abrirDaUrl(): Promise<boolean> {
  db = await abrirSalas();
  const r = (await db.get(`rooms/${code}`)) as Sala | null;
  if (!ehDoChutometro(r)) { ui.msg = 'Sala não encontrada.'; code = ''; history.replaceState(null, '', location.pathname); return false; }
  observar();
  return true;
}

async function sairDaSala() {
  const resto = players().filter((p) => p.id !== pid);
  const eraHost = isHost(), eraTV = !!S?.tv, eraCtl = S?.ctl === pid;
  const c = code;
  sairLocal(); // sai da tela já; o resto é limpeza
  if (!resto.length && !eraTV) await db.remove(`rooms/${c}`);
  else {
    const upd: Record<string, unknown> = { [`players/${pid}`]: null, [`in/${pid}`]: null };
    if (eraTV) { if (eraCtl) upd.ctl = resto[0]?.id ?? null; } else if (eraHost) upd.host = resto[0].id;
    await db.update(`rooms/${c}`, upd);
  }
}

// ---------- anfitrião: ciclo da partida ----------
const nomesDe = (ids: string[]) => ids.map((id) => S?.players?.[id]?.name).filter((n): n is string => !!n);
/** Ainda é a mesma partida e rodada (ninguém encerrou o jogo enquanto o narrador falava)? */
const mesmaRodada = (game: number, n: number) => S?.status === 'playing' && S.game === game && cur()?.n === n;

function terminar(exausta = false) {
  const ids = ganhadoresDaPartida(players());
  const upd: Record<string, unknown> = { status: 'finished', winners: ids.join(',') };
  if (exausta) upd.exhausted = true;
  else ids.forEach((id) => { upd[`players/${id}/wins`] = (S!.players![id].wins || 0) + 1; });
  return db.update(room(), upd);
}

function comecarRodada(n: number) {
  const q = sortearPergunta([...PERGUNTAS.values()], new Set(Object.keys(S!.used || {})), new Set(ler().vistas), S!.cur?.cat);
  if (!q) return terminar(true); // acabaram as perguntas do banco: nunca repete, então encerra
  const agora = db.now();
  atualizar((d) => { if (!d.vistas.includes(q.id)) d.vistas.push(q.id); });
  // Modo TV: primeiro o narrador lê a pergunta (phase 'read'); o tempo só começa depois.
  const cur = S!.tv && !S!.junto
    ? { n, qid: q.id, cat: q.cat, phase: 'read', start: agora, ends: agora + 120000 }
    : { n, qid: q.id, cat: q.cat, phase: 'question', start: agora, ends: agora + (tempoSeg() * 1000) / VELOCIDADE };
  return db.update(room(), { status: 'playing', res: null, cur, [`used/${q.id}`]: true });
}

async function revelar() {
  const c = cur()!, q = perguntaAtual()!;
  const chutes: Record<string, number | null> = {};
  for (const p of players()) { const e = S!.in?.[p.id]; chutes[p.id] = e?.n === c.n ? e.v : null; }
  const r = resultadoRodada(q.r, chutes);
  const upd: Record<string, unknown> = { 'cur/phase': 'reveal', 'cur/ends': db.now() + (S!.tv ? 120000 : REVELA_MS / VELOCIDADE) };
  for (const p of players()) {
    upd[`players/${p.id}/pts`] = (p.pts || 0) + r.pontos[p.id];
    upd[`res/${p.id}`] = { v: chutes[p.id], d: r.dist[p.id], pts: r.pontos[p.id] };
  }
  await db.update(room(), upd);
  return r;
}

async function depoisDaRevelacao() {
  if (semLimite() || cur()!.n < total()) return comecarRodada(cur()!.n + 1);
  return terminar();
}

async function novaPartida() {
  const upd: Record<string, unknown> = { status: 'playing', game: (S!.game || 1) + 1, winners: null, in: null, res: null, exhausted: null };
  players().forEach((p) => { upd[`players/${p.id}/pts`] = 0; });
  await db.update(room(), upd);
  await comecarRodada(1);
}

/** Encerra a partida agora, com o placar do momento (sala comum ou TV). */
async function encerrarPartida() {
  if (S?.status !== 'playing') return;
  ganchos.parar();
  await terminar();
}

/** Modo TV: o narrador lê a pergunta e só então começa a contagem. */
async function lerPergunta(game: number, n: number) {
  await ganchos.narrar(falaPergunta(n, perguntaAtual()!));
  if (!mesmaRodada(game, n) || cur()!.phase !== 'read') return;
  const agora = db.now();
  await db.update(room('cur'), { phase: 'question', start: agora, ends: agora + (tempoSeg() * 1000) / VELOCIDADE });
}

/** Modo TV: "tempo esgotado" → resposta e vencedor falados → pausa curta (a menos que pulem). */
async function fecharRodadaTV(game: number, n: number, esgotou: boolean) {
  if (esgotou) {
    await db.update(room('cur'), { phase: 'timeup', ends: db.now() + 60000 });
    await ganchos.narrar(FALA_TEMPO_ESGOTADO);
    if (!mesmaRodada(game, n)) return;
  }
  const q = perguntaAtual()!;
  const r = await revelar();
  const venc = r.vencedores;
  await ganchos.narrar(falaResposta(q, nomesDe(venc), venc.length ? r.dist[venc[0]] : null));
  if (mesmaRodada(game, n) && cur()!.phase === 'reveal' && cur()!.ends! > db.now()) { // não foi pulada
    await db.update(room('cur'), { ends: db.now() + PAUSA_TV_MS / VELOCIDADE });
  }
}

async function passoDoAnfitriao() {
  if (busy || !S || !isHost() || S.status !== 'playing' || !cur()?.phase) return;
  const c = cur()!, agora = db.now();
  const chave = `${S.game}:${c.n}:${c.phase}`;
  busy = true;
  try {
    if (c.phase === 'read') {
      if (chave !== handled) { handled = chave; await lerPergunta(S.game, c.n); }
    } else if (c.phase === 'question') {
      const ps = players();
      if (S.tv && !ps.length) return; // ninguém na sala: espera
      if (S.tv && S.junto && chave !== lido) { lido = chave; void ganchos.narrar(falaPergunta(c.n, perguntaAtual()!)); } // lê sem segurar o relógio
      const todos = ps.every((p) => S!.in?.[p.id]?.n === c.n);
      if ((todos || agora >= c.ends!) && chave !== handled) {
        handled = chave;
        if (S.tv) await fecharRodadaTV(S.game, c.n, !todos); else await revelar();
      }
    } else if (c.phase === 'reveal' && agora >= c.ends! && chave !== handled) {
      handled = chave;
      await depoisDaRevelacao();
    }
  } finally { busy = false; }
}
setInterval(() => { if (code && db) void passoDoAnfitriao(); }, 300);

/** Comandos que a própria TV aceita (teclado/controle remoto). */
export async function comandoTV(c: 'iniciar' | 'pular' | 'encerrar') {
  if (!S?.tv || !isHost()) return;
  if (c === 'iniciar' && S.status === 'lobby' && players().length) await comecarRodada(1);
  else if (c === 'pular' && cur()?.phase === 'reveal') { ganchos.parar(); await db.update(room('cur'), { ends: db.now() }); }
  else if (c === 'encerrar') await encerrarPartida();
}

/** Vista só-leitura da sala para a TV. */
export function estado() {
  return { S, code, pid, ps: players(), cur: cur(), q: perguntaAtual(), agora: db ? db.now() : Date.now(), total: total(), tempo: tempoSeg(), semLimite: semLimite() };
}
export const linkDaSala = () => `${location.origin}${location.pathname}?sala=${code}`;

// ---------- ações da pessoa ----------
export async function acaoSala(act: string, el: HTMLElement): Promise<boolean> {
  const q = perguntaAtual();
  if (act === 'copiar') { const i = document.querySelector<HTMLInputElement>('.linkrow input')!; i.select(); navigator.clipboard?.writeText(i.value).catch(() => {}); el.textContent = 'Copiado!'; }
  else if (act === 'entrar-aqui') { const n = nomeAtual(); if (!n) { ui.msg = 'Digite seu nome.'; ui.desenhar(); } else { atualizar((d) => { d.nome = n; }); ui.msg = ''; await entrar(n); } }
  else if (act === 'tamanho') { if (mestre()) await db.update(room(), { total: Number(el.dataset.v) }); }
  else if (act === 'junto') { if (mestre()) await db.update(room(), { junto: el.dataset.v === '1' }); }
  else if (act === 'tempo') { if (mestre()) await db.update(room(), { tempo: Number(el.dataset.v) }); }
  else if (act === 'iniciar') { if (mestre()) await comecarRodada(1); }
  else if (act === 'tecla') { if (q && !minhaEntrada()) { digitado = editar(digitado, el, q); ui.desenhar(); } }
  else if (act === 'chutar') {
    const v = lerChute(digitado);
    if (v !== null && cur()?.phase === 'question' && !minhaEntrada()) await db.set(room(`in/${pid}`), { n: cur()!.n, v });
  }
  else if (act === 'pular') { if (mestre() && cur()?.phase === 'reveal') await db.update(room('cur'), { ends: db.now() }); }
  else if (act === 'nova') { if (mestre()) await novaPartida(); }
  else if (act === 'encerrar') { confirmando = 'encerrar'; ui.desenhar(); }
  else if (act === 'encerrar-sim') { confirmando = ''; if (mestre()) await encerrarPartida(); ui.desenhar(); }
  else if (act === 'assumir') { confirmando = ''; if (S?.tv && me()) await db.update(room(), { ctl: pid }); ui.desenhar(); }
  else if (act === 'sair') { confirmando = 'sair'; ui.desenhar(); }
  else if (act === 'ficar') { confirmando = ''; ui.desenhar(); }
  else if (act === 'sair-sim') await sairDaSala();
  else return false;
  return true;
}

// ---------- telas ----------
const respondidos = () => players().filter((p) => S!.in?.[p.id]?.n === cur()!.n).length;

function barra(centro: string) {
  return `<div class="bar"><button class="ib" data-act="sair" aria-label="Sair da sala">${SAIR_ICONE}</button><div class="prog"><small>Sala ${code}</small><b>${centro}</b></div></div>`;
}

function confirmarSair() {
  if (confirmando === 'encerrar') {
    return `<div class="ov"><div class="ovc"><h3>Encerrar o jogo?</h3><p>Mostra o ranking final agora, com os pontos de agora.</p><button class="cta big" data-act="ficar"><span>Continuar jogando</span></button><button class="cta" data-act="encerrar-sim"><span>Encerrar e ver ranking</span></button></div></div>`;
  }
  if (confirmando !== 'sair') return '';
  const passa = S?.tv ? S.ctl === pid : isHost();
  const assumir = S?.tv && !passa && me() ? '<button class="cta" data-act="assumir"><span>Assumir o controle do jogo</span></button>' : '';
  return `<div class="ov"><div class="ovc"><h3>Sair da sala?</h3><p>${passa && players().length > 1 ? 'Outra pessoa vira o anfitrião.' : 'Você pode voltar com o código da sala.'}</p><button class="cta big" data-act="ficar"><span>Ficar na sala</span></button>${assumir}<button class="cta" data-act="sair-sim"><span>Sair da sala</span></button></div></div>`;
}
const encerrarLink = () => (mestre() ? '<button class="link centro" data-act="encerrar">Encerrar jogo</button>' : '');

function perguntaHTML() {
  const c = cur()!, q = perguntaAtual();
  if (!q) return '<main class="inicio"><p class="dica">Carregando pergunta…</p></main>';
  if (digitadoN !== c.n) { digitadoN = c.n; digitado = ''; }
  const mine = minhaEntrada(), dentro = !!me();
  const bloqueado = !!mine || !dentro || c.phase !== 'question';
  const dir = c.phase === 'read' ? '<div class="espera"><b>Ouça a pergunta na TV</b><span>🎙️</span></div>'
    : c.phase === 'timeup' ? `<div class="espera"><b>Tempo esgotado!</b>${mine ? `<span>Seu chute: ${esc(formatar(mine.v, q.u))}</span>` : ''}</div>`
    : mine
    ? `<div class="espera"><b>Chute enviado!</b><span>${esc(formatar(mine.v, q.u))}</span><small>Esperando os outros… ${respondidos()} de ${players().length}</small></div>`
    : chuteHTML(q, digitado, bloqueado);
  return `<main class="jogo">${barra(progresso(c.n))}<div class="esq">${c.phase === 'question' ? tempoHTML() : ''}${cartaoPerguntaHTML(q)}</div><div class="dir">${dir}${encerrarLink()}</div>${confirmarSair()}</main>`;
}

function revelaHTML() {
  const c = cur()!, q = perguntaAtual();
  if (!q) return '';
  const linhas = players().map((p) => ({ p, x: S!.res?.[p.id] })).filter((l) => l.x)
    .sort((a, b) => (a.x!.d ?? Infinity) - (b.x!.d ?? Infinity) || (a.x!.v ?? Infinity) - (b.x!.v ?? Infinity));
  const lista = `<ul class="lista">${linhas.map(({ p, x }) => {
    const chutou = x!.v !== null && x!.v !== undefined;
    return `<li class="${x!.pts > 0 ? 'vence' : ''} ${chutou ? '' : 'mudo'}">${fichaHTML(p.color, p.name)}<span class="nm">${esc(p.name)}${p.id === pid ? ' <em>você</em>' : ''}</span>${chutou
      ? `<span class="vl"><b>${esc(formatar(x!.v!, q.u))}</b><small>${x!.d === 0 ? 'cravou!' : 'errou por ' + esc(formatar(x!.d!, q.u))}</small></span><i class="pt">${x!.pts > 0 ? '+' + x!.pts : ''}</i>`
      : '<span class="vl"><small>não chutou</small></span><i class="pt"></i>'}</li>`;
  }).join('')}</ul>`;
  return `<main class="jogo">${barra(progresso(c.n))}<div class="esq">${cartaoPerguntaHTML(q)}
  <div class="resp"><small>A resposta é</small><b>${esc(formatar(q.r, q.u))}</b>${q.u === 'ano' ? '' : `<span>${esc(q.u)}</span>`}</div></div>
  <div class="dir">${lista}${mestre() ? `<button class="cta" data-act="pular"><span>${!semLimite() && c.n >= total() ? 'Ver resultado' : 'Próxima agora'}</span></button>` : '<p class="dica">Próxima pergunta já já…</p>'}${S!.tv ? '' : '<div class="prox"><i id="nx"></i></div>'}${encerrarLink()}</div>${confirmarSair()}</main>`;
}

function opcoesAnfitriao() {
  const grupo = (titulo: string, itens: readonly number[], atual: number, act: string, sufixo = '') =>
    `<div class="opc"><small>${titulo}</small><div>${itens.map((n) => `<button class="${atual === n ? 'on' : ''}" data-act="${act}" data-v="${n}">${n === SEM_LIMITE ? '∞' : n + sufixo}</button>`).join('')}</div></div>`;
  const contagem = S?.tv
    ? `<div class="opc"><small>Começa a contar o tempo</small><div><button class="${S.junto ? '' : 'on'}" data-act="junto" data-v="0">Depois da leitura</button><button class="${S.junto ? 'on' : ''}" data-act="junto" data-v="1">Junto com a leitura</button></div></div>`
    : '';
  return grupo(`Perguntas na partida${semLimite() ? ' · sem limite' : ''}`, TAMANHOS, total(), 'tamanho') + grupo('Tempo para chutar', TEMPOS, tempoSeg(), 'tempo', ' s') + contagem;
}

function lobbyHTML() {
  const ps = players(), link = `${location.origin}${location.pathname}?sala=${code}`;
  const dentro = !!me();
  const resumo = `<p class="dica">${semLimite() ? '<b>Sem limite</b> de perguntas' : `Partida de <b>${total()}</b> perguntas`} · <b>${tempoSeg()} s</b> para chutar${S?.tv ? (S.junto ? ' · tempo junto com a leitura' : ' · tempo depois da leitura') : ''}</p>`;
  return `<main class="lobby"><div class="bar"><button class="ib" data-act="sair" aria-label="Sair da sala">${SAIR_ICONE}</button><div class="prog"><small>Código da sala</small><b class="cod">${code}</b></div></div>
  ${ui.msg ? `<p class="err">${esc(ui.msg)}</p>` : ''}
  <div class="linkrow"><input readonly value="${esc(link)}"><button class="cta sm" data-act="copiar">Copiar link</button></div>
  <h3 class="sec">Jogadores <span>${ps.length}/${maxJogadores()}</span></h3>
  <ul class="lista">${ps.map((p) => `<li>${fichaHTML(p.color, p.name)}<span class="nm">${esc(p.name)}${p.id === (S!.tv ? S!.ctl : S!.host) ? ' <em>anfitrião</em>' : ''}${p.id === pid ? ' <em>você</em>' : ''}</span>${p.wins ? `<span class="vl"><small>${p.wins} vitória${p.wins > 1 ? 's' : ''}</small></span>` : ''}</li>`).join('')}</ul>
  ${dentro && mestre() ? opcoesAnfitriao() : dentro ? resumo : ''}
  ${dentro && mestre() ? '<button class="cta big" data-act="iniciar"><span>Iniciar jogo</span></button>' : ''}
  ${dentro && !mestre() ? '<p class="dica">Aguardando o anfitrião iniciar…</p>' : ''}
  ${!dentro ? `<label class="lbl" for="nome">Seu nome</label><input id="nome" maxlength="14" placeholder="Como quer ser chamado?" value="${esc(nomeAtual())}"><button class="cta big" data-act="entrar-aqui"><span>Entrar na sala</span></button>` : ''}${confirmarSair()}</main>`;
}

function fimHTML() {
  const ids = (S!.winners || '').split(',').filter(Boolean), ps = players();
  const venc = ids.map((id) => S!.players![id]).filter(Boolean);
  const ordem = classificar(ps);
  const titulo = venc.length === 0 ? 'Ninguém pontuou' : venc.length > 1 ? 'Empate' : 'Vencedor';
  return `<main class="fimsala"><div class="lbl c">${titulo}</div><h2 class="winner">${venc.map((x) => esc(x.name)).join(' e ')}</h2>
  ${S!.exhausted ? '<p class="dica">As perguntas desta sala acabaram. Para jogar mais, crie uma sala nova.</p>' : ''}
  <ul class="lista">${ordem.map((p, i) => `<li class="${ids.includes(p.id) ? 'vence' : ''}"><b class="pl">${i + 1}º</b>${fichaHTML(p.color, p.name)}<span class="nm">${esc(p.name)}${p.id === pid ? ' <em>você</em>' : ''}</span><span class="vl"><b>${p.pts}</b><small>ponto${p.pts === 1 ? '' : 's'}</small></span></li>`).join('')}</ul>
  ${mestre() && !S!.exhausted ? '<button class="cta big" data-act="nova"><span>Nova partida</span></button>' : (!S!.exhausted ? '<p class="dica">Aguardando o anfitrião iniciar outra partida…</p>' : '')}
  <button class="cta" data-act="sair"><span>Sair da sala</span></button>${confirmarSair()}</main>`;
}

export function salaHTML(): string {
  if (!S) return '<main class="inicio"><p class="dica">Entrando na sala…</p></main>';
  contarVitoria();
  if (S.status === 'playing' && !cur()?.phase) return '<main class="inicio"><p class="dica">Preparando a próxima rodada…</p></main>';
  if (S.status === 'lobby') return lobbyHTML();
  if (S.status === 'finished') return fimHTML();
  if (!me()) return lobbyHTML();
  return { read: perguntaHTML, question: perguntaHTML, timeup: perguntaHTML, reveal: revelaHTML }[cur()!.phase!]();
}

/** Minha vitória entra uma vez só no recorde da conta (por sala e partida). */
function contarVitoria() {
  if (S?.status !== 'finished') return;
  const chave = `${code}:${S.game}`;
  if (contadaKey === chave) return;
  contadaKey = chave;
  if ((S.winners || '').split(',').includes(pid)) atualizar((d) => { d.vitorias++; });
}

function tique() {
  const c = cur();
  if (!c || !S || ui.tela !== 'sala') return;
  const totalMs = (c.phase === 'question' ? tempoSeg() * 1000 : REVELA_MS) / VELOCIDADE;
  const resta = Math.max(0, (c.ends || 0) - db.now());
  if (c.phase === 'question') atualizarTempo(resta, totalMs);
  const nx = document.getElementById('nx');
  if (nx) nx.style.width = `${(100 * resta) / totalMs}%`;
}
setInterval(() => { if (code && db) tique(); }, 200);
