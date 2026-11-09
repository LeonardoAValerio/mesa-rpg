# Mesa RPG — Tokens e objetos — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - the Design section below
**Status**: In Progress
**Approved**: 2026-11-09 - user: "Aprovo"
**Build**: `scripts/with-node npm run build`; `scripts/with-node npm run typecheck`; `scripts/with-node npm run lint`
**Run unit**: `scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

---

## Design

- **Model (`src/core/types.ts`):** `Token` becomes `{ id, name, hash, kind: 'character' | 'object', x, y, width, rotation, ring: Faction | null, owner: string | null, hidden, movement: 'free' | 'master' | 'locked' }`. `x, y` is the centre in map pixels; `width` is in cells; the height comes from the image's aspect ratio, which only the renderer knows.
- **Rules (`src/core/items.ts`):** `clampWidth` (0.25..20, step 0.25, ITEM-03), `normalizeRotation` (multiples of 15 in 0..345, ITEM-12), `snapCentre(grid, x, y, wCells, hCells)` putting the left and top edges on grid lines (ITEM-08), `dropPosition(kind, shift, ...)` choosing snap or free (ITEM-08, ITEM-09), `canMove(item, actor)` for Livre / Só mestre / Travado (ITEM-14..16), `fromOldToken` for `.mesa` 1 and 2 (ITEM-20).
- **Protocol and reducer:** `token/place { hash, name, kind, x, y, width, ring }` (master, Movimento Livre, ITEM-19); `token/move { id, x, y }` and `token/rotate { id, rotation }` checked by `canMove`, refusals "Só o mestre move este item" and "Item travado"; `token/update` (name, kind, width, rotation, ring, movement) and hide, show, owner, remove stay master-only with "Sem permissão" (ITEM-18). An object has no ring and no owner. A drop whose centre is outside the map is refused ("Fora do mapa", as TOK-10). The fog hides an item by its centre `(x, y)`.
- **Manifest:** `tipo` (`personagem` / `objeto`), `tamanho` (0.25..20), `faccao` (ring); defaults personagem, 1, no ring (ITEM-11).
- **`.mesa`:** version 3 with the new token fields; versions 1 and 2 convert their tokens (ITEM-20, ITEM-21).
- **Drawing (`src/renderer/board/token-sprite.ts`):** the whole PNG as a sprite anchored at its centre, width `width × cell`, height by the texture's aspect, rotated; a ring only for a character with `ring`; the name under characters only; a square placeholder while the image loads. Two layers: objects, then characters (ITEM-01, 02, 05, 07). The test hook reports each item's drawn bounds, rotation, ring and label from the sprite.
- **Interaction:** drag with the drop rule and Shift; library drop centres the item under the cursor; a refused move or rotation puts it back (ITEM-17); a Travado item does not start a drag. Clicking selects (outline); the master gets the editor and a corner handle that resizes in steps of 0.25 cell (ITEM-04); Q / E rotate the selected item (ITEM-13).
- **Editor:** Nome, Tipo (Personagem / Objeto), Tamanho (células), Rotação (°), Anel (Nenhum / grupo / inimigo / npc / neutro, characters only), Movimento (Livre / Só mestre / Travado), Dono (characters only), Ocultar, Remover.
- **Tests:** the MVP tests that use `col`, `row`, `size`, `faction` or "players move only their own tokens" (PERM-03, PERM-07, TOK-02, TOK-04..07) are rewritten for this model; AD-007 records it.

---

## Test Coverage Matrix

> From the project's matrix - confirm before Execute. Guidelines found: none - strong defaults applied.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Core rules (`src/core`) | unit | All branches; 1:1 to spec ACs; every edge case | `src/core/*.test.ts` | `scripts/with-node npx vitest run` |
| Main services | integration | Real `ws` on a random port | `src/main/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer UI, board, editor | e2e | Real Electron windows, real mouse and keys; what is drawn read from the sprites | `e2e/*.spec.ts` | `scripts/with-node npm run build && scripts/with-node npx playwright test` |

## Gate Check Commands

Faster gates (user: "Sinto que está demorando muito para fazer os testes"): during a task only the tests it touches run; the whole e2e suite runs at the end of each phase and in the final proofs; e2e runs with 3 workers.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After a core task | `scripts/with-node npx vitest run` |
| Task e2e | After a renderer task: unit plus only the e2e files the task changed | `scripts/with-node npx vitest run && scripts/with-node npm run build && scripts/with-node npx playwright test <files>` |
| Phase | At the end of each phase | `scripts/with-node npm run build && scripts/with-node npm run typecheck && scripts/with-node npm run lint && scripts/with-node npx vitest run && scripts/with-node npx playwright test` |

Every test is named `[Cn] <REQ-ID> <claim>`. The e2e need the screen unlocked and port 47800 free.

---

## Execution Plan

### Phase 1: Núcleo

```
T1 → T2 → T3
```

### Phase 2: Mesa

```
T4 → T5 → T6 → T7
```

---

## Task Breakdown

### T1: Modelo de item e regras

**What**: The new `Token` fields and `src/core/items.ts` with `clampWidth`, `normalizeRotation`, `snapCentre`, `dropPosition`, `canMove`, `fromOldToken`; Playwright with 3 workers.
**Where**: `src/core/items.ts`
**Depends on**: None
**Reuses**: `src/core/grid.ts`
**Requirement**: ITEM-03, ITEM-08, ITEM-09, ITEM-12, ITEM-14, ITEM-15, ITEM-16, ITEM-20

**Done when**:

- [x] Unit tests for every rule and edge (clamp below/above/between steps, rotation 360/-15/7, snap with odd/even/fractional widths and an offset grid, Shift both ways, the three Movimento levels for master and player, old 1x1 and 3x3 tokens)
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): items with free position, width, rotation and movement`
**Done**: yes

---

### T2: Ações de item no servidor e manifesto

**What**: `token/place`, `token/move`, `token/rotate`, `token/update` in the protocol and reducer with the Movimento rules, objects without ring or owner, the fog by centre, the manifest's `tipo` and `tamanho`; MVP token, permission and fog tests rewritten for the model.
**Where**: `src/core/reducer.ts`
**Depends on**: T1
**Reuses**: `MASTER_ONLY`, `tokenCovered`
**Requirement**: ITEM-11, ITEM-14, ITEM-15, ITEM-16, ITEM-18, ITEM-19

**Done when**:

- [x] Unit tests: each Movimento level for move and rotate from master and player with the exact messages; a player's edits refused with "Sem permissão"; a new item is Livre; manifest fields and fallbacks
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): anyone moves free items; master-only and locked items`
**Done**: yes

---

### T3: Cena .mesa versão 3

**What**: `.mesa` version 3 with the item fields; versions 1 and 2 convert their tokens.
**Where**: `src/core/mesa-file.ts`
**Depends on**: T2
**Reuses**: `fromOldToken`
**Requirement**: ITEM-20, ITEM-21

**Done when**:

- [x] Unit tests: a version 2 file with a 2x2 token at (3,4) loads as a 2-cell character centred on those cells with its old ring; a save and load keeps every field
- [x] Phase gate passes (the renderer is updated for the new type in this commit only as far as it needs to build)

**Tests**: unit
**Gate**: phase
**Commit**: `feat(core): .mesa version 3 keeps items and reads older tokens`
**Done**: yes

---

### T4: Desenho dos itens

**What**: The whole PNG by aspect ratio, rotation, optional ring, the name under characters only, objects below characters, the placeholder; the test hook reports the drawn bounds.
**Where**: `src/renderer/board/token-sprite.ts`
**Depends on**: None (Phase 1 is done before Phase 2)
**Reuses**: `src/renderer/board/board.ts` `renderTokens`
**Requirement**: ITEM-01, ITEM-02, ITEM-05, ITEM-06, ITEM-07

**Done when**:

- [x] e2e: a 512x768 PNG at width 2 on 100 px cells is drawn 200x300 centred on its position in both windows; ring only when set; name only for characters; an object drawn below a character at the same spot
- [x] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(board): items drawn as the whole PNG, rotated, ring optional`
**Done**: yes

---

### T5: Arrastar, soltar e encaixe

**What**: Drag and drop with the snap rule and Shift, library drop by centre, refused moves put back, no drag on a Travado item.
**Where**: `src/renderer/board/board.ts`
**Depends on**: T4
**Reuses**: `dropPosition`, `src/renderer/ui/library.ts`
**Requirement**: ITEM-08, ITEM-09, ITEM-10, ITEM-14, ITEM-16, ITEM-17

**Done when**:

- [x] e2e: a character dropped between cells snaps, an object stays, Shift inverts both; a library drop centres under the cursor; a player moves a Livre item; a player's move of a "Só mestre" item comes back; nobody drags a Travado item
- [x] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(board): characters snap, objects drop free, Shift inverts`
**Done**: yes

---

### T6: Seleção, rotação e redimensionar

**What**: Click to select (outline), Q / E rotate the selected item when allowed, the master's corner handle resizes in steps of 0.25 cell.
**Where**: `src/renderer/board/selection.ts`
**Depends on**: T5
**Reuses**: `canMove`, `clampWidth`
**Requirement**: ITEM-04, ITEM-13

**Done when**:

- [ ] e2e: E and Q rotate 15° both ways in both windows; a player rotates a Livre item but not a "Só mestre" one; dragging the handle by 1.3 cells makes the width grow by 1.25 and keeps the aspect
- [ ] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(board): select, rotate with Q and E, resize with the corner handle`

---

### T7: Editor de item

**What**: The editor fields Nome, Tipo, Tamanho, Rotação, Anel, Movimento, Dono, Ocultar, Remover.
**Where**: `src/renderer/ui/token-editor.ts`
**Depends on**: T6
**Reuses**: the current editor
**Requirement**: ITEM-03, ITEM-06, ITEM-12, ITEM-15, ITEM-16

**Done when**:

- [ ] e2e: each field changes the item in both windows; Tamanho and Rotação clamp; Anel and Dono are absent for objects
- [ ] Phase gate passes

**Tests**: e2e
**Gate**: phase
**Commit**: `feat(ui): item editor with kind, size, rotation, ring and movement`

---

## Checks

**C1** - Each item is the whole PNG, width = size × cell, height by the PNG's aspect, centred on its position, in every window (ITEM-01, AC 1)
Proof: run e2e | ✓ [C1] ITEM-01

**C2** - A ring only on a character with a ring set; no ring or frame otherwise (ITEM-02, AC 2)
Proof: run e2e | ✓ [C2] ITEM-02

**C3** - Tamanho accepts 0.25 to 20 in steps of 0.25 and clamps the rest, shown in every window (ITEM-03, AC 3)
Proof: run e2e | ✓ [C3] ITEM-03

**C4** - The corner handle resizes in steps of 0.25 cell keeping the aspect (ITEM-04, AC 4)
Proof: run e2e | ✓ [C4] ITEM-04

**C5** - A character shows its name, an object shows none (ITEM-05, AC 5)
Proof: run e2e | ✓ [C5] ITEM-05

**C6** - Tipo in the editor switches an item between Objeto and Personagem in every window (ITEM-06, AC 1)
Proof: run e2e | ✓ [C6] ITEM-06

**C7** - Objects are drawn below characters (ITEM-07, AC 2)
Proof: run e2e | ✓ [C7] ITEM-07

**C8** - A dropped character snaps its left and top edges to grid lines; a dropped object stays where it was dropped (ITEM-08, AC 3)
Proof: run e2e | ✓ [C8] ITEM-08

**C9** - Shift at the drop inverts the snap (ITEM-09, AC 4)
Proof: run e2e | ✓ [C9] ITEM-09

**C10** - A library drop puts the item's centre under the cursor, snapping a character (ITEM-10, AC 5)
Proof: run e2e | ✓ [C10] ITEM-10

**C11** - The manifest's `tipo`, `tamanho` and `faccao` set kind, width and ring, with fallbacks (ITEM-11, AC 6)
Proof: run unit | ✓ [C11] ITEM-11

**C12** - Rotação accepts multiples of 15 from 0 to 345 and rounds the rest (ITEM-12, AC 1)
Proof: run unit | ✓ [C12] ITEM-12

**C13** - E and Q rotate the selected item 15° in every window (ITEM-13, AC 2)
Proof: run e2e | ✓ [C13] ITEM-13

**C14** - Any player who sees a Livre item moves and rotates it (ITEM-14, AC 1)
Proof: run unit | ✓ [C14] ITEM-14

**C15** - A "Só mestre" item: only the master moves or rotates it; a player gets "Só o mestre move este item" (ITEM-15, AC 2)
Proof: run unit | ✓ [C15] ITEM-15

**C16** - A Travado item: every move or rotation is refused with "Item travado", the master's too, and no drag starts (ITEM-16, AC 3)
Proof: run unit | ✓ [C16] ITEM-16

**C17** - A refused move or rotation puts the item back (ITEM-17, AC 4)
Proof: run e2e | ✓ [C17] ITEM-17

**C18** - A player's edit other than move or rotate is refused with "Sem permissão" (ITEM-18, AC 5)
Proof: run unit | ✓ [C18] ITEM-18

**C19** - A newly placed item is Livre (ITEM-19, AC 6)
Proof: run unit | ✓ [C19] ITEM-19

**C20** - A version 1 or 2 `.mesa` loads its tokens as characters in the same place, size and ring, Livre (ITEM-20, AC 1)
Proof: run unit | ✓ [C20] ITEM-20

**C21** - Save and load keep every item field (ITEM-21, AC 2)
Proof: run unit | ✓ [C21] ITEM-21

---

## Handoff

**Settled mid-build:** faster gates and e2e with 3 workers - user asked "precisamos testar tanto para cada implementação? (...) Sinto que está demorando muito para fazer os testes", approved with the tasks: "Aprovo"; author mutation checks only on core rules, the Verifier does the rest. T2 and T3 go in one commit: switching `Token` to the item shape breaks the reducer, `.mesa` and tests together. Their gate was unit (140) + build + src lint; the e2e (12 type errors in token specs) are rewritten in T4-T7, so the full phase gate moves to the end of Phase 2.
**Dispatched:** none
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1 → T2 → T3
Phase 2:  T4 → T5 → T6 → T7
```
