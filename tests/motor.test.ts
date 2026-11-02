import { describe, expect, it } from 'vitest';
import {
  aplicarTecla, classificar, comentario, erroRelativo, formatar, formatarDigitado, ganhadoresDaPartida, lerChute, notaSolo,
  resultadoRodada, sortearPergunta, type Pergunta,
} from '../src/motor/motor.ts';
import { escolherVoz, falaFim, falaPergunta, falaResposta } from '../src/motor/narracao.ts';

const P = (id: string, r: number, u = 'm', cat = 'a'): Pergunta => ({ id, q: id, u, r, cat, d: 1 });

describe('rodada', () => {
  it('mais perto vence: resposta 10, chutes 5 e 12 → 12', () => {
    const r = resultadoRodada(10, { a: 5, b: 12 });
    expect(r.vencedores).toEqual(['b']);
    expect(r.pontos).toEqual({ a: 0, b: 1 });
  });
  it('empate de distância vai para quem chutou abaixo: 8 e 12 para 10 → 8', () => {
    const r = resultadoRodada(10, { a: 12, b: 8 });
    expect(r.vencedores).toEqual(['b']);
  });
  it('chutes iguais vencem juntos', () => {
    const r = resultadoRodada(10, { a: 8, b: 8, c: 3 });
    expect(r.vencedores.sort()).toEqual(['a', 'b']);
    expect(r.pontos).toEqual({ a: 1, b: 1, c: 0 });
  });
  it('cravar vale 3', () => {
    const r = resultadoRodada(206, { a: 206, b: 205 });
    expect(r.pontos).toEqual({ a: 3, b: 0 });
  });
  it('quem não chutou não pontua; ninguém chutou = sem vencedor', () => {
    expect(resultadoRodada(10, { a: 7, b: null }).pontos).toEqual({ a: 1, b: 0 });
    expect(resultadoRodada(10, { a: undefined }).vencedores).toEqual([]);
  });
  it('decimais não têm ruído de ponto flutuante', () => {
    expect(resultadoRodada(0.3, { a: 0.1 + 0.2 }).pontos.a).toBe(3);
  });
});

describe('placar', () => {
  it('classifica por pontos e ordem de entrada', () => {
    const o = classificar([{ pts: 2, j: 0 }, { pts: 5, j: 1 }, { pts: 5, j: 2 }]);
    expect(o.map((x) => x.j)).toEqual([1, 2, 0]);
  });
  it('empate no topo = todos ganham; 0 pontos = ninguém', () => {
    expect(ganhadoresDaPartida([{ id: 'a', pts: 4 }, { id: 'b', pts: 4 }, { id: 'c', pts: 1 }])).toEqual(['a', 'b']);
    expect(ganhadoresDaPartida([{ id: 'a', pts: 0 }])).toEqual([]);
  });
});

describe('solo', () => {
  it('erro relativo e nota', () => {
    expect(erroRelativo(P('x', 200), 150)).toBeCloseTo(0.25);
    expect(erroRelativo(P('x', 200), 900)).toBe(1);
    expect(erroRelativo(P('x', 200), null)).toBe(1);
    expect(notaSolo([0, 0.18, 0.36])).toBe(8.2);
    expect(notaSolo([1, 1])).toBe(0);
    expect(notaSolo([0, 0])).toBe(10);
  });
  it('ano mede pela distância até hoje: 1950 para 1969 erra 19 de 57 anos', () => {
    expect(erroRelativo(P('l', 1969, 'ano'), 1950)).toBeCloseTo(19 / 57);
  });
  it('comentários', () => {
    expect(comentario(0)).toBe('NA MOSCA!');
    expect(comentario(0.03)).toBe('Pertinho!');
    expect(comentario(0.9)).toBe('Passou longe');
  });
});

describe('perguntas sem repetir', () => {
  const todas = [P('1', 1, 'm', 'a'), P('2', 1, 'm', 'a'), P('3', 1, 'm', 'b')];
  it('nunca devolve uma usada; acabou = undefined', () => {
    expect(sortearPergunta(todas, new Set(['1', '2', '3']), new Set())).toBeUndefined();
    expect(sortearPergunta(todas, new Set(['1', '3']), new Set())?.id).toBe('2');
  });
  it('prefere as ainda não vistas e outra categoria', () => {
    expect(sortearPergunta(todas, new Set(), new Set(['1', '2']))?.id).toBe('3');
    expect(sortearPergunta(todas, new Set(), new Set(), 'a')?.id).toBe('3');
  });
  it('se só restam vistas, usa elas', () => {
    expect(sortearPergunta(todas, new Set(['1', '2']), new Set(['3']))?.id).toBe('3');
  });
});

describe('teclado', () => {
  it('digita, vírgula, apaga', () => {
    let s = '';
    for (const t of ['1', '2', ',', '5', ',', '7']) s = aplicarTecla(s, t);
    expect(s).toBe('12,57');
    expect(aplicarTecla(s, 'apagar')).toBe('12,5');
    expect(aplicarTecla('', ',')).toBe('0,');
    expect(aplicarTecla('0', '5')).toBe('5');
    expect(aplicarTecla('12', ',', true)).toBe('12');
    expect(aplicarTecla('123456789012', '1')).toBe('123456789012');
  });
  it('lê e formata', () => {
    expect(lerChute('12,5')).toBe(12.5);
    expect(lerChute('')).toBeNull();
    expect(lerChute(',')).toBeNull();
    expect(formatar(1234567)).toBe('1.234.567');
    expect(formatar(1969, 'ano')).toBe('1969');
    expect(formatar(4.54)).toBe('4,54');
    expect(formatarDigitado('1234567,5')).toBe('1.234.567,5');
    expect(formatarDigitado('1969', true)).toBe('1969');
  });
});

describe('narrador (modo TV)', () => {
  const q = { id: 'x', q: 'Quantos metros tem a Torre Eiffel?', u: 'metros', r: 330, cat: 'a', d: 1 };
  it('a 1ª pergunta abre o jogo, as outras só numeram', () => {
    expect(falaPergunta(1, q)).toMatch(/^Vamos começar! Pergunta 1\. Quantos metros/);
    expect(falaPergunta(3, q)).toBe('Pergunta 3. Quantos metros tem a Torre Eiffel? Resposta em metros.');
    expect(falaPergunta(2, { ...q, u: 'ano' })).toMatch(/Responda com o ano\.$/);
  });
  it('fala a resposta e o vencedor', () => {
    expect(falaResposta(q, ['Maria'], 6)).toBe('A resposta certa é 330 metros. Maria chegou mais perto, errou por 6 metros. Um ponto!');
    expect(falaResposta(q, ['Maria'], 0)).toContain('cravou o número exato e leva três pontos');
    expect(falaResposta(q, ['Ana', 'Léo'], 2)).toContain('Ana e Léo chegaram juntos');
    expect(falaResposta(q, [], null)).toContain('Ninguém chutou');
    expect(falaResposta({ ...q, u: 'ano', r: 1969 }, ['Bia'], 1)).toContain('o ano de 1969. Bia chegou mais perto, errou por 1 ano.');
  });
  it('fala o fim do jogo', () => {
    expect(falaFim(['Maria'], 8)).toBe('Fim de jogo! Vitória de Maria, com 8 pontos. Parabéns!');
    expect(falaFim(['A', 'B', 'C'], 1)).toContain('A, B e C, com 1 ponto cada');
    expect(falaFim([], 0, true)).toBe('Acabaram as perguntas! Fim de jogo! Ninguém pontuou.');
  });
  it('prefere a voz neural do Edge em português do Brasil', () => {
    const vozes = [
      { name: 'Luciana', lang: 'pt-BR' }, { name: 'Google português do Brasil', lang: 'pt-BR' },
      { name: 'Microsoft Antonio Online (Natural) - Portuguese (Brazil)', lang: 'pt-BR' }, { name: 'Joana', lang: 'pt-PT' },
    ];
    expect(escolherVoz(vozes)?.name).toContain('Antonio');
    expect(escolherVoz([{ name: 'Daniel', lang: 'en-GB' }])).toBeUndefined();
    expect(escolherVoz([{ name: 'Joana', lang: 'pt-PT' }, { name: 'Luciana', lang: 'pt_BR' }])?.name).toBe('Luciana');
  });
});
