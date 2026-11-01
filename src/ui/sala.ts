/**
 * Sala online: várias pessoas, cada uma no seu celular. O anfitrião (host) conduz as rodadas;
 * todos escrevem só o próprio chute. Regras da rodada em src/motor/regras.ts (mais perto vence, empate vai
 * para quem chutou abaixo, cravar vale 3). Salas ficam em rooms/AAAA com jogo:'chutometro'.
 */
import {
  classificar, formatar, ganhadoresDaPartida, lerChute, resultadoRodada, sortearPergunta, type Pergunta,
} from '../motor/motor.ts';
import { MAX_JOGADORES, REVELA_MS, TAMANHOS, TAMANHO_PADRAO, TEMPOS, TEMPO_PADRAO } from '../motor/regras.ts';
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
interface Rodada { n: number; qid?: string; cat?: string; phase?: 'question' | 'reveal'; ends?: number; start?: number }
interface Resultado { v: number | null; d: number | null; pts: number }
interface Sala {
  jogo?: string; host: string; status: 'lobby' | 'playing' | 'finished'; game: number; total: number; tempo: number; created?: number;
  players?: Record<string, Jogador>; in?: Record<string, Entrada>; res?: Record<string, Resultado>;
  cur?: Rodada; used?: Record<string, boolean>; winners?: string; exhausted?: boolean;
}
type J = Jogador & { id: string };

let db: Db;
let S: Sala | null = null;
let code = (params.get('sala') || '').toUpperCase();
let unsub: (() => void) | null = null;
let confirmando = false;
let busy = false, handled = '', contadaKey = '';
let digitado = '', digitadoN = -1; // o que a pessoa está digitando nesta rodada
const idStore = local ? sessionStorage : localStorage;
let pid = params.get('as') || idStore.getItem('chutometro.pid') || '';
if (!pid) { pid = 'p' + Math.random().toString(36).slice(2, 10); idStore.setItem('chutometro.pid', pid); }

export const codigoDaUrl = () => code;
const players = (): J[] => Object.entries(S?.players || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => a.j - b.j);
const me = () => S?.players?.[pid];
const isHost = () => S?.host === pid;
const cur = () => S?.cur;
const total = () => S?.total || TAMANHO_PADRAO;
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
  history.replaceState(null, '', `?sala=${code}${params.get('as') ? '&as=' + params.get('as') : ''}${params.get('speed') ? '&speed=' + params.get('speed') : ''}${local ? '&local' : ''}`);
  unsub?.();
  unsub = db.on(room(), (v: Sala | null) => {
    S = v;
    if (!v) { ui.msg = 'Sala encerrada.'; sairLocal(); return; }
    ui.desenhar();
  });
}

function sairLocal() {
  unsub?.(); unsub = null; S = null; code = ''; confirmando = false; handled = ''; digitado = '';
  history.replaceState(null, '', location.pathname);
  ui.ir('inicio');
}

async function entrar(nome: string) {
  const ex = await db.get(room(`players/${pid}`));
  if (ex) { await db.update(room(`players/${pid}`), { name: nome }); return; }
  const ps = Object.values((await db.get(room('players'))) || {}) as Jogador[];
  const j = ps.reduce((m, p) => Math.max(m, p.j), -1) + 1;
  await db.set(room(`players/${pid}`), { name: nome, j, color: CORES[j % CORES.length], pts: 0, wins: 0 });
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

/** Sala do QI (ou inexistente) com o mesmo código não serve: tem de ser do Chutômetro. */
const ehDoChutometro = (r: Sala | null) => !!r && r.jogo === 'chutometro';

export async function entrarNaSala(c: string, nome: string) {
  db = await abrirSalas();
  const r = (await db.get(`rooms/${c}`)) as Sala | null;
  if (!ehDoChutometro(r)) { ui.msg = 'Sala não encontrada.'; ui.desenhar(); return; }
  if (!r!.players?.[pid] && Object.keys(r!.players || {}).length >= MAX_JOGADORES) { ui.msg = `Sala cheia (máx. ${MAX_JOGADORES}).`; ui.desenhar(); return; }
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
  const eraHost = isHost();
  const c = code;
  sairLocal(); // sai da tela já; o resto é limpeza
  if (!resto.length) await db.remove(`rooms/${c}`);
  else {
    const upd: Record<string, unknown> = { [`players/${pid}`]: null, [`in/${pid}`]: null };
    if (eraHost) upd.host = resto[0].id;
    await db.update(`rooms/${c}`, upd);
  }
}

// ---------- anfitrião: ciclo da partida ----------
function comecarRodada(n: number) {
  const q = sortearPergunta([...PERGUNTAS.values()], new Set(Object.keys(S!.used || {})), new Set(ler().vistas), S!.cur?.cat);
  if (!q) { // acabaram as perguntas do banco: nunca repete, então encerra
    const ids = ganhadoresDaPartida(players());
    return db.update(room(), { status: 'finished', exhausted: true, winners: ids.join(',') });
  }
  const agora = db.now();
  atualizar((d) => { if (!d.vistas.includes(q.id)) d.vistas.push(q.id); });
  return db.update(room(), {
    status: 'playing', res: null,
    cur: { n, qid: q.id, cat: q.cat, phase: 'question', start: agora, ends: agora + (tempoSeg() * 1000) / VELOCIDADE },
    [`used/${q.id}`]: true,
  });
}

async function revelar() {
  const c = cur()!, q = perguntaAtual()!;
  const chutes: Record<string, number | null> = {};
  for (const p of players()) { const e = S!.in?.[p.id]; chutes[p.id] = e?.n === c.n ? e.v : null; }
  const r = resultadoRodada(q.r, chutes);
  const upd: Record<string, unknown> = { 'cur/phase': 'reveal', 'cur/ends': db.now() + REVELA_MS / VELOCIDADE };
  for (const p of players()) {
    upd[`players/${p.id}/pts`] = (p.pts || 0) + r.pontos[p.id];
    upd[`res/${p.id}`] = { v: chutes[p.id], d: r.dist[p.id], pts: r.pontos[p.id] };
  }
  await db.update(room(), upd);
}

async function depoisDaRevelacao() {
  if (cur()!.n < total()) return comecarRodada(cur()!.n + 1);
  const ids = ganhadoresDaPartida(players());
  const upd: Record<string, unknown> = { status: 'finished', winners: ids.join(',') };
  ids.forEach((id) => { upd[`players/${id}/wins`] = (S!.players![id].wins || 0) + 1; });
  await db.update(room(), upd);
}

async function novaPartida() {
  const upd: Record<string, unknown> = { status: 'playing', game: (S!.game || 1) + 1, winners: null, in: null, res: null, exhausted: null };
  players().forEach((p) => { upd[`players/${p.id}/pts`] = 0; });
  await db.update(room(), upd);
  await comecarRodada(1);
}

async function passoDoAnfitriao() {
  if (busy || !S || !isHost() || S.status !== 'playing' || !cur()?.phase) return;
  const c = cur()!, agora = db.now();
  const chave = `${S.game}:${c.n}:${c.phase}`;
  busy = true;
  try {
    if (c.phase === 'question') {
      const todos = players().every((p) => S!.in?.[p.id]?.n === c.n);
      if ((todos || agora >= c.ends!) && chave !== handled) { handled = chave; await revelar(); }
    } else if (c.phase === 'reveal' && agora >= c.ends! && chave !== handled) {
      handled = chave;
      await depoisDaRevelacao();
    }
  } finally { busy = false; }
}
setInterval(() => { if (code && db) void passoDoAnfitriao(); }, 300);

// ---------- ações da pessoa ----------
export async function acaoSala(act: string, el: HTMLElement): Promise<boolean> {
  const q = perguntaAtual();
  if (act === 'copiar') { const i = document.querySelector<HTMLInputElement>('.linkrow input')!; i.select(); navigator.clipboard?.writeText(i.value).catch(() => {}); el.textContent = 'Copiado!'; }
  else if (act === 'entrar-aqui') { const n = nomeAtual(); if (!n) { ui.msg = 'Digite seu nome.'; ui.desenhar(); } else { atualizar((d) => { d.nome = n; }); ui.msg = ''; await entrar(n); } }
  else if (act === 'tamanho') await db.update(room(), { total: Number(el.dataset.v) });
  else if (act === 'tempo') await db.update(room(), { tempo: Number(el.dataset.v) });
  else if (act === 'iniciar') await comecarRodada(1);
  else if (act === 'tecla') { if (q && !minhaEntrada()) { digitado = editar(digitado, el, q); ui.desenhar(); } }
  else if (act === 'chutar') {
    const v = lerChute(digitado);
    if (v !== null && cur()?.phase === 'question' && !minhaEntrada()) await db.set(room(`in/${pid}`), { n: cur()!.n, v });
  }
  else if (act === 'pular') { if (isHost() && cur()?.phase === 'reveal') await db.update(room('cur'), { ends: db.now() }); }
  else if (act === 'nova') await novaPartida();
  else if (act === 'sair') { confirmando = true; ui.desenhar(); }
  else if (act === 'ficar') { confirmando = false; ui.desenhar(); }
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
  return confirmando ? `<div class="ov"><div class="ovc"><h3>Sair da sala?</h3><p>${isHost() && players().length > 1 ? 'Outra pessoa vira o anfitrião.' : 'Você pode voltar com o código da sala.'}</p><button class="cta big" data-act="ficar"><span>Ficar na sala</span></button><button class="cta" data-act="sair-sim"><span>Sair da sala</span></button></div></div>` : '';
}

function perguntaHTML() {
  const c = cur()!, q = perguntaAtual();
  if (!q) return '<main class="inicio"><p class="dica">Carregando pergunta…</p></main>';
  if (digitadoN !== c.n) { digitadoN = c.n; digitado = ''; }
  const mine = minhaEntrada(), dentro = !!me();
  const bloqueado = !!mine || !dentro;
  const dir = mine
    ? `<div class="espera"><b>Chute enviado!</b><span>${esc(formatar(mine.v, q.u))}</span><small>Esperando os outros… ${respondidos()} de ${players().length}</small></div>`
    : chuteHTML(q, digitado, bloqueado);
  return `<main class="jogo">${barra(`${c.n} de ${total()}`)}<div class="esq">${tempoHTML()}${cartaoPerguntaHTML(q)}</div><div class="dir">${dir}</div>${confirmarSair()}</main>`;
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
  return `<main class="jogo">${barra(`${c.n} de ${total()}`)}<div class="esq">${cartaoPerguntaHTML(q)}
  <div class="resp"><small>A resposta é</small><b>${esc(formatar(q.r, q.u))}</b>${q.u === 'ano' ? '' : `<span>${esc(q.u)}</span>`}</div></div>
  <div class="dir">${lista}${isHost() ? `<button class="cta" data-act="pular"><span>${c.n >= total() ? 'Ver resultado' : 'Próxima agora'}</span></button>` : '<p class="dica">Próxima pergunta já já…</p>'}<div class="prox"><i id="nx"></i></div></div>${confirmarSair()}</main>`;
}

function opcoesAnfitriao() {
  const grupo = (titulo: string, itens: readonly number[], atual: number, act: string, sufixo = '') =>
    `<div class="opc"><small>${titulo}</small><div>${itens.map((n) => `<button class="${atual === n ? 'on' : ''}" data-act="${act}" data-v="${n}">${n}${sufixo}</button>`).join('')}</div></div>`;
  return grupo('Perguntas na partida', TAMANHOS, total(), 'tamanho') + grupo('Tempo para chutar', TEMPOS, tempoSeg(), 'tempo', ' s');
}

function lobbyHTML() {
  const ps = players(), link = `${location.origin}${location.pathname}?sala=${code}`;
  const dentro = !!me();
  const resumo = `<p class="dica">Partida de <b>${total()}</b> perguntas · <b>${tempoSeg()} s</b> para chutar</p>`;
  return `<main class="lobby"><div class="bar"><button class="ib" data-act="sair" aria-label="Sair da sala">${SAIR_ICONE}</button><div class="prog"><small>Código da sala</small><b class="cod">${code}</b></div></div>
  ${ui.msg ? `<p class="err">${esc(ui.msg)}</p>` : ''}
  <div class="linkrow"><input readonly value="${esc(link)}"><button class="cta sm" data-act="copiar">Copiar link</button></div>
  <h3 class="sec">Jogadores <span>${ps.length}/${MAX_JOGADORES}</span></h3>
  <ul class="lista">${ps.map((p) => `<li>${fichaHTML(p.color, p.name)}<span class="nm">${esc(p.name)}${p.id === S!.host ? ' <em>anfitrião</em>' : ''}${p.id === pid ? ' <em>você</em>' : ''}</span>${p.wins ? `<span class="vl"><small>${p.wins} vitória${p.wins > 1 ? 's' : ''}</small></span>` : ''}</li>`).join('')}</ul>
  ${dentro && isHost() ? opcoesAnfitriao() : dentro ? resumo : ''}
  ${dentro && isHost() ? '<button class="cta big" data-act="iniciar"><span>Iniciar jogo</span></button>' : ''}
  ${dentro && !isHost() ? '<p class="dica">Aguardando o anfitrião iniciar…</p>' : ''}
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
  ${isHost() && !S!.exhausted ? '<button class="cta big" data-act="nova"><span>Nova partida</span></button>' : (!S!.exhausted ? '<p class="dica">Aguardando o anfitrião iniciar outra partida…</p>' : '')}
  <button class="cta" data-act="sair"><span>Sair da sala</span></button>${confirmarSair()}</main>`;
}

export function salaHTML(): string {
  if (!S) return '<main class="inicio"><p class="dica">Entrando na sala…</p></main>';
  contarVitoria();
  if (S.status === 'playing' && !cur()?.phase) return '<main class="inicio"><p class="dica">Preparando a próxima rodada…</p></main>';
  if (S.status === 'lobby') return lobbyHTML();
  if (S.status === 'finished') return fimHTML();
  if (!me()) return lobbyHTML();
  return { question: perguntaHTML, reveal: revelaHTML }[cur()!.phase!]();
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
