/**
 * Mantém os dados do aparelho e os da conta (Firestore: jogadores/{uid}/jogos/chutometro) iguais.
 * Ao entrar: baixa, junta com o do aparelho e envia. A cada mudança: espera 2 s e envia.
 * Sem internet o jogo segue normal; o Firebase só é carregado depois que o jogo já abriu.
 */
import { gravar, ler, mesclar, quandoGravar, usarConta, type Dados } from '../ui/dados.ts';
import type { Usuario } from './conta.ts';

type Conta = typeof import('./conta.ts');
export type Situacao = 'verificando' | 'sem-conta' | 'salvo' | 'sem-internet';

let conta: Conta | null = null;
let usuario: Usuario | null = null;
let situacao: Situacao = 'verificando';
let espera: ReturnType<typeof setTimeout> | null = null;
let pendente: Dados | null = null;
let aviso: () => void = () => {};

export const usuarioAtual = () => usuario;
export const situacaoAtual = () => situacao;
export const carregarConta = async () => (conta ??= await import('./conta.ts'));

async function enviarAgora() {
  if (espera) clearTimeout(espera);
  espera = null;
  const d = pendente, u = usuario;
  if (!d || !u || !conta) return;
  pendente = null;
  try { await conta.enviar(u.uid, { ...d }); situacao = 'salvo'; } catch { pendente = d; situacao = 'sem-internet'; }
  aviso();
}

async function sincronizar(u: Usuario) {
  try {
    const c = await carregarConta();
    const daNuvem = await c.baixar(u.uid) as Partial<Dados> | null;
    const junto = mesclar(ler(), daNuvem); // lê o aparelho DEPOIS de baixar (a pessoa pode ter jogado nesse meio tempo)
    if (usuario?.uid !== u.uid) return; // saiu ou trocou de conta enquanto baixava
    gravar(junto, false);
    await c.enviar(u.uid, { ...junto });
    situacao = 'salvo';
  } catch { situacao = 'sem-internet'; }
  aviso();
}

/** Liga a conta. `trocou` = a gaveta mudou (entrou/saiu alguém) → a tela deve se redesenhar. */
export async function iniciarNuvem(trocou: () => void) {
  aviso = trocou;
  quandoGravar((d) => {
    if (!usuario) return;
    pendente = d;
    if (espera) clearTimeout(espera);
    espera = setTimeout(() => void enviarAgora(), 2000);
  });
  addEventListener('online', () => pendente && void enviarAgora());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void enviarAgora(); });
  try {
    const c = await carregarConta();
    c.observarConta((u) => {
      usuario = u; pendente = null;
      usarConta(u?.uid ?? null);
      situacao = u ? 'salvo' : 'sem-conta';
      trocou();
      if (u) void sincronizar(u);
    });
  } catch { situacao = 'sem-internet'; aviso(); }
}
