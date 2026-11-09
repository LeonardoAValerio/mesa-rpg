# Fog shapes verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 64b9906
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `e2e/fog-tools.spec.ts` `[C1] FOGS-01 a brush drag covers the points within the brush radius of the path, and none past it, in every window` | yes - samples 90-95 px inside and 120 px outside a 100 px radius, caps included, in both windows |
| C2 | `e2e/fog-tools.spec.ts` `[C2] FOGS-02 a rectangle covers exactly its inside in every window` | yes |
| C3 | `e2e/fog-tools.spec.ts` `[C3] FOGS-03 a polygon closed on its first point, by a double click or by Enter covers its inside only, in every window` | yes for the simple L polygon on all three closings; a self-intersecting polygon is drawn differently from the model (F3) |
| C4 | `src/core/fog.test.ts` `[C4] FOGS-04 at a point the last shape containing it decides, and with none the base decides` | yes |
| C5 | `e2e/fog.spec.ts` `[C5] FOGS-05 "Cobrir tudo" covers and "Revelar tudo" reveals the whole map, edges included, in every window` | yes |
| C6 | `src/core/fog-scene.test.ts` `[C6] FOGS-06 a token whose centre is under the fog is withheld from non-owners and sent once its centre is revealed` | yes - owner, non-owner, master, three revealed cells without the centre |
| C7 | `src/core/fog-scene.test.ts` `[C7] FOGS-07 a player's fog action is refused with "Sem permissão" and changes nothing` | yes |
| C8 | `src/core/fog-scene.test.ts` `[C8] FOGS-08 the 2001st shape and a 2001-point stroke are refused with the limit message and change nothing` | no - calls `applyAction` directly, past the protocol; a stroke of 2002+ points is dropped by the protocol with no message (F1) |
| C9 | `src/core/fog-scene.test.ts` `[C9] FOGS-09 changing the cell size or the offset leaves the fog exactly as it was` | yes |
| C10 | `e2e/fog-tools.spec.ts` `[C10] FOGT-01 picking a fog tool shows "Cobrir" and "Revelar" in the toolbar, "Cobrir" selected the first time` | yes |
| C11 | `e2e/fog-tools.spec.ts` `[C11] FOGT-02 holding Alt draws in the opposite mode, and releasing it goes back to the selected mode` | yes - both modes, read from the player's drawn fog |
| C12 | `e2e/fog-tools.spec.ts` `[C12] FOGT-03 the brush shows a circle of its radius under the cursor` | no - asserts the tool's `cursor` state; with the ring drawing disabled the test still passes (F4) |
| C13 | `e2e/fog-tools.spec.ts` `[C13] FOGT-04 while drawing only the master sees a preview; the fog changes in every window on release` | no - the "nothing changes before release" half holds, but the preview is read from tool state; with the preview drawing disabled the test still passes (F5) |
| C14 | `e2e/fog-tools.spec.ts` `[C14] FOGT-05 Esc while drawing a polygon discards it and sends nothing` | yes - also checks 0 shapes in both windows |
| C15 | `src/core/fog.test.ts` `[C15] FOGT-06 the brush radius is 0.5 to 10 cells in steps of 0.5` | yes - bounds, steps, rounding, NaN; the input clamp is also seen in C12's test |
| C16 | `e2e/fog-tools.spec.ts` `[C16] FOGT-07 without a fog tool the toolbar shows no fog modes, and a player never sees them` | yes |
| C17 | `src/core/mesa-file.test.ts` `[C17] FOGS-10 a version 1 file loads with its cell fog as covered rectangles over the same areas` | yes - every cell centre of a 4x3 v1 fog; offset grids in `fog.test.ts` |
| C18 | `src/core/mesa-file.test.ts` `[C18] FOGS-11 saving and loading keeps the fog shapes in the same order` | yes - rect, stroke, poly in order, full equality |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 - A stroke or polygon of more than 2001 points is dropped without the limit message (FOGS-08, C8) | `src/core/protocol.ts:12` `z.array(num).max(4002)`; throwaway test: `parseClientMsg` returns null for 2002 and 3000 points, so `table-server.ts:179` drops it, no refusal is sent and the client's pending promise never resolves; `fog-tools.ts:180` puts no cap on a stroke (points every radius/4, about 1.25 map px at a 10 px cell), so a long small-brush stroke vanishes silently | let the protocol accept the shape and let `addShape` refuse it (or cap and simplify on the client), and test the refusal through the server (`table-server.actions.test.ts`) with a 2002+ point stroke | 22c602f - the wire takes up to 20000 numbers and the client stops at 2001 points; C8 goes through parseClientMsg at 2001 and 3000 points |
| F2 - The master never sees "Névoa com formas demais: use Cobrir tudo ou Revelar tudo" | `src/renderer/board/fog-tools.ts:163` and `:196` `void this.client.send(...)` discard the refusal; the spec's decision row says the message tells the master what to do; no e2e shows it | show the refusal reason on screen (as `grid-panel.ts:70` does) and add an e2e at 2000 shapes | 22c602f - refusals show in the fog panel (fog-error); an e2e draws the 2001st shape and reads the message |
| F3 - A self-intersecting polygon is drawn differently from the model, so token visibility disagrees with the fog on screen (FOGS-03, FOGS-06) | `src/core/fog.ts:31` uses even-odd; `src/renderer/board/fog-layer.ts:12` fills with `g.poly(...).fill()` (earcut). Throwaway e2e at HEAD: a Cobrir pentagram, centre (400,300): `fogAt` false (a token there is sent to players) but `fogSample` on the player window true (drawn black). A Revelar star gives the opposite: drawn open, token withheld | draw the polygon with the same rule as `fogAt` (or make `fogAt` match the fill rule), and add a unit + e2e case with a crossing polygon | 22c602f - the fog is painted on a 2D canvas with even-odd polygons; an e2e star leaves its centre revealed on screen and sends the token there |
| F4 - C12 does not check that a circle is drawn | `e2e/fog-tools.spec.ts:97` reads `fogTool().cursor`, computed from `radiusPx`; mutating `fog-tools.ts` so `this.ring.circle(...)` never runs leaves C12 green | assert the drawn ring (e.g. bounds of the `ring` Graphics, or pixels under the cursor) | 9b4a598 - the snapshot measures the drawn ring; C12 fails when the ring is not drawn |
| F5 - C13 does not check that a preview is drawn | `e2e/fog-tools.spec.ts:118` reads `fogTool().preview`, built from the drawing state; mutating `fog-tools.ts` so `drawShape(this.preview, ...)` never runs leaves C13 green | assert the drawn preview (bounds of the `preview` Graphics or its pixels) | 9b4a598 - the snapshot measures the drawn preview box; C13 fails when the preview is not drawn |
| F6 - The fog test hook reads the texture, not the screen, and the scaled-down path for maps over 2048 px has no test | `src/renderer/board/fog-layer.ts:76` `sample` maps points with `this.k` straight into the RenderTexture; the sprite's size/position (`fog-layer.ts:67`) and visibility order are never checked, so dropping `sprite.width = map.width` on a 4096 px map would leave every e2e green while the fog covers a quarter of the map. A throwaway 4096x3072 example sampled correctly at HEAD | sample through the sprite's transform (or read the composed canvas), and add one e2e on a map larger than 2048 px | 22c602f - fogSample goes through the sprite transform; an e2e on a 4096x3072 map fails when the sprite is not stretched |
| F7 - Space-pan with the polygon tool is not covered | `e2e/board.spec.ts:103` loops over ping, fog-rect and fog-brush only; `fog-poly` is guarded in `fog-tools.ts` `down` but untested | add `tool-fog-poly` to the MAP-08 loop | ee054bf - MAP-08 also covers fog-poly; it fails when Space no longer blocks the fog tools |
