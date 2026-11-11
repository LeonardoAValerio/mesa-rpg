# Mesa RPG — Seleção e grupos no tabuleiro — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - the Design section below
**Status**: Draft
**Approved**: pending
**Build**: `scripts/with-node npm run build`; `scripts/with-node npm run typecheck`; `scripts/with-node npm run lint`
**Run unit**: `scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

---

## Design

- **Rules (`src/core/items.ts`, `src/core/grid.ts`, `src/core/reducer.ts`, pure):**
  - `snapCentre(grid, x, y, wCells, hCells)`: per axis, a size that is an even whole number puts the centre on the nearest grid line; any other size puts it on the centre of the nearest cell (BRD-01).
  - `Grid` gets `visible: boolean` (default `true`); `clampGrid` keeps it; `grid/set` takes it (master only, BRD-07); `map/set` sets it back to `true` (BRD-06). `dropPosition` snaps a character only while the grid is visible, Shift inverting as today (BRD-04).
  - `Token` gets `group: string | null`. New actions: `token/group { ids }` (2+ items, each one the actor may move, or "Sem permissão"; they get a new group id and leave any old group; a group left with one item ends) (BRD-15, BRD-16); `token/ungroup { group }` (the actor may move every member, BRD-19); `token/moveMany { moves: {id, x, y}[] }` (all or nothing: each item movable by the actor and inside the map, or the first refusal) (BRD-10, BRD-17, BRD-18). `token/remove` ends a group left with one item (BRD-21).
  - `.mesa` and `.cena` schemas: `grid.visible` and `token.group` optional, read as `true` and `null` (BRD-05, BRD-06, BRD-20).
- **Renderer:**
  - Grid: `gridLayer` draws nothing while hidden; a "Mostrar grid" switch (`grid-visible`) in the Mapas grid panel sends `grid/set { visible }` (BRD-03).
  - Selection (`src/renderer/board/selection.ts`) holds a list of ids: an outline per item, the resize handle only with one; Shift+click toggles; a click on a grouped item selects the group (BRD-09, BRD-14, BRD-17). Q/E turn each selected item; Delete (master) removes each; Esc or an empty click clears (BRD-11..13). The master's editor shows only with one item.
  - Box (`board.ts`): a left drag on the empty map with the select tool draws a rectangle (`overlayLayer`); on release it selects the items whose centre is inside, that this window sees and the person may move (BRD-08).
  - Drag: the dragged item's container follows the pointer and the other selected ones follow by the same offset; on drop the dragged item lands by the drop rule and the others by the same delta, sent as one `token/moveMany` (BRD-10, BRD-17); a refusal puts them back and shows its reason (BRD-18).
  - Group bar (`src/renderer/ui/group-bar.ts`, `group-bar`): over the top of the map; "Agrupar" (`group`) with 2+ items selected, "Desagrupar" (`ungroup`) when the selection is one group, the message (`group-message`); Ctrl+G and Ctrl+Shift+G (BRD-15, BRD-19).
  - Pan: a right-button drag pans like the middle button; the canvas opens no context menu (BRD-22, BRD-23).
  - Test hooks: `BoardSnapshot.selection` gets `ids`; `grid.visible` is in the snapshot; `board()` already gives tokens with `group` through the view.

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Core rules (`src/core`) | unit | All branches; snap per axis, grid visibility, group/ungroup/moveMany/remove, file compat | `src/core/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer board and UI | e2e | Real Electron windows, real mouse gestures: drops, box, Shift+click, drags, keys, the group bar, right-button pan | `e2e/*.spec.ts` | `scripts/with-node npm run build && scripts/with-node npx playwright test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After a core task | `scripts/with-node npx vitest run` |
| Task e2e | After a UI task: unit plus the e2e files it changed | `scripts/with-node npx vitest run && scripts/with-node npm run build && scripts/with-node npx playwright test <files>` |
| Phase | At the end of each phase | `scripts/with-node npm run build && scripts/with-node npm run typecheck && scripts/with-node npm run lint && scripts/with-node npx vitest run && scripts/with-node npx playwright test` |

Every test is named `[Cn] <REQ-ID> <claim>`. The e2e need the screen unlocked and port 47800 free.

---

## Execution Plan

### Phase 1: Regras

```
T1
```

### Phase 2: Tabuleiro

```
T1 → T2 → T3 → T4 → T5
```

---

## Task Breakdown

### T1: Regras do tabuleiro

**What**: the centred snap, `grid.visible` with the drop rule, `token.group` and the `token/group`, `token/ungroup`, `token/moveMany` actions, the group cleanup on remove, and the file schemas reading old files.
**Where**: `src/core/items.ts`, `src/core/grid.ts`, `src/core/reducer.ts`, `src/core/protocol.ts`, `src/core/types.ts`, `src/core/mesa-file.ts`
**Depends on**: None
**Reuses**: `canMove`, `insideMap` rules of `token/move`
**Requirement**: BRD-01, BRD-04, BRD-06, BRD-07, BRD-15, BRD-16, BRD-18, BRD-19, BRD-21

**Done when**:

- [ ] Unit tests: snap for sizes 1, 1.5, 2, 2.5, 3, 4 and a 1x2 item on each axis, with grid offsets; drop with the grid hidden, with and without Shift; `grid/set` visible by the master and refused for a player; `map/set` shows the grid; group of 2+, refused for an item the actor may not move, regrouping leaves the old group; ungroup refused without permission; moveMany all or nothing (permission, outside the map); remove ends a group of one; old `.mesa`/`.cena` read with the grid visible and no groups
- [ ] Phase gate passes

**Tests**: unit
**Gate**: phase
**Commit**: `feat(core): centred snap, hidden grid and token groups`

---

### T2: Grid escondida e encaixe na tela

**What**: the grid drawn only while visible, the "Mostrar grid" switch, drops (map drag and library) through the new rule.
**Where**: `src/renderer/board/board.ts`, `src/renderer/ui/grid-panel.ts`
**Depends on**: T1
**Reuses**: `dropAt`
**Requirement**: BRD-01, BRD-02, BRD-03, BRD-04, BRD-05, BRD-06, BRD-07

**Done when**:

- [ ] e2e: a 1.5-cell and a 2-cell character dragged and dropped land centred by the rule in both windows; one dragged from the campaign list too; "Mostrar grid" off hides the lines in both windows and a drop stays where it is (Shift snaps); a scene saved hidden comes back hidden (`.cena` and `.mesa`); an old scene and a new map show the grid; a player's `grid/set` is refused
- [ ] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(ui): hide the grid per scene and snap tokens centred`

---

### T3: Seleção por área

**What**: the selection as a list, the box, Shift+click, moving the selection together, Q/E on each, Delete for the master, Esc and empty click, outlines and the editor.
**Where**: `src/renderer/board/selection.ts`, `src/renderer/board/board.ts`, `src/renderer/main.ts`
**Depends on**: T2
**Reuses**: the drag and drop of one item
**Requirement**: BRD-08, BRD-09, BRD-10, BRD-11, BRD-12, BRD-13, BRD-14

**Done when**:

- [ ] e2e: a box selects exactly the movable, visible items whose centre is inside, for master and player; Shift+click adds and removes; dragging one of four moves all by the same offset in both windows; Q/E turn each; Delete removes for the master and nothing for a player; Esc and an empty click clear; each selected item outlined and the editor hidden with several
- [ ] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(board): select several items with a box and move them together`

---

### T4: Grupos

**What**: the group bar with "Agrupar" and "Desagrupar" and the shortcuts, a grouped item selecting its group, group drags and their refusal, groups in saved scenes.
**Where**: `src/renderer/ui/group-bar.ts`, `src/renderer/board/selection.ts`
**Depends on**: T3
**Reuses**: the selection drag
**Requirement**: BRD-15, BRD-16, BRD-17, BRD-18, BRD-19, BRD-20, BRD-21

**Done when**:

- [ ] e2e: Ana groups her character and a free horse and dragging the horse moves both in both windows; grouping a locked item shows "Sem permissão"; a group with a "Só mestre" item does not move for Ana and shows "Sem permissão"; "Desagrupar" and the shortcuts; groups back after saving and loading a scene; removing an item of a pair ends the group
- [ ] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(ui): group tokens so they move together`

---

### T5: Mover a vista com o botão direito

**What**: a right-button drag pans in any tool; no context menu on the map.
**Where**: `src/renderer/board/board.ts`
**Depends on**: T4
**Reuses**: the middle-button pan
**Requirement**: BRD-22, BRD-23

**Done when**:

- [ ] e2e: with the ruler and with the select tool, a right drag moves the camera by the drag and nothing else happens (no ruler, no box, no move); a right click opens no context menu
- [ ] Phase gate passes

**Tests**: e2e
**Gate**: phase
**Commit**: `feat(board): pan the view with the right mouse button`

---

## Checks

**C1** - A dropped character lands centred: on a line for even whole sizes, on a cell centre otherwise (BRD-01, AC 1)
Proof: run e2e | ✓ [C1] BRD-01

**C2** - A character placed from the campaign lists snaps by the same rule (BRD-02, AC 2)
Proof: run e2e | ✓ [C2] BRD-02

**C3** - "Mostrar grid" off hides the lines in every window, on shows them (BRD-03, AC 1)
Proof: run e2e | ✓ [C3] BRD-03

**C4** - With the grid hidden a dropped character stays where dropped; Shift snaps it (BRD-04, AC 2)
Proof: run e2e | ✓ [C4] BRD-04

**C5** - A scene saved with the grid hidden loads hidden, as `.cena` and `.mesa` (BRD-05, AC 3)
Proof: run e2e | ✓ [C5] BRD-05

**C6** - An old scene and a new map show the grid (BRD-06, AC 4)
Proof: run e2e | ✓ [C6] BRD-06

**C7** - A player's change of "Mostrar grid" is refused with "Sem permissão" (BRD-07, AC 5)
Proof: run e2e | ✓ [C7] BRD-07

**C8** - A box selects exactly the items with the centre inside that the person may move (BRD-08, AC 1)
Proof: run e2e | ✓ [C8] BRD-08

**C9** - Shift+click adds an item to the selection or takes it out (BRD-09, AC 2)
Proof: run e2e | ✓ [C9] BRD-09

**C10** - Dragging one selected item moves every selected item by the same offset in every window (BRD-10, AC 3)
Proof: run e2e | ✓ [C10] BRD-10

**C11** - Q/E turn each selected item 15° in every window (BRD-11, AC 4)
Proof: run e2e | ✓ [C11] BRD-11

**C12** - The master's Delete removes the selected items; a player's removes nothing (BRD-12, AC 5)
Proof: run e2e | ✓ [C12] BRD-12

**C13** - An empty click or Esc clears the selection (BRD-13, AC 6)
Proof: run e2e | ✓ [C13] BRD-13

**C14** - Each selected item is outlined and the master's editor hides with several (BRD-14, AC 7)
Proof: run e2e | ✓ [C14] BRD-14

**C15** - "Agrupar" or Ctrl+G groups 2+ selected items, leaving old groups (BRD-15, AC 1)
Proof: run e2e | ✓ [C15] BRD-15

**C16** - Grouping an item the person may not move is refused with "Sem permissão" (BRD-16, AC 2)
Proof: run e2e | ✓ [C16] BRD-16

**C17** - Clicking or dragging a grouped item selects and moves the whole group in every window (BRD-17, AC 3)
Proof: run e2e | ✓ [C17] BRD-17

**C18** - A group with an item the person may not move does not move and shows "Sem permissão" (BRD-18, AC 4)
Proof: run e2e | ✓ [C18] BRD-18

**C19** - "Desagrupar" or Ctrl+Shift+G ungroups when the person may move every member (BRD-19, AC 5)
Proof: run e2e | ✓ [C19] BRD-19

**C20** - Groups come back as saved after a scene is saved and loaded (BRD-20, AC 6)
Proof: run e2e | ✓ [C20] BRD-20

**C21** - Removing an item keeps the rest grouped and ends a group of one (BRD-21, AC 7)
Proof: run unit | ✓ [C21] BRD-21

**C22** - A right-button drag pans in any tool and the tool does not act (BRD-22, AC 1)
Proof: run e2e | ✓ [C22] BRD-22

**C23** - A right click opens no context menu on the map (BRD-23, AC 2)
Proof: run e2e | ✓ [C23] BRD-23

---

## Handoff

**Settled mid-build:** none
**Dispatched:** none
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1
Phase 2:  T1 → T2 → T3 → T4 → T5
```
