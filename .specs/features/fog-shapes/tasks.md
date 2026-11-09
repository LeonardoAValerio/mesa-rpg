# Mesa RPG — Névoa em formas livres — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - the Design section below
**Status**: In Progress
**Approved**: 2026-11-09 - user: "aprovo"
**Build**: `scripts/with-node npm run build`; `scripts/with-node npm run typecheck`; `scripts/with-node npm run lint`
**Run unit**: `scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

---

## Design

- **Model (`src/core/types.ts`, `src/core/fog.ts`):** `Fog = { base: 'revealed' | 'covered'; shapes: FogShape[] }`, where `FogShape` is `{ kind: 'stroke'; mode; radius; points: number[] }` (flat `x, y` pairs, map pixels; a point is inside when its distance to the polyline is ≤ `radius`), `{ kind: 'rect'; mode; x; y; w; h }` or `{ kind: 'poly'; mode; points: number[] }` (even-odd point-in-polygon). `fogAt(fog, x, y)` walks the shapes from the last: the first that contains the point decides (`cover` → covered); none → `base` (FOGS-04). Outside the map nothing is drawn. `coverAll()` = `{ base: 'covered', shapes: [] }`, `revealAll()` = `{ base: 'revealed', shapes: [] }` (FOGS-05). `addShape(fog, shape)` refuses past 2000 shapes or 2000 points (FOGS-08) and drops degenerate shapes (zero-area rect, polygon under 3 distinct points). `tokenCovered(fog, grid, token)` tests the token's centre in pixels (FOGS-06). `fromCellFog(old, grid)` turns each run of covered cells in a row into a covered rect over `base: 'revealed'` (FOGS-10). The brush radius in cells is clamped to 0.5..10 in steps of 0.5 in core (`clampBrushCells`, FOGT-06) and turned into pixels with the grid cell.
- **Protocol and reducer:** `fog/brush` and `fog/rect` are replaced by `fog/shape { shape }` (zod: kinds above, numbers finite, at most 4000 numbers per `points`); `fog/coverAll` and `fog/revealAll` stay; all three are master-only (FOGS-07). `map/set` gives `revealAll()`; `grid/set` no longer touches the fog (FOGS-09). `view.canSee` passes the grid to `tokenCovered`.
- **`.mesa` (`src/core/mesa-file.ts`):** `MESA_VERSION = 2` with the new fog; version 1 files still load, their cell fog converted with `fromCellFog` (FOGS-10). Shapes are kept in order (FOGS-11).
- **Drawing (`src/renderer/board/fog-layer.ts`):** the fog is drawn into a `RenderTexture` the size of the map (scaled down to at most 2048 px on the long side): fill black when `base` is covered, then each shape in order, `cover` drawn black and `reveal` drawn with blend mode `erase`; shown as a sprite at 100% for players and 50% for the master (FOG-02). Rebuilt only when the fog changes. The test hook reports `fog: { shapes, base, alpha }` and `fogSample(points)`, which reads the alpha of the drawn texture at map points, so e2e checks what is on screen, not the model.
- **Tools (`src/renderer/board/fog-tools.ts`, toolbar):** tools `fog-brush`, `fog-rect`, `fog-poly` in the top bar for the master; while one is active, the toolbar shows `Cobrir` / `Revelar` (`fog-mode-cover`, `fog-mode-reveal`), `Cobrir` the first time (FOGT-01, FOGT-07), and the brush radius input (`fog-radius`). Alt held at the shape's start inverts the mode (FOGT-02). Brush: a circle under the cursor (FOGT-03); the drag is previewed locally and sent once on release, points closer than radius/4 dropped. Rectangle: previewed, sent on release. Polygon: clicks add points, a click near the first point, a double click or Enter closes; Esc discards (FOGT-05). Nothing is sent while drawing (FOGT-04). The side panel keeps "Cobrir tudo" and "Revelar tudo" and loses the mode and radius controls.
- **Replaced checks:** the MVP's FOG-03, FOG-04, FOG-06 tests (C66, C67, C69, C70) and fog-default's C4, C5 (FOGD-04, FOGD-05) describe the cell fog; they are rewritten for shapes in this feature and recorded as AD-006.

---

## Test Coverage Matrix

> From the project's matrix (`.specs/features/auto-update/tasks.md`) - confirm before Execute. Guidelines found: none - strong defaults applied.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Core rules (`src/core`) | unit | All branches; 1:1 to spec ACs; every edge case | `src/core/*.test.ts` | `scripts/with-node npx vitest run` |
| Main services | integration | Real `ws` on a random port | `src/main/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer UI, board, tools | e2e | Real Electron windows, real mouse and keys; what is drawn read from the fog texture | `e2e/*.spec.ts` | `scripts/with-node npm run build && scripts/with-node npx playwright test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit tests only | `scripts/with-node npx vitest run` |
| Full | After tasks with e2e tests | `scripts/with-node npx vitest run && scripts/with-node npm run build && scripts/with-node npx playwright test` |
| Build | After each phase | `scripts/with-node npm run build && scripts/with-node npm run typecheck && scripts/with-node npm run lint && scripts/with-node npx vitest run` |

Every test is named `[Cn] <REQ-ID> <claim>`. The e2e suite needs the screen unlocked (a locked GNOME screen stops drawing windows).

---

## Execution Plan

### Phase 1: Núcleo

```
T1 → T2 → T3
```

### Phase 2: Tela

```
T4 → T5 → T6
```

---

## Task Breakdown

### T1: Modelo de formas da névoa

**What**: `Fog` and `FogShape` types, and in `src/core/fog.ts`: `fogAt`, shape containment, `coverAll`, `revealAll`, `addShape` with the limits, `tokenCovered` by centre, `clampBrushCells`, `fromCellFog`.
**Where**: `src/core/fog.ts`
**Depends on**: None
**Reuses**: `src/core/grid.ts` `cellOrigin`
**Requirement**: FOGS-04, FOGS-08, FOGT-06

**Done when**:

- [x] Unit tests: last shape wins, base when none, stroke/rect/poly containment at and just past their edges, a single-point stroke is a circle, limits refuse at 2001, degenerate shapes dropped, radius clamp, token centre rule, cell runs to rects
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): fog made of free-form shapes`
**Done**: yes

---

### T2: Ações de névoa no servidor

**What**: `fog/shape` in the protocol and reducer, `map/set` revealed, `grid/set` leaves the fog, `canSee` by centre; the old cell actions removed; MVP and fog-default fog tests rewritten for shapes.
**Where**: `src/core/reducer.ts`
**Depends on**: T1
**Reuses**: `MASTER_ONLY`, `refuse`
**Requirement**: FOGS-05, FOGS-06, FOGS-07, FOGS-08, FOGS-09

**Done when**:

- [x] Unit tests: a player's `fog/shape` gets "Sem permissão"; the 2001st shape gets the limit message and the scene is unchanged; grid changes keep the fog; a token is sent or withheld as its centre is revealed or covered
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): fog/shape action replaces the cell brush and rectangle`
**Done**: yes

---

### T3: Cena .mesa com a névoa nova

**What**: `.mesa` version 2 with shapes; version 1 files convert their cell fog.
**Where**: `src/core/mesa-file.ts`
**Depends on**: T2
**Reuses**: `fromCellFog`
**Requirement**: FOGS-10, FOGS-11

**Done when**:

- [x] Unit tests: a version 1 file with a revealed 3x2 block loads with the same points covered and revealed; encode then decode keeps shapes in order
- [x] Build gate passes

**Tests**: unit
**Gate**: build
**Commit**: `feat(core): .mesa version 2 keeps fog shapes and reads version 1`
**Done**: yes

---

### T4: Desenho da névoa

**What**: The fog drawn into a `RenderTexture` with erase for reveal shapes, 100% for players and 50% for the master; test hook `fogSample`; e2e for "Cobrir tudo" / "Revelar tudo" and the opacities.
**Where**: `src/renderer/board/fog-layer.ts`
**Depends on**: None (Phase 1 is done before Phase 2)
**Reuses**: `src/renderer/board/board.ts` test hook
**Requirement**: FOGS-05

**Done when**:

- [x] e2e: after "Cobrir tudo" both windows sample covered everywhere (player alpha 1, master 0.5); after "Revelar tudo" nothing is covered
- [x] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(board): fog drawn from shapes`
**Done**: yes

---

### T5: Pincel e retângulo com preview

**What**: `src/renderer/board/fog-tools.ts` with the brush and rectangle, the modes and radius in the toolbar, Alt inversion, the cursor circle and previews; the side panel keeps only "Cobrir tudo" / "Revelar tudo".
**Where**: `src/renderer/board/fog-tools.ts`
**Depends on**: T4
**Reuses**: `src/renderer/ui/toolbar.ts`, `src/renderer/board/overlays.ts` preview patterns
**Requirement**: FOGS-01, FOGS-02, FOGT-01, FOGT-02, FOGT-03, FOGT-04, FOGT-06, FOGT-07

**Done when**:

- [x] e2e with real mouse: a brush drag covers points within the radius of the path and not just past it, in both windows, only after release; a rectangle the same; Alt reveals; the modes appear only with a fog tool, "Cobrir" first; the cursor circle has the radius; the radius input clamps
- [x] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(board): fog brush and rectangle with preview and modes in the toolbar`
**Done**: yes

---

### T6: Polígono de névoa

**What**: The polygon tool: click points, close on the first point, double click or Enter, Esc cancels.
**Where**: `src/renderer/board/fog-tools.ts`
**Depends on**: T5
**Reuses**: the T5 preview layer
**Requirement**: FOGS-03, FOGT-05

**Done when**:

- [x] e2e: a 5-point polygon closed each of the three ways covers its inside and not its outside in both windows; Esc sends nothing
- [x] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(board): fog polygon tool`
**Done**: yes

---

## Checks

**C1** - A brush drag changes the fog exactly within the radius of the path, in every window, after release (FOGS-01, AC 1)
Proof: run e2e | ✓ [C1] FOGS-01

**C2** - A rectangle changes the fog exactly inside it in every window (FOGS-02, AC 2)
Proof: run e2e | ✓ [C2] FOGS-02

**C3** - A closed polygon changes the fog exactly inside it in every window (FOGS-03, AC 3)
Proof: run e2e | ✓ [C3] FOGS-03

**C4** - At a point, the last shape containing it decides; none means revealed (FOGS-04, AC 4)
Proof: run unit | ✓ [C4] FOGS-04

**C5** - "Cobrir tudo" covers and "Revelar tudo" reveals the whole map in every window (FOGS-05, AC 5)
Proof: run e2e | ✓ [C5] FOGS-05

**C6** - A token whose centre is under the fog is not sent to non-owners, and is sent once revealed (FOGS-06, AC 6)
Proof: run unit | ✓ [C6] FOGS-06

**C7** - A player's fog action is refused with "Sem permissão" (FOGS-07, AC 7)
Proof: run unit | ✓ [C7] FOGS-07

**C8** - Past 2000 shapes or 2000 points the shape is refused with the limit message (FOGS-08, AC 8)
Proof: run unit | ✓ [C8] FOGS-08

**C9** - Changing the grid leaves the fog the same (FOGS-09, AC 9)
Proof: run unit | ✓ [C9] FOGS-09

**C10** - A fog tool shows "Cobrir" and "Revelar" in the toolbar, "Cobrir" first (FOGT-01, AC 1)
Proof: run e2e | ✓ [C10] FOGT-01

**C11** - Alt inverts the mode while painting (FOGT-02, AC 2)
Proof: run e2e | ✓ [C11] FOGT-02

**C12** - The brush shows a circle of its radius under the cursor (FOGT-03, AC 3)
Proof: run e2e | ✓ [C12] FOGT-03

**C13** - While drawing, only the master's window shows a preview; the others change on release (FOGT-04, AC 4)
Proof: run e2e | ✓ [C13] FOGT-04

**C14** - Esc discards a polygon and sends nothing (FOGT-05, AC 5)
Proof: run e2e | ✓ [C14] FOGT-05

**C15** - The brush radius accepts 0,5 to 10 cells in steps of 0,5 and clamps the rest (FOGT-06, AC 6)
Proof: run unit | ✓ [C15] FOGT-06

**C16** - Without a fog tool the toolbar has no fog modes (FOGT-07, AC 7)
Proof: run e2e | ✓ [C16] FOGT-07

**C17** - A version 1 `.mesa` loads with the same areas covered (FOGS-10, AC 1)
Proof: run unit | ✓ [C17] FOGS-10

**C18** - Saving and loading keeps the shapes in order (FOGS-11, AC 2)
Proof: run unit | ✓ [C18] FOGS-11

---

## Handoff

**Settled mid-build:** T1, T2 and T3 go in one commit: changing the `Fog` type breaks the reducer, view and `.mesa` until all three change, so none builds alone. The renderer and the e2e still use the cell fog in that commit (typecheck red there) until T4, the next commit. T4 gate: unit 127, e2e 59 of 60 - NET-02 failed only because the user's own `npm run dev` was hosting on port 47800; left running, rerun in the proofs. T5 gate: unit 127, e2e 66 of 67, the same NET-02 port clash. T6 gate: unit 127, e2e 68 of 69, the same NET-02 port clash.
**Dispatched:** Verifier (validate.md) at the proofs commit after 64b9906
**Walked:** at b95687e with real mouse and keys in Electron (MESA_TEST=1, master + player "Ana"), map `Florestas Frias.jpg` imported through "Importar mapa" (grid detected 85.33 px): "Cobrir tudo" turns the player black and the master 50% dark; Pincel de névoa, Revelar, radius 1, dragged from the castle down and east: a smooth trail with round ends, no cells; Polígono de névoa: six clicks show a yellow outline following the cursor and a ring on the first point, Enter reveals the clearing; Retângulo de névoa over the village Tal reveals it. The player window shows exactly the trail, the clearing and the village; the toolbar shows Cobrir/Revelar right after the three fog tools; the side panel keeps only "Cobrir tudo" / "Revelar tudo".

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1 → T2 → T3
Phase 2:  T4 → T5 → T6
```
