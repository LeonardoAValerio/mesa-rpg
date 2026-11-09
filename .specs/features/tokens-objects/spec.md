# Mesa RPG — Tokens e objetos

## Problem Statement

Todo token é recortado num círculo de 1×1, 2×2 ou 3×3 células com um anel de facção, então o PNG do kit aparece achatado e com borda, e não há como pôr na mesa um baú, um item no chão ou uma porta. user: "os tokens eles estão colocando uma borda e achatando o elemento, mas na verdade acho que deve ser do tamanho do PNG ou fazer alguma escala"; "as vezes eu vou querer colocar um token como um item no chão, um báu, etc.". Além disso só o dono move um token, e o usuário quer que todos movam tudo, com restrições por item.

## Goals

- [ ] Um PNG do kit aparece na mesa inteiro, na proporção original, sem círculo nem borda.
- [ ] O mestre põe um baú e uma porta como objetos, gira a porta e trava o baú no lugar.
- [ ] Qualquer jogador move os itens livres, e nenhum jogador move um item "Só mestre" ou "Travado".

## Out of Scope

| Feature | Reason |
| --- | --- |
| Abas, pasta da campanha, sons | Features C, D, E do `.specs/ROADMAP.md` |
| Anexar um item a outro (montaria, item carregado) | Não pedido; pode vir depois |
| Camadas além de "objeto abaixo, personagem acima" | Duas camadas cobrem o pedido |
| Rotação livre (qualquer ângulo) e rotação arrastando | Passos de 15° escolhidos |
| Animações, barras de vida, condições | Fora do roadmap |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Aparência | O PNG inteiro, na proporção dele, sem recorte; sem anel por padrão; o anel de facção é opcional por personagem; objeto nunca tem anel | user: "PNG puro, anel opcional (Recomendado)" | y |
| Tamanho | Largura em células, de 0,25 a 20 em passos de 0,25; a altura segue a proporção do PNG; começa em 1 célula; muda no editor ou arrastando a alça do canto | user: "Largura em células (Recomendado)" | y |
| Encaixe | Personagem encaixa ao soltar (a borda esquerda e a de cima numa linha do grid); objeto fica onde foi solto; Shift ao soltar inverte | user: "Personagem encaixa, objeto livre (Recomendado)" | y |
| Rotação | Passos de 15°, de 0° a 345°; campo "Rotação" no editor e teclas Q (anti-horário) e E (horário) no item selecionado | user: "Sim, em passos de 15° (Recomendado)" | y |
| Quem move | Cada item tem "Movimento": **Livre** (padrão: quem vê o item move e gira), **Só mestre** (só o mestre move e gira) ou **Travado** (ninguém arrasta nem gira, nem o mestre, até o mestre destravar no editor); substitui PERM-03 e PERM-07 do MVP | user: "deixamos que todos podem mexer tudo e só colocamos restrições por cima"; a forma dos três níveis é a proposta do agente | n |
| O que o jogador edita | Só move e gira (respeitando "Movimento"); nome, tamanho, anel, tipo, movimento, ocultar e remover são do mestre | O pedido fala em mover; editar o item é do mestre | n |
| Dono | Continua existindo só para personagens: o dono vê o próprio personagem sob a névoa e o nome dele aparece para o mestre; não dá permissão extra | Com todos movendo, o dono serve à névoa | n |
| Objetos | Desenhados abaixo dos personagens; sem nome na mesa (o nome aparece no editor); sem dono; a névoa os esconde pela mesma regra do centro; o mestre pode ocultá-los | Baú, porta e item no chão ficam sob os personagens | n |
| Personagem na mesa | O nome aparece abaixo da imagem, como hoje | Mantém o que já funciona | n |
| Importar pasta | Cada PNG vira personagem; o manifesto ganha `tipo` (`personagem` ou `objeto`); `tamanho` passa a ser a largura em células (0,25 a 20); `faccao` liga o anel daquela facção; sem manifesto: personagem, 1 célula, sem anel | Mantém o kit do Blender funcionando e permite objetos pelo manifesto | n |
| Arrastar da biblioteca | O item cai com o centro sob o cursor; personagem encaixa (Shift solta livre) | Igual ao soltar um item já na mesa | n |
| Seleção | Clicar num item o seleciona (contorno fino); o mestre vê o editor; um jogador só ganha o contorno e pode usar Q/E | Q/E precisam de um alvo | n |
| Cenas antigas | `.mesa` versão 1 e 2 abrem: cada token vira personagem com o centro no centro das células que ocupava, largura = tamanho antigo, anel = facção antiga, Movimento Livre; a cena passa a salvar na versão 3 | Ninguém perde cena; o visual antigo tinha anel | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: O PNG como ele é ⭐ MVP

**User Story**: Como mestre, quero que cada token apareça como o PNG que eu fiz, inteiro e na proporção certa, para a mesa parecer com o meu kit.

**Why P1**: É a reclamação principal.

**Acceptance Criteria**:

1. ITEM-01: The app SHALL draw each item as its whole PNG, not cropped, with a width of its size in cells times the cell size and a height that keeps the PNG's aspect ratio, centred on the item's position, in every window.
2. ITEM-02: WHERE a character has a ring THEN the app SHALL draw a ring in that faction's colour around it; WHERE it has none, or the item is an object, the app SHALL draw no ring and no frame.
3. ITEM-03: WHEN the master sets the size in the editor THEN the app SHALL accept 0,25 to 20 cells in steps of 0,25, clamp other values into that range, and show the new size in every window.
4. ITEM-04: WHEN the master drags the corner handle of the selected item THEN the app SHALL resize it in steps of 0,25 cell, keeping the aspect ratio, in every window.
5. ITEM-05: The app SHALL show a character's name below it, and SHALL show no name on the table for an object.

**Independent Test**: um PNG de 512×768 com tamanho 2 numa célula de 100 px aparece com 200×300 px, inteiro, sem borda; ligar o anel "inimigo" mostra o anel vermelho.

---

### P1: Objetos e personagens ⭐ MVP

**User Story**: Como mestre, quero colocar baús, itens e portas como objetos, abaixo dos personagens e soltos do grid.

**Why P1**: user: "colocar um token como um item no chão, um báu".

**Acceptance Criteria**:

1. ITEM-06: WHEN the master sets an item's kind to "Objeto" or "Personagem" in the editor THEN the app SHALL draw it as that kind in every window.
2. ITEM-07: The app SHALL draw every object below every character.
3. ITEM-08: WHEN someone drops a character THEN the app SHALL snap its left and top edges to grid lines; WHEN someone drops an object THEN the app SHALL leave it where it was dropped.
4. ITEM-09: WHILE Shift is held at the drop THEN the app SHALL do the opposite: leave a character free, snap an object.
5. ITEM-10: WHEN the master drags an item from the library onto the map THEN the app SHALL place it with its centre under the cursor, snapping a character, in every window.
6. ITEM-11: WHERE a token folder has `<nome>.json` with `tipo` (`personagem` or `objeto`), `tamanho` (0,25 to 20) and `faccao` THEN the app SHALL use them for the kind, the width and the ring; any missing or invalid value SHALL fall back to personagem, 1 cell, no ring.

**Independent Test**: um baú (objeto) solto entre duas células fica ali; um personagem solto no mesmo ponto encaixa; o personagem aparece por cima do baú.

---

### P1: Rotação ⭐ MVP

**User Story**: Como mestre, quero girar uma porta ou uma ponte para encaixar no mapa.

**Why P1**: user: "Sim, em passos de 15° (Recomendado)".

**Acceptance Criteria**:

1. ITEM-12: WHEN the master sets "Rotação" in the editor THEN the app SHALL accept multiples of 15° from 0 to 345, round other values to the nearest multiple of 15 modulo 360, and show the item rotated about its centre in every window.
2. ITEM-13: WHEN someone allowed to move the selected item presses E or Q THEN the app SHALL rotate it 15° clockwise or anticlockwise in every window.

**Independent Test**: uma porta selecionada gira 15° a cada E, e o jogador vê a mesma rotação.

---

### P1: Todos movem, com restrições por item ⭐ MVP

**User Story**: Como grupo, queremos mover qualquer peça como numa mesa de verdade, e como mestre quero travar o que não deve sair do lugar.

**Why P1**: user: "deixamos que todos podem mexer tudo e só colocamos restrições por cima".

**Acceptance Criteria**:

1. ITEM-14: WHILE an item's Movimento is Livre the server SHALL accept a move or a rotation of it from any player who can see it.
2. ITEM-15: WHILE an item's Movimento is "Só mestre" the server SHALL accept a move or a rotation of it only from the master, and SHALL refuse a player's with "Só o mestre move este item".
3. ITEM-16: WHILE an item's Movimento is "Travado" the server SHALL refuse every move or rotation of it, the master's included, with "Item travado", and the app SHALL not start a drag of it.
4. ITEM-17: IF a move or rotation is refused THEN the app SHALL put the item back where it was.
5. ITEM-18: IF a player sends an edit other than a move or a rotation (name, size, ring, kind, Movimento, hide, owner, remove) THEN the server SHALL refuse it with "Sem permissão" and change nothing.
6. ITEM-19: WHEN the master places an item THEN its Movimento SHALL be Livre.

**Independent Test**: Ana move o Goblin livre; o mestre marca o baú como Travado e ninguém o arrasta; marca a porta como "Só mestre" e Ana não a move nem gira.

---

### P2: Cenas antigas continuam abrindo

**User Story**: Como mestre, quero abrir as cenas salvas pela 0.3.0.

**Why P2**: Há poucas cenas, mas nenhuma deve se perder.

**Acceptance Criteria**:

1. ITEM-20: WHEN the master loads a `.mesa` version 1 or 2 THEN the app SHALL show each old token as a character centred on the cells it covered, as wide as its old size, with a ring of its old faction and Movimento Livre.
2. ITEM-21: WHEN the master saves and loads a scene THEN every item SHALL come back with the same kind, position, size, rotation, ring, owner, Movimento and hidden state.

**Independent Test**: uma cena da 0.3.0 com um token 2×2 abre com um personagem de 2 células no mesmo lugar.

---

## Edge Cases

- WHEN an item's image has not loaded yet THEN the app SHALL draw a square placeholder of its width so it can still be selected and moved.
- IF an item is dropped with its centre outside the map THEN the app SHALL put it back where it was (as TOK-10).
- WHEN a player's view loses an item (hidden, under the fog) while they drag it THEN the drag SHALL stop (as TOK-11).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| ITEM-01 | P1: O PNG como ele é | Design | Pending |
| ITEM-02 | P1: O PNG como ele é | Design | Pending |
| ITEM-03 | P1: O PNG como ele é | Design | Pending |
| ITEM-04 | P1: O PNG como ele é | Design | Pending |
| ITEM-05 | P1: O PNG como ele é | Design | Pending |
| ITEM-06 | P1: Objetos e personagens | Design | Pending |
| ITEM-07 | P1: Objetos e personagens | Design | Pending |
| ITEM-08 | P1: Objetos e personagens | Design | Pending |
| ITEM-09 | P1: Objetos e personagens | Design | Pending |
| ITEM-10 | P1: Objetos e personagens | Design | Pending |
| ITEM-11 | P1: Objetos e personagens | Design | Pending |
| ITEM-12 | P1: Rotação | Design | Pending |
| ITEM-13 | P1: Rotação | Design | Pending |
| ITEM-14 | P1: Todos movem, com restrições por item | Design | Pending |
| ITEM-15 | P1: Todos movem, com restrições por item | Design | Pending |
| ITEM-16 | P1: Todos movem, com restrições por item | Design | Pending |
| ITEM-17 | P1: Todos movem, com restrições por item | Design | Pending |
| ITEM-18 | P1: Todos movem, com restrições por item | Design | Pending |
| ITEM-19 | P1: Todos movem, com restrições por item | Design | Pending |
| ITEM-20 | P2: Cenas antigas continuam abrindo | Design | Pending |
| ITEM-21 | P2: Cenas antigas continuam abrindo | Design | Pending |

**Coverage:** 21 total, 0 mapped to tasks, 21 unmapped ⚠️

---

## Sources

- `.specs/ROADMAP.md` - the feature and the decisions taken before it
- `.specs/features/tokens-objects/context.md` - the answers for this feature, in the user's words
- `.specs/features/mesa-mvp/spec.md` TOK-01..12, PERM-01..08 - what this changes (PERM-03, PERM-07, TOK-02, TOK-04..07)

---

## Success Criteria

- [ ] No notebook, os PNGs do kit aparecem inteiros, e o grupo move os personagens sem pedir ao mestre.
