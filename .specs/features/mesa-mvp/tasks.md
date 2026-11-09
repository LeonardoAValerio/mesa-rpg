# Mesa RPG LAN — MVP Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/mesa-mvp/design.md`
**Status**: Approved
**Approved**: 2026-11-08 - user: "aprovado"
**Build**: `test ! -d mesa-rpg || (cd mesa-rpg && scripts/with-node npm run build)`; `test ! -d mesa-rpg || (cd mesa-rpg && scripts/with-node npm run typecheck)`; `test ! -d mesa-rpg || (cd mesa-rpg && scripts/with-node npm run lint)`
**Run unit**: `cd mesa-rpg && scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `cd mesa-rpg && scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

> `test ! -d mesa-rpg ||` exists only because the repo is empty before T1: with no project there is nothing to build. From T1 on, the folder exists and every Build command really runs. `scripts/with-node` (T1) loads `~/.nvm` and the Node in `.nvmrc` (22.16.0), because `node` is not on the PATH of non-interactive shells on this machine.

---

## Test Coverage Matrix

> Generated from project guidelines and spec - confirm before Execute. Guidelines found: none - strong defaults applied. Test types chosen by the user: "Vitest + Playwright Electron (Recomendado)".

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Core rules (`src/core`) | unit | All branches; 1:1 to spec ACs; all listed edge cases | `mesa-rpg/src/core/*.test.ts` | `scripts/with-node npx vitest run` |
| Main services (server, store, cache, import, netinfo) | integration | Real `ws`/HTTP on a random port, real files in a temp dir: happy + edge + error paths | `mesa-rpg/src/main/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer network client (`src/renderer/net`) | integration | Real server from `main/table-server`, fake timers for the time limits | `mesa-rpg/src/renderer/net/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer UI, board, IPC, preload | e2e | Two real Electron windows: every screen state and control in the spec | `mesa-rpg/e2e/*.spec.ts` | `scripts/with-node npm run build && scripts/with-node npx playwright test` |
| Config, scaffolding, packaging | none | build gate only (PKG-01 has its own lone proof) | - | build gate only |

## Gate Check Commands

> Generated from the stack in design.md - confirm before Execute.

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After tasks with unit/integration tests only | `cd mesa-rpg && scripts/with-node npx vitest run` |
| Full | After tasks with e2e tests | `cd mesa-rpg && scripts/with-node npx vitest run && scripts/with-node npm run build && scripts/with-node npx playwright test` |
| Build | After each phase and config-only tasks | `cd mesa-rpg && scripts/with-node npm run build && scripts/with-node npm run typecheck && scripts/with-node npm run lint && scripts/with-node npx vitest run` |

Every test is named `[Cn] <REQ-ID> <claim>`, so each check is found by `✓ [Cn]` in the run.

---

## Execution Plan

### Phase 1: Esqueleto e conexão (Fase 1 do plano)

```
T1 → T2
T1 → T3 → T4 → T5
T1 → T6
T4 → T7
T5 → T7
T5 → T8
T6 → T8
T7 → T8
```

### Phase 2: Mesa básica (Fase 2)

```
T9 → T10
T9 → T12
T11 → T12
T12 → T13 → T14 → T15 → T16
```

### Phase 3: Assets e tokens (Fase 3)

```
T17 → T18
T19 → T20
T18 → T20 → T21
```

### Phase 4: Jogo (Fase 4)

```
T22 → T23 → T24
T25 → T26
```

### Phase 5: Névoa e cena (Fase 5)

```
T27 → T28 → T29
T30 → T31
```

### Phase 6: Empacotamento (Fase 6)

```
T32
```

---

## Task Breakdown

### T1: Scaffold do projeto Electron

**What**: Create `mesa-rpg/` with electron-vite (main/preload/renderer), TypeScript ~6.0, ESLint, Vitest and Playwright configured, `.nvmrc` 22.16.0, `scripts/with-node`, and the scripts `dev`, `build`, `typecheck`, `lint`, `test`, `dist`. Also `git init` at the repo root, with `.gitignore` for `node_modules`, `out`, `dist`. Touches as well: the config files that come with it.
**Where**: `mesa-rpg/package.json`
**Depends on**: None
**Reuses**: electron-vite structure
**Requirement**: NET-01

**Done when**:

- [x] `scripts/with-node npm run build`, `typecheck` and `lint` exit 0
- [x] `npm run dev` opens an empty window with `contextIsolation: true`, `sandbox: true`

**Tests**: none
**Gate**: build
**Commit**: `chore(mesa): scaffold electron-vite project`
**Done**: yes

---

### T2: Empacotamento portátil inicial

**What**: `electron-builder.yml` with `win.target: portable`, x64, `signAndEditExecutable: false`, `artifactName: MesaRPG-${version}-portable.exe`; confirm early that `npm run dist` produces the `.exe` on Linux without Wine. If it fails, stop and ask the user (departure from PKG-01).
**Where**: `mesa-rpg/electron-builder.yml`
**Depends on**: T1
**Requirement**: PKG-01

**Done when**:

- [x] `scripts/with-node npm run dist` produces exactly one `dist/MesaRPG-*-portable.exe`: [C77] PKG-01

**Tests**: none
**Gate**: build
**Commit**: `build(mesa): portable windows exe target`
**Done**: yes

---

### T3: Tipos e protocolo

**What**: `core/types.ts` with the design's models, and `core/protocol.ts` with zod schemas plus `parseClientMsg`.
**Where**: `mesa-rpg/src/core/protocol.ts`
**Depends on**: T1
**Requirement**: NET-15

**Done when**:

- [x] `parseClientMsg` returns null for invalid JSON, an unknown type and missing fields; tests for C15 (protocol part)
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): message protocol and validation`
**Done**: yes

---

### T4: Regras de sessão

**What**: `validatePort` and `validateJoin` in `core/session-rules.ts`.
**Where**: `mesa-rpg/src/core/session-rules.ts`
**Depends on**: T3
**Requirement**: NET-04, NET-07, NET-09

**Done when**:

- [x] Unit/integration tests named and passing: [C4] NET-04
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): port and join validation`
**Done**: yes

---

### T5: Servidor da mesa (conexão)

**What**: `startTableServer`: HTTP + ws on `0.0.0.0`, `hello`/`join` with `hostToken`, players list, `join-error`, `closed` on close, `EADDRINUSE` → "Porta <porta> em uso", malformed messages discarded.
**Where**: `mesa-rpg/src/main/table-server.ts`
**Depends on**: T4
**Requirement**: NET-02, NET-05, NET-07, NET-09, NET-13, NET-15

**Done when**:

- [x] Unit/integration tests named and passing: [C5] NET-05, [C7] NET-07, [C9] NET-09, [C15] NET-15
- [x] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(server): host table over ws with join rules`
**Done**: yes

---

### T6: Endereços de rede

**What**: `listAddresses(ifaces)` with IPv4 only, labelled "Hamachi" (25.x), "Radmin" (26.x) or "Rede"; `MESA_TEST_IFACES` replaces the interfaces in test mode.
**Where**: `mesa-rpg/src/main/netinfo.ts`
**Depends on**: T1
**Requirement**: NET-03

**Done when**:

- [x] Integration test of the labels; quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(main): list LAN/VPN addresses`
**Done**: yes

---

### T7: Cliente de rede

**What**: `TableClient`: connect with a 5 s timeout, join, `status` events, reconnection every 3 s for up to 60 s with the same name.
**Where**: `mesa-rpg/src/renderer/net/table-client.ts`
**Depends on**: T4, T5
**Requirement**: NET-08, NET-10, NET-11, NET-12

**Done when**:

- [x] Unit/integration tests named and passing: [C8] NET-08, [C10] NET-10, [C12] NET-12
- [x] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(client): connect, timeout and reconnect`
**Done**: yes

---

### T8: Tela inicial, hospedar e entrar

**What**: IPC `host/stopHost/addresses/copy`, preload `window.mesa`, `ui/home.ts` (Hospedar/Entrar, fields, errors), `ui/host-info.ts` (IPs + Copiar), players list, overlays "Conexão…" and "O mestre encerrou a mesa" with "Voltar ao início". The master window connects to 127.0.0.1 with the `hostToken`. Touches as well: `main/ipc.ts`, `preload/index.ts`, which are glue for this screen.
**Where**: `mesa-rpg/src/renderer/ui/home.ts`
**Depends on**: T5, T6, T7
**Requirement**: NET-01, NET-02, NET-03, NET-06, NET-13

**Done when**:

- [ ] Playwright tests named and passing: [C1] NET-01, [C2] NET-02, [C3] NET-03, [C6] NET-06, [C13] NET-13
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): home screen, host and join`

---

### T9: Matemática do grid

**What**: `clampGrid`, `cellAt`, `cellOrigin`, `rulerDistance`, `gridFromDetection` (fallback 70 + message).
**Where**: `mesa-rpg/src/core/grid.ts`
**Depends on**: None
**Requirement**: MAP-04, MAP-06, TOOL-01

**Done when**:

- [ ] Unit/integration tests named and passing: [C22] MAP-06
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): grid math`

---

### T10: Detecção automática de grid

**What**: `detectGrid(rgba, w, h)` with mean luminance per column/row and a radix-2 FFT; period in 20..400 px.
**Where**: `mesa-rpg/src/core/grid-detect.ts`
**Depends on**: T9
**Requirement**: MAP-03, MAP-04

**Done when**:

- [ ] Unit/integration tests named and passing: [C19] MAP-03, [C20] MAP-04
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): detect grid period by FFT`

---

### T11: Validação de imagem

**What**: `imageInfo(bytes)` (magic bytes and dimensions of PNG/JPEG/WebP) and `readImageFile(path)` in main, with the 50 MB limit → "Imagem inválida". Touches as well: uses `core/image-info.ts`.
**Where**: `mesa-rpg/src/main/import.ts`
**Depends on**: None
**Requirement**: MAP-09

**Done when**:

- [ ] Unit/integration tests named and passing: [C25] MAP-09
- [ ] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(main): validate imported images`

---

### T12: Reducer de mapa, grid e tokens

**What**: `applyAction` for `map/set`, `grid/set`, `token/place|move|update|remove|hide|show|owner`, with permissions.
**Where**: `mesa-rpg/src/core/reducer.ts`
**Depends on**: T9, T11
**Requirement**: TOK-10, PERM-02, PERM-04, MAP-05, MAP-06

**Done when**:

- [ ] Unit/integration tests named and passing: [C35] TOK-10, [C44] PERM-02, [C46] PERM-04
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): scene reducer with permissions`

---

### T13: Vista por usuário e diffs

**What**: `viewFor` (hidden tokens left out for players, master sees `hidden`) and `diffViews`.
**Where**: `mesa-rpg/src/core/view.ts`
**Depends on**: T12
**Requirement**: PERM-05, PERM-06, NET-14

**Done when**:

- [ ] Unit tests for view and diff (hide/show produce remove/upsert for the player)
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): per-viewer view and diff`

---

### T14: Servidor aplica ações e envia patches

**What**: The server routes `action` → `applyAction` → `viewFor`/`diffViews` per session; `reject` to the author; owners kept by name. Touches as well: modify.
**Where**: `mesa-rpg/src/main/table-server.ts`
**Depends on**: T13
**Requirement**: NET-11, NET-14, NET-16, PERM-03

**Done when**:

- [ ] Unit/integration tests named and passing: [C11] NET-11, [C14] NET-14, [C16] NET-16, [C45] PERM-03
- [ ] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(server): apply actions and broadcast patches`

---

### T15: Tabuleiro PixiJS

**What**: `board.ts` + `camera.ts` + `token-sprite.ts`: map, grid, tokens (size, name, ring), zoom 10–400% on the cursor, pan with middle button/space, drag with snap, `window.__mesaTest.board()` when `MESA_TEST=1`; empty-state messages. Touches as well: `camera.ts`, `token-sprite.ts` in the same folder.
**Where**: `mesa-rpg/src/renderer/board/board.ts`
**Depends on**: T14
**Requirement**: MAP-01, MAP-07, MAP-08, TOK-05, TOK-06

**Done when**:

- [ ] Playwright tests named and passing: [C17] MAP-01, [C23] MAP-07, [C24] MAP-08, [C30] TOK-05, [C31] TOK-06
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(board): pixi board with camera and tokens`

---

### T16: Importar mapa e painel de grid

**What**: IPC `importMap` (dialog → `readImageFile` → store → `map/set` with the detected grid), `ui/grid-panel.ts` (cell, offset, colour, opacity). Touches as well: the `importMap` handler in `main/ipc.ts`.
**Where**: `mesa-rpg/src/renderer/ui/grid-panel.ts`
**Depends on**: T15
**Requirement**: MAP-02, MAP-05

**Done when**:

- [ ] Playwright tests named and passing: [C18] MAP-02, [C21] MAP-05
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): import map and grid panel`

---

### T17: AssetStore e endpoint HTTP

**What**: `AssetStore` (sha256) and `GET /asset/:hash` serving only referenced hashes. Touches as well: the route in `table-server.ts`.
**Where**: `mesa-rpg/src/main/asset-store.ts`
**Depends on**: None
**Requirement**: ASSET-01, ASSET-06

**Done when**:

- [ ] Unit/integration tests named and passing: [C37] ASSET-01, [C42] ASSET-06
- [ ] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(server): content-addressed asset store`

---

### T18: Cache e download de assets

**What**: `AssetCache` in `userData/cache` and `asset-loader.ts` (downloads what is missing, checks the hash, retries 3 times, progress "Baixando arquivos n/total"). Touches as well: `main/asset-cache.ts`.
**Where**: `mesa-rpg/src/renderer/net/asset-loader.ts`
**Depends on**: T17
**Requirement**: ASSET-02, ASSET-03, ASSET-04, ASSET-05

**Done when**:

- [ ] Unit/integration tests named and passing: [C38] ASSET-02, [C39] ASSET-03, [C40] ASSET-04, [C41] ASSET-05
- [ ] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(client): cached asset download by hash`

---

### T19: Manifesto e paleta

**What**: `parseManifest`, `parsePalette`, and `importTokenFolder(dir)` in main. Touches as well: `core/palette.ts` and `importTokenFolder` in `main/import.ts`.
**Where**: `mesa-rpg/src/core/manifest.ts`
**Depends on**: None
**Requirement**: TOK-01, TOK-02, TOK-03, TOK-09

**Done when**:

- [ ] Unit/integration tests named and passing: [C26] TOK-01, [C27] TOK-02, [C28] TOK-03, [C34] TOK-09
- [ ] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(core): token manifest and palette`

---

### T20: Biblioteca de tokens

**What**: IPC `importTokens`/`loadPalette`, `ui/library.ts` (list, drag to the map → `token/place`), download status overlay. Touches as well: handlers in `main/ipc.ts`.
**Where**: `mesa-rpg/src/renderer/ui/library.ts`
**Depends on**: T18, T19
**Requirement**: TOK-01, TOK-04, ASSET-04

**Done when**:

- [ ] Playwright tests named and passing: [C29] TOK-04
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): token library and drag to map`

---

### T21: Editor de token e permissões na tela

**What**: `ui/token-editor.ts`: name, faction, size, owner (connected players), hide/show, remove; the player drags only their own tokens; drag cancelled when the token is removed.
**Where**: `mesa-rpg/src/renderer/ui/token-editor.ts`
**Depends on**: T20
**Requirement**: TOK-07, TOK-08, TOK-11, PERM-01, PERM-05, PERM-06, PERM-07

**Done when**:

- [ ] Playwright tests named and passing: [C32] TOK-07, [C33] TOK-08, [C36] TOK-11, [C43] PERM-01, [C47] PERM-05, [C48] PERM-06, [C49] PERM-07
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): token editor and ownership`

---

### T22: Dados

**What**: `parseDice` and `rollDice` with `kh`/`kl` and limits; `cryptoRng` in main.
**Where**: `mesa-rpg/src/core/dice.ts`
**Depends on**: None
**Requirement**: DICE-01, DICE-02, DICE-03, DICE-04

**Done when**:

- [ ] Unit/integration tests named and passing: [C52] DICE-02, [C53] DICE-03
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): dice notation and roller`

---

### T23: Histórico de dados e chat no servidor

**What**: Actions `roll` and `chat` in the reducer; the server keeps 200 entries and sends them on join. Touches as well: modify; reducer branch in `core/reducer.ts`.
**Where**: `mesa-rpg/src/main/table-server.ts`
**Depends on**: T22
**Requirement**: DICE-01, DICE-04, CHAT-02, CHAT-03, PERM-08

**Done when**:

- [ ] Unit/integration tests named and passing: [C51] DICE-01, [C54] DICE-04, [C56] CHAT-02, [C57] CHAT-03, [C50] PERM-08
- [ ] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(server): shared roll and chat log`

---

### T24: Painel de dados e chat

**What**: `ui/log-panel.ts`: input for rolls and chat, history with dice and discarded dice marked, `textContent` only.
**Where**: `mesa-rpg/src/renderer/ui/log-panel.ts`
**Depends on**: T23
**Requirement**: CHAT-01, CHAT-04, DICE-04

**Done when**:

- [ ] Playwright tests named and passing: [C55] CHAT-01, [C58] CHAT-04
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): dice and chat panel`

---

### T25: Eventos efêmeros com limite

**What**: `createLimiter` and server relay of `ruler`, `ruler/end`, `ping`, `stroke` to everyone. Touches as well: the relay in `table-server.ts`.
**Where**: `mesa-rpg/src/core/ratelimit.ts`
**Depends on**: None
**Requirement**: TOOL-05

**Done when**:

- [ ] Unit/integration tests named and passing: [C63] TOOL-05
- [ ] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(server): rate-limited ephemeral relay`

---

### T26: Régua, ping e desenho

**What**: `board/overlays.ts` and tools in the toolbar: ruler with distance, ping for 2 s, stroke that disappears 5 s after release.
**Where**: `mesa-rpg/src/renderer/board/overlays.ts`
**Depends on**: T25
**Requirement**: TOOL-01, TOOL-02, TOOL-03, TOOL-04

**Done when**:

- [ ] Playwright tests named and passing: [C59] TOOL-01, [C60] TOOL-02, [C61] TOOL-03, [C62] TOOL-04
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(board): ruler, ping and quick draw`

---

### T27: Névoa no core

**What**: `fogDims`, `coverAll`, `brush`, `rect`, `isCovered`, `tokenCovered`.
**Where**: `mesa-rpg/src/core/fog.ts`
**Depends on**: None
**Requirement**: FOG-03, FOG-04, FOG-05

**Done when**:

- [ ] Unit/integration tests named and passing: [C66] FOG-03, [C67] FOG-04, [C68] FOG-05
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): fog of war bitset`

---

### T28: Névoa no reducer e na vista

**What**: `map/set` covers everything, `grid/set` with a cell or offset change covers again, `fog/*` actions for the master only; `viewFor` hides tokens under fog from anyone who does not own them. Touches as well: modify; fog branch in `core/reducer.ts`.
**Where**: `mesa-rpg/src/core/view.ts`
**Depends on**: T27
**Requirement**: FOG-01, FOG-06, FOG-07, FOG-08

**Done when**:

- [ ] Unit/integration tests named and passing: [C64] FOG-01, [C69] FOG-06, [C70] FOG-07, [C71] FOG-08
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): fog hides tokens per viewer`

---

### T29: Camada e ferramentas de névoa

**What**: `board/fog-layer.ts` (opaque for players, 50% for the master) and `ui/fog-panel.ts` (brush 1–10, rectangle, Reveal/Cover, Cobrir tudo).
**Where**: `mesa-rpg/src/renderer/board/fog-layer.ts`
**Depends on**: T28
**Requirement**: FOG-02, FOG-03, FOG-04, FOG-05

**Done when**:

- [ ] Playwright tests named and passing: [C65] FOG-02
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(board): fog layer and tools`

---

### T30: Arquivo .mesa

**What**: `encodeMesa` and `decodeMesa` with hash validation.
**Where**: `mesa-rpg/src/core/mesa-file.ts`
**Depends on**: None
**Requirement**: SAVE-01, SAVE-03, SAVE-04

**Done when**:

- [ ] Unit/integration tests named and passing: [C72] SAVE-01, [C74] SAVE-03, [C75] SAVE-04
- [ ] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): .mesa scene file`

---

### T31: Salvar e carregar cena

**What**: IPC `saveScene`/`loadScene` with dialogs, confirmation "Substituir a cena atual?", and the `scene/load` action broadcast to everyone. Touches as well: handlers in `main/ipc.ts`.
**Where**: `mesa-rpg/src/renderer/ui/scene-menu.ts`
**Depends on**: T30
**Requirement**: SAVE-02, SAVE-04, SAVE-05

**Done when**:

- [ ] Playwright tests named and passing: [C73] SAVE-02, [C76] SAVE-05
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `feat(ui): save and load scene`

---

### T32: Build final offline

**What**: Final CSP in `index.html`, no external URL in the bundle, final `npm run dist`.
**Where**: `mesa-rpg/src/renderer/index.html`
**Depends on**: None
**Requirement**: PKG-01, PKG-02

**Done when**:

- [ ] Playwright tests named and passing: [C78] PKG-02
- [ ] Full gate passes

**Tests**: e2e
**Gate**: full
**Commit**: `build(mesa): offline csp and final portable exe`

---

## Checks

**C1** - Ao abrir, o app mostra a tela inicial com os botões "Hospedar" e "Entrar" (NET-01, AC 1)
Proof: run e2e | ✓ [C1] NET-01

**C2** - "Hospedar" com a porta padrão 47800 inicia o servidor em 0.0.0.0:47800 e abre a mesa como mestre (NET-02, AC 2)
Proof: run e2e | ✓ [C2] NET-02

**C3** - Hospedando, a tela lista os IPv4 marcando 25.x como "Hamachi" e 26.x como "Radmin", e "Copiar" põe "IP:47800" na área de transferência (NET-03, AC 3)
Proof: run e2e | ✓ [C3] NET-03

**C4** - Portas "abc", "80", "1023", "65536" e "" dão "Porta inválida"; 1024 e 65535 são aceitas (NET-04, AC 4)
Proof: run unit | ✓ [C4] NET-04

**C5** - Iniciar o servidor numa porta ocupada falha com "Porta <porta> em uso" (NET-05, AC 5)
Proof: run unit | ✓ [C5] NET-05

**C6** - Entrar em 127.0.0.1:<porta> como "Ana" mostra "Ana" na lista de conectados das duas janelas (NET-06, AC 6)
Proof: run e2e | ✓ [C6] NET-06

**C7** - Nome vazio ou de 25 caracteres recebe "Nome inválido"; um nome já conectado recebe "Nome já em uso" (NET-07, AC 7)
Proof: run unit | ✓ [C7] NET-07

**C8** - Um servidor que não responde em 5 s leva a "Não foi possível conectar a <IP>:<porta>" (NET-08, AC 8)
Proof: run unit | ✓ [C8] NET-08

**C9** - Com 8 jogadores conectados, o nono recebe "Mesa cheia" (NET-09, AC 9)
Proof: run unit | ✓ [C9] NET-09

**C10** - Na queda, o cliente mostra "Conexão com o mestre perdida — tentando reconectar" e tenta de novo a cada 3 s (NET-10, AC 10)
Proof: run unit | ✓ [C10] NET-10

**C11** - Reconectar como "Ana" mantém Ana como dona dos tokens dela (NET-11, AC 11)
Proof: run unit | ✓ [C11] NET-11

**C12** - Depois de 60 s sem reconectar, o status passa a "Conexão perdida" (NET-12, AC 12)
Proof: run unit | ✓ [C12] NET-12

**C13** - Quando o mestre fecha a mesa, a janela do jogador mostra "O mestre encerrou a mesa" e "Voltar ao início" (NET-13, AC 13)
Proof: run e2e | ✓ [C13] NET-13

**C14** - Uma ação recusada não muda o estado do servidor nem gera patch para ninguém (NET-14, AC 14)
Proof: run unit | ✓ [C14] NET-14

**C15** - JSON inválido e ação desconhecida são descartados; o servidor continua respondendo (NET-15, AC 15)
Proof: run unit | ✓ [C15] NET-15

**C16** - Dois movimentos simultâneos do mesmo token deixam todos os clientes na posição do último a chegar (NET-16, AC 16)
Proof: run unit | ✓ [C16] NET-16

**C17** - Sem mapa, o mestre vê "Nenhum mapa carregado" e "Importar mapa"; o jogador vê "Aguardando o mestre carregar um mapa" (MAP-01, AC 1)
Proof: run e2e | ✓ [C17] MAP-01

**C18** - O mestre importa um PNG e as duas janelas mostram o mapa com a largura e altura da imagem (MAP-02, AC 2)
Proof: run e2e | ✓ [C18] MAP-02

**C19** - Um mapa 2000x1500 com grid 24x18 é detectado com célula entre 82 e 85 px (MAP-03, AC 3)
Proof: run unit | ✓ [C19] MAP-03

**C20** - Uma imagem sem grid dá célula 70 e "Grid não detectado — ajuste manualmente" (MAP-04, AC 4)
Proof: run unit | ✓ [C20] MAP-04

**C21** - Mudar a célula para 100 no painel do mestre redesenha o grid com 100 px nas duas janelas (MAP-05, AC 5)
Proof: run e2e | ✓ [C21] MAP-05

**C22** - Célula 5 vira 10, 900 vira 500, deslocamento acima da célula vira o tamanho da célula, opacidade 150% vira 100% (MAP-06, AC 6)
Proof: run unit | ✓ [C22] MAP-06

**C23** - A roda do mouse muda o zoom só naquela janela, limitado a 10% e 400%, mantendo o ponto sob o cursor (MAP-07, AC 7)
Proof: run e2e | ✓ [C23] MAP-07

**C24** - Arrastar com o botão do meio desloca a visão só naquela janela (MAP-08, AC 8)
Proof: run e2e | ✓ [C24] MAP-08

**C25** - Um `.txt` renomeado para `.png` e um arquivo de mais de 50 MB dão "Imagem inválida" (MAP-09, AC 9)
Proof: run unit | ✓ [C25] MAP-09

**C26** - Importar uma pasta com `goblin.png` e `elfa.png` lista os tokens "goblin" e "elfa" (TOK-01, AC 1)
Proof: run unit | ✓ [C26] TOK-01

**C27** - `goblin.json` com `inimigo` e tamanho 2 faz o token goblin ser inimigo 2x2 (TOK-02, AC 2)
Proof: run unit | ✓ [C27] TOK-02

**C28** - Sem manifesto, com JSON inválido ou com `faccao: "x"` o token fica `neutro` e tamanho 1 (TOK-03, AC 3)
Proof: run unit | ✓ [C28] TOK-03

**C29** - Arrastar um token da biblioteca para o mapa o coloca na célula sob o cursor nas duas janelas (TOK-04, AC 4)
Proof: run e2e | ✓ [C29] TOK-04

**C30** - Soltar um token arrastado encaixa o canto superior esquerdo na célula, nas duas janelas (TOK-05, AC 5)
Proof: run e2e | ✓ [C30] TOK-05

**C31** - Um token tamanho 2 ocupa 2x2 células, mostra o nome e tem anel na cor da facção (TOK-06, AC 6)
Proof: run e2e | ✓ [C31] TOK-06

**C32** - O mestre renomeia o token para "Chefe" e as duas janelas mostram "Chefe" (TOK-07, AC 7)
Proof: run e2e | ✓ [C32] TOK-07

**C33** - O mestre remove um token e ele some das duas janelas (TOK-08, AC 8)
Proof: run e2e | ✓ [C33] TOK-08

**C34** - Com `palette.json` as cores dele são usadas; sem ele, grupo #3b82f6, inimigo #ef4444, npc #eab308, neutro #9ca3af (TOK-09, AC 9)
Proof: run unit | ✓ [C34] TOK-09

**C35** - Mover um token para fora da área do mapa é recusado e a posição fica a anterior (TOK-10, AC 10)
Proof: run unit | ✓ [C35] TOK-10

**C36** - Se o mestre remove um token durante o arraste do jogador, o arraste é cancelado (TOK-11, AC 11)
Proof: run e2e | ✓ [C36] TOK-11

**C37** - O mesmo conteúdo dá o mesmo hash SHA-256 e conteúdos diferentes dão hashes diferentes (ASSET-01, AC 1)
Proof: run unit | ✓ [C37] ASSET-01

**C38** - Com cache vazio, o cliente baixa o hash da cena e o grava no cache (ASSET-02, AC 2)
Proof: run unit | ✓ [C38] ASSET-02

**C39** - Com o hash no cache, o cliente não faz nenhuma requisição (ASSET-03, AC 3)
Proof: run unit | ✓ [C39] ASSET-03

**C40** - Durante o download o status é "Baixando arquivos 1/2" e depois "Baixando arquivos 2/2" (ASSET-04, AC 4)
Proof: run unit | ✓ [C40] ASSET-04

**C41** - Um arquivo com hash errado é pedido 3 vezes e então dá "Falha ao baixar arquivo" (ASSET-05, AC 5)
Proof: run unit | ✓ [C41] ASSET-05

**C42** - `GET /asset/<hash>` de um hash fora da cena e da biblioteca devolve 404 (ASSET-06, AC 6)
Proof: run unit | ✓ [C42] ASSET-06

**C43** - O mestre escolhe "Ana" como dona da Guerreira e o token mostra "Ana" na janela do mestre (PERM-01, AC 1)
Proof: run e2e | ✓ [C43] PERM-01

**C44** - O mestre move, edita, esconde, mostra e remove um token que não é dele (PERM-02, AC 2)
Proof: run unit | ✓ [C44] PERM-02

**C45** - Ana tenta mover o Goblin, recebe `reject` e a posição continua a anterior (PERM-03, AC 3)
Proof: run unit | ✓ [C45] PERM-03

**C46** - Cada ação exclusiva do mestre vinda de um jogador é recusada sem mudar o estado (PERM-04, AC 4)
Proof: run unit | ✓ [C46] PERM-04

**C47** - Um token escondido some da janela do jogador e fica com alfa 0.5 na do mestre (PERM-05, AC 5)
Proof: run e2e | ✓ [C47] PERM-05

**C48** - Mostrar o token escondido faz ele aparecer de novo na janela do jogador (PERM-06, AC 6)
Proof: run e2e | ✓ [C48] PERM-06

**C49** - Ana arrasta a Guerreira, que é dela, e não consegue arrastar o Goblin (PERM-07, AC 7)
Proof: run e2e | ✓ [C49] PERM-07

**C50** - Um jogador sem tokens consegue rolar, conversar e mandar régua, ping e traço (PERM-08, AC 8)
Proof: run unit | ✓ [C50] PERM-08

**C51** - Rolar `1d8+1d6-2` registra autor, expressão, cada dado e o total certo (DICE-01, AC 1)
Proof: run unit | ✓ [C51] DICE-01

**C52** - O sorteio usa `crypto.randomInt` e 60000 d6 ficam a menos de 5% de 10000 por face (DICE-02, AC 2)
Proof: run unit | ✓ [C52] DICE-02

**C53** - `2d20kh1` soma só o maior e marca o outro como descartado; `2d20kl1` soma o menor (DICE-03, AC 3)
Proof: run unit | ✓ [C53] DICE-03

**C54** - `2d`, `101d6`, `1d1`, `1d6+2000` e `2d6kh3` dão "Notação inválida: <expressão>" e nada entra no histórico (DICE-04, AC 4)
Proof: run unit | ✓ [C54] DICE-04

**C55** - Ana manda "olá" e as duas janelas mostram "Ana: olá" (CHAT-01, AC 5)
Proof: run e2e | ✓ [C55] CHAT-01

**C56** - Mensagem vazia ou de 501 caracteres não é enviada; 500 caracteres são (CHAT-02, AC 6)
Proof: run unit | ✓ [C56] CHAT-02

**C57** - Com 250 entradas no histórico, quem entra recebe as últimas 200 (CHAT-03, AC 7)
Proof: run unit | ✓ [C57] CHAT-03

**C58** - `<b>oi</b>` aparece com os sinais de menor e maior como texto, sem elemento `b` (CHAT-04, AC 8)
Proof: run e2e | ✓ [C58] CHAT-04

**C59** - A régua de (0,0) a (3,5) mostra "5" nas duas janelas enquanto é arrastada (TOOL-01, AC 1)
Proof: run e2e | ✓ [C59] TOOL-01

**C60** - Soltar a régua apaga a régua nas duas janelas (TOOL-02, AC 2)
Proof: run e2e | ✓ [C60] TOOL-02

**C61** - Um ping aparece nas duas janelas e some depois de 2 s (TOOL-03, AC 3)
Proof: run e2e | ✓ [C61] TOOL-03

**C62** - Um traço aparece nas duas janelas e some 5 s depois de soltar o mouse (TOOL-04, AC 4)
Proof: run e2e | ✓ [C62] TOOL-04

**C63** - De 40 pings em 10 s, só 30 são repassados (TOOL-05, AC 5)
Proof: run unit | ✓ [C63] TOOL-05

**C64** - Importar um mapa cobre todas as células da névoa (FOG-01, AC 1)
Proof: run unit | ✓ [C64] FOG-01

**C65** - Uma célula coberta é opaca na janela do jogador e tem 50% de opacidade na do mestre (FOG-02, AC 2)
Proof: run e2e | ✓ [C65] FOG-02

**C66** - O pincel de raio 2 revela só as células com centro dentro do raio, e o modo Cobrir volta a cobri-las (FOG-03, AC 3)
Proof: run unit | ✓ [C66] FOG-03

**C67** - O retângulo revela só as células com centro dentro dele, e o modo Cobrir volta a cobri-las (FOG-04, AC 4)
Proof: run unit | ✓ [C67] FOG-04

**C68** - "Cobrir tudo" deixa todas as células cobertas (FOG-05, AC 5)
Proof: run unit | ✓ [C68] FOG-05

**C69** - Um token sob a névoa não está na vista de quem não é dono e está na vista do dono (FOG-06, AC 6)
Proof: run unit | ✓ [C69] FOG-06

**C70** - Revelar a célula do token gera `token/upsert` para o jogador (FOG-07, AC 7)
Proof: run unit | ✓ [C70] FOG-07

**C71** - Mudar célula ou deslocamento do grid cobre de novo todas as células (FOG-08, AC 8)
Proof: run unit | ✓ [C71] FOG-08

**C72** - O `.mesa` salvo tem mapa, grid, tokens com todos os campos, névoa e cada imagem em base64 (SAVE-01, AC 1)
Proof: run unit | ✓ [C72] SAVE-01

**C73** - Carregar um `.mesa` mostra a cena carregada nas duas janelas (SAVE-02, AC 2)
Proof: run e2e | ✓ [C73] SAVE-02

**C74** - Codificar e decodificar uma cena devolve a mesma cena e os mesmos bytes de imagem (SAVE-03, AC 3)
Proof: run unit | ✓ [C74] SAVE-03

**C75** - JSON inválido, versão 2 ou imagem com hash errado dão "Arquivo .mesa inválido" (SAVE-04, AC 4)
Proof: run unit | ✓ [C75] SAVE-04

**C76** - Carregar com tokens na cena pergunta "Substituir a cena atual?" e cancelar mantém a cena (SAVE-05, AC 5)
Proof: run e2e | ✓ [C76] SAVE-05

**C77** - `npm run dist` gera um único `MesaRPG-*-portable.exe` x64 (PKG-01, AC 1)
Proof: `cd mesa-rpg && scripts/with-node npm run dist && test "$(ls dist/MesaRPG-*-portable.exe | wc -l)" = 1`

**C78** - O build não referencia nenhuma URL `http(s)://` externa e a CSP só permite `'self'`, `ws:` e `http:` (PKG-02, AC 2)
Proof: run e2e | ✓ [C78] PKG-02

---

## Handoff

The feature's live state, written as it happens - a compaction gives no warning.

**Settled mid-build:** user: "aprovado" (2026-11-08) without picking sub-agents; batches run inline in the main session. Git defaults accepted: git init at the repo root, `.specs/` tracked, skill folders ignored.
**Dispatched:** none
**Walked:** none

---

## Phase Execution Map

```
Phases run 1 to 6 in order; inside a phase, tasks run in the listed order.

Phase 1:  T1, T2, T3, T4, T5, T6, T7, T8
Phase 2:  T9, T10, T11, T12, T13, T14, T15, T16
Phase 3:  T17, T18, T19, T20, T21
Phase 4:  T22, T23, T24, T25, T26
Phase 5:  T27, T28, T29, T30, T31
Phase 6:  T32
```

Execution is strictly sequential, one task at a time, in order.
