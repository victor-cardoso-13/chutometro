/**
 * Chutômetro — controle da tela. Liga os toques às telas (src/ui) e à conta (src/nuvem).
 * Telas: início → solo | sala | conta.
 */
import './estilo.css';
import { atualizar, ler } from './ui/dados.ts';
import { $app, carregarPerguntas, params, ui, type Tela } from './ui/comum.ts';
import { acaoConta, contaHTML, inicioHTML } from './ui/inicio.ts';
import { acaoSala, abrirDaUrl, codigoDaUrl, criarSala, entrarNaSala, salaHTML } from './ui/sala.ts';
import { acaoSolo, iniciarSolo, sairDoSolo, soloHTML } from './ui/solo.ts';
import { iniciarNuvem, usuarioAtual } from './nuvem/sincronia.ts';
import { abrirTV, acaoTV, desbloquearSom, tvHTML } from './ui/tv.ts';

function desenhar() {
  const antes = { y: $app.querySelector('.vista')?.scrollTop ?? 0 };
  const foco = document.activeElement as HTMLInputElement | null;
  const guardar = foco && foco.tagName === 'INPUT' && foco.id ? { id: foco.id, v: foco.value, ini: foco.selectionStart, fim: foco.selectionEnd } : null;
  const html = { inicio: inicioHTML, conta: contaHTML, solo: soloHTML, sala: salaHTML, tv: tvHTML }[ui.tela]();
  $app.innerHTML = `<div class="vista tela-${ui.tela}">${html}</div>`;
  const v = $app.querySelector('.vista');
  if (v) v.scrollTop = antes.y;
  if (guardar) { // não perde o que a pessoa está digitando quando a tela se redesenha
    const el = document.getElementById(guardar.id) as HTMLInputElement | null;
    if (el && !el.value) { el.value = guardar.v; el.focus(); el.setSelectionRange(guardar.ini, guardar.fim); }
  }
}

ui.desenhar = desenhar;
ui.ir = (t: Tela) => { ui.tela = t; if (t !== 'inicio') ui.msg = ''; desenhar(); };

function nomeDigitado(): string {
  const digitado = (document.getElementById('nome') as HTMLInputElement | null)?.value.trim() ?? '';
  const nome = digitado || ler().nome || usuarioAtual()?.email.split('@')[0].slice(0, 14) || '';
  if (!nome) { ui.msg = 'Digite seu nome.'; desenhar(); return ''; }
  if (nome !== ler().nome) atualizar((d) => { d.nome = nome; });
  ui.msg = '';
  return nome;
}

$app.addEventListener('click', async (ev) => {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-act]');
  if (!el || (el as HTMLButtonElement).disabled) return;
  const act = el.dataset.act!;
  if (ui.tela === 'tv') { // o som só liga dentro de um toque: chamar antes de qualquer espera
    desbloquearSom();
    try { await acaoTV(act); } catch { ui.msg = 'Sem internet agora. Confira a conexão e toque de novo.'; desenhar(); }
    return;
  }
  try {
    if (ui.tela === 'inicio') {
      if (act === 'tv') { location.href = `${location.pathname}?tv`; return; }
      if (act === 'solo') { await carregarPerguntas(); nomeDigitado(); ui.tela = 'solo'; iniciarSolo(); return; }
      if (act === 'criar') { const n = nomeDigitado(); if (n) { await carregarPerguntas(); await criarSala(n); } return; }
      if (act === 'entrar') {
        const c = (document.getElementById('codigo') as HTMLInputElement).value.trim().toUpperCase();
        if (c.length !== 4) { ui.msg = 'O código tem 4 letras.'; desenhar(); return; }
        const n = nomeDigitado(); if (n) { await carregarPerguntas(); await entrarNaSala(c, n); }
        return;
      }
    }
    if (await acaoConta(act)) return;
    if (ui.tela === 'solo' && await acaoSolo(act, el)) return;
    if (ui.tela === 'sala') await acaoSala(act, el);
  } catch {
    ui.msg = 'Sem internet agora. Tente de novo quando a internet voltar.';
    if (ui.tela !== 'solo') { ui.tela = 'inicio'; sairDoSolo(); }
    desenhar();
  }
});

(async function iniciar() {
  desenhar();
  if (params.has('tv')) { try { await abrirTV(); } catch { ui.msg = 'Sem internet agora. Confira a conexão e toque de novo.'; } desenhar(); return; }
  void iniciarNuvem(desenhar);
  try {
    await carregarPerguntas();
    if (codigoDaUrl()) { ui.tela = (await abrirDaUrl()) ? 'sala' : 'inicio'; }
  } catch { ui.msg = 'Não deu para carregar as perguntas. Confira a internet.'; }
  desenhar();
})();
