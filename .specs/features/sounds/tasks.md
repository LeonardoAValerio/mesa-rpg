# Mesa RPG — Sons — Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path. The skill is the source of truth for the full flow (per-task cycle, sub-agent delegation, the walk, check_proofs, the Verifier and the screens sub-agent).

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: inline - the Design section below
**Status**: In Progress
**Approved**: 2026-11-10 - user: "Pode seguir"
**Build**: `scripts/with-node npm run build`; `scripts/with-node npm run typecheck`; `scripts/with-node npm run lint`
**Run unit**: `scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

---

## Design

- **Rules (`src/core/sound.ts`, pure):** `audioInfo(bytes)` → `'mp3' | 'ogg' | 'wav' | 'm4a' | null` by the file's own header (ID3 or MPEG frame sync, `OggS`, `RIFF....WAVE`, `ftyp` M4A/mp42/isom), `MAX_AUDIO_BYTES = 100 MB` (SOM-03). The table's sound state `Sound = { layers: Layer[] }`, `Layer = { hash, volume (0..100), startedAt (server ms), stoppingAt (server ms) | null }`, and the reducer cases: `sound/toggle {hash}` (start at volume 100, or mark stopping; a stopping layer clicked again rises again; 8 live layers max → "Máximo de 8 camadas", SOM-06, SOM-07, SOM-10), `sound/volume {hash, volume}` (SOM-09), `sound/stopAll` (SOM-11), `sound/set {layers: {hash, volume}[]}` for scenes (SOM-26, SOM-27), `sound/effect {hash}` (SOM-16); every sound action from a player → "Sem permissão" (SOM-19). A stopping layer leaves the state 2 s after `stoppingAt`. `layerPosition(startedAt, serverNow, duration)` → seconds into the loop (SOM-12, SOM-13).
- **Protocol:** the actions above join `actionSchema`; `View` gets `sound: { layers: Layer[] }` (no names; SOM-19 assumption: players see no list); the `welcome` and every `patch` carry `serverNow` so each window keeps a clock offset; the server sends `{ t: 'effect', hash, at }` to every session on `sound/effect`, and `{ t: 'effects', hashes }` (the campaign's effects) to every session on join and on rescan (SOM-17).
- **Main:** `CampaignFolder.scan` also walks `musicas/` and `efeitos/` with `readAudioFile` (type and size rule) into the `AssetStore`, entries `{ section: 'musicas' | 'efeitos', path, group, name, hash, kind: 'audio' }` (SOM-01..03); `addFiles` takes the two sections (SOM-04). The asset route serves a hash that is a layer's, an effect of the campaign, or as before, with its `audio/*` type. Scenes: the `.cena` gets `sound: { path, volume }[]` (no version change: an absent `sound` is no layers); save maps live layers' hashes to paths, load resolves paths (a missing one → "Arquivo não encontrado: <caminho>") and sends `sound/set` (SOM-25..28); `importMesa` leaves `sound` alone (SOM-29).
- **Renderer engine (`src/renderer/sound/engine.ts`):** Web Audio: one `AudioContext`, a gain bus for music and one for effects, each times "Mudo" (SOM-20..23); per layer a looping `AudioBufferSourceNode` started at `layerPosition` and a gain ramped over 2 s on start and stop (no ramp for a layer already playing when the window joins, SOM-12); buffers come from an `AssetLoader` (same hash check and cache as images, SOM-14); an effect plays when its buffer is ready, unless it arrived more than 2 s after `at` (SOM-18). Disconnect or "Encerrar mesa" closes every node (SOM-15). Personal "Música", "Efeitos", "Mudo" in `localStorage` (`mesa-sound-v1`), default 80/80/off (SOM-24). Test hook `__mesaTest.sound()` → `{ layers: [{ hash, gain, position, playing }], effects: [{ hash, at, played }], music, effects, muted }` read from the real nodes.
- **UI:** a "Sons" panel (`panel-sons`) in both roles, layout key `mesa-layout-v3-<role>` (SOM-05). Every window: sliders `sound-music`, `sound-effects`, switch `sound-mute`. Master: lists "Músicas" (`list-musicas`) and "Efeitos" (`list-efeitos`) with groups and "Adicionar arquivos" from `campaignSection`, a music row toggles (`data-playing`), the "Tocando" list with each layer's name and volume slider (`layer-volume`), "Parar tudo" (`stop-all`), the message line (`sound-message`).
- **Tests:** e2e write audio fixtures (short generated WAV and OGG files) into the campaign with `putFile`; they read what plays through `__mesaTest.sound()`; Chromium runs Web Audio with no sound device.

---

## Test Coverage Matrix

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Core rules (`src/core`) | unit | All branches; the sound reducer, audio sniffing, positions | `src/core/*.test.ts` | `scripts/with-node npx vitest run` |
| Main services (folder scan, server, scenes) | integration | Real files in a temp dir, a real server and ws clients | `src/main/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer sound engine | unit | A fake audio context and clock; ramps, offsets, late effects | `src/renderer/sound/*.test.ts` | `scripts/with-node npx vitest run` |
| Renderer UI, IPC | e2e | Real Electron windows; what plays read from the real audio nodes | `e2e/*.spec.ts` | `scripts/with-node npm run build && scripts/with-node npx playwright test` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | After a core or main task | `scripts/with-node npx vitest run` |
| Task e2e | After a UI task: unit plus the e2e files it changed | `scripts/with-node npx vitest run && scripts/with-node npm run build && scripts/with-node npx playwright test <files>` |
| Phase | At the end of each phase | `scripts/with-node npm run build && scripts/with-node npm run typecheck && scripts/with-node npm run lint && scripts/with-node npx vitest run && scripts/with-node npx playwright test` |

Every test is named `[Cn] <REQ-ID> <claim>`. The e2e need the screen unlocked and port 47800 free.

---

## Execution Plan

### Phase 1: Regras, servidor e pasta

```
T1 → T2 → T3
```

### Phase 2: Som na tela

```
T3 → T4 → T5 → T6
```

---

## Task Breakdown

### T1: Regras de som

**What**: `src/core/sound.ts` with `audioInfo`, the sound reducer cases inside `applyAction`, `layerPosition`; the protocol actions, `View.sound`, `serverNow`, the `effect` and `effects` messages.
**Where**: `src/core/sound.ts`, `src/core/protocol.ts`, `src/core/types.ts`, `src/core/reducer.ts`
**Depends on**: None
**Reuses**: `applyAction` and its "Sem permissão" rule
**Requirement**: SOM-03, SOM-06, SOM-07, SOM-09, SOM-10, SOM-11, SOM-13, SOM-19

**Done when**:

- [x] Unit tests: each audio header and a non-audio file; toggle on, off, again while stopping; the 9th layer refused; volume 0..100 and out of range; stop all; a player refused for each sound action; position at 0, inside the loop and after several loops
- [x] Quick gate passes

**Tests**: unit
**Gate**: quick
**Commit**: `feat(core): sound layers, effects and audio file rules`
**Done**: yes

---

### T2: Servidor e pasta com sons

**What**: the scan of `musicas/` and `efeitos/`, `addFiles` for them, the asset route for audio, the server's sound actions, `serverNow`, the effect broadcast and the effects list to every session.
**Where**: `src/main/campaign.ts`, `src/main/import.ts`, `src/main/table-server.ts`, `src/main/ipc.ts`, `src/preload/*`
**Depends on**: T1
**Reuses**: `CampaignFolder.scan`, the asset route's `referenced` rule
**Requirement**: SOM-01, SOM-02, SOM-03, SOM-04, SOM-16, SOM-17, SOM-19

**Done when**:

- [x] Integration tests: audio files listed with groups and names, a bad or 100 MB + 1 byte file skipped; an effect broadcast reaches master and player with `at`; a player gets the effects list on join and the audio bytes from the route; a player's sound action refused
- [x] Quick gate passes

**Tests**: integration
**Gate**: quick
**Commit**: `feat(main): serve and list the campaign's music and effects`
**Done**: yes

---

### T3: Som nas cenas

**What**: `.cena` `sound` saved from the live layers and loaded with `sound/set`; a missing file blocks the load; `.mesa` import leaves the layers.
**Where**: `src/core/campaign.ts`, `src/main/scenes.ts`, `src/main/ipc.ts`
**Depends on**: T2
**Reuses**: `encodeCena`, `decodeCena`, the CAMP-19 message
**Requirement**: SOM-25, SOM-26, SOM-27, SOM-28, SOM-29

**Done when**:

- [x] Integration tests: save with two layers writes their paths and volumes; load sets them; a `.cena` with no `sound` stops all; a missing audio path refused with the message
- [x] Phase gate passes

**Tests**: integration
**Gate**: phase
**Commit**: `feat(main): scenes keep their music layers`
**Done**: yes

---

### T4: Tocar na janela

**What**: the Web Audio engine (layers in sync with ramps, effects with the 2 s rule, personal volumes and mute, stop on leave), the "Sons" panel with "Música", "Efeitos", "Mudo" in both roles, layout v3, the `sound()` test hook.
**Where**: `src/renderer/sound/engine.ts`, `src/renderer/ui/sound-panel.ts`, `src/renderer/ui/layout.ts`, `src/renderer/main.ts`
**Depends on**: T3
**Reuses**: `AssetLoader`, the dock panels
**Requirement**: SOM-05, SOM-12, SOM-13, SOM-14, SOM-15, SOM-18, SOM-20, SOM-21, SOM-22, SOM-23, SOM-24

**Done when**:

- [ ] Unit tests (fake audio context and clock): start offset, 2 s ramps, no ramp when joining, a late effect skipped and an on-time one played, bus gains from the sliders and mute
- [ ] e2e: a player joining mid-layer plays it within 1 s of the master; personal volume changes one window only and survives a restart; mute; end of table stops everything; Sons in the layout and in "Painéis", a 0.7.0 layout reset
- [ ] Task e2e gate passes

**Tests**: unit, e2e
**Gate**: task e2e
**Commit**: `feat(ui): play the table's sounds with personal volume`

---

### T5: Controles do mestre

**What**: the master's lists of music and effects, click to toggle a layer, the "Tocando" list with volume per layer, "Parar tudo", the 8-layer message, "Adicionar arquivos"; effects on click.
**Where**: `src/renderer/ui/sound-panel.ts`, `src/renderer/ui/campaign-lists.ts`
**Depends on**: T4
**Reuses**: `campaignSection`
**Requirement**: SOM-01, SOM-02, SOM-04, SOM-06, SOM-07, SOM-08, SOM-09, SOM-10, SOM-11, SOM-16, SOM-17, SOM-19

**Done when**:

- [ ] e2e: lists with groups update within 2 s; a click starts a layer in both windows with the rise, a second click fades it out; layer volume reaches the player within 1 s; the 9th layer message; "Parar tudo"; an effect clicked twice overlaps in both windows; a player has no play controls; "Adicionar arquivos" names `(2)`
- [ ] Task e2e gate passes

**Tests**: e2e
**Gate**: task e2e
**Commit**: `feat(ui): the master's music layers and effects`

---

### T6: Som nas cenas, na tela

**What**: e2e of scenes with sound through the scene list; any wiring the flow lacks.
**Where**: `e2e/sound-scenes.spec.ts`, `src/renderer/ui/scene-menu.ts`
**Depends on**: T5
**Reuses**: the scene menu
**Requirement**: SOM-25, SOM-26, SOM-27, SOM-28, SOM-29

**Done when**:

- [ ] e2e: save "Taverna" with a layer at 60, change the layers, load: the other fades out and the layer is back at 60 in both windows; a scene without sound stops all; a deleted audio file blocks the load; "Importar .mesa" keeps the layers
- [ ] Phase gate passes

**Tests**: e2e
**Gate**: phase
**Commit**: `test(e2e): scenes bring their sound back`

---

## Checks

**C1** - Sons lists `musicas/` and `efeitos/` by name, subfolders as groups (SOM-01, AC 1)
Proof: run e2e | ✓ [C1] SOM-01

**C2** - Audio files added, renamed or removed show within 2 s (SOM-02, AC 2)
Proof: run e2e | ✓ [C2] SOM-02

**C3** - Files that are not MP3, OGG, WAV or M4A, or over 100 MB, are not listed (SOM-03, AC 3)
Proof: run unit | ✓ [C3] SOM-03

**C4** - "Adicionar arquivos" copies into Músicas or Efeitos, a repeat named `(2)` (SOM-04, AC 4)
Proof: run e2e | ✓ [C4] SOM-04

**C5** - Sons is in the starting layout and "Painéis"; a 0.7.0 layout gives the starting one (SOM-05, AC 5)
Proof: run e2e | ✓ [C5] SOM-05

**C6** - A click starts a music looping in every window, rising over 2 s, marked playing (SOM-06, AC 1)
Proof: run e2e | ✓ [C6] SOM-06

**C7** - A second click fades it out over 2 s and stops it everywhere (SOM-07, AC 2)
Proof: run e2e | ✓ [C7] SOM-07

**C8** - The master sees each playing layer with name and a 0..100 volume starting at 100 (SOM-08, AC 3)
Proof: run e2e | ✓ [C8] SOM-08

**C9** - A layer's volume reaches every window within 1 s (SOM-09, AC 4)
Proof: run e2e | ✓ [C9] SOM-09

**C10** - With 8 layers, another shows "Máximo de 8 camadas" and starts nothing (SOM-10, AC 5)
Proof: run e2e | ✓ [C10] SOM-10

**C11** - "Parar tudo" fades and stops every layer everywhere (SOM-11, AC 6)
Proof: run e2e | ✓ [C11] SOM-11

**C12** - Joining mid-layer plays from the master's point within 1 s, no rise (SOM-12, AC 7)
Proof: run e2e | ✓ [C12] SOM-12

**C13** - Two windows play a layer at most 1 s apart (SOM-13, AC 8)
Proof: run e2e | ✓ [C13] SOM-13

**C14** - A layer whose file arrives late plays from the current point (SOM-14, AC 9)
Proof: run unit | ✓ [C14] SOM-14

**C15** - Ending the table or losing the connection stops every sound in that window (SOM-15, AC 10)
Proof: run e2e | ✓ [C15] SOM-15

**C16** - An effect plays once in every window, overlapping (SOM-16, AC 1)
Proof: run e2e | ✓ [C16] SOM-16

**C17** - A player's window downloads the campaign's effects on join (SOM-17, AC 2)
Proof: run e2e | ✓ [C17] SOM-17

**C18** - An effect arriving more than 2 s late is not played (SOM-18, AC 3)
Proof: run unit | ✓ [C18] SOM-18

**C19** - A player has no play controls and a player's sound action is refused with "Sem permissão" (SOM-19, AC 4)
Proof: run e2e | ✓ [C19] SOM-19

**C20** - Every window has "Música" and "Efeitos" from 0 to 100 at 80 and "Mudo" (SOM-20, AC 1)
Proof: run e2e | ✓ [C20] SOM-20

**C21** - "Música" scales every layer in that window only (SOM-21, AC 2)
Proof: run e2e | ✓ [C21] SOM-21

**C22** - "Efeitos" scales effects in that window only (SOM-22, AC 3)
Proof: run e2e | ✓ [C22] SOM-22

**C23** - "Mudo" silences the window and off brings the volumes back (SOM-23, AC 4)
Proof: run e2e | ✓ [C23] SOM-23

**C24** - The personal controls come back after a restart (SOM-24, AC 5)
Proof: run e2e | ✓ [C24] SOM-24

**C25** - A saved scene keeps each playing layer's path and volume (SOM-25, AC 1)
Proof: run unit | ✓ [C25] SOM-25

**C26** - Loading a scene with layers fades out the others and plays its own at its volume (SOM-26, AC 2)
Proof: run e2e | ✓ [C26] SOM-26

**C27** - Loading a scene without layers fades every layer out (SOM-27, AC 3)
Proof: run e2e | ✓ [C27] SOM-27

**C28** - A scene whose audio file is gone does not load and shows "Arquivo não encontrado: <caminho>" (SOM-28, AC 4)
Proof: run e2e | ✓ [C28] SOM-28

**C29** - Importing a `.mesa` keeps the layers playing (SOM-29, AC 5)
Proof: run e2e | ✓ [C29] SOM-29

---

## Handoff

**Settled mid-build:** none
**Dispatched:** none
**Walked:** none

---

## Phase Execution Map

```
Phase 1 → Phase 2

Phase 1:  T1 → T2 → T3
Phase 2:  T3 → T4 → T5 → T6
```
