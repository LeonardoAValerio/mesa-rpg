# Mesa RPG — Painéis encaixáveis

**Approved**: 2026-11-09 - user: "Aprovo"

## Problem Statement

A barra lateral empilha tudo numa coluna: Conectados, Cena, Mapa e grid, Névoa, Dados e chat juntos, a biblioteca e o editor do item. O mestre rola a barra para achar cada coisa, e dados e chat se misturam. user: "seria importante a gente conseguir dividir as abas, uma aba de tokens, uma de mapas, uma de dados, uma de chat (...)"; e depois: "alguma coisa como aqueles editores complexos, como photoshop, e outros, onde você consegue liberar ou esconder as abas e organizar elas dentro da tela".

## Goals

- [ ] Cada coisa da barra lateral está num painel com nome, a um clique.
- [ ] O mestre arruma os painéis como quiser (lado a lado, flutuando, fechados) e encontra a mesma arrumação na próxima sessão.
- [ ] Rolagens e mensagens ficam separadas, e quem não está olhando vê que chegou algo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Painel Sons | Vem com a feature E (user: "Só com a feature de sons (Recomendado)") |
| Ficha e outras seções | Features futuras |
| Painel em outra janela do sistema (fora do app) | Exige janelas extras do Electron; flutuar dentro do app cobre o pedido |
| Mover a mesa ou a barra de ferramentas | A mesa fica fixa no centro e a barra de cima fica onde está |
| Layout compartilhado entre computadores | Cada um arruma o seu |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Biblioteca | `dockview-core` 8.9.0 (MIT, sem dependências, TypeScript puro) | Faz abas arrastáveis, divisões, flutuar e salvar layout; Golden Layout está parado desde 2023 | n |
| Painéis do mestre | Conectados, Tokens, Mapas, Dados, Chat | user: "Direto no estilo Photoshop (Recomendado)" | y |
| Painéis do jogador | Conectados, Dados, Chat | Tokens e Mapas são ferramentas do mestre | n |
| Layout inicial | Mesa no centro; à direita, Conectados em cima e, embaixo, um grupo de abas Tokens · Mapas · Dados · Chat (jogador: Dados · Chat) | user: o layout inicial é "o da spec atual: abas à direita da mesa" | y |
| Aba aberta no início | Mestre: Mapas; jogador: Dados | O mestre começa importando o mapa; o jogador rola dados | n |
| O que dá para fazer | Arrastar uma aba para outro grupo ou para a borda de um grupo (divide), redimensionar divisões, tornar um grupo flutuante sobre a mesa, fechar um painel | user: "liberar ou esconder as abas e organizar elas dentro da tela" | y |
| Reabrir e restaurar | Botão "Painéis" na barra de cima: lista os painéis com marca nos abertos (clicar abre ou fecha) e "Restaurar layout" | Um painel fechado precisa voltar | n |
| Layout salvo | No computador, separado para mestre e jogador; volta na próxima mesa; um layout salvo inválido ou de outra versão é ignorado e o inicial é usado | user: "layout fica salvo por computador" | y |
| A mesa | Fica fixa no centro, não fecha nem flutua, e se ajusta ao espaço que sobra | O mapa é o centro do app | n |
| Dados e Chat | Separados: Dados com o rolador e só as rolagens; Chat só com as mensagens | user: "Separadas (Recomendado)" | y |
| Mapas | Cena (Salvar/Carregar), Importar mapa, grid, névoa (Cobrir tudo/Revelar tudo) | user: "Na aba Mapas (Recomendado)" | y |
| Tokens | A biblioteca (Importar pasta de tokens, paleta) e o editor do item selecionado | O que é de token fica junto | n |
| Contador de novidades | Dados e Chat mostram na aba quantas entradas chegaram enquanto o painel não estava visível; ver o painel zera; até "9+" | Pedido na opção escolhida | n |
| Clique num item | Não muda o painel visível; a aba Tokens ganha um ponto até o painel ficar visível; aí mostra o editor do item | user: "Não, só mostra um aviso (Recomendado)" | y |
| Texto digitado | Mover, flutuar ou esconder um painel não apaga o que foi digitado no rolador ou no chat | Os painéis são movidos, não recriados | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Painéis com nome ⭐ MVP

**User Story**: Como mestre, quero cada ferramenta num painel com nome, para achar o que preciso sem rolar a barra.

**Why P1**: É o pedido.

**Acceptance Criteria**:

1. PANEL-01: WHEN the master's table opens with no saved layout THEN the app SHALL show the table in the centre and, on its right, "Conectados" above a group of tabs "Tokens", "Mapas", "Dados", "Chat" with "Mapas" open.
2. PANEL-02: WHEN a player's table opens with no saved layout THEN the app SHALL show "Conectados" above a group of tabs "Dados", "Chat" with "Dados" open, and no "Tokens" or "Mapas".
3. PANEL-03: WHEN someone clicks a tab THEN the app SHALL show that panel in its group and mark the tab as active.
4. PANEL-04: The "Tokens" panel SHALL hold "Importar pasta de tokens", the palette, the token library and the editor of the selected item.
5. PANEL-05: The "Mapas" panel SHALL hold "Salvar cena", "Carregar cena", "Importar mapa", the grid settings, "Cobrir tudo" and "Revelar tudo".

**Independent Test**: o mestre abre a mesa e vê o layout inicial; o jogador vê só Conectados, Dados e Chat.

---

### P1: Organizar a tela ⭐ MVP

**User Story**: Como mestre, quero arrastar, dividir, soltar flutuando e fechar painéis, e encontrar a mesma arrumação na próxima sessão.

**Why P1**: user: "liberar ou esconder as abas e organizar elas dentro da tela".

**Acceptance Criteria**:

1. PANEL-06: WHEN someone drags a tab onto another group THEN the panel SHALL move into that group, and WHEN onto the edge of a group THEN the app SHALL split that group and put the panel in the new part.
2. PANEL-07: WHEN someone drags the divider between groups or between the table and a group THEN both sides SHALL change size, and the table SHALL fit the new space.
3. PANEL-08: WHEN someone makes a group float THEN it SHALL show over the table, where it can be moved, and the table SHALL use the freed space.
4. PANEL-09: WHEN someone closes a panel THEN it SHALL leave the screen and show without a mark in the "Painéis" menu; WHEN they pick it there THEN it SHALL open again.
5. PANEL-10: WHEN someone uses "Restaurar layout" in "Painéis" THEN the app SHALL show the starting layout of PANEL-01 or PANEL-02.
6. PANEL-11: WHEN the layout changes THEN the app SHALL save it on that computer, separately for master and player, and WHEN the next table opens THEN it SHALL show that layout.
7. PANEL-12: IF the saved layout cannot be read THEN the app SHALL show the starting layout.
8. PANEL-13: The table SHALL stay in the centre and SHALL not be closed, moved or floated.
9. PANEL-14: WHEN a panel is moved, floated, closed or reopened THEN the text typed in its inputs SHALL still be there.

**Independent Test**: o mestre arrasta Chat para a borda de baixo de Dados (dividindo), faz Tokens flutuar, fecha Mapas; fecha o app, abre outra mesa e vê a mesma arrumação; "Restaurar layout" volta ao inicial.

---

### P1: Dados e Chat separados ⭐ MVP

**User Story**: Como jogador, quero as rolagens num painel e as mensagens em outro, e saber quando chega algo no que não estou vendo.

**Why P1**: user: "Separadas (Recomendado)".

**Acceptance Criteria**:

1. PANEL-15: The "Dados" panel SHALL hold the dice roller and the history of rolls only, and the "Chat" panel the history of messages and the message input only.
2. PANEL-16: WHEN a roll arrives while "Dados" is not visible, or a message while "Chat" is not visible, THEN that tab SHALL show how many arrived, up to "9+".
3. PANEL-17: WHEN the panel with a count becomes visible THEN the count SHALL disappear.

**Independent Test**: com o jogador vendo Chat, o mestre rola 2d6 duas vezes: a aba Dados mostra 2; clicar em Dados mostra as rolagens e zera o contador.

---

### P1: Seleção sem trocar de painel ⭐ MVP

**User Story**: Como mestre, quero clicar num token sem perder o chat que estou lendo.

**Why P1**: user: "Não, só mostra um aviso (Recomendado)".

**Acceptance Criteria**:

1. PANEL-18: WHEN the master selects an item on the table while "Tokens" is not visible THEN the visible panels SHALL stay and the "Tokens" tab SHALL show a highlight dot.
2. PANEL-19: WHEN "Tokens" becomes visible THEN the dot SHALL disappear and the panel SHALL show the editor of the selected item; WHEN the selection is cleared first THEN the dot SHALL disappear.

**Independent Test**: o mestre em Chat clica no Goblin: o Chat continua visível e Tokens ganha o ponto; abrir Tokens mostra "Personagem: Goblin".

---

## Edge Cases

- WHEN the board's own "Importar mapa" button (no map loaded) is used THEN it SHALL work whether "Mapas" is open or closed.
- WHEN a floating group is dragged partly off the window THEN "Restaurar layout" SHALL bring every panel back.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PANEL-01 | P1: Painéis com nome | Design | Pending |
| PANEL-02 | P1: Painéis com nome | Design | Pending |
| PANEL-03 | P1: Painéis com nome | Design | Pending |
| PANEL-04 | P1: Painéis com nome | Design | Pending |
| PANEL-05 | P1: Painéis com nome | Design | Pending |
| PANEL-06 | P1: Organizar a tela | Design | Pending |
| PANEL-07 | P1: Organizar a tela | Design | Pending |
| PANEL-08 | P1: Organizar a tela | Design | Pending |
| PANEL-09 | P1: Organizar a tela | Design | Pending |
| PANEL-10 | P1: Organizar a tela | Design | Pending |
| PANEL-11 | P1: Organizar a tela | Design | Pending |
| PANEL-12 | P1: Organizar a tela | Design | Pending |
| PANEL-13 | P1: Organizar a tela | Design | Pending |
| PANEL-14 | P1: Organizar a tela | Design | Pending |
| PANEL-15 | P1: Dados e Chat separados | Design | Pending |
| PANEL-16 | P1: Dados e Chat separados | Design | Pending |
| PANEL-17 | P1: Dados e Chat separados | Design | Pending |
| PANEL-18 | P1: Seleção sem trocar de painel | Design | Pending |
| PANEL-19 | P1: Seleção sem trocar de painel | Design | Pending |

**Coverage:** 19 total, 0 mapped to tasks, 19 unmapped ⚠️

---

## Sources

- `.specs/ROADMAP.md` - feature C and the user's words
- `.specs/features/sidebar-tabs/context.md` - this feature's answers, including the change to docking panels
- `dockview-core` on npm (8.9.0, "Zero dependency layout manager supporting tabs, groups, grids and splitviews for vanilla TypeScript") - the library

---

## Success Criteria

- [ ] Na sessão, o mestre deixa Chat e Dados lado a lado, Tokens flutuando perto da mesa, e encontra assim na próxima vez.
