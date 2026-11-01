/** Tela inicial (convidado ou conta) e tela de entrar/criar conta. */
import { dataBonita, ler } from './dados.ts';
import { esc, ui } from './comum.ts';
import { carregarConta, situacaoAtual, usuarioAtual } from '../nuvem/sincronia.ts';

let modoCriar = false;
let erroConta = '';
let ocupado = false;
let emailTxt = '';
let senhaTxt = '';

export function inicioHTML() {
  const u = usuarioAtual(), d = ler();
  const recorde = d.recorde ? `Melhor nota: <b>${String(d.recorde.nota).replace('.', ',')}</b> · ${dataBonita(d.recorde.data)}` : 'Ainda sem nota no solo';
  const sit = situacaoAtual();
  const conta = u
    ? `<div class="acc"><div class="av">${esc((d.nome || u.email)[0].toUpperCase())}</div><div class="ai"><b>${esc(d.nome || u.email)}</b><small>${recorde}${d.vitorias ? ` · ${d.vitorias} vitória${d.vitorias > 1 ? 's' : ''}` : ''}</small></div><button class="link" data-act="sair-conta">Sair</button></div>`
    : `<div class="acc"><div class="av">?</div><div class="ai"><b>Convidado</b><small>${recorde}</small></div><button class="link on" data-act="ir-conta">Entrar com conta</button></div>`;
  const aviso = u
    ? (sit === 'sem-internet' ? 'Sem internet agora: seus dados ficam no aparelho e sobem quando voltar.' : 'Conta ligada: notas e vitórias ficam salvas em qualquer aparelho.')
    : 'Sem conta você joga igual, só não leva as notas para outro aparelho.';
  return `<main class="inicio"><div class="logo"><span>Chutômetro</span><small>Quem chega mais perto?</small></div>
  ${ui.msg ? `<p class="err">${esc(ui.msg)}</p>` : ''}${conta}
  <label class="lbl" for="nome">Seu nome</label><input id="nome" maxlength="14" placeholder="Como quer ser chamado?" value="${esc(d.nome)}" autocomplete="off">
  <button class="cta big" data-act="solo"><span>Jogar sozinho</span><small>10 perguntas e uma nota no final</small></button>
  <button class="cta" data-act="criar"><span>Criar sala</span><small>Até 10 amigos, cada um no seu celular</small></button>
  <div class="entrar"><input id="codigo" maxlength="4" placeholder="CÓDIGO" autocomplete="off" autocapitalize="characters"><button class="cta sm" data-act="entrar">Entrar numa sala</button></div>
  <p class="foot">${aviso}</p></main>`;
}

export function contaHTML() {
  return `<main class="inicio conta"><button class="voltar" data-act="ir-inicio">‹ Voltar</button>
  <div class="logo peq"><span>Chutômetro</span><small>${modoCriar ? 'Criar conta' : 'Entrar com conta'}</small></div>
  <p class="dica">É a mesma conta dos outros jogos sem anúncio.</p>
  ${erroConta ? `<p class="err">${esc(erroConta)}</p>` : ''}
  <label class="lbl" for="email">E-mail</label><input id="email" type="email" autocomplete="email" inputmode="email" autocapitalize="off" placeholder="voce@exemplo.com" value="${esc(emailTxt)}">
  <label class="lbl" for="senha">Senha</label><input id="senha" type="password" autocomplete="${modoCriar ? 'new-password' : 'current-password'}" placeholder="${modoCriar ? 'Mínimo 6 letras ou números' : 'Sua senha'}" value="${esc(senhaTxt)}">
  <button class="cta big" data-act="enviar-conta" ${ocupado ? 'disabled' : ''}><span>${ocupado ? 'Aguarde…' : modoCriar ? 'Criar conta' : 'Entrar'}</span></button>
  <button class="cta" data-act="trocar-modo"><span>${modoCriar ? 'Já tenho conta' : 'Não tenho conta: criar'}</span></button>
  ${modoCriar ? '' : '<button class="link centro" data-act="esqueci">Esqueci a senha</button>'}</main>`;
}

export async function acaoConta(act: string): Promise<boolean> {
  const email = (document.getElementById('email') as HTMLInputElement | null)?.value ?? '';
  const senha = (document.getElementById('senha') as HTMLInputElement | null)?.value ?? '';
  if (ui.tela === 'conta') { emailTxt = email; senhaTxt = senha; }
  if (act === 'ir-conta') { erroConta = ''; modoCriar = false; ui.ir('conta'); return true; }
  if (act === 'ir-inicio') { ui.ir('inicio'); return true; }
  if (act === 'trocar-modo') { modoCriar = !modoCriar; erroConta = ''; ui.desenhar(); return true; }
  if (act === 'sair-conta') { await (await carregarConta()).sair(); return true; }
  if (act === 'enviar-conta' || act === 'esqueci') {
    if (ocupado) return true;
    ocupado = true; erroConta = ''; ui.desenhar();
    try {
      const c = await carregarConta();
      if (act === 'esqueci') { await c.esqueciSenha(email); erroConta = 'Enviamos um e-mail para você trocar a senha.'; }
      else if (modoCriar) { await c.criarConta(email, senha); senhaTxt = ''; ui.ir('inicio'); }
      else { await c.entrar(email, senha); senhaTxt = ''; ui.ir('inicio'); }
    } catch (e) {
      const c = await carregarConta().catch(() => null);
      erroConta = c ? c.mensagemDeErro(e) : 'Sem internet agora. Tente de novo quando a internet voltar.';
    }
    ocupado = false;
    if (ui.tela === 'conta') ui.desenhar();
    return true;
  }
  return false;
}
