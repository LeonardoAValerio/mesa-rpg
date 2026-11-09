# Mesa RPG — Abas na barra lateral

## Problem Statement

A barra lateral empilha tudo numa coluna: Conectados, Cena, Mapa e grid, Névoa, Dados e chat juntos, a biblioteca e o editor do item. O mestre rola a barra para achar cada coisa, e dados e chat se misturam. user: "seria importante a gente conseguir dividir as abas, uma aba de tokens, uma de mapas, uma de dados, uma de chat, uma de sons (...), futuramente ficha e entre outras seções".

## Goals

- [ ] Cada coisa da barra lateral está a um clique, numa aba com nome.
- [ ] Rolagens e mensagens ficam separadas, e quem está em outra aba vê que chegou algo.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Aba Sons | Vem com a feature E (user: "Só com a feature de sons (Recomendado)") |
| Ficha e outras seções | Features futuras |
| Arrastar abas, esconder a barra, atalhos de teclado | Não pedido |
| Guardar a aba aberta entre sessões | A aba volta ao padrão a cada mesa |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Abas do mestre | Tokens, Mapas, Dados, Chat, nessa ordem | Pedido do usuário, sem Sons por enquanto | y |
| Abas do jogador | Dados, Chat | Tokens e Mapas são ferramentas do mestre | n |
| Dados e Chat | Separados: Dados com o rolador e só as rolagens; Chat só com as mensagens | user: "Separadas (Recomendado)" | y |
| Mapas | Cena (Salvar/Carregar), Importar mapa, grid, névoa (Cobrir tudo/Revelar tudo) | user: "Na aba Mapas (Recomendado)" | y |
| Tokens | A biblioteca (Importar pasta de tokens, paleta) e o editor do item selecionado | O que é de token fica junto | n |
| Conectados | Sempre visível acima das abas | user: "Na aba Mapas (Recomendado)" (a opção dizia isso) | y |
| Clique num item | Não troca de aba; a aba Tokens ganha um ponto de destaque até ser aberta; aberta, mostra o editor do item | user: "Não, só mostra um aviso (Recomendado)" | y |
| Contador de novidades | Dados e Chat mostram quantas entradas chegaram com a aba fechada; abrir zera; até "9+" | Pedido na opção escolhida | n |
| Aba inicial | Mestre: Mapas; jogador: Dados | O mestre começa importando o mapa; o jogador rola dados | n |
| Texto digitado | Trocar de aba não apaga o que foi digitado no rolador ou no chat | As abas escondem, não recriam | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Abas ⭐ MVP

**User Story**: Como mestre, quero cada ferramenta numa aba com nome, para achar o que preciso sem rolar a barra.

**Why P1**: É o pedido.

**Acceptance Criteria**:

1. TAB-01: The master's sidebar SHALL show the tabs "Tokens", "Mapas", "Dados" and "Chat", in that order, and a player's SHALL show "Dados" and "Chat".
2. TAB-02: The list "Conectados" SHALL stay visible above the tabs whichever tab is open.
3. TAB-03: WHEN someone clicks a tab THEN the app SHALL show that tab's content only and mark that tab as selected.
4. TAB-04: The "Tokens" tab SHALL hold "Importar pasta de tokens", the palette, the token library and the editor of the selected item.
5. TAB-05: The "Mapas" tab SHALL hold "Salvar cena", "Carregar cena", "Importar mapa", the grid settings, "Cobrir tudo" and "Revelar tudo".
6. TAB-06: WHEN the table opens THEN the master SHALL see "Mapas" open and a player "Dados".
7. TAB-07: WHEN someone switches tabs and comes back THEN the text typed in the dice and chat inputs SHALL still be there.

**Independent Test**: o mestre abre a mesa em Mapas, importa o mapa, vai para Tokens e arrasta um token; o jogador só vê Dados e Chat.

---

### P1: Dados e Chat separados ⭐ MVP

**User Story**: Como jogador, quero as rolagens numa aba e as mensagens em outra, e saber quando chega algo na aba que não estou vendo.

**Why P1**: user: "Separadas (Recomendado)".

**Acceptance Criteria**:

1. TAB-08: The "Dados" tab SHALL hold the dice roller and the history of rolls only, and the "Chat" tab the history of messages and the message input only.
2. TAB-09: WHEN a roll arrives while "Dados" is closed, or a message while "Chat" is closed, THEN that tab SHALL show how many arrived, up to "9+".
3. TAB-10: WHEN someone opens a tab with a count THEN the count SHALL disappear.

**Independent Test**: com o jogador em Chat, o mestre rola 2d6 duas vezes: a aba Dados do jogador mostra 2; abrir Dados mostra as rolagens e zera o contador.

---

### P1: Seleção sem trocar de aba ⭐ MVP

**User Story**: Como mestre, quero clicar num token sem perder o chat que estou lendo.

**Why P1**: user: "Não, só mostra um aviso (Recomendado)".

**Acceptance Criteria**:

1. TAB-11: WHEN the master selects an item on the table while another tab is open THEN the open tab SHALL stay and the "Tokens" tab SHALL show a highlight dot.
2. TAB-12: WHEN the master opens "Tokens" THEN the highlight SHALL disappear and the tab SHALL show the editor of the selected item.

**Independent Test**: o mestre em Chat clica no Goblin: o Chat continua aberto e Tokens ganha o ponto; abrir Tokens mostra "Personagem: Goblin".

---

## Edge Cases

- WHEN the selection is cleared before Tokens is opened THEN the highlight SHALL disappear.
- WHEN the board's own "Importar mapa" button (no map loaded) is used THEN it SHALL work from any tab.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| TAB-01 | P1: Abas | Design | Pending |
| TAB-02 | P1: Abas | Design | Pending |
| TAB-03 | P1: Abas | Design | Pending |
| TAB-04 | P1: Abas | Design | Pending |
| TAB-05 | P1: Abas | Design | Pending |
| TAB-06 | P1: Abas | Design | Pending |
| TAB-07 | P1: Abas | Design | Pending |
| TAB-08 | P1: Dados e Chat separados | Design | Pending |
| TAB-09 | P1: Dados e Chat separados | Design | Pending |
| TAB-10 | P1: Dados e Chat separados | Design | Pending |
| TAB-11 | P1: Seleção sem trocar de aba | Design | Pending |
| TAB-12 | P1: Seleção sem trocar de aba | Design | Pending |

**Coverage:** 12 total, 0 mapped to tasks, 12 unmapped ⚠️

---

## Sources

- `.specs/ROADMAP.md` - feature C and the user's words
- `.specs/features/sidebar-tabs/context.md` - this feature's answers

---

## Success Criteria

- [ ] Na sessão, o mestre usa Mapas, Tokens, Dados e Chat sem rolar a barra lateral.
