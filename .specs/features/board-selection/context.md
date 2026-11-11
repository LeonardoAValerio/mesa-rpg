# Board selection Context

**Gathered:** 2026-11-11
**Spec:** `.specs/features/board-selection/spec.md`
**Status:** Ready for tasks

---

## Feature Boundary

Feature F of `.specs/ROADMAP.md`: five board adjustments the user asked for after v0.8.0. user (request): "deixar centralizado os tokens quando são maiores"; "Ter opção de remover a grid (Tem que ser salvo por cena)"; "No mouse ele deve ser possível selecionar uma área e selecionar vários tokens"; "Ter opção de agrupar tokens, onde ao pegar um ele já vai selecionando o outro (A ideia é para fazer por exemplo montarias e etc)"; "Botão direito do mouse podia mover pelo mapa também, como quando clica espaço".

---

## Implementation Decisions

### Centred snap

- A character snaps with its centre on the centre of a cell (1x1, 3x3, 1.5, 2.5...); only even whole sizes (2x2, 4x4) sit on the crossing of the lines, filling whole cells. user: "Centro no centro da célula (Recomendado)".

### Hidden grid

- "Mostrar grid" in Mapas, kept per scene; with the grid hidden, tokens stay where dropped (no snap). user: "Não, ficam livres (Recomendado)".

### Area selection

- Anyone drags a box on the empty map; only the items the person may move are taken. Dragging one moves them all; Q/E turn each; Delete removes them (master only); Shift+click adds or takes one out. user: "Todos; mover juntos e girar (Recomendado)".

### Groups

- Anyone groups the items they may move (e.g. their character with the mount); grabbing one selects the whole group; the group moves only if the person may move each of its items; kept in the scene. user: "Qualquer um agrupa".

### Right-button pan

- The right button drags the view like Space + drag (the user's own words; no question needed).

### Agent's Discretion

None delegated.

### Declined / Undiscussed Gray Areas → Assumptions

Where "Agrupar" sits, the shortcuts, snapping of a moved selection, the editor with several items, Shift on a hidden grid, and old scenes are low-stakes defaults in the spec's Assumptions table.
