# campaign-folder proofs

**HEAD**: 2c83018
**Tree**: clean
**Shell**: /bin/sh
**Result**: 25 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ✓ [C1] CAMP-01` | pass |
| C2 | `run e2e / ✓ [C2] CAMP-02` | pass |
| C3 | `run e2e / ✓ [C3] CAMP-03` | pass |
| C4 | `run e2e / ✓ [C4] CAMP-04` | pass |
| C5 | `run e2e / ✓ [C5] CAMP-05` | pass |
| C6 | `run e2e / ✓ [C6] CAMP-06` | pass |
| C7 | `run e2e / ✓ [C7] CAMP-07` | pass |
| C8 | `run e2e / ✓ [C8] CAMP-08` | pass |
| C9 | `run e2e / ✓ [C9] CAMP-09` | pass |
| C10 | `run e2e / ✓ [C10] CAMP-10` | pass |
| C11 | `run e2e / ✓ [C11] CAMP-11` | pass |
| C12 | `run e2e / ✓ [C12] CAMP-12` | pass |
| C13 | `run e2e / ✓ [C13] CAMP-13` | pass |
| C14 | `run e2e / ✓ [C14] CAMP-14` | pass |
| C15 | `run unit / ✓ [C15] CAMP-15` | pass |
| C16 | `run unit / ✓ [C16] CAMP-16` | pass |
| C17 | `run e2e / ✓ [C17] CAMP-17` | pass |
| C18 | `run e2e / ✓ [C18] CAMP-18` | pass |
| C19 | `run e2e / ✓ [C19] CAMP-19` | pass |
| C20 | `run unit / ✓ [C20] CAMP-20` | pass |
| C21 | `run e2e / ✓ [C21] CAMP-21` | pass |
| C22 | `run unit / ✓ [C22] CAMP-22` | pass |
| Build | `scripts/with-node npm run build` | pass |
| Build | `scripts/with-node npm run typecheck` | pass |
| Build | `scripts/with-node npm run lint` | pass |

## Output

`Run e2e` - exit 0

```
  ✓  129 e2e/panels.spec.ts:419:1 › [C17] PANEL-17 the count disappears when its panel is shown, by its tab or by closing the panel in front of it (2.5s)
  ✓  131 e2e/update.spec.ts:71:1 › [C6] UPD-06 a player's "Reiniciar e atualizar" runs the install at once (1.9s)
  ✓  132 e2e/panels.spec.ts:450:1 › [C18] PANEL-18 selecting an item while Tokens is hidden keeps the visible panels and dots the Tokens tab (2.3s)
  ✓  133 e2e/update.spec.ts:81:1 › [C7] UPD-07 while hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs (2.0s)
  ✓  134 e2e/panels.spec.ts:468:1 › [C19] PANEL-19 showing Tokens clears the dot and shows the item's editor; clearing the selection first clears it too (2.1s)
  ✓  135 e2e/update.spec.ts:99:1 › [C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa" (2.0s)
  ✓  137 e2e/update.spec.ts:109:1 › [C13] UPD-13 an unpackaged app (npm run dev) never checks for updates and shows no bar (687ms)
  ✓  136 e2e/version.spec.ts:18:1 › [C14] UPD-14 the start screen shows "Versão <versão>" of the app (1.4s)
  ✓  138 e2e/update.spec.ts:117:1 › [C11] UPD-11 the same or an older version shows no bar (666ms)
  ✓  140 e2e/update.spec.ts:125:1 › [C12] UPD-12 a failed check or download shows no bar and the app keeps working (996ms)
  ✓  139 e2e/version.spec.ts:25:1 › [C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept (1.7s)
  ✓  141 e2e/version.spec.ts:40:1 › [C19] VER-05 a player refused for the version is in neither window players list (2.2s)
  ✓   88 e2e/net.spec.ts:111:1 › [C12] NET-12 after 60 s without reconnecting the player sees "Conexão perdida" and "Voltar ao início", which goes home (1.0m)

  141 passed (2.4m)
```

`Run unit` - exit 0

```
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C11] NET-11 Ana reconnecting with the same name still owns her token and can move it 60ms
 ✓ src/core/grid-detect.test.ts > detectGrid > [C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente" 1625ms
 ✓ src/core/grid-detect.test.ts > detectGrid > a detected grid produces no warning 1ms

 Test Files  34 passed (34)
      Tests  161 passed (161)
   Start at  09:50:12
   Duration  3.94s (tests 62%, import 31%, transform 6%, worker 2%)

    Isolate  34 workers spawned · ~203ms startup each (spawn + environment, per file)
             at least ~258ms faster with isolate: false — reuses workers across files instead of one per file

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
