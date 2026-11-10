# Mesa RPG — Painéis encaixáveis — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - the Design section below
**Status**: In Progress
**Approved**: 2026-11-09 - user: "aprovo as tarefas"
**Build**: `scripts/with-node npm run build`; `scripts/with-node npm run typecheck`; `scripts/with-node npm run lint`
**Run unit**: `scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

---

## Design

- **Library:** `dockview` 8.9.0 (devDependency, bundled by Vite; it re-exports `dockview-core`); `createDockview(element, { createComponent, createTabComponent })`; its stylesheet `dockview/dist/styles/dockview.css` is imported as a file, so Vite links it and the CSP stays strict.
- **Layout (`src/renderer/ui/layout.ts`):** the table screen's board area and sidebar become one dockview. The table is the panel `mesa` in a locked group with no tab header (no drop, no close, no float, PANEL-13). The other panels are the existing DOM blocks moved into dockview content elements, never recreated (PANEL-14): `conectados` (players list), `tokens` (library and item editor), `mapas` (scene menu, map and grid panel, fog buttons), `dados`, `chat`. Starting layout (PANEL-01, PANEL-02): `mesa` on the left; on the right `conectados` above a group `tokens · mapas · dados · chat` (players: `dados · chat`), active `mapas` (players: `dados`).
- **Persistence:** on every layout change the layout (`api.toJSON()`) is saved in `localStorage` under `mesa-layout-v1-master` or `mesa-layout-v1-player` (PANEL-11). At start a saved layout is applied with `fromJSON` inside `try`; it is used only if it has `mesa` and only panels of that role, and missing panels of the role are not forced back (the user may have closed them); anything else gives the starting layout (PANEL-12).
- **"Painéis" menu (top bar):** a button opening a list of the role's panels with a mark on the open ones; a click opens a closed panel (in the right-hand group, or a new one there) or closes an open one; "Restaurar layout" clears the saved layout and rebuilds the starting one (PANEL-09, PANEL-10). Floating uses dockview's floating groups (a "Flutuar" button in each group header, and dragging a tab out with Shift as dockview allows) (PANEL-08).
- **Tabs:** a custom tab renderer shows the title, a count badge (`tab-count-<id>`) and a highlight dot (`tab-dot-<id>`).
- **Dados and Chat:** `log-panel.ts` splits into a dice panel (roller + rolls) and a chat panel (messages + input), both reading `client.log` and `client.on('log')` filtered by kind (PANEL-15). A panel not visible (`api.isVisible` false or its tab not active) counts arrivals; becoming visible clears the count; shown as 1..9 or "9+" (PANEL-16, PANEL-17).
- **Tokens dot:** the master's selection (board `onSelect`) sets the dot on `tokens` when it is not visible; becoming visible or the selection clearing removes it (PANEL-18, PANEL-19).
- **Test hook:** `window.__mesaTest.layout()` reports the groups in order with their panel ids, active panel, floating flag and size, and which panels are visible; badges and dots are read from the DOM.
- **e2e helpers:** `launch({ userData })` reuses a profile so a layout saved in one session is read in the next; profiles are still removed at the end.

---

## Test Coverage Matrix

> From the project's matrix - confirm before Execute. Guidelines found: none - strong defaults applied.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Renderer UI, layout, panels | e2e | Real Electron windows, real mouse drags on the dockview; every criterion, in master and player windows | `e2e/*.spec.ts` | `scripts/with-node npm run build && scripts/with-node npx playwright test` |
| Core rules (`src/core`) | unit | unchanged by this feature | `src/core/*.test.ts` | `scripts/with-node npx vitest run` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Task e2e | After each task: unit plus only the e2e files the task changed | `scripts/with-node npx vitest run && scripts/with-node npm run build && scripts/with-node npx playwright test <files>` |
| Phase | At the end of each phase | `scripts/with-node npm run build && scripts/with-node npm run typecheck && scripts/with-node npm run lint && scripts/with-node npx vitest run && scripts/with-node npx playwright test` |

Every test is named `[Cn] <REQ-ID> <claim>`. The e2e need the screen unlocked and port 47800 free.

---

## Execution Plan

### Phase 1: Painéis

```
T1 → T2
```

### Phase 2: Dados, Chat e Tokens

```
T3 → T4
```

---

## Task Breakdown

### T1: Layout com painéis

**What**: `dockview` and `src/renderer/ui/layout.ts`: the table as a locked headerless panel, the existing blocks moved into the panels `conectados`, `tokens`, `mapas`, `dados`/`chat` (still the joint log until T3), the starting layout for master and player, the test hook `layout()`.
**Where**: `src/renderer/ui/layout.ts`
**Depends on**: None
**Reuses**: `src/renderer/ui/table-screen.ts`, the existing panels
**Requirement**: PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-05, PANEL-13

**Done when**:

- [x] e2e: master and player starting layouts with the exact tabs and active panel; clicking each tab shows its panel; Tokens and Mapas hold their controls; the table has no tab and cannot be dragged
- [x] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(ui): docking panels around the table`
**Done**: yes

---

### T2: Organizar, salvar e restaurar

**What**: drag and split, resize, float, close and reopen through "Painéis", "Restaurar layout", the layout saved per role and the fallback; `launch({ userData })`.
**Where**: `src/renderer/ui/layout.ts`
**Depends on**: T1
**Reuses**: dockview `toJSON` / `fromJSON`
**Requirement**: PANEL-06, PANEL-07, PANEL-08, PANEL-09, PANEL-10, PANEL-11, PANEL-12, PANEL-14

**Done when**:

- [x] e2e with real drags: a tab onto another group and onto a group's edge; a divider resizes and the board canvas follows; a group floats over the table; close and reopen; restore; the layout comes back in a second session with the same profile; a broken saved layout gives the starting one; typed text survives moves
- [x] Phase gate passes

**Tests**: e2e
**Gate**: phase
**Commit**: `feat(ui): arrange, float, close and restore panels, saved per computer`
**Done**: yes

---

### T3: Dados e Chat separados

**What**: the dice panel and the chat panel from the joint log, with the counts on their tabs.
**Where**: `src/renderer/ui/log-panel.ts`
**Depends on**: None (Phase 1 is done before Phase 2)
**Reuses**: `client.log`, the tab renderer from T1
**Requirement**: PANEL-15, PANEL-16, PANEL-17

**Done when**:

- [x] e2e: rolls only in Dados and messages only in Chat; counts 1, 2 ... "9+" while hidden, cleared when shown, in the master's and the player's windows
- [x] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(ui): dice and chat in their own panels with unread counts`
**Done**: yes

---

### T4: Ponto em Tokens

**What**: the highlight dot on the Tokens tab when the master selects an item while Tokens is not visible.
**Where**: `src/renderer/ui/layout.ts`
**Depends on**: T3
**Reuses**: board `onSelect`, the tab renderer
**Requirement**: PANEL-18, PANEL-19

**Done when**:

- [x] e2e: selecting with Chat visible keeps Chat and dots Tokens; opening Tokens clears it and shows the item's editor; clearing the selection first clears it
- [x] Phase gate passes

**Tests**: e2e
**Gate**: phase
**Commit**: `feat(ui): selecting an item dots the Tokens tab`
**Done**: yes

---

## Checks

**C1** - The master starts with the table in the centre and, on its right, Conectados above Tokens · Mapas · Dados · Chat with Mapas open (PANEL-01, AC 1)
Proof: run e2e | ✓ [C1] PANEL-01

**C2** - A player starts with Conectados above Dados · Chat with Dados open, and no Tokens or Mapas (PANEL-02, AC 2)
Proof: run e2e | ✓ [C2] PANEL-02

**C3** - Clicking a tab shows that panel and marks the tab active (PANEL-03, AC 3)
Proof: run e2e | ✓ [C3] PANEL-03

**C4** - Tokens holds the token import, palette, library and the item editor (PANEL-04, AC 4)
Proof: run e2e | ✓ [C4] PANEL-04

**C5** - Mapas holds Salvar cena, Carregar cena, Importar mapa, the grid settings, Cobrir tudo and Revelar tudo (PANEL-05, AC 5)
Proof: run e2e | ✓ [C5] PANEL-05

**C6** - A tab dropped on another group moves there; dropped on a group's edge it splits the group (PANEL-06, AC 1)
Proof: run e2e | ✓ [C6] PANEL-06

**C7** - Dragging a divider resizes both sides and the table fits the new space (PANEL-07, AC 2)
Proof: run e2e | ✓ [C7] PANEL-07

**C8** - A floated group shows over the table and can be moved, and the table uses the freed space (PANEL-08, AC 3)
Proof: run e2e | ✓ [C8] PANEL-08

**C9** - A closed panel leaves the screen and shows unmarked in "Painéis"; picking it reopens it (PANEL-09, AC 4)
Proof: run e2e | ✓ [C9] PANEL-09

**C10** - "Restaurar layout" brings back the starting layout (PANEL-10, AC 5)
Proof: run e2e | ✓ [C10] PANEL-10

**C11** - The layout is saved per role on the computer and comes back at the next table (PANEL-11, AC 6)
Proof: run e2e | ✓ [C11] PANEL-11

**C12** - An unreadable saved layout gives the starting layout (PANEL-12, AC 7)
Proof: run e2e | ✓ [C12] PANEL-12

**C13** - The table stays in the centre and cannot be closed, moved or floated (PANEL-13, AC 8)
Proof: run e2e | ✓ [C13] PANEL-13

**C14** - Text typed in a panel survives moving, floating, closing and reopening it (PANEL-14, AC 9)
Proof: run e2e | ✓ [C14] PANEL-14

**C15** - Dados holds the roller and only rolls; Chat holds only messages and the input (PANEL-15, AC 1)
Proof: run e2e | ✓ [C15] PANEL-15

**C16** - A hidden Dados or Chat tab shows how many entries arrived, up to "9+" (PANEL-16, AC 2)
Proof: run e2e | ✓ [C16] PANEL-16

**C17** - Showing the panel clears its count (PANEL-17, AC 3)
Proof: run e2e | ✓ [C17] PANEL-17

**C18** - Selecting an item with Tokens hidden keeps the visible panels and dots the Tokens tab (PANEL-18, AC 1)
Proof: run e2e | ✓ [C18] PANEL-18

**C19** - Showing Tokens clears the dot and shows the item's editor; clearing the selection first clears it (PANEL-19, AC 2)
Proof: run e2e | ✓ [C19] PANEL-19

---

## Handoff

**Settled mid-build:** dockview only uses the custom tab renderer through `defaultTabComponent`, and passes the panel in `init`; the e2e that use controls in a closed panel first open it with `showPanel` (tokens, library, log, offline). Found in T2: at 300 px the fourth tab sat under dockview's overflow button (unreachable): the right column starts at 340 px with compact tabs, with a test; floated groups cascaded (they used to open on top of each other); dockview's HTML5 drags need human-paced moves in tests (`humanMove`), and the default DnD strategy is kept (with `dndStrategy: 'pointer'` the floating move lost its pointer capture). Phase 1 gate: unit 142, e2e 103. Phase 2 gate: unit 142, e2e 108.
**Dispatched:** Verifier (validate.md) at 417f9de; returned FAIL with F1-F4 (tests only), closed by 614de85
**Walked:** at 1902434 in Electron (MESA_TEST=1, a hosted table, `Florestas Frias.jpg` imported from the Mapas panel): the starting layout shows the map left and, on the right, Conectados above Tokens · Mapas · Dados · Chat on Mapas; dragging Chat to the right part of its group made a new group; "⇱" on Tokens floated Tokens with Dados over the table; × on Mapas closed it; the app was closed and a new table hosted with the same profile showed the same arrangement (Tokens and Dados floating, Chat on the right, Mapas closed) and the board's own "Importar mapa" with Mapas closed.

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1 → T2
Phase 2:  T3 → T4
```
