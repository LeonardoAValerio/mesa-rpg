# Mesa RPG — Pasta da campanha — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - the Design section below
**Status**: In Progress
**Approved**: 2026-11-10 - user: "Aprovo"
**Build**: `scripts/with-node npm run build`; `scripts/with-node npm run typecheck`; `scripts/with-node npm run lint`
**Run unit**: `scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

---

## Design

- **Rules (`src/core/campaign.ts`, pure):** `campaignNameError(name, existing)` → `null`, "Nome inválido" or "Campanha já existe" (1..60 chars, none of `\ / : * ? " < > |`, no edge spaces, case-insensitive clash, CAMP-03); the same rule for scene names; `freeName(base, ext, existing)` → `base.ext`, `base (2).ext`... (CAMP-14); the `.cena` format: `{ format: 'mesa-cena', version: 1, scene, files: { [hash]: relPath } }` with `encodeCena`, `decodeCena` (zod, the version 3 scene schema, every scene hash in `files`, paths relative and inside the campaign) and `remapHashes(scene, old→new)` (CAMP-16, CAMP-20).
- **Campaign folder (`src/main/campaign.ts`):** root `join(app.getPath('documents'), 'Mesa RPG')`; under `MESA_TEST`, `MESA_DOCUMENTS` replaces Documents. `listCampaigns`, `createCampaign`, `ensureSubfolders` (the six folders), the last campaign in `userData/settings.json` (CAMP-01..06). `scan(dir)` walks `mapas/`, `tokens/`, `objetos/` recursively, reads each image with the existing `readImageFile` (type and 50 MB rules, CAMP-15), puts the bytes in the `AssetStore` (so drops and players' downloads work as for the library) and returns entries `{ section, path, group, name, hash, kind, width, ring, w, h }` (the `.json` beside a token applies, its `tipo` wins over the folder, CAMP-08). `watch(dir)` uses `fs.watch(dir, { recursive: true })`, debounced 300 ms, and rescans (CAMP-11). `addFiles(section, paths)` copies with `freeName` (CAMP-14). `openFolder` uses `shell.openPath`; under `MESA_TEST` it only records the path (CAMP-07).
- **Scenes (`src/main/scenes.ts`):** `saveCena(name)` builds `files` from the scan's hash → path index; a hash that is not in the campaign (an imported `.mesa`) is first written to `mapas/importados/` or `tokens/importados/` as `importado-<hash8>.<ext>` (CAMP-22); asks to replace an existing name through the renderer (CAMP-17). `loadCena(name)` reads each path: a missing one → "Arquivo não encontrado: <path>" (CAMP-19); a changed one → its new hash, remapped in the scene (CAMP-20). "Exportar .mesa" and "Importar .mesa" are the old save/load handlers (CAMP-21).
- **IPC:** `campaigns()`, `createCampaign(name)`, `host(port, campaign)`, `campaign()` (name and entries, pushed again on every rescan as `mesa:campaign`), `openFolder()`, `addFiles(section)`, `saveCena(name, replace)`, `loadCena(name)`, `listCenas()`, `exportMesa()`, `importMesa()`; the old `importTokens` and the file-dialog `importMap` go (the board's empty-map button adds a map to `mapas/` and loads it).
- **UI:** the start screen's host box gets a campaign list (radio rows, `campaign-<name>`), "Nova campanha" (`new-campaign-name`, `new-campaign`) and "Hospedar" disabled with no campaign (CAMP-01..06). Mapas: the campaign name, "Abrir pasta", the map list, the scene list with "Salvar cena" (name prompt) and "Exportar .mesa" / "Importar .mesa". Tokens: the token and object lists. Lists: groups (`<details>`) titled with the subfolder path, rows with a 48 px thumbnail drawn on a canvas from the asset (the CSP allows no data: or blob: images) and the name; tokens drag as library items did (testids `library-item`, `library-name` kept), maps load on click.
- **Tests:** `e2e/helpers.ts` `launch` sets `MESA_DOCUMENTS` inside the test profile and, unless asked not to, creates a campaign "Teste" there and marks it as the last one, so existing tests that press "Hospedar" keep working; MVP library, map-import and scene tests are rewritten for the campaign.

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Core rules (`src/core`) | unit | All branches; 1:1 to the rules above; edge cases | `src/core/*.test.ts` | `scripts/with-node npx vitest run` |
| Main services (campaign folder, scenes) | integration | Real files in a temp dir, real `fs.watch`; happy + error paths | `src/main/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer UI, IPC | e2e | Real Electron windows; the start screen, the lists, drags, the scene flow | `e2e/*.spec.ts` | `scripts/with-node npm run build && scripts/with-node npx playwright test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After a core or main task | `scripts/with-node npx vitest run` |
| Task e2e | After a UI task: unit plus the e2e files it changed | `scripts/with-node npx vitest run && scripts/with-node npm run build && scripts/with-node npx playwright test <files>` |
| Phase | At the end of each phase | `scripts/with-node npm run build && scripts/with-node npm run typecheck && scripts/with-node npm run lint && scripts/with-node npx vitest run && scripts/with-node npx playwright test` |

Every test is named `[Cn] <REQ-ID> <claim>`. The e2e need the screen unlocked and port 47800 free.

---

## Execution Plan

### Phase 1: Pasta e cenas no main

```
T1 → T2 → T3
```

### Phase 2: Telas

```
T4 → T5 → T6
```

---

## Task Breakdown

### T1: Regras da campanha e formato .cena

**What**: `src/core/campaign.ts` with the name rule, `freeName`, `encodeCena`, `decodeCena`, `remapHashes`.
**Where**: `src/core/campaign.ts`
**Depends on**: None
**Reuses**: the `.mesa` version 3 scene schema
**Requirement**: CAMP-03, CAMP-14, CAMP-16, CAMP-20

**Done when**:

- [x] Unit tests for every rule and edge (60/61 chars, each forbidden character, edge spaces, case clash; `(2)`, `(3)`, no extension; a `.cena` round trip, a missing `files` entry, `..` paths, remap of map and items)
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): campaign names and the .cena scene format`
**Done**: yes

---

### T2: Pasta da campanha no main

**What**: `src/main/campaign.ts`: root, list, create, subfolders, last campaign, scan into the store, watch, add files, open folder.
**Where**: `src/main/campaign.ts`
**Depends on**: T1
**Reuses**: `readImageFile`, `parseManifest`, `AssetStore`
**Requirement**: CAMP-01, CAMP-02, CAMP-05, CAMP-06, CAMP-08, CAMP-09, CAMP-10, CAMP-11, CAMP-14, CAMP-15

**Done when**:

- [x] Integration tests in a temp dir: listing and creating campaigns, the six folders, the last campaign kept and dropped when gone, scan with groups and kinds and the `.json` rule, bad and huge files skipped, a file added by `fs` seen within 2 s, `addFiles` naming
- [x] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(main): the campaign folder, scanned and watched`
**Done**: yes

---

### T3: Cenas da campanha no main

**What**: `src/main/scenes.ts` (save, list, load `.cena`; imported images copied in; missing and changed files) and the IPC handlers for the whole feature, replacing `importTokens` and the file-dialog `importMap`.
**Where**: `src/main/scenes.ts`
**Depends on**: T2
**Reuses**: `encodeMesa`, `decodeMesa`, the table server's `setScene`
**Requirement**: CAMP-16, CAMP-17, CAMP-19, CAMP-20, CAMP-21, CAMP-22

**Done when**:

- [x] Integration tests: save and load round trip; a missing file refused with the message; a changed file loads the new one; an imported `.mesa` saved copies its images into `importados/`
- [x] Phase gate passes (the renderer adapted only as far as it needs to build; the e2e follow in Phase 2)

**Tests**: integration
**Gate**: quick
**Commit**: `feat(main): campaign scenes that point at the folder`
**Done**: yes

---

### T4: Campanha na tela inicial

**What**: the campaign list, "Nova campanha", "Hospedar" disabled with none, the remembered campaign; Mapas shows the name and "Abrir pasta"; `launch` creates the "Teste" campaign.
**Where**: `src/renderer/ui/home.ts`
**Depends on**: None (Phase 1 is done before Phase 2)
**Reuses**: the IPC from T3
**Requirement**: CAMP-01, CAMP-02, CAMP-03, CAMP-04, CAMP-05, CAMP-06, CAMP-07

**Done when**:

- [ ] e2e: an empty Documents shows no campaign and a disabled "Hospedar"; "Nova campanha" creates the six folders and selects it; bad names show the messages; hosting remembers it for the next start; "Abrir pasta" opens the folder
- [ ] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(ui): choose or create the campaign before hosting`

---

### T5: Listas de mapas, tokens e objetos

**What**: the lists in Tokens and Mapas with thumbnails and groups, live updates, drag to the map, click a map, "Adicionar arquivos"; the old library import removed; MVP library and map-import e2e rewritten.
**Where**: `src/renderer/ui/campaign-lists.ts`
**Depends on**: T4
**Reuses**: `src/renderer/ui/library.ts` drop handling, `src/renderer/ui/grid-panel.ts` map loading
**Requirement**: CAMP-08, CAMP-09, CAMP-10, CAMP-11, CAMP-12, CAMP-13, CAMP-14, CAMP-15

**Done when**:

- [ ] e2e: files written into the campaign by the test show in their groups within 2 s and disappear when deleted; thumbnails drawn; an object dragged in is an object; a map clicked loads in both windows; "Adicionar arquivos" copies with `(2)`
- [ ] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(ui): the campaign's maps, tokens and objects in the panels`

---

### T6: Cenas na tela

**What**: "Salvar cena" with a name and the replace question, the scene list that loads with SAVE-05's question, "Exportar .mesa" and "Importar .mesa"; MVP scene e2e rewritten.
**Where**: `src/renderer/ui/scene-menu.ts`
**Depends on**: T5
**Reuses**: the confirm dialog of SAVE-05
**Requirement**: CAMP-16, CAMP-17, CAMP-18, CAMP-19, CAMP-21

**Done when**:

- [ ] e2e: save "Emboscada", change the scene, load it from the list in both windows; replace asked; a deleted token file blocks the load with the message; export and import of `.mesa`
- [ ] Phase gate passes

**Tests**: e2e
**Gate**: phase
**Commit**: `feat(ui): save and open campaign scenes by name`

---

## Checks

**C1** - The start screen lists the folders in `Documentos/Mesa RPG/` as campaigns, creating it when missing (CAMP-01, AC 1)
Proof: run e2e | ✓ [C1] CAMP-01

**C2** - "Nova campanha" creates the campaign with its six folders and selects it (CAMP-02, AC 2)
Proof: run e2e | ✓ [C2] CAMP-02

**C3** - A bad or existing name shows "Nome inválido" or "Campanha já existe" and creates nothing (CAMP-03, AC 3)
Proof: run unit | ✓ [C3] CAMP-03

**C4** - "Hospedar" is disabled with no campaign selected (CAMP-04, AC 4)
Proof: run e2e | ✓ [C4] CAMP-04

**C5** - Hosting creates missing subfolders, remembers the campaign and shows its name in Mapas (CAMP-05, AC 5)
Proof: run e2e | ✓ [C5] CAMP-05

**C6** - The last campaign comes selected next time, if its folder exists (CAMP-06, AC 6)
Proof: run e2e | ✓ [C6] CAMP-06

**C7** - "Abrir pasta" opens the campaign folder (CAMP-07, AC 7)
Proof: run e2e | ✓ [C7] CAMP-07

**C8** - Tokens lists the images of `tokens/` and `objetos/` with thumbnail and name, objects from `objetos/` unless the `.json` says otherwise (CAMP-08, AC 1)
Proof: run e2e | ✓ [C8] CAMP-08

**C9** - Mapas lists the images of `mapas/` with thumbnail and name (CAMP-09, AC 2)
Proof: run e2e | ✓ [C9] CAMP-09

**C10** - Subfolders are groups titled with their path that open and close (CAMP-10, AC 3)
Proof: run e2e | ✓ [C10] CAMP-10

**C11** - Files added, removed or renamed outside the app show in the lists within 2 s (CAMP-11, AC 4)
Proof: run e2e | ✓ [C11] CAMP-11

**C12** - A token or object dragged from the list lands as a library drop does, in every window (CAMP-12, AC 5)
Proof: run e2e | ✓ [C12] CAMP-12

**C13** - A map clicked in the list loads as "Importar mapa" does, in every window (CAMP-13, AC 6)
Proof: run e2e | ✓ [C13] CAMP-13

**C14** - "Adicionar arquivos" copies into the subfolder, naming repeats `(2)`, `(3)` (CAMP-14, AC 7)
Proof: run e2e | ✓ [C14] CAMP-14

**C15** - Unreadable images and files over 50 MB are not listed (CAMP-15, AC 8)
Proof: run unit | ✓ [C15] CAMP-15

**C16** - "Salvar cena" writes `cenas/<nome>.cena` pointing at the campaign files, not holding images (CAMP-16, AC 1)
Proof: run unit | ✓ [C16] CAMP-16

**C17** - An existing scene name asks "Substituir a cena <nome>?" and writes only if confirmed (CAMP-17, AC 2)
Proof: run e2e | ✓ [C17] CAMP-17

**C18** - Mapas lists the scenes and a pick loads it in every window, asking as SAVE-05 when the table has items (CAMP-18, AC 3)
Proof: run e2e | ✓ [C18] CAMP-18

**C19** - A scene with a missing file does not load and shows "Arquivo não encontrado: <caminho>" (CAMP-19, AC 4)
Proof: run e2e | ✓ [C19] CAMP-19

**C20** - A changed file loads its current version (CAMP-20, AC 5)
Proof: run unit | ✓ [C20] CAMP-20

**C21** - "Exportar .mesa" saves the full file and "Importar .mesa" loads one (CAMP-21, AC 6)
Proof: run e2e | ✓ [C21] CAMP-21

**C22** - Saving a scene with images from outside the campaign copies them into `importados/` and points at them (CAMP-22, AC 7)
Proof: run unit | ✓ [C22] CAMP-22

---

## Handoff

**Settled mid-build:** T3 gate was unit (161) + build + lint; the e2e (hosting now needs a campaign, the library import is gone) are reworked in Phase 2 with the "Teste" campaign in `launch`.
**Dispatched:** none
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1 → T2 → T3
Phase 2:  T4 → T5 → T6
```
