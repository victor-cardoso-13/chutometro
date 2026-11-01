/**
 * Dados do jogador guardados no aparelho (localStorage). Cada conta tem a sua "gaveta";
 * quem joga sem conta usa a gaveta "convidado". Sem conta ≠ conta: nunca se misturam.
 * A nuvem (src/nuvem/sincronia.ts) mantém a gaveta da conta igual à do Firebase.
 */
export interface Dados {
  nome: string;
  /** Melhor nota do solo (0 a 10) e o dia (AAAA-MM-DD). */
  recorde: { nota: number; data: string } | null;
  /** Vitórias em salas. */
  vitorias: number;
  /** Ids de perguntas já vistas (para preferir as novas). */
  vistas: string[];
}

const VAZIO = (): Dados => ({ nome: '', recorde: null, vitorias: 0, vistas: [] });
const PREFIXO = 'chutometro:v1:';
let gaveta = 'convidado';
const ouvintes = new Set<(d: Dados) => void>();

export function usarConta(uid: string | null) { gaveta = uid ? `u:${uid}` : 'convidado'; }
export function quandoGravar(f: (d: Dados) => void) { ouvintes.add(f); }

export function ler(): Dados {
  try {
    const bruto = localStorage.getItem(PREFIXO + gaveta);
    return { ...VAZIO(), ...(bruto ? JSON.parse(bruto) : {}) };
  } catch { return VAZIO(); }
}

export function gravar(d: Dados, avisar = true) {
  try { localStorage.setItem(PREFIXO + gaveta, JSON.stringify(d)); } catch { /* aparelho cheio: segue sem salvar */ }
  if (avisar) ouvintes.forEach((f) => f(d));
}

export function atualizar(fn: (d: Dados) => void): Dados {
  const d = ler(); fn(d); gravar(d); return d;
}

/** Junta duas cópias (aparelho + nuvem) sem perder nada: maior nota, mais vitórias, todas as vistas. */
export function mesclar(a: Dados, b: Partial<Dados> | null): Dados {
  const o = { ...VAZIO(), ...(b ?? {}) };
  const rec = [a.recorde, o.recorde].filter((r): r is NonNullable<Dados['recorde']> => !!r).sort((x, y) => y.nota - x.nota)[0] ?? null;
  return { nome: a.nome || o.nome, recorde: rec, vitorias: Math.max(a.vitorias, o.vitorias), vistas: [...new Set([...a.vistas, ...o.vistas])] };
}

export const hoje = () => new Date().toLocaleDateString('sv-SE'); // AAAA-MM-DD no fuso do aparelho
export const dataBonita = (iso: string) => iso.split('-').reverse().join('/');
