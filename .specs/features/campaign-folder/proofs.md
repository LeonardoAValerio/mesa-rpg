# campaign-folder proofs

**HEAD**: 9e59f68
**Tree**: clean
**Shell**: /bin/sh
**Result**: 25 pass, 1 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ✓ [C1] CAMP-01` | pass |
| C2 | `run e2e / ✓ [C2] CAMP-02` | pass |
| C3 | `run unit / ✓ [C3] CAMP-03` | pass |
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
| Run e2e | `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list` | **fail** - exit 1 |
| Build | `scripts/with-node npm run build` | pass |
| Build | `scripts/with-node npm run typecheck` | pass |
| Build | `scripts/with-node npm run lint` | pass |

## Output

`Run e2e` - exit 1

```
    > 61 |   await expect(page.getByTestId('table')).toBeVisible()
         |                                           ^
      62 | }
      63 |
      64 | export async function join(page: Page, port: number, name: string): Promise<void> {
        at host (/home/usuario/Projects/basement-tabletop/mesa-rpg/e2e/helpers.ts:61:43)
        at masterAndPlayer (/home/usuario/Projects/basement-tabletop/mesa-rpg/e2e/helpers.ts:76:3)
        at table (/home/usuario/Projects/basement-tabletop/mesa-rpg/e2e/tokens.spec.ts:8:30)
        at /home/usuario/Projects/basement-tabletop/mesa-rpg/e2e/tokens.spec.ts:30:30

    Error Context: test-results/tokens--C43-PERM-01-the-ma-4f4e2-ws-Ana-in-the-master-window/error-context.md

  1 failed
    e2e/tokens.spec.ts:29:1 › [C43] PERM-01 the master picks "Ana" as owner of the Guerreira and the token shows "Ana" in the master window 
  140 passed (2.5m)
```

`Run unit` - exit 0

```
 ✓ src/main/table-server.actions.test.ts > TableServer actions > [C11] NET-11 Ana reconnecting with the same name still owns her token and can move it 61ms
 ✓ src/core/grid-detect.test.ts > detectGrid > [C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente" 1580ms
 ✓ src/core/grid-detect.test.ts > detectGrid > a detected grid produces no warning 0ms

 Test Files  34 passed (34)
      Tests  161 passed (161)
   Start at  09:24:05
   Duration  3.98s (tests 61%, import 31%, transform 5%, worker 2%)

    Isolate  34 workers spawned · ~222ms startup each (spawn + environment, per file)
             at least ~281ms faster with isolate: false — reuses workers across files instead of one per file

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```
