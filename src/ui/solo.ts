/** Solo: 10 perguntas, você chuta, vê o quanto errou e no fim ganha uma nota (10 − erro médio em %). */
import { comentario, distancia, erroMedioPct, erroRelativo, formatar, lerChute, notaSolo, sortearPergunta, type Pergunta } from '../motor/motor.ts';
import { PERGUNTAS_SOLO } from '../motor/regras.ts';
import { atualizar, dataBonita, hoje, ler } from './dados.ts';
import { PERGUNTAS, cartaoPerguntaHTML, chuteHTML, editar, esc, params, ui } from './comum.ts';

interface Corrida {
  n: number; usadas: Set<string>; q: Pergunta; digitado: string; fase: 'pergunta' | 'resposta' | 'fim';
  erros: number[]; chute: number | null; ultimaCat?: string; nota: number; novoRecorde: boolean;
}
let C: Corrida | null = null;

export function iniciarSolo() {
  C = { n: 0, usadas: new Set(), q: null as unknown as Pergunta, digitado: '', fase: 'pergunta', erros: [], chute: null, nota: 0, novoRecorde: false };
  proxima(params.get('q') ?? undefined); // ?q=ID: só para testes
}

function proxima(forcada?: string) {
  const c = C!;
  if (c.n >= PERGUNTAS_SOLO) return fim();
  const q = (forcada && PERGUNTAS.get(forcada)) || sortearPergunta([...PERGUNTAS.values()], c.usadas, new Set(ler().vistas), c.ultimaCat);
  if (!q) return fim(); // acabaram todas as perguntas: encerra com o que fez
  c.q = q; c.usadas.add(q.id); c.ultimaCat = q.cat; c.n++; c.digitado = ''; c.chute = null; c.fase = 'pergunta';
  atualizar((d) => { if (!d.vistas.includes(q.id)) d.vistas.push(q.id); });
  ui.desenhar();
}

function fim() {
  const c = C!;
  c.fase = 'fim'; c.nota = notaSolo(c.erros);
  const rec = ler().recorde;
  c.novoRecorde = c.erros.length > 0 && (!rec || c.nota > rec.nota);
  if (c.novoRecorde) atualizar((d) => { d.recorde = { nota: c.nota, data: hoje() }; });
  ui.desenhar();
}

export function sairDoSolo() { C = null; }

const nota = (n: number) => String(n).replace('.', ',');

export function soloHTML(): string {
  const c = C;
  if (!c) return '';
  const topo = `<div class="bar"><button class="ib" data-act="sair-solo" aria-label="Voltar ao início">‹</button><div class="prog"><small>Pergunta</small><b>${Math.min(c.n, PERGUNTAS_SOLO)} de ${PERGUNTAS_SOLO}</b></div></div>`;
  if (c.fase === 'pergunta') {
    return `<main class="jogo">${topo}<div class="esq">${cartaoPerguntaHTML(c.q)}</div><div class="dir">${chuteHTML(c.q, c.digitado, false)}</div></main>`;
  }
  if (c.fase === 'resposta') {
    const q = c.q, e = c.erros[c.erros.length - 1];
    const dist = c.chute === null ? null : distancia(q.r, c.chute);
    const linha = c.chute === null ? 'Você não chutou' : dist === 0 ? 'Você cravou!' : `Seu chute: <b>${esc(formatar(c.chute, q.u))}</b> · errou por <b>${esc(formatar(dist!, q.u))}</b> (${Math.round(e * 100)}%)`;
    return `<main class="jogo">${topo}<div class="esq">${cartaoPerguntaHTML(q)}</div><div class="dir">
    <div class="resp"><small>A resposta é</small><b>${esc(formatar(q.r, q.u))}</b>${q.u === 'ano' ? '' : `<span>${esc(q.u)}</span>`}</div>
    <div class="veredito ${e === 0 ? 'mosca' : ''}"><strong>${comentario(e)}</strong><span>${linha}</span></div>
    <button class="cta big" data-act="proxima"><span>${c.n >= PERGUNTAS_SOLO ? 'Ver minha nota' : 'Próxima'}</span></button></div></main>`;
  }
  const rec = ler().recorde;
  return `<main class="fim"><div class="lbl c">Fim do jogo</div><div class="nota"><b>${nota(c.nota)}</b><small>de 10</small></div>
  <p class="dica">Erro médio: <b>${erroMedioPct(c.erros)}%</b> nas ${c.erros.length} perguntas</p>
  ${c.novoRecorde ? '<p class="novo">✨ Nova melhor nota!</p>' : rec ? `<p class="dica">Sua melhor nota: <b>${nota(rec.nota)}</b> · ${dataBonita(rec.data)}</p>` : ''}
  <button class="cta big" data-act="de-novo"><span>Jogar de novo</span></button><button class="cta" data-act="sair-solo"><span>Voltar ao início</span></button></main>`;
}

export async function acaoSolo(act: string, el: HTMLElement): Promise<boolean> {
  const c = C;
  if (!c) return false;
  if (act === 'tecla' && c.fase === 'pergunta') { c.digitado = editar(c.digitado, el, c.q); ui.desenhar(); }
  else if (act === 'chutar' && c.fase === 'pergunta') {
    const v = lerChute(c.digitado);
    if (v === null) return true;
    c.chute = v; c.erros.push(erroRelativo(c.q, v)); c.fase = 'resposta'; ui.desenhar();
  }
  else if (act === 'proxima' && c.fase === 'resposta') proxima();
  else if (act === 'de-novo') iniciarSolo();
  else if (act === 'sair-solo') { sairDoSolo(); ui.ir('inicio'); }
  else return false;
  return true;
}
