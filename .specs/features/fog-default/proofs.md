# fog-default proofs

**HEAD**: 6f2bfdd
**Tree**: clean
**Shell**: /bin/sh
**Result**: 8 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run unit / ✓ [C1] FOGD-01` | pass |
| C2 | `run e2e / ✓ [C2] FOGD-02` | pass |
| C3 | `run unit / ✓ [C3] FOGD-03` | pass |
| C4 | `run unit / ✓ [C4] FOGD-04` | pass |
| C5 | `run unit / ✓ [C5] FOGD-05` | pass |
| Build | `scripts/with-node npm run build` | pass |
| Build | `scripts/with-node npm run typecheck` | pass |
| Build | `scripts/with-node npm run lint` | pass |

## Output

`Run unit` - exit 0

```
 ✓ src/core/grid-detect.test.ts > detectGrid > [C19] MAP-03 detects a 2000x1500 map with a 24x18 grid as a cell between 82 and 85 px 1250ms
 ✓ src/core/grid-detect.test.ts > detectGrid > finds the offset of a grid that does not start at the edge 326ms
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C16] NET-16 two simultaneous moves of one token leave every client at the position of the last to arrive 2029ms
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C11] NET-11 Ana reconnecting with the same name still owns her token and can move it 59ms
 ✓ src/core/grid-detect.test.ts > detectGrid > [C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente" 1496ms
 ✓ src/core/grid-detect.test.ts > detectGrid > a detected grid produces no warning 1ms

 Test Files  30 passed (30)
      Tests  122 passed (122)
   Start at  15:05:49
   Duration  3.29s (tests 63%, import 28%, transform 7%, worker 2%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run e2e` - exit 0

```
  ✓  47 e2e/tools.spec.ts:66:1 › [C62] TOOL-04 a stroke shows in both windows and is gone 5 s after the mouse is released (6.8s)
  ✓  48 e2e/tools.spec.ts:88:1 › the ruler tool does not move tokens (TOOL-01) (1.4s)
  ✓  49 e2e/update.spec.ts:39:1 › [C4] UPD-04 a newer version shows "Baixando atualização <versão>…" in the top bar while it downloads (516ms)
  ✓  50 e2e/update.spec.ts:51:1 › [C5] UPD-05 a finished download shows "Atualização <versão> pronta" and "Reiniciar e atualizar", on the start screen and on the table (757ms)
  ✓  51 e2e/update.spec.ts:71:1 › [C6] UPD-06 a player's "Reiniciar e atualizar" runs the install at once (1.3s)
  ✓  52 e2e/update.spec.ts:81:1 › [C7] UPD-07 while hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs (1.3s)
  ✓  53 e2e/update.spec.ts:99:1 › [C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa" (1.3s)
  ✓  54 e2e/update.spec.ts:109:1 › [C13] UPD-13 an unpackaged app (npm run dev) never checks for updates and shows no bar (506ms)
  ✓  55 e2e/update.spec.ts:117:1 › [C11] UPD-11 the same or an older version shows no bar (526ms)
  ✓  56 e2e/update.spec.ts:125:1 › [C12] UPD-12 a failed check or download shows no bar and the app keeps working (590ms)
  ✓  57 e2e/version.spec.ts:18:1 › [C14] UPD-14 the start screen shows "Versão <versão>" of the app (984ms)
  ✓  58 e2e/version.spec.ts:25:1 › [C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept (1.2s)
  ✓  59 e2e/version.spec.ts:40:1 › [C19] VER-05 a player refused for the version is in neither window players list (1.9s)

  59 passed (2.6m)
```
