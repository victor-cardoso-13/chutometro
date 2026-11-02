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
- **Sem limite (decidido):** a sala tem a opção ∞ (`SEM_LIMITE = 0`) e o anfitrião tem o botão "Encerrar jogo" (ranking na hora). Pensado para a TV rodar a noite toda; perguntas já usadas na sala nunca repetem.
- **Modo TV (decidido, mock em `mocks/modo-tv.html`):** `/?tv` abre a sala na TV (`src/ui/tv.ts`, `src/tv.css`): QR + código, a TV é a `host` que conduz (`tv:true` na sala; não joga), lê a pergunta falando (fase `read`, o tempo só começa depois), diz "tempo esgotado" (`timeup`), fala resposta e vencedor, placar ao vivo. Quem manda no jogo é o jogador-controle `ctl` (o 1º a entrar; qualquer jogador pode "assumir" no menu de sair). Até 30 jogadores, padrão sem limite. Config da sala (celular do anfitrião): o tempo conta "depois da leitura" (padrão, fase `read`) ou "junto com a leitura" (`junto:true`, a TV lê sem segurar o relógio). Voz = `speechSynthesis` do navegador (no Edge: vozes neurais do Edge TTS, Antonio). **Não** chamar o serviço do Edge TTS por token/websocket (bloqueado). Falas em `src/motor/narracao.ts`. Teste sem som: `speechSynthesis` desligado + `?local&speed=8` (nunca testar com voz ligada: o som toca de verdade).
- A decidir: aparência final do modo TV nas TVs reais.

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

## Organização (feita)
- `src/motor/` regras puras (`regras.ts`, `motor.ts`), testadas em `tests/motor.test.ts`. `src/ui/` telas (`inicio`, `solo`, `sala`, `comum`, `dados`). `src/main.ts` liga toques.
- Nota do solo = 10 − erro médio (%); erro relativo à resposta (anos: relativo a "quantos anos atrás", ver `erroRelativo`).
- Salas: **Realtime Database emprestado do QI** (`src/nuvem/salas-*.ts`), em `rooms/AAAA` com `jogo:'chutometro'` (as regras do banco só liberam `rooms/[A-Z]{4}`, então não precisou mudar nada). Código de sala do QI digitado aqui = "Sala não encontrada". Anfitrião conduz; todos chutam só o próprio número; revelação 8 s (anfitrião pode pular).
- Perguntas: `public/questions.json` (941, **congelado**: ids `cNNNN` entram em `vistas`). Gerado por `scripts/gerar-perguntas.py` a partir de `data/banco-bruto.json` + `data/validacao/relatorio.json`. Validação: 2 respostas às cegas; **não houve conferência na web das aprovadas** (conferência parcial foi interrompida a pedido do Victor para gastar menos). Pergunta errada? remover pelo id.
- Teste visual/rolagem: `npx vite --port 5230 --strictPort` e `PORTA=5230 node scripts/prints.mjs prints` (sala em 3 abas com `?local`). `?speed=N` acelera tempos; `?q=ID` força a 1ª pergunta do solo.
