# fog-default verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 6f2bfdd (HEAD 73d09c2 only adds proofs.md)
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `src/core/fog-scene.test.ts` `[C1] FOGD-01 importing a map leaves every fog cell revealed, also over a fogged map` | yes - asserts 0 covered on a fresh map and on a second `map/set` over a fully covered map; a mutation that carries coverage over on `map/set` fails it |
| C2 | `e2e/fog.spec.ts` `[C2] FOGD-02 "Revelar tudo" clears the fog in the master's and the player's windows` | yes - clicks the real button and reads the drawn fog count (`snap().fog.covered`) in both windows, 48 -> 0, and that the player has no button |
| C3 | `src/core/fog-scene.test.ts` `[C3] FOGD-03 a player's "Revelar tudo" is refused with "Sem permissão" and changes nothing; with no map it is refused like "Cobrir tudo"` | yes - exact refusal value, pure reducer returns no scene, and the master's same action does reveal; also holds the no-map edge case |
| C4 | `src/core/fog-scene.test.ts` `[C4] FOGD-04 with no covered cell, changing the cell size or the offset keeps every cell revealed` | yes - cell, offsetX, offsetY each, from a fresh map and from a covered-then-revealed map, asserts 0 covered and the new dims |
| C5 | `src/core/fog-scene.test.ts` `[C5] FOGD-05 with one covered cell, changing the cell size or the offset covers every cell` | no - the single covered cell is always cell [0,0] (bit 0); an `anyCovered` that only reads the first cell still passes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 (C5): FOGD-05 is proven only with the first cell covered, so a bound/scan bug in `anyCovered` goes unseen - after a grid change the map would turn fully clear to players although the master had hidden a cell | Mutating `src/core/fog.ts:55` to `for (let i = 0; i < 1; i++)` leaves all of `src/core/fog-scene.test.ts` green (C5 at `fog-scene.test.ts:90` covers only `[[0, 0]]`); a throwaway test covering only the last cell [7,5] fails under the mutation and passes at HEAD | in C5 also cover a single cell other than the first (e.g. the last cell, [7,5], past the first byte) and assert every cell is covered after each grid change | 7f41115 - C5 covers one cell at a time at [0,0], [3,2] and [7,5]; the first-cell-only mutation fails it |

Probed and fine (no finding): own examples at HEAD - only the last cell covered then `grid/set cell 90` covers all; an offset grid (colStart -1, partial edge cells) imports with 0 covered, `fog/revealAll` on it is idempotent, and a cover brush at a negative column then an offset change covers all. Regressions: `map/set` and `grid/set` are the only producers of fresh fog (`coverAll`/`revealAll` used nowhere else); `.mesa` load keeps the saved `fog` unchanged (`src/core/mesa-file.ts:31`) and `e2e/scene.spec.ts` now covers before revealing so the save/load round trip still carries real fog; FOG-06/FOG-07 unit tests and `e2e/fog.spec.ts` `table()` start from `fog/coverAll`, so token hiding under fog is still exercised; player view draws from `scene.fog` with no assumption of a covered start (`src/core/view.ts:8`). Mutation removing the coverage carry in `map/set` is caught by C1.
