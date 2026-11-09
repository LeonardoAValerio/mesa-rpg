# Tokens e objetos — Context

**Gathered:** 2026-11-09
**Spec:** `.specs/features/tokens-objects/spec.md`

## Feature Boundary

Feature B of `.specs/ROADMAP.md`: tokens drawn as the PNG at its natural aspect ratio, sized by the grid, with no frame unless a ring is chosen; a new kind "Objeto" for chests, items and doors; rotation; who may move what.

## Implementation Decisions

### From the roadmap (already decided)

- PNG at its natural size and aspect ratio, scaled by the grid; no frame by default; the faction ring is an option per token; objects never have a ring. user: "PNG puro, anel opcional (Recomendado)".
- user (request): "os tokens que você colocou ali de serem 'neutros', não sei se é muito interessante, as vezes eu vou querer colocar um token como um item no chão, um báu, etc."; "os tokens eles estão colocando uma borda e achatando o elemento, mas na verdade acho que deve ser do tamanho do PNG ou fazer alguma escala".

### Size

- A width in cells, 0.25 to 20 in steps of 0.25; the height follows the PNG's aspect ratio; characters and objects start at 1 cell; set in the editor or by dragging a corner handle. user: "Largura em células (Recomendado)".

### Snap

- A character snaps to the grid when dropped; an object stays where it is dropped; Shift held on release inverts that. user: "Personagem encaixa, objeto livre (Recomendado)".

### Rotation

- In steps of 15°, a "Rotação" field in the editor and the keys Q and E on the selected item; characters and objects. user: "Sim, em passos de 15° (Recomendado)".

### Who moves what

- user: "Acho que qualquer um pode mover objetos e tokens na verdade, daí podiamos configurar apenas para dar lock, ou colocar o bloqueio de mestre, que daí uma configuração extra. Oque acha? Daí deixamos que todos podem mexer tudo e só colocamos restrições por cima".
- Agent's reading, proposed in the spec for approval: each item has "Movimento": Livre (default, anyone who sees it moves and rotates it), Só mestre, Travado (nobody drags it, the master included, until the master unlocks it). This replaces PERM-07 of the MVP (players move only their own tokens).

## Deferred Ideas

- None new.
