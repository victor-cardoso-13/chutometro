# Chutômetro — instruções para o Claude

Jogo de **palpites numéricos**: toda pergunta tem resposta em número (altura, ano, população, patrimônio…). Cada jogador chuta um número e **ganha quem chegar mais perto**.
Dá para jogar **sozinho** ou em **sala** (cada um no seu celular), nos mesmos moldes do QI.
**Esta pasta é só do Chutômetro**: repositório https://github.com/victor-cardoso-13/chutometro, publicado em https://victor-cardoso-13.github.io/chutometro/ .
Não mexa em outros jogos daqui nem no `_modelo/`. O QI (`../qi/`) é a referência de sala/solo/login: leia, copie e adapte, mas não edite.

## Como falar com o usuário
Português, linguagem simples, passo a passo (ele não programa). Mudança visual: mock primeiro, publicar só depois do "ok".
Imagens: salvar em `prints/` e dar hiperlink relativo. HTML: abrir no Safari na hora.
Fluxo: perguntas de jogo com exemplos para marcar → mock HTML aprovado → motor + testes → tela → publicar. Não programar a tela antes do "pode seguir".

## Regra central (dita pelo Victor)
- Vence quem **chega mais perto** da resposta. **Empate de distância: vence quem chutou para baixo** (resposta 10, chutes 8 e 12 → ganha o 8).
- Perguntas sempre envolvem números de qualquer natureza (medidas, anos, quantidades, dinheiro, contagens).
- Respostas têm **fonte e data** no banco de perguntas; as que mudam com o tempo (ex.: patrimônio do 10º mais rico), trazem **data e fonte dentro do texto da pergunta** (ex.: "…em dezembro de 2025, segundo a Forbes?"), então nunca envelhecem; o jogador não vê marca de "atualizável".
- **Sala (decidido):** só o mais perto ganha **1 ponto**; **cravar o número exato vale 3**. O anfitrião escolhe o tempo para chutar (15/30/60 s) ao criar a sala. Sem palpite = não pontua.
- **Solo (decidido):** 10 perguntas e uma **nota** no fim (erro médio em %), com recorde.
- Banco: `data/src/*.json` (ver `data/ESPECIFICACAO.md`), 1000 perguntas validadas por agentes às cegas (`data/validacao/`). Perguntas já vistas não repetem (como `vistas` do QI).
- A decidir: número de rodadas da sala, aparência (mock).

## Padrão técnico (igual ao QI/harness)
- Vite + TypeScript + Vitest + PWA. Motor puro em `src/motor/`, telas em `src/ui/`.
- Login opcional pelo projeto Firebase **jogos-sem-anuncio** (`src/nuvem/conta.ts`; progresso em `jogadores/{uid}/jogos/chutometro`). "Convidado" joga igual.
- Salas: a decidir (ver conversa); o QI usa Realtime Database próprio (exceção histórica).
- **Visual (aprovado): grafite total + amarelo** (`mocks/grafite-amarelo.html`, variação B): fundo degradê `#2f3340`→`#171a22`, cartões/teclas `#262a35` com borda `#3b4150`, texto `#f5f5f7`, amarelo `#ffd21f` (botões, vencedor, tempo; texto sobre amarelo `#171a22`, sombra `#a88400`). Resultado da pergunta = **só lista** (sem reta), nome longo corta com “…”. Teclado numérico próprio, **teclas grandes** ocupando o espaço que sobra. O bloco `@media (display-mode: standalone)` do `estilo.css` (tela cheia no iOS 26) **não pode ser apagado**.

## Antes de publicar
1. `npm test` e `npx tsc --noEmit -p .` (Node: `source ~/.nvm/nvm.sh`).
2. Prints: iPad 1180×820 e 820×1180; iPhone 440×800, 390×844 e deitado 956×360; mais 393×852 com área segura (topo 59, base 34). Nunca iPhone SE.

## Publicar
`export PATH="$HOME/.local/bin:$PATH"`; ramo novo → commit → `gh pr create` → `gh pr merge --merge --delete-branch` → `gh run watch`.
Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
