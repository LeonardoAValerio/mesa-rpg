# auto-update proofs

**HEAD**: df0f865
**Tree**: clean
**Shell**: /bin/sh
**Result**: 30 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && rm -rf dist && scripts/with-node npm run dist && v=$(sed` | pass |
| C2 | `run unit / ✓ [C2] UPD-02` | pass |
| C3 | `run unit / ✓ [C3] UPD-03` | pass |
| C4 | `run e2e / ✓ [C4] UPD-04` | pass |
| C5 | `run e2e / ✓ [C5] UPD-05` | pass |
| C6 | `run e2e / ✓ [C6] UPD-06` | pass |
| C7 | `run e2e / ✓ [C7] UPD-07` | pass |
| C8 | `run e2e / ✓ [C8] UPD-08` | pass |
| C9 | `run unit / ✓ [C9] UPD-09` | pass |
| C10 | `run unit / ✓ [C10] UPD-10` | pass |
| C11 | `run e2e / ✓ [C11] UPD-11` | pass |
| C12 | `run e2e / ✓ [C12] UPD-12` | pass |
| C13 | `run e2e / ✓ [C13] UPD-13` | pass |
| C14 | `run e2e / ✓ [C14] UPD-14` | pass |
| C15 | `run e2e / ✓ [C15] VER-01` | pass |
| C16 | `run unit / ✓ [C16] VER-02` | pass |
| C17 | `run unit / ✓ [C17] VER-03` | pass |
| C18 | `run unit / ✓ [C18] VER-04` | pass |
| C19 | `run e2e / ✓ [C19] VER-05` | pass |
| C20 | `run unit / ✓ [C20] REL-01` | pass |
| C21 | `run unit / ✓ [C21] REL-02` | pass |
| C22 | `run unit / ✓ [C22] REL-03` | pass |
| C23 | `run unit / ✓ [C23] REL-04` | pass |
| C24 | `cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && test "$(git rev-parse --show-toplevel)" = "$(pwd -P)" &&` | pass |
| C25 | `cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && old=$(git --git-dir=../.git-pre-split log --format="%s%x` | pass |
| C26 | `cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && ! git log --all --name-only --format= / grep -E '^(\.cla` | pass |
| C27 | `cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && grep -qx '## Instalar' README.md && grep -qx '## Jogar' ` | pass |
| Build | `cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && scripts/with-node npm run build` | pass |
| Build | `cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && scripts/with-node npm run typecheck` | pass |
| Build | `cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && scripts/with-node npm run lint` | pass |

## Output

`Run unit` - exit 0

```
 ✓ src/core/grid-detect.test.ts > detectGrid > [C19] MAP-03 detects a 2000x1500 map with a 24x18 grid as a cell between 82 and 85 px 1368ms
 ✓ src/core/grid-detect.test.ts > detectGrid > finds the offset of a grid that does not start at the edge 332ms
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C16] NET-16 two simultaneous moves of one token leave every client at the position of the last to arrive 2031ms
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C11] NET-11 Ana reconnecting with the same name still owns her token and can move it 60ms
 ✓ src/core/grid-detect.test.ts > detectGrid > [C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente" 1484ms
 ✓ src/core/grid-detect.test.ts > detectGrid > a detected grid produces no warning 1ms

 Test Files  30 passed (30)
      Tests  120 passed (120)
   Start at  13:59:40
   Duration  3.41s (tests 64%, import 28%, transform 7%, worker 2%)

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`Run e2e` - exit 0

```
  ✓  46 e2e/tools.spec.ts:66:1 › [C62] TOOL-04 a stroke shows in both windows and is gone 5 s after the mouse is released (7.0s)
  ✓  47 e2e/tools.spec.ts:88:1 › the ruler tool does not move tokens (TOOL-01) (1.5s)
  ✓  48 e2e/update.spec.ts:39:1 › [C4] UPD-04 a newer version shows "Baixando atualização <versão>…" in the top bar while it downloads (545ms)
  ✓  49 e2e/update.spec.ts:51:1 › [C5] UPD-05 a finished download shows "Atualização <versão> pronta" and "Reiniciar e atualizar", on the start screen and on the table (806ms)
  ✓  50 e2e/update.spec.ts:71:1 › [C6] UPD-06 a player's "Reiniciar e atualizar" runs the install at once (1.4s)
  ✓  51 e2e/update.spec.ts:81:1 › [C7] UPD-07 while hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs (1.5s)
  ✓  52 e2e/update.spec.ts:99:1 › [C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa" (1.4s)
  ✓  53 e2e/update.spec.ts:109:1 › [C13] UPD-13 an unpackaged app (npm run dev) never checks for updates and shows no bar (548ms)
  ✓  54 e2e/update.spec.ts:117:1 › [C11] UPD-11 the same or an older version shows no bar (545ms)
  ✓  55 e2e/update.spec.ts:125:1 › [C12] UPD-12 a failed check or download shows no bar and the app keeps working (702ms)
  ✓  56 e2e/version.spec.ts:18:1 › [C14] UPD-14 the start screen shows "Versão <versão>" of the app (1.1s)
  ✓  57 e2e/version.spec.ts:25:1 › [C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept (1.3s)
  ✓  58 e2e/version.spec.ts:40:1 › [C19] VER-05 a player refused for the version is in neither window players list (2.0s)

  58 passed (2.6m)
```

`cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && rm -rf dist && scripts/with-node npm run dist && v=$(sed` - exit 0

```


 Test Files  1 passed (1)
      Tests  1 passed | 2 skipped (3)
   Start at  14:03:07
   Duration  161ms (import 75%, transform 10%, tests 8%, worker 6%)

npm notice
npm notice New major version of npm available! 10.9.9 -> 12.2.2
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.2
npm notice To update run: npm install -g npm@12.2.2
npm notice
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

`cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && test "$(git rev-parse --show-toplevel)" = "$(pwd -P)" &&` - exit 0

```
.specs/features/auto-update/spec.md
package.json
```

`cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && old=$(git --git-dir=../.git-pre-split log --format="%s%x` - exit 0

```
(no output)
```

`cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && ! git log --all --name-only --format= / grep -E '^(\.cla` - exit 0

```
(no output)
```

`cd "$([ -d mesa-rpg ] && echo mesa-rpg // echo .)" && grep -qx '## Instalar' README.md && grep -qx '## Jogar' ` - exit 0

```
(no output)
```
