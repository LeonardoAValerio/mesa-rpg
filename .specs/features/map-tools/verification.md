# Map-tools verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 9705a1b
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `e2e/map-tools.spec.ts` `[C1] MTB-01 the map shows a column of tool icons on its left edge: Mover, Régua, Ping, Desenho, and Névoa for the master` | yes - exact button order per role, left edge, taller than wide, SVG count, no text |
| C2 | `e2e/map-tools.spec.ts` `[C2] MTB-02 pointing at a tool shows its name and shortcut` | yes - exact `title` for all five buttons |
| C3 | `e2e/map-tools.spec.ts` `[C3] MTB-03 clicking a tool makes it the active tool and marks its button` | yes - one tool clicked (Ping), but it asserts the press, the old button released and that the tool really acts; C4/C9 cover the other buttons |
| C4 | `e2e/map-tools.spec.ts` `[C4] MTB-04 V, R, P, D and (master) N pick the tools; N does nothing for a player` | yes - all five letters, plus N for a player |
| C5 | `e2e/map-tools.spec.ts` `[C5] MTB-05 in a text field the letters type and do not change the tool` | yes - the value typed and the tool unchanged (only an `<input>`; textarea/select untested) |
| C6 | `e2e/map-tools.spec.ts` `[C6] MTB-06 the top bar has no tool buttons, fog modes or radius` | yes - no `tool-*`/`fog-*` and buttons exactly "Painéis", "Encerrar mesa" |
| C7 | `e2e/map-tools.spec.ts` `[C7] MTB-07 clicks and drags on the tool column and the fog panel do not reach the map` | yes - click and drag on the column send no ping; a click on the fog panel draws no fog |
| C8 | `e2e/map-tools.spec.ts` `[C8] MTB-08 Névoa opens the fog panel with Pincel, Retângulo, Polígono, Cobrir, Revelar and the radius; Pincel and Cobrir the first time` | yes |
| C9 | `e2e/map-tools.spec.ts` `[C9] MTB-09 picking a shape makes it the active tool and the Névoa button shows its icon` | yes - each shape's icon name on the Névoa button |
| C10 | `e2e/map-tools.spec.ts` `[C10] MTB-10 the radius shows only with the brush` | yes - all three shapes, and back to the brush |
| C11 | `e2e/map-tools.spec.ts` `[C11] MTB-11 Esc, a press outside or another tool closes the fog panel; shape and mode stay for next time` | yes - for the cases it names; Esc with the focus in the panel's own radius field is not covered (F1) |
| C12 | `e2e/panels.spec.ts` `[C12] MTB-12 Rede holds the port, the firewall hint and each address with "Copiar"; the top bar does not` | yes - exact port text, hint, labels, clipboard `IP:porta`, absent from the top bar |
| C13 | `e2e/panels.spec.ts` `[C13] MTB-13 the master starts with Rede as a tab beside Conectados, Conectados open` | yes |
| C14 | `e2e/panels.spec.ts` `[C14] MTB-14 a player has no Rede, in the layout or in "Painéis"` | yes |
| C15 | `e2e/panels.spec.ts` `[C15] MTB-15 a layout saved by 0.5.0 gives the starting layout, with Rede` | no - passes with the key bump reverted (F2) |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 (C11, MTB-11): Esc does not close the fog panel while the focus is in the panel's own radius field | `src/renderer/ui/map-toolbar.ts:82` returns on `typing(e.target)` before the `Escape` branch at :83; throwaway e2e at HEAD: open Névoa, `fill('2')` in `fog-radius`, press Escape -> `fog-flyout` stays visible. Changing the radius is the panel's normal use, so the focus is often there | handle Escape before the typing guard (or when the target is inside the flyout) and add the case to C11's test | |
| F2 (C15, MTB-15): C15's test passes without the layout key change it is meant to prove | Mutation: `LAYOUT_KEY` back to `mesa-layout-v1-*` in `src/renderer/ui/layout.ts:15`, rebuild -> C15 still passes. `e2e/panels.spec.ts:70` copies `getItem('mesa-layout-v2-master')`, which is `null` under the mutation, so v1 gets `"null"` (rejected by PANEL-12) and the starting layout shows anyway. The copied layout also contains Rede, unlike a real 0.5.0 layout. A throwaway test that closes Rede and Chat, moves the saved layout to the v1 key and hosts again passes at HEAD and fails under the mutation (restores a layout without Rede) | save a 0.5.0-shaped layout (no `rede`) under `mesa-layout-v1-master` without depending on the v2 key, and assert the starting layout with Rede | |
| F3 (regression, MAP-08 Space pan): after clicking Névoa and closing its panel with Esc, Space (the pan key) reopens the panel | The clicked Névoa button keeps the focus and Space activates it (`src/renderer/ui/map-toolbar.ts:42` button `onclick: () => pick(def.tool)`); throwaway e2e at HEAD: click `tool-fog`, Escape, press Space -> `fog-flyout` visible again. The same happens on Space keyup after a Space+drag pan when the focus is on the Névoa button | keep the tool buttons from taking focus on click (e.g. `preventDefault` on `mousedown`, or blur after pick), or ignore Space activation on them; add a case | |

Probed with no finding: letters vs Q/E rotation, Space pan and Esc deselect (no letter clash; Esc both closes the panel and deselects, which is fine); shortcuts while a dockview tab or the "Painéis" menu button has focus (they pick tools, no field is involved); a player pressing N and the player's column (four buttons, panel never opens); the fog panel ("Cobrir tudo" still in Mapas) and the selection handle (unchanged `setTool` path); CSP: a throwaway e2e collecting console messages while the Lucide icons render saw no CSP violation; the v2 key with a real 0.5.0-shaped layout (see F2); nothing else the top bar held is lost (`actions` and the update bar still mount there; the old `toolbar` testid is no longer referenced). The proof run of `e2e/map-tools.spec.ts` and `e2e/panels.spec.ts` at HEAD: 36 passed.
