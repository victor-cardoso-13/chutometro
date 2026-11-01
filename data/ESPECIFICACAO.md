# Banco de perguntas do Chutômetro — especificação

Cada arquivo `data/src/<categoria>.json` é uma lista (array JSON) de objetos:

```json
{
  "q": "Quantos ossos tem o corpo de um adulto?",
  "unidade": "ossos",
  "resposta": 206,
  "fonte": "Anatomia humana (consenso médico)",
  "ano": 2024,
  "atualizavel": false,
  "dificuldade": 1
}
```

- `q`: pergunta em português do Brasil, clara, que já diga a unidade/escala quando precisar ("em metros", "em milhões de habitantes", "em que ano").
- `unidade`: o que o número representa ("ossos", "metros", "ano", "milhões de habitantes", "°C", "km", "%"). Para perguntas de ano use `"ano"`.
- `resposta`: UM número (inteiro ou decimal, sem texto, sem aspas). Use a mesma unidade/escala da pergunta (se a pergunta é "em milhões", resposta em milhões).
- `fonte`: onde se confirma (Wikipédia, IBGE, NASA, FIFA, COI, Guinness, livro, etc.), curta.
- `ano`: ano de referência do dado (quando foi conferido ou a que ano o dado se refere).
- `atualizavel`: `true` se a resposta muda com o tempo (população, recordes que podem cair, patrimônio, preços). Prefira `false`.
- `dificuldade`: 1 (todo mundo faz ideia), 2 (médio), 3 (difícil).

## Regras de qualidade (importantes)
1. Resposta **única e verificável**: nada de "cerca de" com fontes divergentes. Evite o que tem várias medições aceitas (ex.: comprimento de rios, Muralha da China, anos de impérios com datas discutidas).
2. **Preferir fatos estáveis** (história, ciência, anatomia, geografia física, esportes já encerrados, obras artísticas). Dados que mudam: `atualizavel: true` e só se forem confiáveis em 2026.
3. A pergunta deve ser **divertida de chutar**: quando a pessoa não sabe, ela consegue ter uma ideia de ordem de grandeza. Nada de números arbitrários sem noção ("qual o CEP...").
4. **Variar a escala**: misture respostas de 1 dígito até bilhões, e anos. Não faça 100 perguntas de "em que ano".
5. No máximo ~15% das perguntas de uma categoria podem ser de "em que ano".
6. **Sem repetição**: não repita pergunta nem o mesmo fato com outras palavras.
7. Nada ofensivo, político-partidário ou com dados pessoais de gente comum. Personalidades só com fatos públicos e consolidados.
8. Números com precisão razoável: se a resposta oficial for 8.848,86 m, pergunte "em metros" e use 8849 (arredondado como a fonte mais comum) — e deixe claro na fonte.

## Regra para dados que mudam com o tempo (decidida pelo Victor)
Não existe "atualizável" para o jogador. Todo dado que muda **entra na própria pergunta com data e fonte fixas**, e assim a resposta nunca envelhece. Exemplos:
- "Qual era o patrimônio, em bilhões de dólares, do homem mais rico do mundo em dezembro de 2025, segundo a Forbes?"
- "Quantos habitantes tinha o Brasil no Censo de 2022, em milhões?"
Por isso `atualizavel` fica sempre `false` no banco final, e a data/fonte aparece no texto da pergunta (`q`).
