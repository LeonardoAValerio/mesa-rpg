# Mesa RPG — Seleção e grupos no tabuleiro

**Approved**: 2026-11-11 - user: "Aprovo"

## Problem Statement

Mexer em vários tokens é um por um: não há como pegar um bando de goblins nem levar a personagem junto com a montaria. Um token de 1,5 ou 2,5 células encaixa com o centro fora de uma célula, a grid não pode ser escondida num mapa que não tem grid, e mover a vista exige segurar Espaço. user: "deixar centralizado os tokens quando são maiores"; "Ter opção de remover a grid (Tem que ser salvo por cena)"; "No mouse ele deve ser possível selecionar uma área e selecionar vários tokens"; "Ter opção de agrupar tokens, onde ao pegar um ele já vai selecionando o outro (A ideia é para fazer por exemplo montarias e etc)"; "Botão direito do mouse podia mover pelo mapa também, como quando clica espaço".

## Goals

- [ ] O mestre move um grupo de inimigos com um arrasto, e a jogadora move personagem e montaria juntas.
- [ ] Todo personagem encaixa centrado nas células que ocupa.
- [ ] Um mapa sem grid fica sem grid naquela cena.
- [ ] A vista se move com o botão direito, em qualquer ferramenta.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Laço livre (seleção por desenho) | O pedido é "selecionar uma área"; a caixa cobre |
| Grupo dentro de grupo | Montaria e bando são um nível só |
| Copiar e colar tokens | Não foi pedido |
| Alinhar ou distribuir tokens | Não foi pedido |
| Menu do botão direito | O botão direito passa a mover a vista |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Centralizar | Personagem encaixa com o centro no centro de uma célula; só lados pares inteiros (2, 4...) ficam no cruzamento das linhas | user: "Centro no centro da célula (Recomendado)" | y |
| Grid escondida | "Mostrar grid" no painel Mapas, por cena; com a grid escondida os tokens ficam onde soltar | user: "Não, ficam livres (Recomendado)" | y |
| Seleção por área | Qualquer um; só entram os itens que a pessoa pode mover; arrastar move todos; Q/E giram cada um; Delete apaga (só mestre); Shift+clique soma ou tira | user: "Todos; mover juntos e girar (Recomendado)" | y |
| Grupos | Qualquer um agrupa os itens que pode mover; pegar um seleciona o grupo; o grupo só se move se a pessoa pode mover cada item; salvo na cena | user: "Qualquer um agrupa" | y |
| Botão direito | Arrastar com o botão direito move a vista, como Espaço + arrasto | user: "Botão direito do mouse podia mover pelo mapa também, como quando clica espaço" | y |
| Onde ficam "Agrupar" e "Desagrupar" | Numa barrinha no topo do mapa, que aparece com 2 ou mais itens selecionados (Agrupar) ou um grupo selecionado (Desagrupar); atalhos Ctrl+G e Ctrl+Shift+G | Os jogadores não têm a aba Tokens | n |
| Encaixe de uma seleção arrastada | O item pego encaixa como sozinho; os outros andam o mesmo tanto, mantendo as distâncias | Um bando arrastado não se desarruma | n |
| Shift com a grid escondida | Shift ao soltar encaixa na grid escondida, como hoje inverte o encaixe | Mantém a regra do Shift (ITEM-09) | n |
| Editor com vários itens | O editor de token (aba Tokens) aparece só com um item selecionado | Editar vários de uma vez não foi pedido | n |
| Seleção | Cada janela tem a sua; ninguém vê a seleção do outro | Como hoje (ITEM-04) | n |
| Grupo que perde itens | Um item apagado sai do grupo; um grupo que fica com um item só deixa de existir | Grupo de um não faz sentido | n |
| Agrupar itens que já têm grupo | Os itens escolhidos formam um grupo novo e saem dos grupos antigos | Um item tem no máximo um grupo | n |
| Cenas antigas | Uma cena salva antes disso abre com a grid visível e sem grupos | Como era | n |
| Mapa novo | Carregar um mapa novo deixa a grid visível | O mestre esconde se quiser | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Encaixe centrado ⭐ MVP

**User Story**: Como mestre ou jogador, quero que todo personagem encaixe centrado nas células que ocupa.

**Why P1**: Pedido direto; afeta todo token maior que uma célula.

**Acceptance Criteria**:

1. BRD-01: WHEN a character is dropped with the snap on THEN, on each axis where its drawn size in cells is an even whole number (2, 4...), its centre SHALL land on a grid line, and on every other axis (1, 3, 1.5, 2.5...) on the centre of a cell.
2. BRD-02: WHEN a character is placed from the library or the campaign lists THEN it SHALL snap by the same rule.

**Independent Test**: um token de 1,5 célula solto perto de (130, 170) numa grid de 100 px fica com o centro em (150, 150); um de 2 células, em (100, 200).

---

### P1: Esconder a grid ⭐ MVP

**User Story**: Como mestre, quero esconder a grid numa cena cujo mapa não tem grid.

**Why P1**: Pedido direto, com a condição de valer por cena.

**Acceptance Criteria**:

1. BRD-03: WHEN the master turns "Mostrar grid" off in "Mapas" THEN every window SHALL stop drawing the grid lines, and turning it on SHALL draw them again.
2. BRD-04: WHILE the grid is hidden a character dropped SHALL stay where it is dropped, and Shift held at the drop SHALL snap it to the hidden grid.
3. BRD-05: WHEN the master saves a scene (`.cena` or `.mesa`) and loads it again THEN the grid SHALL be shown or hidden as it was saved.
4. BRD-06: WHEN a scene saved before this feature is loaded, or a new map is loaded, THEN the grid SHALL be visible.
5. BRD-07: IF a player tries to change "Mostrar grid" THEN the table SHALL refuse it with "Sem permissão".

**Independent Test**: o mestre esconde a grid, salva "Cidade", mostra a grid, carrega "Cidade": a grid some nas duas janelas.

---

### P1: Seleção por área ⭐ MVP

**User Story**: Como mestre ou jogador, quero pegar vários itens com uma caixa e mexer neles juntos.

**Why P1**: Pedido direto.

**Acceptance Criteria**:

1. BRD-08: WHEN someone drags on an empty part of the map with the select tool THEN a rectangle SHALL follow the pointer, and on release every item whose centre is inside it and that the person may move SHALL be selected, and no other.
2. BRD-09: WHEN someone Shift+clicks an item they may move THEN it SHALL be added to the selection, or taken out if it was in it.
3. BRD-10: WHEN someone drags one of several selected items THEN every selected item SHALL move by the same offset in every window, the dragged one snapping as alone (BRD-01, BRD-04).
4. BRD-11: WHEN someone presses Q or E with several items selected THEN each SHALL turn 15° anticlockwise or clockwise about its own centre, in every window.
5. BRD-12: WHEN the master presses Delete with items selected THEN they SHALL be removed in every window; a player's Delete SHALL remove nothing.
6. BRD-13: WHEN someone clicks an empty part of the map or presses Esc THEN the selection SHALL be cleared.
7. BRD-14: WHILE several items are selected each SHALL show the selection outline, and the master's item editor SHALL be hidden.

**Independent Test**: o mestre arrasta uma caixa sobre três goblins e um baú; os quatro ficam selecionados, ele arrasta um goblin duas células para a direita e os quatro andam duas células nas duas janelas.

---

### P1: Grupos ⭐ MVP

**User Story**: Como jogadora, quero juntar minha personagem e a montaria para que andem juntas.

**Why P1**: Pedido direto (montarias).

**Acceptance Criteria**:

1. BRD-15: WHEN someone with 2 or more items selected uses "Agrupar" (or Ctrl+G) THEN those items SHALL form one group, leaving any group they were in.
2. BRD-16: IF any of the selected items is one the person may not move THEN "Agrupar" SHALL be refused with "Sem permissão" and nothing SHALL change.
3. BRD-17: WHEN someone clicks or drags an item of a group THEN every item of the group SHALL be selected and move with it in every window.
4. BRD-18: IF the person may not move every item of the group THEN dragging it SHALL move nothing and show "Sem permissão".
5. BRD-19: WHEN someone with a group selected uses "Desagrupar" (or Ctrl+Shift+G) THEN its items SHALL move alone again, if the person may move every item of it.
6. BRD-20: WHEN the master saves a scene and loads it again THEN the groups SHALL be as saved.
7. BRD-21: WHEN an item of a group is removed THEN the others SHALL stay grouped, and a group left with one item SHALL end.

**Independent Test**: Ana seleciona a Guerreira (dela) e o Cavalo (Livre), usa "Agrupar"; arrasta o Cavalo e a Guerreira vai junto, nas duas janelas.

---

### P1: Mover a vista com o botão direito ⭐ MVP

**User Story**: Como mestre ou jogador, quero mover a vista arrastando com o botão direito.

**Why P1**: Pedido direto.

**Acceptance Criteria**:

1. BRD-22: WHEN someone drags with the right mouse button on the map THEN the view SHALL pan with the pointer, in any tool, and the tool SHALL not act.
2. BRD-23: WHEN someone right-clicks on the map THEN no context menu SHALL open.

**Independent Test**: com a ferramenta de régua ativa, o mestre arrasta com o botão direito: o mapa anda e nenhuma régua aparece.

---

## Edge Cases

- WHEN a box is dragged over items the person may not move (a player and the master's locked door) THEN those SHALL stay out of the selection.
- WHEN a box is dragged over items hidden from a player (fog, hidden token) THEN the player's selection SHALL not include them.
- WHEN a selected item is removed by someone else THEN it SHALL leave the selection.
- WHEN a selection is dragged so the dragged item would leave the map THEN the move SHALL be refused as today ("Fora do mapa") and nothing SHALL move.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| BRD-01 | P1: Encaixe centrado | Design | Pending |
| BRD-02 | P1: Encaixe centrado | Design | Pending |
| BRD-03 | P1: Esconder a grid | Design | Pending |
| BRD-04 | P1: Esconder a grid | Design | Pending |
| BRD-05 | P1: Esconder a grid | Design | Pending |
| BRD-06 | P1: Esconder a grid | Design | Pending |
| BRD-07 | P1: Esconder a grid | Design | Pending |
| BRD-08 | P1: Seleção por área | Design | Pending |
| BRD-09 | P1: Seleção por área | Design | Pending |
| BRD-10 | P1: Seleção por área | Design | Pending |
| BRD-11 | P1: Seleção por área | Design | Pending |
| BRD-12 | P1: Seleção por área | Design | Pending |
| BRD-13 | P1: Seleção por área | Design | Pending |
| BRD-14 | P1: Seleção por área | Design | Pending |
| BRD-15 | P1: Grupos | Design | Pending |
| BRD-16 | P1: Grupos | Design | Pending |
| BRD-17 | P1: Grupos | Design | Pending |
| BRD-18 | P1: Grupos | Design | Pending |
| BRD-19 | P1: Grupos | Design | Pending |
| BRD-20 | P1: Grupos | Design | Pending |
| BRD-21 | P1: Grupos | Design | Pending |
| BRD-22 | P1: Mover a vista com o botão direito | Design | Pending |
| BRD-23 | P1: Mover a vista com o botão direito | Design | Pending |

**Coverage:** 23 total, 0 mapped to tasks, 23 unmapped ⚠️

---

## Sources

- The user's request after v0.8.0 (quoted in Problem Statement) and `.specs/features/board-selection/context.md`
- `.specs/features/tokens-objects/spec.md` ITEM-04, ITEM-08..10, ITEM-13 and `.specs/features/mesa-mvp/spec.md` MAP-08 - selection, snap, rotation and Space panning this changes

---

## Success Criteria

- [ ] Um bando de 6 goblins muda de sala com um arrasto.
- [ ] Personagem e montaria nunca se separam sem querer.
