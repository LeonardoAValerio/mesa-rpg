# sounds proofs

**HEAD**: ce7b4fe
**Tree**: clean
**Shell**: /bin/sh
**Result**: 32 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ✓ [C1] SOM-01` | pass |
| C2 | `run e2e / ✓ [C2] SOM-02` | pass |
| C3 | `run unit / ✓ [C3] SOM-03` | pass |
| C4 | `run e2e / ✓ [C4] SOM-04` | pass |
| C5 | `run e2e / ✓ [C5] SOM-05` | pass |
| C6 | `run e2e / ✓ [C6] SOM-06` | pass |
| C7 | `run e2e / ✓ [C7] SOM-07` | pass |
| C8 | `run e2e / ✓ [C8] SOM-08` | pass |
| C9 | `run e2e / ✓ [C9] SOM-09` | pass |
| C10 | `run e2e / ✓ [C10] SOM-10` | pass |
| C11 | `run e2e / ✓ [C11] SOM-11` | pass |
| C12 | `run e2e / ✓ [C12] SOM-12` | pass |
| C13 | `run e2e / ✓ [C13] SOM-13` | pass |
| C14 | `run unit / ✓ [C14] SOM-14` | pass |
| C15 | `run e2e / ✓ [C15] SOM-15` | pass |
| C16 | `run e2e / ✓ [C16] SOM-16` | pass |
| C17 | `run e2e / ✓ [C17] SOM-17` | pass |
| C18 | `run unit / ✓ [C18] SOM-18` | pass |
| C19 | `run e2e / ✓ [C19] SOM-19` | pass |
| C20 | `run e2e / ✓ [C20] SOM-20` | pass |
| C21 | `run e2e / ✓ [C21] SOM-21` | pass |
| C22 | `run e2e / ✓ [C22] SOM-22` | pass |
| C23 | `run e2e / ✓ [C23] SOM-23` | pass |
| C24 | `run e2e / ✓ [C24] SOM-24` | pass |
| C25 | `run unit / ✓ [C25] SOM-25` | pass |
| C26 | `run e2e / ✓ [C26] SOM-26` | pass |
| C27 | `run e2e / ✓ [C27] SOM-27` | pass |
| C28 | `run e2e / ✓ [C28] SOM-28` | pass |
| C29 | `run e2e / ✓ [C29] SOM-29` | pass |
| Build | `scripts/with-node npm run build` | pass |
| Build | `scripts/with-node npm run typecheck` | pass |
| Build | `scripts/with-node npm run lint` | pass |

## Output

`Run e2e` - exit 0

```
  ✓  153 e2e/sound.spec.ts:126:1 › [C22] SOM-22 "Efeitos" scales effects in that window only, in what it really plays (3.3s)
  ✓  155 e2e/update.spec.ts:99:1 › [C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa" (2.3s)
  ✓  158 e2e/update.spec.ts:109:1 › [C13] UPD-13 an unpackaged app (npm run dev) never checks for updates and shows no bar (791ms)
  ✓  159 e2e/update.spec.ts:117:1 › [C11] UPD-11 the same or an older version shows no bar (664ms)
  ✓  160 e2e/update.spec.ts:125:1 › [C12] UPD-12 a failed check or download shows no bar and the app keeps working (954ms)
  ✓  161 e2e/version.spec.ts:18:1 › [C14] UPD-14 the start screen shows "Versão <versão>" of the app (1.4s)
  ✓  157 e2e/sound.spec.ts:142:1 › [C23] SOM-23 "Mudo" silences what the window plays and turning it off brings the volumes back (5.9s)
  ✓  162 e2e/version.spec.ts:25:1 › [C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept (1.8s)
  ✓  156 e2e/tools.spec.ts:66:1 › [C62] TOOL-04 a stroke shows in both windows and is gone 5 s after the mouse is released (7.9s)
  ✓  163 e2e/sound.spec.ts:162:1 › [C24] SOM-24 "Música", "Efeitos" and "Mudo" come back when the app opens again on the same computer (4.2s)
  ✓  165 e2e/tools.spec.ts:88:1 › the ruler tool does not move tokens (TOOL-01) (2.6s)
  ✓  164 e2e/version.spec.ts:40:1 › [C19] VER-05 a player refused for the version is in neither window players list (3.1s)
  ✓  166 e2e/sound.spec.ts:178:1 › [C5] SOM-05 Sons is in every starting layout and in "Painéis"; a layout saved by 0.7.0 gives the starting one (2.2s)

  166 passed (3.2m)
```

`Run unit` - exit 0

```
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C11] NET-11 Ana reconnecting with the same name still owns her token and can move it 58ms
 ✓ src/core/grid-detect.test.ts > detectGrid > [C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente" 1544ms
 ✓ src/core/grid-detect.test.ts > detectGrid > a detected grid produces no warning 1ms

 Test Files  37 passed (37)
      Tests  202 passed (202)
   Start at  11:43:40
   Duration  3.99s (tests 64%, import 29%, transform 5%, worker 2%)

    Isolate  37 workers spawned · ~216ms startup each (spawn + environment, per file)
             at least ~317ms faster with isolate: false — reuses workers across files instead of one per file

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
