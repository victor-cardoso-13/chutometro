/**
 * Modo TV: a TV (ou o computador ligado nela) cria a sala, mostra o QR code, conduz as rodadas, narra com voz
 * e mostra o placar ao vivo. Quem joga usa o próprio celular (telas de src/ui/sala.ts). Desenho: mocks/modo-tv.html.
 * Voz = fala nativa do navegador: no Microsoft Edge são as vozes neurais do Edge TTS (Antonio Online), nos outros a melhor pt-BR.
 */
import qrcode from 'qrcode-generator';
import '../tv.css';
import { classificar, formatar, ganhadoresDaPartida } from '../motor/motor.ts';
import { duracaoEstimada, escolherVoz, falaEntrou, falaFim, FALA_BOAS_VINDAS } from '../motor/narracao.ts';
import { VELOCIDADE, carregarPerguntas, esc, fichaHTML, ui } from './comum.ts';
import { comandoTV, criarSalaTV, estado, ganchos, linkDaSala, retomarSalaTV, type J } from './sala.ts';
import { CATEGORIAS } from '../motor/regras.ts';

// ---------- narrador ----------
let legenda = '';
let falando: { fim: () => void } | null = null;
let ativo = false;

const sintese = () => (typeof window !== 'undefined' ? window.speechSynthesis : undefined);

/** Chamar DENTRO de um toque: o navegador só libera o som depois de um toque da pessoa. */
export function desbloquearSom() {
  try { sintese()?.speak(new SpeechSynthesisUtterance('')); } catch { /* sem som: o jogo segue só com a legenda */ }
  document.documentElement.requestFullscreen?.().catch(() => { /* tela cheia é opcional */ });
  navigator.wakeLock?.request('screen').catch(() => { /* TV pode dormir; nada a fazer */ });
}

export function parar() {
  sintese()?.cancel();
  falando?.fim();
}

export function narrar(texto: string): Promise<void> {
  parar();
  return new Promise<void>((resolve) => {
    let feito = false;
    const ss = sintese();
    // Se o som falhar (sem voz, navegador bloqueou), a fala "dura" o tempo de leitura e o jogo segue com a legenda.
    const tempo = setTimeout(() => fim(), (duracaoEstimada(texto) * (ss ? 2.2 : 1) + 3000) / VELOCIDADE);
    const fim = () => {
      if (feito) return;
      feito = true; clearTimeout(tempo);
      if (falando?.fim === fim) { falando = null; if (ui.tela === 'tv') ui.desenhar(); }
      resolve();
    };
    falando = { fim };
    legenda = texto;
    if (ss) {
      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      const v = escolherVoz(ss.getVoices());
      if (v) u.voice = v;
      u.onend = fim; u.onerror = fim;
      ss.speak(u);
    }
    if (ui.tela === 'tv') ui.desenhar();
  });
}

// ---------- ligação com a sala ----------
let conhecidos: Set<string> | null = null;
let aviso: ReturnType<typeof setTimeout> | undefined;
let fimFalado = '';

function aoMudar(s: ReturnType<typeof estado>['S']) {
  if (!s) { conhecidos = null; return; }
  const e = estado();
  // Pulou a resposta: cala o narrador.
  if (s.cur?.phase === 'reveal' && (s.cur.ends ?? 0) <= e.agora) parar();
  // Alguém entrou na sala (só no saguão, para não atrapalhar a pergunta).
  const nomes = new Map(Object.entries(s.players ?? {}).map(([id, p]) => [id, p.name]));
  if (conhecidos === null) conhecidos = new Set(nomes.keys());
  const novos = [...nomes].filter(([id]) => !conhecidos!.has(id)).map(([, n]) => n);
  nomes.forEach((_, id) => conhecidos!.add(id));
  if (novos.length && s.status === 'lobby') {
    clearTimeout(aviso);
    aviso = setTimeout(() => { if (!falando) void narrar(falaEntrou(novos)); }, 1200);
  }
  // Fim de jogo: anuncia o campeão.
  if (s.status === 'finished') {
    const chave = `${e.code}:${s.game}`;
    if (fimFalado !== chave) {
      fimFalado = chave;
      const todos = Object.entries(s.players ?? {}).map(([id, p]) => ({ id, pts: p.pts || 0 }));
      const ids = ganhadoresDaPartida(todos); // calcula aqui (não depende de `winners` já ter chegado)
      parar();
      void narrar(falaFim(ids.map((id) => s.players?.[id]?.name).filter((n): n is string => !!n), todos.find((t) => t.id === ids[0])?.pts ?? 0, !!s.exhausted));
    }
  }
}

export function iniciarTV() {
  if (ativo) return;
  ativo = true;
  ganchos.narrar = narrar;
  ganchos.parar = parar;
  ganchos.aoMudar = aoMudar;
  document.body.classList.add('modo-tv');
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); const s = estado().S; void comandoTV(s?.status === 'lobby' ? 'iniciar' : 'pular'); }
    else if (ev.key === 'f') document.documentElement.requestFullscreen?.().catch(() => {});
  });
  setInterval(tique, 200);
}

/** Abre a TV: se a página foi recarregada, volta para a mesma sala. */
export async function abrirTV(): Promise<void> {
  iniciarTV();
  ui.tela = 'tv';
  if (estado().code) { await carregarPerguntas(); if (!(await retomarSalaTV())) ui.msg = ''; }
}

export async function acaoTV(act: string): Promise<boolean> {
  if (act === 'tv-comecar') {
    ui.msg = '';
    await carregarPerguntas();
    await criarSalaTV();
    void narrar(FALA_BOAS_VINDAS);
    return true;
  }
  return false;
}

// ---------- telas ----------
function qrSvg(texto: string): string {
  const q = qrcode(0, 'M');
  q.addData(texto); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }).replace(/ width="[^"]*"| height="[^"]*"/g, '');
}

const nomeCurto = (n: string) => esc(n);

function placarHTML(ps: J[], res: Record<string, { pts: number }> | undefined, maximo = 8) {
  const ord = classificar(ps);
  const linhas = ord.slice(0, maximo).map((p, i) => {
    const ganhou = res?.[p.id]?.pts ?? 0;
    return `<div class="t-li ${ganhou > 0 ? 'up' : ''}"><span class="pos">${i + 1}º</span>${fichaHTML(p.color, p.name)}<span class="nm">${nomeCurto(p.name)}</span>${ganhou > 0 ? `<span class="mais">+${ganhou}</span>` : ''}<b>${p.pts}</b></div>`;
  }).join('');
  const resto = ord.length - maximo;
  return `<div class="t-pl"><h3>Placar <i>ao vivo</i></h3><div class="t-lis">${linhas || '<p class="t-vazio">Sem jogadores</p>'}${resto > 0 ? `<p class="t-vazio">+ ${resto} jogador${resto > 1 ? 'es' : ''}</p>` : ''}</div></div>`;
}

function moldura(info: string, corpo: string, cls = '') {
  return `<div class="t-raiz"><div class="t-tv"><div class="t-topo"><span class="t-logo">🎯 Chutômetro</span><span class="t-pill">${esc(info)}</span></div>
  <section class="t-tela ${cls}">${corpo}</section>
  <div class="t-nar"><span class="ic">🎙️</span><div class="t-onda ${falando ? 'on' : ''}"><i></i><i></i><i></i><i></i><i></i></div>
  <div class="tx"><span>${esc(legenda || 'Pronto para narrar.')}</span><small>Narrador · voz pt-BR do navegador (no Microsoft Edge: Edge TTS, Antonio) — legenda para quem não ouve</small></div></div></div></div>`;
}

function inicioTV() {
  return `<div class="t-raiz"><div class="t-tv"><section class="t-tela t-comeco">
  <h1 class="t-grande">🎯 Chutômetro</h1><p>Modo TV · quem chega mais perto?</p>
  ${ui.msg ? `<p class="t-erro">${esc(ui.msg)}</p>` : ''}
  <button class="t-botao" data-act="tv-comecar">Abrir a sala</button>
  <p class="t-dica">Toque aqui uma vez: isso liga o som e a tela cheia. Precisa de internet.</p></section></div></div>`;
}

function saguao(e: ReturnType<typeof estado>) {
  const ps = classificar(e.ps).sort((a, b) => a.j - b.j);
  const url = linkDaSala();
  const curto = (location.host + location.pathname).replace(/\/$/, '');
  const lista = ps.map((p) => `<div class="t-chip">${fichaHTML(p.color, p.name)}<span class="nm">${nomeCurto(p.name)}</span>${p.wins ? `<small>🏆${p.wins}</small>` : ''}</div>`).join('');
  return moldura('Sala aberta', `<div class="t-qr">${qrSvg(url)}<b>Aponte a câmera do celular</b></div>
  <div class="t-meio"><h1>Quem chega<br><em>mais perto?</em></h1>
  <p>Ou abra <b>${esc(curto)}</b><br>e digite o código:</p><div class="t-cod">${e.code}</div>
  <p class="t-peq">${e.ps.length ? 'O 1º a entrar é o anfitrião e inicia pelo celular' : 'Esperando os jogadores…'} · ${e.semLimite ? 'sem limite de perguntas' : e.total + ' perguntas'} · ${e.tempo} s</p></div>
  <div class="t-jog"><h3>Jogadores (${ps.length})</h3><div class="t-chips ${ps.length > 10 ? 'duas' : ''}">${lista}</div></div>`, 't-saguao');
}

function perguntaTV(e: ReturnType<typeof estado>) {
  const c = e.cur!, q = e.q;
  if (!q) return moldura('…', '<p class="t-vazio">Carregando pergunta…</p>');
  const lendo = c.phase === 'read';
  const quem = e.ps.map((p) => `<span class="${e.S!.in?.[p.id]?.n === c.n ? 'ok' : ''}">${nomeCurto(p.name)}</span>`).join('');
  const dica = q.u === 'ano' ? 'Responda com o ano' : `Resposta em ${esc(q.u)}`;
  return moldura(e.semLimite ? `Pergunta ${c.n}` : `Pergunta ${c.n} de ${e.total}`, `<div class="t-pr"><div class="t-n">${esc(CATEGORIAS[q.cat] ?? '')} · ${lendo ? 'ouça a pergunta' : 'chute um número no celular'}</div>
  <div class="t-q">${esc(q.q)}</div><div class="t-un">${dica}</div>
  <div class="t-rel"><div class="t-anel" id="tanel" style="--p:${lendo ? 100 : 100}%"><b id="tseg">${lendo ? '🎙️' : e.tempo}</b></div><div class="t-quem">${quem}</div></div></div>
  ${placarHTML(e.ps, undefined)}`, 't-perg');
}

function esgotouTV(e: ReturnType<typeof estado>) {
  return moldura(`Pergunta ${e.cur!.n}`, '<div class="t-gde">⏰</div><h1 class="t-grande">Tempo esgotado!</h1><p>Chutes trancados. Vamos ver quem chegou mais perto…</p>', 't-fim');
}

function respostaTV(e: ReturnType<typeof estado>) {
  const q = e.q!, S = e.S!;
  const linhas = e.ps.map((p) => ({ p, x: S.res?.[p.id] })).filter((l) => l.x)
    .sort((a, b) => (a.x!.d ?? Infinity) - (b.x!.d ?? Infinity) || (a.x!.v ?? Infinity) - (b.x!.v ?? Infinity));
  const mostrar = linhas.slice(0, 6);
  const lista = mostrar.map(({ p, x }, i) => {
    const chutou = x!.v !== null && x!.v !== undefined;
    return chutou
      ? `<div class="t-cl ${x!.pts > 0 ? 'w' : ''}"><span>${x!.pts > 0 ? '🥇' : i + 1 + 'º'}</span><span class="nm">${nomeCurto(p.name)}</span><b>${esc(formatar(x!.v!, q.u))}</b><small>${x!.d === 0 ? 'cravou!' : 'errou por ' + esc(formatar(x!.d!, q.u))}</small></div>`
      : `<div class="t-cl mudo"><span>—</span><span class="nm">${nomeCurto(p.name)}</span><b>…</b><small>não chutou</small></div>`;
  }).join('');
  const mais = linhas.length - mostrar.length;
  const gan = linhas.filter((l) => l.x!.pts > 0);
  const mosca = gan.length && gan.every((l) => l.x!.d === 0)
    ? `<div class="t-mosca">🎯 NA MOSCA! ${gan.map((l) => nomeCurto(l.p.name)).join(' e ')} +3</div>`
    : gan.length ? `<div class="t-mosca">🏆 ${gan.map((l) => nomeCurto(l.p.name)).join(' e ')} ${gan.length > 1 ? 'levam' : 'leva'} +1 ponto</div>` : '<div class="t-mosca">Ninguém chutou desta vez</div>';
  return moldura(e.semLimite ? `Pergunta ${e.cur!.n}` : `Pergunta ${e.cur!.n} de ${e.total}`, `<div class="t-pr"><div class="t-q2">${esc(q.q)}</div><div class="t-a">A resposta certa é</div>
  <div class="t-num">${esc(formatar(q.r, q.u))}<small>${q.u === 'ano' ? '' : esc(q.u)}</small></div>
  <div class="t-lista">${lista}${mais > 0 ? `<p class="t-vazio">+ ${mais} outro${mais > 1 ? 's' : ''}</p>` : ''}</div>${mosca}</div>
  ${placarHTML(e.ps, S.res)}`, 't-resp');
}

function finalTV(e: ReturnType<typeof estado>) {
  const ord = classificar(e.ps);
  const [a, b, c] = ord;
  const deg = (p: J | undefined, cls: string, med: string) => (p ? `<div class="t-deg ${cls}"><div class="med">${med}</div><div class="nm">${nomeCurto(p.name)}</div><div class="bl">${p.pts}</div></div>` : '');
  const resto = ord.slice(3, 11).map((p, i) => `<div class="t-li"><span class="pos">${i + 4}º</span>${fichaHTML(p.color, p.name)}<span class="nm">${nomeCurto(p.name)}</span><b>${p.pts}</b></div>`).join('');
  return moldura('Fim de jogo', `<div class="t-podio">${deg(b, 'p2', '🥈')}${deg(a, 'p1', '🥇')}${deg(c, 'p3', '🥉')}</div>
  <div class="t-pl t-resto"><h3>${ord.length > 3 ? 'Demais' : 'Ranking'}</h3><div class="t-lis">${resto || '<p class="t-vazio">—</p>'}</div>
  <p class="t-vazio">${e.S!.exhausted ? 'As perguntas acabaram.' : 'O anfitrião inicia outra partida pelo celular.'}</p></div>
  <span class="t-conf" style="left:12%">🎉</span><span class="t-conf" style="left:35%;animation-delay:1.2s">✨</span><span class="t-conf" style="left:58%;animation-delay:.5s">🎊</span><span class="t-conf" style="left:80%;animation-delay:2s">🎉</span>`, 't-final');
}

export function tvHTML(): string {
  const e = estado();
  if (!e.S) return inicioTV();
  if (e.S.status === 'lobby') return saguao(e);
  if (e.S.status === 'finished') return finalTV(e);
  if (!e.cur?.phase || !e.q) return moldura('…', '<p class="t-vazio">Preparando a próxima pergunta…</p>');
  return { read: perguntaTV, question: perguntaTV, timeup: esgotouTV, reveal: respostaTV }[e.cur.phase](e);
}

/** Relógio da pergunta, sem redesenhar a tela. */
function tique() {
  if (ui.tela !== 'tv') return;
  const e = estado();
  if (e.cur?.phase !== 'question') return;
  const total = (e.tempo * 1000) / VELOCIDADE;
  const resta = Math.max(0, (e.cur.ends ?? 0) - e.agora);
  const seg = document.getElementById('tseg'), anel = document.getElementById('tanel');
  if (seg) seg.textContent = String(Math.ceil((resta / 1000) * VELOCIDADE));
  if (anel) { anel.style.setProperty('--p', `${Math.max(0, Math.min(100, (100 * resta) / total))}%`); anel.classList.toggle('low', resta < total * 0.2); }
}
