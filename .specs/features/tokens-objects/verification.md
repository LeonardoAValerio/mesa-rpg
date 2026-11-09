# Tokens e objetos verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 56f7634
**Verifier**: independent sub-agent (author != verifier)

Diff range `aa1f13c..86ff8ae`. Two mutations were run at HEAD and then reverted: commenting out `img.anchor.set(0.5)` left C1 green, and swapping the object and character layers left C7 and C6 green. Three throwaway e2e probes (a fog rect started on the resize handle, a rotated character dropped, deselection with Q/E) and three throwaway unit probes (snap at width 20 / 0.25 on an offset grid, clamp/rotation bounds, a v3 object with an owner) were also run and then deleted.

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `e2e/items.spec.ts` `[C1] ITEM-01 a 512x768 PNG at 2 cells is drawn whole at 200x300, centred on its position, in every window` | no - size and aspect hold, but "centred" is read from the container position, not the drawn image; with the anchor removed (image drawn from its top-left corner) the test stays green (F2) |
| C2 | `e2e/items.spec.ts` `[C2] ITEM-02 only a character with a ring set gets a ring; no ring and no frame otherwise, objects included` | yes |
| C3 | `e2e/items.spec.ts` `[C3] ITEM-03 Tamanho accepts 0.25 to 20 cells in steps of 0.25 and clamps the rest, in every window` | yes - both bounds, a step rounding, both windows |
| C4 | `e2e/items.spec.ts` `[C4] ITEM-04 dragging the corner handle resizes the item in steps of 0.25 cell, keeping the aspect, in every window` | yes |
| C5 | `e2e/items.spec.ts` `[C5] ITEM-05 a character shows its name under it; an object shows none` | yes |
| C6 | `e2e/items.spec.ts` `[C6] ITEM-06 Tipo switches an item between Objeto and Personagem in every window` | yes for the kind and label; its z assertion has the same flaw as C7 (F1) |
| C7 | `e2e/items.spec.ts` `[C7] ITEM-07 objects are drawn below characters, whatever the order they were placed in` | no - `z` is the index in a fixed `[...objectLayer, ...characterLayer]` list; with the layers swapped (objects drawn on top) the test stays green (F1) |
| C8 | `e2e/items.spec.ts` `[C8] ITEM-08 a dropped character snaps its left and top edges to grid lines; a dropped object stays where it was dropped` | yes for unrotated items (square and 2:3); no case for a rotated item, which does not snap (F6) |
| C9 | `e2e/items.spec.ts` `[C9] ITEM-09 Shift held at the drop leaves a character free and snaps an object` | yes |
| C10 | `e2e/library.spec.ts` `[C10] ITEM-10 a library drop puts the item's centre under the cursor, snapping a character, in both windows` | yes |
| C11 | `src/main/import-tokens.test.ts` `[C11] ITEM-11 goblin.json with "inimigo", tamanho 2 makes a 2-cell enemy character with a ring; tipo "objeto" makes an object` | yes (the fallbacks are held by `[C28] TOK-03` in the same file) |
| C12 | `src/core/items.test.ts` `[C12] ITEM-12 a rotation is a multiple of 15 from 0 to 345; other values round to the nearest one modulo 360` | yes for the rule; the editor field and "every window" are held only by an untagged e2e (F3) |
| C13 | `e2e/items.spec.ts` `[C13] ITEM-13 E and Q rotate the selected item 15° clockwise and anticlockwise, in every window` | yes |
| C14 | `src/core/reducer.test.ts` `[C14] ITEM-14 any player who sees a Livre item moves and rotates it, theirs or not, object or character` | yes - covers hidden and fogged items, and the owner's own item under the fog |
| C15 | `src/core/reducer.test.ts` `[C15] ITEM-15 a "Só mestre" item moves and rotates only for the master; a player gets "Só o mestre move este item"` | yes |
| C16 | `src/core/reducer.test.ts` `[C16] ITEM-16 a Travado item refuses every move and rotation, the master's too, with "Item travado"` | no - the server half holds; "no drag starts" (the board) is not in the selected test and is held only by an untagged e2e (F3) |
| C17 | `e2e/items.spec.ts` `[C17] ITEM-17 a refused move puts the item back where it was` | yes (a rotation is never applied before the server answers, so there is nothing to put back) |
| C18 | `src/core/reducer.test.ts` `[C18] ITEM-18 a player's edits other than move and rotate are refused with "Sem permissão" and change nothing` | yes |
| C19 | `src/core/reducer.test.ts` `[C19] ITEM-19 a placed item is Livre, unrotated and unowned; an object gets no ring` | yes |
| C20 | `src/core/mesa-file.test.ts` `[C20] ITEM-20 a version 2 (and 1) file loads its tokens as characters centred on their cells, as wide as their size, with their faction as ring, Livre` | yes |
| C21 | `src/core/mesa-file.test.ts` `[C21] ITEM-21 saving and loading keeps every item field: kind, position, size, rotation, ring, owner, Movimento, hidden` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 - C7 (and C6's z check) passes when objects are drawn above characters | `src/renderer/board/board.ts:337` builds `z` from `[...objectLayer.children, ...characterLayer.children]` whatever the real order is; swapping the layers at `board.ts:105` kept `[C7]` and `[C6]` green | derive `z` from the actual draw order (e.g. walk `tokenLayer`'s children in order, or use each sprite's world draw index) so that swapping the layers fails C7 | 5974867 - z is the real drawing order walked under the token layer; C7 fails with the layers swapped |
| F2 - C1 does not check that the image is centred on the item's position | `e2e/items.spec.ts:27` asserts `t.x, t.y`, which `board.ts:346` takes from `s.root` (the container), not the drawn image; with `img.anchor.set(0.5)` removed (`token-sprite.ts:31`) `[C1]` stays green | report the drawn image's bounds (e.g. `getBounds()` of the sprite in map pixels) in the hook and assert they are 300..500 x 150..450 | 5974867 - the hook reads the centre from the drawn image bounds; C1 fails without the centre anchor |
| F3 - the browser halves of C16 ("no drag starts") and C12 (the editor field, every window) are not in the tests their proofs select | C16 and C12 are `run unit`; the drag refusal is in the untagged `e2e/items.spec.ts:122`, and the Rotação field in the untagged `e2e/items.spec.ts:261`; the matrix puts the board and editor at e2e | tag those e2e tests (or add tagged ones) so that C16 and C12 select a test for the board and editor part | 5974867 - C12 and C16 are now e2e proofs (editor rotation in every window; drag blocked and server refusal from both windows) |
| F4 - a fog/ruler/draw stroke started on the selected item's handle also resizes the item (no check) | `src/renderer/board/selection.ts:123-125` `stageDown` starts a resize without checking `board.tool` or Space; a throwaway e2e at HEAD: select a 1-cell item, pick `tool-fog-rect`, drag from the handle -> the fog rect is drawn **and** the item becomes 4 cells (400 px) | start a resize only with the select tool and without Space held; add an e2e for it | 5974867 - the handle works only with Mover and not while Space pans; an e2e draws a fog rectangle from it and the item keeps its size |
| F5 - the selection can never be cleared, so Q/E and the handle stay live on the last clicked item (no check) | nothing calls `selection.select(null)` (only `board.ts:207` selects); a throwaway e2e at HEAD: after clicking empty map, pressing Escape and picking the ruler, pressing E still rotated the item 0 -> 15 | clear the selection on a click on empty map, Escape, or a tool change (as the spec's "Seleção" row implies), and test that E then does nothing | 5974867 - an empty click, Esc or another tool clears the selection; an e2e checks each and that E then turns nothing |
| F6 - a rotated character does not snap its drawn edges to grid lines (ITEM-08) | `src/core/items.ts:43-53` and `board.ts:148` snap with the unrotated width/height; a throwaway e2e at HEAD: a 100x150 character at 90° dropped at (520, 330) lands at (550, 375) with drawn left/top edges at 475/325, off the 100 px grid | snap with the rotated bounding box (swap w/h at 90°/270°; use the axis-aligned bounds otherwise) and add a rotated case to C8 | ebc21a7 + 5974867 - rotatedExtent snaps a turned item by its drawn box; C8 drops a 90° character and fails without it |
| F7 - a version 3 file can load an object with an owner (minor) | `src/core/mesa-file.ts:100` clears `ring` for an object but keeps `owner`; a throwaway unit probe loaded `{kind:'object', owner:'Ana'}` with `owner: 'Ana'`, so under the fog `canSee` shows the object to Ana only, against "objetos: sem dono" | also set `owner: null` for objects in `decodeMesa`, with a unit case | ebc21a7 - a version 3 object loads with no owner and no ring; unit test |
