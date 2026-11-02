/**
 * Armazenamento das salas (igual ao do QI): set / update / remove / get / on / now.
 * Online = Firebase Realtime Database. Em desenvolvimento, "?local" usa só abas do mesmo navegador (testes).
 * Só é carregado quando a pessoa entra numa sala, para o solo abrir rápido e funcionar sem internet.
 */
import { salasConfig } from './salas-config.ts';

export interface Db {
  now(): number;
  set(p: string, v: unknown): Promise<unknown>;
  remove(p: string): Promise<unknown>;
  update(p: string, obj: Record<string, unknown>): Promise<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(p: string): Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(p: string, cb: (v: any) => void): () => void;
}

const dividir = (p: string) => p.split('/').filter(Boolean);

function bancoLocal(): Db {
  const CHAVE = 'chutometro-local-db';
  const canal = new BroadcastChannel('chutometro-local-db');
  const ouvintes = new Set<() => void>();
  const ler = (): Record<string, unknown> => { try { return JSON.parse(localStorage.getItem(CHAVE) || '{}') || {}; } catch { return {}; } };
  const em = (t: unknown, partes: string[]) => partes.reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), t);
  const avisar = () => ouvintes.forEach((l) => l());
  canal.onmessage = avisar;
  const escrever = (p: string, v: unknown) => {
    const t = ler(); const partes = dividir(p);
    if (!partes.length) localStorage.setItem(CHAVE, JSON.stringify(v ?? {}));
    else {
      let o = t as Record<string, unknown>;
      partes.slice(0, -1).forEach((k) => { if (typeof o[k] !== 'object' || o[k] === null) o[k] = {}; o = o[k] as Record<string, unknown>; });
      const ultimo = partes[partes.length - 1];
      if (v === null || v === undefined) delete o[ultimo]; else o[ultimo] = v;
      localStorage.setItem(CHAVE, JSON.stringify(t));
    }
    canal.postMessage(1); avisar();
  };
  return {
    now: () => Date.now(),
    set: async (p, v) => escrever(p, v),
    remove: async (p) => escrever(p, null),
    update: async (p, obj) => { for (const [k, v] of Object.entries(obj)) escrever(`${p}/${k}`, v); },
    get: async (p) => em(ler(), dividir(p)) ?? null,
    on(p, cb) {
      let ultimo: string | undefined;
      const l = () => { const v = em(ler(), dividir(p)) ?? null; const s = JSON.stringify(v); if (s !== ultimo) { ultimo = s; cb(v); } };
      ouvintes.add(l); l();
      return () => ouvintes.delete(l);
    },
  };
}

async function bancoFirebase(): Promise<Db> {
  const { getApps, initializeApp } = await import('firebase/app');
  const rt = await import('firebase/database');
  const db = rt.getDatabase(getApps().find((a) => a.name === 'salas') ?? initializeApp(salasConfig, 'salas'));
  // Sem internet o Firebase "finge" que funciona (guarda só no aparelho, a sala nunca existe de verdade).
  // Por isso só seguimos depois de conectar de verdade; se não der, quem chamou mostra o aviso de "sem internet".
  rt.goOnline(db); // numa nova tentativa, reconecta já (sem esperar o intervalo do Firebase)
  await new Promise<void>((ok, falha) => {
    let parar = () => {};
    const limite = setTimeout(() => { parar(); rt.goOffline(db); falha(new Error('sem conexão')); }, 8_000);
    parar = rt.onValue(rt.ref(db, '.info/connected'), (s) => { if (s.val() === true) { clearTimeout(limite); parar(); ok(); } });
  });
  let desvio = 0;
  rt.onValue(rt.ref(db, '.info/serverTimeOffset'), (s) => { desvio = s.val() || 0; });
  return {
    now: () => Date.now() + desvio,
    set: (p, v) => rt.set(rt.ref(db, p), v ?? null),
    remove: (p) => rt.remove(rt.ref(db, p)),
    update: (p, obj) => rt.update(rt.ref(db, p), obj),
    get: async (p) => (await rt.get(rt.ref(db, p))).val(),
    on: (p, cb) => rt.onValue(rt.ref(db, p), (s) => cb(s.val())),
  };
}

let aberto: Promise<Db> | null = null;
export const local = import.meta.env.DEV && new URLSearchParams(location.search).has('local');
export function abrirSalas(): Promise<Db> {
  // se não conectou, esquece a tentativa para a próxima vez tentar de novo
  return (aberto ??= local ? Promise.resolve(bancoLocal()) : bancoFirebase().catch((e) => { aberto = null; throw e; }));
}
