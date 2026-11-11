# board-selection proofs

**HEAD**: d21ba14
**Tree**: clean
**Shell**: /bin/sh
**Result**: 26 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ✓ [C1] BRD-01` | pass |
| C2 | `run e2e / ✓ [C2] BRD-02` | pass |
| C3 | `run e2e / ✓ [C3] BRD-03` | pass |
| C4 | `run e2e / ✓ [C4] BRD-04` | pass |
| C5 | `run e2e / ✓ [C5] BRD-05` | pass |
| C6 | `run e2e / ✓ [C6] BRD-06` | pass |
| C7 | `run e2e / ✓ [C7] BRD-07` | pass |
| C8 | `run e2e / ✓ [C8] BRD-08` | pass |
| C9 | `run e2e / ✓ [C9] BRD-09` | pass |
| C10 | `run e2e / ✓ [C10] BRD-10` | pass |
| C11 | `run e2e / ✓ [C11] BRD-11` | pass |
| C12 | `run e2e / ✓ [C12] BRD-12` | pass |
| C13 | `run e2e / ✓ [C13] BRD-13` | pass |
| C14 | `run e2e / ✓ [C14] BRD-14` | pass |
| C15 | `run e2e / ✓ [C15] BRD-15` | pass |
| C16 | `run e2e / ✓ [C16] BRD-16` | pass |
| C17 | `run e2e / ✓ [C17] BRD-17` | pass |
| C18 | `run e2e / ✓ [C18] BRD-18` | pass |
| C19 | `run e2e / ✓ [C19] BRD-19` | pass |
| C20 | `run e2e / ✓ [C20] BRD-20` | pass |
| C21 | `run unit / ✓ [C21] BRD-21` | pass |
| C22 | `run e2e / ✓ [C22] BRD-22` | pass |
| C23 | `run e2e / ✓ [C23] BRD-23` | pass |
| Build | `scripts/with-node npm run build` | pass |
| Build | `scripts/with-node npm run typecheck` | pass |
| Build | `scripts/with-node npm run lint` | pass |

## Output

`Run e2e` - exit 0

```
  ✓  171 e2e/sound.spec.ts:126:1 › [C22] SOM-22 "Efeitos" scales effects in that window only, in what it really plays (3.2s)
  ✓  172 e2e/update.spec.ts:99:1 › [C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa" (2.2s)
  ✓  175 e2e/update.spec.ts:109:1 › [C13] UPD-13 an unpackaged app (npm run dev) never checks for updates and shows no bar (803ms)
  ✓  176 e2e/update.spec.ts:117:1 › [C11] UPD-11 the same or an older version shows no bar (853ms)
  ✓  177 e2e/update.spec.ts:125:1 › [C12] UPD-12 a failed check or download shows no bar and the app keeps working (1.0s)
  ✓  178 e2e/version.spec.ts:18:1 › [C14] UPD-14 the start screen shows "Versão <versão>" of the app (1.3s)
  ✓  174 e2e/sound.spec.ts:145:1 › [C23] SOM-23 "Mudo" silences what the window plays and turning it off brings the volumes back (5.9s)
  ✓  179 e2e/version.spec.ts:25:1 › [C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept (1.8s)
  ✓  173 e2e/tools.spec.ts:66:1 › [C62] TOOL-04 a stroke shows in both windows and is gone 5 s after the mouse is released (7.8s)
  ✓  181 e2e/version.spec.ts:40:1 › [C19] VER-05 a player refused for the version is in neither window players list (3.1s)
  ✓  180 e2e/sound.spec.ts:165:1 › [C24] SOM-24 "Música", "Efeitos" and "Mudo" come back when the app opens again on the same computer (4.1s)
  ✓  182 e2e/tools.spec.ts:88:1 › the ruler tool does not move tokens (TOOL-01) (2.6s)
  ✓  183 e2e/sound.spec.ts:181:1 › [C5] SOM-05 Sons is in every starting layout and in "Painéis"; a layout saved by 0.7.0 gives the starting one (2.2s)

  183 passed (3.4m)
```

`Run unit` - exit 0

```
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C11] NET-11 Ana reconnecting with the same name still owns her token and can move it 59ms
 ✓ src/core/grid-detect.test.ts > detectGrid > [C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente" 1627ms
 ✓ src/core/grid-detect.test.ts > detectGrid > a detected grid produces no warning 1ms

 Test Files  37 passed (37)
      Tests  214 passed (214)
   Start at  11:29:10
   Duration  4.15s (tests 66%, import 28%, transform 4%, worker 2%)

    Isolate  37 workers spawned · ~227ms startup each (spawn + environment, per file)
             at least ~333ms faster with isolate: false — reuses workers across files instead of one per file

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
