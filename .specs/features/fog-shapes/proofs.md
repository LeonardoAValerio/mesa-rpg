# fog-shapes proofs

**HEAD**: 239309a
**Tree**: clean
**Shell**: /bin/sh
**Result**: 21 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ✓ [C1] FOGS-01` | pass |
| C2 | `run e2e / ✓ [C2] FOGS-02` | pass |
| C3 | `run e2e / ✓ [C3] FOGS-03` | pass |
| C4 | `run unit / ✓ [C4] FOGS-04` | pass |
| C5 | `run e2e / ✓ [C5] FOGS-05` | pass |
| C6 | `run unit / ✓ [C6] FOGS-06` | pass |
| C7 | `run unit / ✓ [C7] FOGS-07` | pass |
| C8 | `run unit / ✓ [C8] FOGS-08` | pass |
| C9 | `run unit / ✓ [C9] FOGS-09` | pass |
| C10 | `run e2e / ✓ [C10] FOGT-01` | pass |
| C11 | `run e2e / ✓ [C11] FOGT-02` | pass |
| C12 | `run e2e / ✓ [C12] FOGT-03` | pass |
| C13 | `run e2e / ✓ [C13] FOGT-04` | pass |
| C14 | `run e2e / ✓ [C14] FOGT-05` | pass |
| C15 | `run unit / ✓ [C15] FOGT-06` | pass |
| C16 | `run e2e / ✓ [C16] FOGT-07` | pass |
| C17 | `run unit / ✓ [C17] FOGS-10` | pass |
| C18 | `run unit / ✓ [C18] FOGS-11` | pass |
| Build | `scripts/with-node npm run build` | pass |
| Build | `scripts/with-node npm run typecheck` | pass |
| Build | `scripts/with-node npm run lint` | pass |

## Output

`Run e2e` - exit 0

```
  ✓  60 e2e/tools.spec.ts:66:1 › [C62] TOOL-04 a stroke shows in both windows and is gone 5 s after the mouse is released (6.9s)
  ✓  61 e2e/tools.spec.ts:88:1 › the ruler tool does not move tokens (TOOL-01) (1.5s)
  ✓  62 e2e/update.spec.ts:39:1 › [C4] UPD-04 a newer version shows "Baixando atualização <versão>…" in the top bar while it downloads (550ms)
  ✓  63 e2e/update.spec.ts:51:1 › [C5] UPD-05 a finished download shows "Atualização <versão> pronta" and "Reiniciar e atualizar", on the start screen and on the table (873ms)
  ✓  64 e2e/update.spec.ts:71:1 › [C6] UPD-06 a player's "Reiniciar e atualizar" runs the install at once (1.4s)
  ✓  65 e2e/update.spec.ts:81:1 › [C7] UPD-07 while hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs (1.5s)
  ✓  66 e2e/update.spec.ts:99:1 › [C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa" (1.4s)
  ✓  67 e2e/update.spec.ts:109:1 › [C13] UPD-13 an unpackaged app (npm run dev) never checks for updates and shows no bar (543ms)
  ✓  68 e2e/update.spec.ts:117:1 › [C11] UPD-11 the same or an older version shows no bar (528ms)
  ✓  69 e2e/update.spec.ts:125:1 › [C12] UPD-12 a failed check or download shows no bar and the app keeps working (651ms)
  ✓  70 e2e/version.spec.ts:18:1 › [C14] UPD-14 the start screen shows "Versão <versão>" of the app (1.1s)
  ✓  71 e2e/version.spec.ts:25:1 › [C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept (1.3s)
  ✓  72 e2e/version.spec.ts:40:1 › [C19] VER-05 a player refused for the version is in neither window players list (1.9s)

  72 passed (3.3m)
```

`Run unit` - exit 0

```
 ✓ src/core/grid-detect.test.ts > detectGrid > [C19] MAP-03 detects a 2000x1500 map with a 24x18 grid as a cell between 82 and 85 px 1363ms
 ✓ src/core/grid-detect.test.ts > detectGrid > finds the offset of a grid that does not start at the edge 347ms
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C16] NET-16 two simultaneous moves of one token leave every client at the position of the last to arrive 2041ms
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C11] NET-11 Ana reconnecting with the same name still owns her token and can move it 62ms
 ✓ src/core/grid-detect.test.ts > detectGrid > [C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente" 1555ms
 ✓ src/core/grid-detect.test.ts > detectGrid > a detected grid produces no warning 1ms

 Test Files  30 passed (30)
      Tests  128 passed (128)
   Start at  18:19:47
   Duration  3.50s (tests 62%, import 30%, transform 7%, worker 2%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
