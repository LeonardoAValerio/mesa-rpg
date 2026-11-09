# Mesa RPG — Instalador, atualização automática e versão na mesa — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - the Design section below (no new architecture beyond it)
**Status**: Approved
**Approved**: 2026-11-09 - user: "Aprovo. Pode fazer com 2 agentes"
**Build**: `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && scripts/with-node npm run build`; `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && scripts/with-node npm run typecheck`; `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && scripts/with-node npm run lint`
**Run unit**: `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

> `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)"` exists because T1 moves the repository root: before T1 the commands run from `basement-tabletop` and enter `mesa-rpg`; from T1 on the root is `mesa-rpg` itself, with `.specs` inside it, and the skill scripts run with `--root mesa-rpg`.

---

## Design

- **Repository (T1):** clone `basement-tabletop`, run `git filter-branch --index-filter` that keeps only `mesa-rpg/**` (moved to the root) and `.specs/**` (kept as `.specs/`), drop empty commits, and put the rewritten `.git` in `mesa-rpg/`. `.specs/` is moved into `mesa-rpg/`, the root `.gitignore` merges into `mesa-rpg/.gitignore`, and the old `basement-tabletop/.git` is renamed `.git-pre-split` (kept, nothing deleted). No remote is added.
- **Version (core):** `src/core/version.ts` - `versionError(master: string | undefined, player: string | undefined): string | null` returns `null` when both are equal and defined, else the message `Versão diferente da do mestre: mestre <m>, você <p>. Atualize o app.` with `desconhecida` for an absent side.
- **Protocol:** `join` gains `version?: string`; `welcome` gains `version: string`. The server takes `version` in its options and checks it before the name rules, so a refused join never becomes a session (VER-05). The client checks `welcome.version` and closes with the same message (VER-03), as a join error that keeps the start-screen fields.
- **Which version:** `app.getVersion()`; with `MESA_TEST=1`, `MESA_VERSION` overrides it so e2e can run two versions side by side. The renderer reads it through a new `mesa.version` in the preload.
- **Update state (core):** `src/core/update-state.ts` - a reducer over `{ kind: 'available' | 'progress' | 'downloaded' | 'not-available' | 'error', version? }` to `{ phase: 'idle' | 'downloading' | 'ready', version? }` and `updateBanner(state)` giving the text. `error` and `not-available` always return to `idle` with no banner.
- **Updater (main):** `src/main/updater.ts` - `startUpdater({ isPackaged, updater, onState })`. When `isPackaged` is false it does nothing (UPD-13). Otherwise it sets `autoDownload = true`, `autoInstallOnAppQuit = true`, subscribes to the updater events, feeds the reducer, pushes the state to the renderer and calls `checkForUpdates()` once, swallowing its rejection (UPD-12). `install()` stops the table server (players get "O mestre encerrou a mesa", the same path as "Encerrar mesa") and calls `quitAndInstall(false, true)`. It never calls `quitAndInstall` from an event (UPD-10). The real updater is `electron-updater`'s `autoUpdater`; with `MESA_TEST=1` a fake updater is used, driven from tests through `globalThis.__mesaUpdater` (emit events, read whether install ran).
- **Top bar (renderer):** `src/renderer/ui/update-bar.ts`, mounted once on `document.body` above every screen, testids `update-bar`, `update-text`, `update-install`. While hosting, "Reiniciar e atualizar" opens an in-page confirm (`update-confirm`, `update-confirm-yes`, `update-confirm-no`) with "Reiniciar encerra a mesa para todos. Continuar?".
- **Packaging:** `electron-builder.yml` - `win.target: nsis` x64 only; `nsis: { oneClick: true, perMachine: false, createDesktopShortcut: true, createStartMenuShortcut: true, artifactName: MesaRPG-Setup-${version}.${ext} }`; `publish: { provider: github, owner: LeonardoAValerio, repo: mesa-rpg, releaseType: release }`. `npm run dist` builds without publishing (`--publish never`); `npm run release` is what the Action runs (`--publish always`).
- **Release:** `scripts/check-tag.mjs` exits 1 with `Tag <tag> não corresponde à versão v<versão> do package.json` when `GITHUB_REF_NAME` differs. `.github/workflows/release.yml` on `push: tags: ['v*']`, `runs-on: windows-latest`, `permissions: contents: write`, steps: checkout, setup-node from `.nvmrc`, `npm ci`, check-tag, typecheck, `npx vitest run`, `npm run release` with `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.

---

## Test Coverage Matrix

> Generated from codebase (the MVP's matrix) and spec - confirm before Execute. Guidelines found: none - strong defaults applied; test types as chosen for the MVP: "Vitest + Playwright Electron (Recomendado)".

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Core rules (`src/core`) | unit | All branches; 1:1 to spec ACs; all listed edge cases | `src/core/*.test.ts` | `scripts/with-node npx vitest run` |
| Main services (server, updater) | integration | Real `ws` on a random port; fake updater emitting real event sequences: happy + error paths | `src/main/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer network client | integration | Real server from `main/table-server` | `src/renderer/net/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer UI, IPC, preload | e2e | Real Electron windows: every banner state, control and refusal in the spec | `e2e/*.spec.ts` | `scripts/with-node npm run build && scripts/with-node npx playwright test` |
| Build and release config (`electron-builder.yml`, workflow, `check-tag`) | unit | The config and workflow parsed as YAML, the tag script run as a process | `scripts/*.test.ts` | `scripts/with-node npx vitest run` |
| Repository layout, README | none | lone shell proofs over `git` | - | build gate only |

## Gate Check Commands

> Generated from the MVP's gates - confirm before Execute. All run from the repository root (`mesa-rpg` after T1).

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit/integration tests only | `scripts/with-node npx vitest run` |
| Full | After tasks with e2e tests | `scripts/with-node npx vitest run && scripts/with-node npm run build && scripts/with-node npx playwright test` |
| Build | After each phase and config-only tasks | `scripts/with-node npm run build && scripts/with-node npm run typecheck && scripts/with-node npm run lint && scripts/with-node npx vitest run` |

Every test is named `[Cn] <REQ-ID> <claim>`, so each check is found by `✓ [Cn]` in the run.

---

## Execution Plan

### Phase 1: Repositório

Phases run in order: each phase starts after the previous one is committed.

```
T1 → T2
```

### Phase 2: Versão na mesa

```
T3 → T4 → T5 → T6
```

### Phase 3: Atualização automática

```
T7 → T8 → T9
T9 → T10
```

### Phase 4: Publicação

```
T11 → T12
```

---

## Task Breakdown

### T1: mesa-rpg vira a raiz do repositório

**What**: Rewrite the history so `mesa-rpg/` is the root and `.specs/` lives inside it, as in the Design section; keep the old `.git` as `basement-tabletop/.git-pre-split`; merge `.gitignore`.
**Where**: `mesa-rpg/.git`
**Depends on**: None
**Reuses**: `git filter-branch` (git 2.39 here; `git filter-repo` is not installed)
**Requirement**: REPO-01, REPO-02, REPO-03

**Done when**:

- [x] `git -C mesa-rpg rev-parse --show-toplevel` is `mesa-rpg`, and `.specs/features/auto-update/tasks.md` is tracked there
- [x] `git log` in `mesa-rpg` has every old commit that touched `mesa-rpg/` or `.specs/`, and no path starts with `mesa-rpg/`
- [x] `git ls-files` and the history hold none of the plan `.md`, skill folders, `node_modules`, `out`, `dist`, `test-results`
- [x] Build gate passes from `mesa-rpg`

**Done**: yes
**Tests**: none
**Gate**: build
**Commit**: `chore(repo): mesa-rpg is the repository root with .specs inside`

---

### T2: README

**What**: `README.md` in Portuguese with sections `## Instalar`, `## Jogar` and `## Publicar uma versão` (install from the releases page and the SmartScreen step, host/join over Hamachi or Radmin, `npm version` + `git push --follow-tags`), plus how to run locally.
**Where**: `README.md`
**Depends on**: T1
**Reuses**: the run instructions already given to the user
**Requirement**: REPO-04

**Done when**:

- [x] The three sections exist
- [x] Build gate passes

**Done**: yes
**Tests**: none
**Gate**: build
**Commit**: `docs: readme in portuguese`

---

### T3: Regra de versão

**What**: `versionError` in `src/core/version.ts`, as in the Design section.
**Where**: `src/core/version.ts`
**Depends on**: None
**Reuses**: `src/core/session-rules.ts` style
**Requirement**: VER-01, VER-02, VER-03

**Done when**:

- [x] Equal versions give `null`; different, absent player and absent master give the exact message
- [x] Quick gate passes; unit tests grow by at least 1

**Done**: yes
**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): version rule for joining a table`

---

### T4: Servidor recusa versão diferente

**What**: `join.version` and `welcome.version` in the protocol; the server option `version` and the refusal before the name rules.
**Where**: `src/main/table-server.ts`
**Depends on**: T3
**Reuses**: `handleJoin`, `join-error`, the protocol zod schema
**Requirement**: VER-01, VER-02, VER-04, VER-05

**Done when**:

- [x] A join with another version or none gets `join-error` with the message and no session (the master's player list stays the same)
- [x] A join with the same version gets `welcome` with `version`
- [x] Quick gate passes; integration tests grow

**Done**: yes
**Tests**: integration
**Gate**: quick
**Commit**: `feat(server): refuse a join from a different app version`

---

### T5: Cliente confere a versão do mestre

**What**: The client sends its version in `join` and, when `welcome.version` is absent or different, closes and reports the message as a join error.
**Where**: `src/renderer/net/table-client.ts`
**Depends on**: T4
**Reuses**: the existing join-error path
**Requirement**: VER-03

**Done when**:

- [x] Against a server built with another version (or a fake welcome with none), `connect` rejects with the message
- [x] Quick gate passes; integration tests grow

**Done**: yes
**Tests**: integration
**Gate**: quick
**Commit**: `feat(client): leave a table whose master runs another version`

---

### T6: Versão no app e na tela inicial

**What**: Main passes `app.getVersion()` (or `MESA_VERSION` under `MESA_TEST`) to the server; preload exposes `mesa.version`; the client is created with it; the start screen shows `Versão <versão>` (`testid: app-version`); `e2e/helpers.ts` `launch({ version })`; e2e for VER-01 and VER-05 with two windows and for UPD-14.
**Where**: `src/main/index.ts`
**Depends on**: T5
**Reuses**: `src/preload/index.ts`, `src/renderer/ui/home.ts`, `e2e/helpers.ts`
**Requirement**: VER-01, VER-05, UPD-14

**Done when**:

- [x] A 0.0.9 player joining a master on the app version sees the message with fields kept, and the master's list stays `Mestre`
- [x] The start screen shows `Versão 0.1.0` (the `package.json` version)
- [x] Full gate passes

**Done**: yes
**Tests**: e2e
**Gate**: full
**Commit**: `feat(app): version shown on the start screen and checked on join`

---

### T7: Estado da atualização

**What**: The reducer and `updateBanner` in `src/core/update-state.ts`, as in the Design section.
**Where**: `src/core/update-state.ts`
**Depends on**: None
**Reuses**: none
**Requirement**: UPD-04, UPD-05, UPD-11, UPD-12

**Done when**:

- [x] `available`/`progress` → `Baixando atualização <v>…`; `downloaded` → `Atualização <v> pronta`; `not-available` and `error` → no banner, except that an `error` after `downloaded` keeps `ready` (the file is already on disk)
- [x] Quick gate passes

**Done**: yes
**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): update banner state`

---

### T8: Atualizador no main

**What**: `startUpdater` and `install()` in `src/main/updater.ts`, the fake updater for `MESA_TEST`, and the `electron-updater` dependency.
**Where**: `src/main/updater.ts`
**Depends on**: T7
**Reuses**: `src/main/testing.ts` test hooks
**Requirement**: UPD-03, UPD-09, UPD-10, UPD-13

**Done when**:

- [x] Unpackaged: `checkForUpdates` is never called; packaged: called once on start, with `autoDownload` and `autoInstallOnAppQuit` true
- [x] A full event sequence up to `downloaded` never calls `quitAndInstall`; `install()` calls it with `(false, true)` after stopping the server
- [x] A rejected `checkForUpdates` does not throw
- [x] Quick gate passes

**Done**: yes
**Tests**: integration
**Gate**: quick
**Commit**: `feat(main): auto-updater from github releases`

---

### T9: Faixa de atualização

**What**: `src/renderer/ui/update-bar.ts`, IPC `mesa:update-state` (push) and `mesa:update-install`, the master's confirm, and e2e driving the fake updater.
**Where**: `src/renderer/ui/update-bar.ts`
**Depends on**: T8
**Reuses**: `src/renderer/ui/dom.ts`, `src/main/ipc.ts`, `src/preload/index.ts`
**Requirement**: UPD-04, UPD-05, UPD-06, UPD-07, UPD-08, UPD-11, UPD-12

**Done when**:

- [ ] e2e: the bar shows the download text, then the ready text and button, on the start screen and on the table; nothing for `not-available` or `error`
- [ ] e2e: a player's click runs install; the master's click asks, "não" keeps the table, "sim" runs install and the player sees "O mestre encerrou a mesa"
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): update bar with restart and the master's confirm`

---

### T10: Instalador NSIS

**What**: `electron-builder.yml` as in the Design section, `dist`/`release` scripts, the `yaml` dev dependency, `scripts/build-config.test.ts`; confirm `npm run dist` builds the NSIS installer on Linux (if it needs Wine and fails, stop and ask the user).
**Where**: `electron-builder.yml`
**Depends on**: T9
**Reuses**: the MVP's `signAndEditExecutable: false`
**Requirement**: UPD-01, UPD-02, REL-04

**Done when**:

- [ ] `npm run dist` writes `dist/MesaRPG-Setup-0.1.0.exe`, its `.blockmap` and `dist/latest.yml`, and no portable `.exe`
- [ ] The config test: `nsis` the only Windows target, `perMachine: false`, `oneClick: true`, publish `github` `LeonardoAValerio/mesa-rpg` `releaseType: release`
- [ ] Build gate passes

**Tests**: unit
**Gate**: build
**Commit**: `build: nsis installer published to github releases`

---

### T11: Checagem da tag

**What**: `scripts/check-tag.mjs` and its test, which runs it as a process with `GITHUB_REF_NAME` set.
**Where**: `scripts/check-tag.mjs`
**Depends on**: None
**Reuses**: none
**Requirement**: REL-02

**Done when**:

- [ ] `v0.1.0` exits 0; `v0.1.1` and `0.1.0` exit 1 with the message
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `build: refuse a release tag that does not match package.json`

---

### T12: Workflow de release

**What**: `.github/workflows/release.yml` as in the Design section and `scripts/release-workflow.test.ts`, which parses it and asserts the trigger, the runner, the permission and that check-tag, typecheck and unit tests come before the publish step.
**Where**: `.github/workflows/release.yml`
**Depends on**: T11
**Reuses**: `yaml` from T10
**Requirement**: REL-01, REL-03

**Done when**:

- [ ] The test passes and fails if the publish step is moved before the tests
- [ ] Build gate passes

**Tests**: unit
**Gate**: build
**Commit**: `ci: release workflow on version tags`

---

## Checks

**C1** - `npm run dist` writes `MesaRPG-Setup-<versão>.exe`, its `.blockmap` and `latest.yml`, and the NSIS config installs per user (UPD-01, AC 1)
Proof: `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && rm -rf dist && scripts/with-node npm run dist && v=$(sed -n 's/^  "version": "\(.*\)",$/\1/p' package.json) && test -f "dist/MesaRPG-Setup-$v.exe" && test -f "dist/MesaRPG-Setup-$v.exe.blockmap" && grep -q "version: $v" dist/latest.yml && scripts/with-node npx vitest run scripts/build-config.test.ts -t "C1"`

**C2** - The build has no portable target (UPD-02, AC 2)
Proof: run unit | ✓ [C2] UPD-02

**C3** - Packaged, the updater checks the latest release once on start (UPD-03, AC 3)
Proof: run unit | ✓ [C3] UPD-03

**C4** - A newer version shows "Baixando atualização <versão>…" in the top bar while downloading (UPD-04, AC 4)
Proof: run e2e | ✓ [C4] UPD-04

**C5** - When the download finishes the bar shows "Atualização <versão> pronta" and "Reiniciar e atualizar", on the start screen and on the table (UPD-05, AC 5)
Proof: run e2e | ✓ [C5] UPD-05

**C6** - A player's "Reiniciar e atualizar" runs the install at once (UPD-06, AC 6)
Proof: run e2e | ✓ [C6] UPD-06

**C7** - While hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs (UPD-07, AC 7)
Proof: run e2e | ✓ [C7] UPD-07

**C8** - After the master confirms, the player sees "O mestre encerrou a mesa" (UPD-08, AC 8)
Proof: run e2e | ✓ [C8] UPD-08

**C9** - A downloaded update installs on quit: `autoInstallOnAppQuit` is on (UPD-09, AC 9)
Proof: run unit | ✓ [C9] UPD-09

**C10** - No updater event ever calls `quitAndInstall` (UPD-10, AC 10)
Proof: run unit | ✓ [C10] UPD-10

**C11** - Same or older version: no bar (UPD-11, AC 11)
Proof: run e2e | ✓ [C11] UPD-11

**C12** - A failed check or download: no bar, and a rejected check does not throw (UPD-12, AC 12)
Proof: run e2e | ✓ [C12] UPD-12

**C13** - Unpackaged, the updater never checks (UPD-13, AC 13)
Proof: run unit | ✓ [C13] UPD-13

**C14** - The start screen shows "Versão <versão>" (UPD-14, AC 14)
Proof: run e2e | ✓ [C14] UPD-14

**C15** - A player on another version sees "Versão diferente da do mestre: mestre <m>, você <p>. Atualize o app." with IP, port and name kept (VER-01, AC 1)
Proof: run e2e | ✓ [C15] VER-01

**C16** - A join with no version is refused with `desconhecida` as the player's version (VER-02, AC 2)
Proof: run unit | ✓ [C16] VER-02

**C17** - A welcome with no version or another one makes the player leave with the message, `desconhecida` when absent (VER-03, AC 3)
Proof: run unit | ✓ [C17] VER-03

**C18** - A join with the same version proceeds to `welcome` (VER-04, AC 4)
Proof: run unit | ✓ [C18] VER-04

**C19** - A refused player is in neither window's players list (VER-05, AC 5)
Proof: run e2e | ✓ [C19] VER-05

**C20** - The workflow runs on `v*` tags, on `windows-latest`, publishing with `npm run release` and `releaseType: release` (REL-01, AC 1)
Proof: run unit | ✓ [C20] REL-01

**C21** - A tag different from `v` + the `package.json` version fails with the message (REL-02, AC 2)
Proof: run unit | ✓ [C21] REL-02

**C22** - Typecheck and unit tests run before the publish step (REL-03, AC 3)
Proof: run unit | ✓ [C22] REL-03

**C23** - Update and publish point at `LeonardoAValerio/mesa-rpg` (REL-04, AC 4)
Proof: run unit | ✓ [C23] REL-04

**C24** - `mesa-rpg` is the repository root with `.specs` inside it (REPO-01, AC 1)
Proof: `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && test "$(git rev-parse --show-toplevel)" = "$(pwd -P)" && git ls-files --error-unmatch .specs/features/auto-update/spec.md package.json`

**C25** - The old commits are in the new history with rewritten paths (REPO-02, AC 2)
Proof: `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && git log --format=%s | grep -qx 'chore(mesa): scaffold electron-vite project' && git log --format=%s | grep -q '^docs(specs): mesa mvp verified' && git log --name-only --format= | grep -q '^src/core/dice.ts$' && ! git log --name-only --format= | grep -q '^mesa-rpg/'`

**C26** - Neither the tree nor the history holds the plan, skill folders or build output (REPO-03, AC 3)
Proof: `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && ! git log --all --name-only --format= | grep -E '^(\.claude|\.cursor|\.windsurf|\.agents|node_modules|out|dist|test-results)/|plano do app'`

**C27** - `README.md` has "Instalar", "Jogar" and "Publicar uma versão" (REPO-04, AC 4)
Proof: `cd "$([ -d mesa-rpg ] && echo mesa-rpg || echo .)" && grep -qx '## Instalar' README.md && grep -qx '## Jogar' README.md && grep -qx '## Publicar uma versão' README.md`

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** execution with 2 batch sub-agents - user: "Aprovo. Pode fazer com 2 agentes"
**Dispatched:** batch 1 (Phases 1-2, T1-T6) at 3b1bf34+spec docs commit, in the old basement-tabletop repo; returned at 479f370 (T1-T6 done, unit 101, e2e 50); batch 2 (Phases 3-4, T7-T12) at 479f370
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2 → Phase 3 → Phase 4

Phase 1:  T1 → T2
Phase 2:  T3 → T4 → T5 → T6
Phase 3:  T7 → T8 → T9 → T10
Phase 4:  T11 → T12
```
