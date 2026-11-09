# Mesa MVP verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 6677226
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `e2e/net.spec.ts` [C1] NET-01 the app opens on the start screen with "Hospedar" and "Entrar" | yes |
| C2 | `e2e/net.spec.ts` [C2] NET-02 "Hospedar" with the default port starts the server on 0.0.0.0:47800 and opens the table as master | yes |
| C3 | `e2e/net.spec.ts` [C3] NET-03 hosting lists 25.x as "Hamachi" and 26.x as "Radmin" and "Copiar" copies IP:porta | yes |
| C4 | `src/core/session-rules.test.ts` [C4] NET-04 rejects non-numeric and out-of-range ports with "Porta inválida" and accepts 1024..65535 | yes |
| C5 | `src/main/table-server.test.ts` [C5] NET-05 fails to start on a busy port with "Porta <porta> em uso" | yes |
| C6 | `e2e/net.spec.ts` [C6] NET-06 joining 127.0.0.1 as "Ana" shows "Ana" in the players list of both windows | yes |
| C7 | `src/main/table-server.test.ts` [C7] NET-07 rejects an empty name, a 25-character name and a name in use, with the matching reason | yes |
| C8 | `src/renderer/net/table-client.test.ts` [C8] NET-08 gives up after 5 s without an answer with "Não foi possível conectar a <IP>:<porta>" | yes |
| C9 | `src/main/table-server.test.ts` [C9] NET-09 refuses a ninth player with "Mesa cheia" | yes |
| C10 | `src/renderer/net/table-client.test.ts` [C10] NET-10 shows "Conexão com o mestre perdida — tentando reconectar" on a drop and retries every 3 s | yes - at the client status; no e2e draws the overlay (see findings) |
| C11 | `src/main/table-server.actions.test.ts` [C11] NET-11 Ana reconnecting with the same name still owns her token and can move it | yes |
| C12 | `src/renderer/net/table-client.test.ts` [C12] NET-12 turns into "Conexão perdida" after 60 s of failed retries and stops trying | no - asserts the client status only; the "Voltar ao início" button NET-12 requires is asserted nowhere |
| C13 | `e2e/net.spec.ts` [C13] NET-13 when the master closes the app the player sees "O mestre encerrou a mesa" and "Voltar ao início" | yes |
| C14 | `src/main/table-server.actions.test.ts` [C14] NET-14 a refused action changes nothing on the server and sends no patch to anyone | yes |
| C15 | `src/main/table-server.test.ts` [C15] NET-15 drops invalid JSON and unknown actions and keeps serving | yes |
| C16 | `src/main/table-server.actions.test.ts` [C16] NET-16 two simultaneous moves of one token leave every client at the position of the last to arrive | yes |
| C17 | `e2e/board.spec.ts` [C17] MAP-01 with no map the master sees "Nenhum mapa carregado" and "Importar mapa"; the player sees "Aguardando o mestre carregar um mapa" | yes |
| C18 | `e2e/map.spec.ts` [C18] MAP-02 the master imports a PNG and both windows show the map at the image width and height | yes |
| C19 | `src/core/grid-detect.test.ts` [C19] MAP-03 detects a 2000x1500 map with a 24x18 grid as a cell between 82 and 85 px | yes |
| C20 | `src/core/grid-detect.test.ts` [C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente" | yes - only the no-grid case; a grid below 20 px is not tried (see findings) |
| C21 | `e2e/map.spec.ts` [C21] MAP-05 setting the cell to 100 in the master panel redraws the grid at 100 px in both windows | yes |
| C22 | `src/core/grid.test.ts` [C22] MAP-06 clamps cell 5→10 and 900→500, offset above the cell to the cell, opacity 150%→100% | yes |
| C23 | `e2e/board.spec.ts` [C23] MAP-07 the wheel zooms only that window, between 10% and 400%, keeping the point under the cursor | yes |
| C24 | `e2e/board.spec.ts` [C24] MAP-08 dragging with the middle button pans only that window | yes - middle button only; the space-drag path of MAP-08 is untested (see findings) |
| C25 | `src/main/import.test.ts` [C25] MAP-09 refuses a .txt renamed to .png and a file over 50 MB with "Imagem inválida" | yes |
| C26 | `src/main/import-tokens.test.ts` [C26] TOK-01 a folder with goblin.png and elfa.png lists the tokens "goblin" and "elfa" | yes |
| C27 | `src/main/import-tokens.test.ts` [C27] TOK-02 goblin.json with "inimigo" and size 2 makes goblin an enemy 2x2 | yes |
| C28 | `src/main/import-tokens.test.ts` [C28] TOK-03 no manifest, invalid JSON or `faccao: "x"` give `neutro` and size 1 | yes |
| C29 | `e2e/library.spec.ts` [C29] TOK-04 dragging a library token onto the map places it in the cell under the cursor in both windows | yes |
| C30 | `e2e/board.spec.ts` [C30] TOK-05 dropping a dragged token snaps its top-left corner to the cell under it, in both windows | yes |
| C31 | `e2e/board.spec.ts` [C31] TOK-06 a size-2 token covers 2x2 cells, shows its name and has a ring in its faction colour | yes |
| C32 | `e2e/tokens.spec.ts` [C32] TOK-07 the master renames the token to "Chefe" and both windows show "Chefe" | yes |
| C33 | `e2e/tokens.spec.ts` [C33] TOK-08 the master removes a token and it disappears from both windows | yes |
| C34 | `src/main/import-tokens.test.ts` [C34] TOK-09 uses the palette colours, and without one grupo #3b82f6, inimigo #ef4444, npc #eab308, neutro #9ca3af | yes |
| C35 | `src/core/reducer.test.ts` [C35] TOK-10 refuses a move off the map and keeps the token where it was | yes |
| C36 | `e2e/tokens.spec.ts` [C36] TOK-11 when the master removes a token while the player is dragging it, the drag is cancelled | yes |
| C37 | `src/main/asset-store.test.ts` [C37] ASSET-01 the same content gets the same SHA-256 hash and different content a different one | yes |
| C38 | `src/renderer/net/asset-loader.test.ts` [C38] ASSET-02 with an empty cache it downloads the scene hash and writes it to the cache | yes |
| C39 | `src/renderer/net/asset-loader.test.ts` [C39] ASSET-03 with the hash already cached it makes no request | yes |
| C40 | `src/renderer/net/asset-loader.test.ts` [C40] ASSET-04 shows "Baixando arquivos 1/2", then "Baixando arquivos 2/2", then clears | yes |
| C41 | `src/renderer/net/asset-loader.test.ts` [C41] ASSET-05 a file with the wrong hash is asked 3 times and then shows "Falha ao baixar arquivo" | yes |
| C42 | `src/main/asset-store.test.ts` [C42] ASSET-06 answers 404 for a hash outside the scene and the library, and serves one the scene uses | yes |
| C43 | `e2e/tokens.spec.ts` [C43] PERM-01 the master picks "Ana" as owner of the Guerreira and the token shows "Ana" in the master window | yes |
| C44 | `src/core/reducer.test.ts` [C44] PERM-02 lets the master move, edit, hide, show and remove a token that is not theirs | yes |
| C45 | `src/main/table-server.actions.test.ts` [C45] PERM-03 Ana moving the Goblin gets `reject` and the Goblin stays where it was | yes |
| C46 | `src/core/reducer.test.ts` [C46] PERM-04 refuses every master-only action from a player and leaves the scene untouched | yes |
| C47 | `e2e/tokens.spec.ts` [C47] PERM-05 a hidden token disappears from the player window and has alpha 0.5 in the master window | yes |
| C48 | `e2e/tokens.spec.ts` [C48] PERM-06 showing the hidden token makes it appear again in the player window | yes |
| C49 | `e2e/tokens.spec.ts` [C49] PERM-07 Ana drags the Guerreira, which is hers, and cannot drag the Goblin | yes |
| C50 | `src/main/table-server.ephemeral.test.ts` [C50] PERM-08 a player with no tokens can roll, chat and send ruler, ping and stroke | yes |
| C51 | `src/main/table-server.log.test.ts` [C51] DICE-01 rolling `1d8+1d6-2` logs the author, the expression, each die and the right total for everyone | yes |
| C52 | `src/main/rng.test.ts` [C52] DICE-02 draws with `crypto.randomInt` and 60000 d6 land within 5% of 10000 per face | yes |
| C53 | `src/core/dice.test.ts` [C53] DICE-03 `2d20kh1` sums only the highest and marks the other dropped; `2d20kl1` sums the lowest | yes |
| C54 | `src/main/table-server.log.test.ts` [C54] DICE-04 `2d`, `101d6`, `1d1`, `1d6+2000` and `2d6kh3` give "Notação inválida: <expressão>" and nothing reaches the log | yes - but a modifier summed from several constants is never tried (see findings) |
| C55 | `e2e/log.spec.ts` [C55] CHAT-01 Ana sends "olá" and both windows show "Ana: olá" | yes |
| C56 | `src/main/table-server.log.test.ts` [C56] CHAT-02 an empty message or one of 501 characters is not sent; 500 characters are | yes |
| C57 | `src/main/table-server.log.test.ts` [C57] CHAT-03 with 250 entries in the log, whoever joins gets the last 200 | yes |
| C58 | `e2e/log.spec.ts` [C58] CHAT-04 `<b>oi</b>` shows the angle brackets as text, with no `b` element | yes |
| C59 | `e2e/tools.spec.ts` [C59] TOOL-01 a ruler from (0,0) to (3,5) shows "5" in both windows while it is dragged | yes |
| C60 | `e2e/tools.spec.ts` [C60] TOOL-02 releasing the ruler clears it in both windows | yes |
| C61 | `e2e/tools.spec.ts` [C61] TOOL-03 a ping shows in both windows and is gone 2 s later | yes |
| C62 | `e2e/tools.spec.ts` [C62] TOOL-04 a stroke shows in both windows and is gone 5 s after the mouse is released | yes |
| C63 | `src/main/table-server.ephemeral.test.ts` [C63] TOOL-05 of 40 pings in 10 s only 30 are relayed | yes |
| C64 | `src/core/fog-scene.test.ts` [C64] FOG-01 importing a map covers every fog cell | yes |
| C65 | `e2e/fog.spec.ts` [C65] FOG-02 a covered cell is opaque in the player window and 50% opaque in the master window | yes |
| C66 | `src/core/fog.test.ts` [C66] FOG-03 a brush of radius 2 reveals only the cells whose centre is within the radius, and Cover covers them again | yes |
| C67 | `src/core/fog.test.ts` [C67] FOG-04 a rectangle reveals only the cells whose centre is inside it, and Cover covers them again | yes |
| C68 | `src/core/fog.test.ts` [C68] FOG-05 "Cobrir tudo" leaves every cell covered | yes |
| C69 | `src/core/fog-scene.test.ts` [C69] FOG-06 a token under the fog is not in the view of who does not own it and is in its owner view | yes |
| C70 | `src/core/fog-scene.test.ts` [C70] FOG-07 revealing the token cell sends `token/upsert` to the player | yes |
| C71 | `src/core/fog-scene.test.ts` [C71] FOG-08 changing the cell size or the offset covers every cell again | yes |
| C72 | `src/core/mesa-file.test.ts` [C72] SAVE-01 the saved .mesa has the map, grid, tokens with every field, fog and each image in base64 | yes |
| C73 | `e2e/scene.spec.ts` [C73] SAVE-02 loading a .mesa shows the loaded scene in both windows | yes |
| C74 | `src/core/mesa-file.test.ts` [C74] SAVE-03 encoding then decoding a scene gives back the same scene and the same image bytes | yes |
| C75 | `src/core/mesa-file.test.ts` [C75] SAVE-04 invalid JSON, version 2 or an image with the wrong hash give "Arquivo .mesa inválido" | yes |
| C76 | `e2e/scene.spec.ts` [C76] SAVE-05 loading with tokens on the table asks "Substituir a cena atual?" and cancelling keeps the scene | yes |
| C77 | lone proof (tasks.md C77): `npm run dist && test "$(ls dist/MesaRPG-*-portable.exe \| wc -l)" = 1` (proofs.md: target=portable archs=x64, MesaRPG-0.1.0-portable.exe) | yes |
| C78 | `e2e/offline.spec.ts` [C78] PKG-02 the build loads nothing from an external http(s) URL and the CSP only allows 'self', ws: and http: | yes - static scan covers html/css only, not the JS bundle; the runtime request watch covers the loads |
| C80 | `e2e/board.spec.ts` `[C80] MAP-08 Space + left drag pans only that window and fires no tool (ping, fog)` | yes - added in the fix pass for finding 3 (not judged by the Verifier) |
| C79 | `e2e/tokens.spec.ts` [C79] TOK-12 a master click on a token right after a scene update selects it, 10 times out of 10 | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| MAP-04 breaks below the range: a grid whose period is under 20 px is reported as a wrong cell with no warning, instead of falling back to 70 px and "Grid não detectado — ajuste manualmente" | Own example at HEAD: a 1200x900 image with 2 px lines every 12 px gives `detectGrid` cell 23.17 and `gridFromDetection` warning `null`; every 15 px gives 29.61 and no warning. `src/core/grid-detect.ts:109-118` takes the first ACF peak at or above `PERIOD_MIN`, which is a multiple (2p) of a period below 20. A 450 px grid does fall back correctly | Before taking a peak at lag L, check for a stronger or comparable peak at L/2 or L/3 below `PERIOD_MIN` (true period below 20 means 'not detected'); add a [C20]-style test with a 12 px grid expecting cell 70 and the warning | 9da24cc - C20 now also asserts 12 and 15 px grids fall back to 70 px with the warning (fails on 6677226) |
| NET-12's "Voltar ao início" button and the NET-10/NET-12 screen states are asserted nowhere; C12 checks only the client status string | `src/renderer/net/table-client.test.ts:143` asserts `status` only; `src/renderer/ui/status-overlay.ts:5-16` draws the message and button but no e2e drives a drop (only NET-13 at `e2e/net.spec.ts:91`). Matrix: renderer UI is e2e, "every screen state" | Add an e2e that kills the master's server without `closed` (or stops it mid-session) and asserts `status-message` = "Conexão com o mestre perdida — tentando reconectar"; and assert `back-home` alongside "Conexão perdida" (unit-level render of `statusOverlay` with the `lost` status is enough for the button) | ccf8667 - C12 moved to an e2e that kills the master: retry screen, then "Conexão perdida" + "Voltar ao início" going home, never before 60 s (it also caught the client giving up ~3 s early) |
| MAP-08 space-drag pans but also fires the active tool: with Ping, Desenho, Régua or a fog tool selected, space+drag sends a ping/stroke/ruler or paints fog in every window | `src/renderer/board/board.ts:132` starts the pan on space+left button, but the Pixi stage handlers `src/renderer/board/overlays.ts:71` and `src/renderer/board/fog-layer.ts:46` check only `e.button !== 0`, not the space flag (only `startDrag`, `board.ts:172`, does). C24 tests the middle button only, so the space path has no test | Expose `board.panningKey` (or the space flag) and return early in `Overlays.down` and the fog `down` while it is held; add an e2e that holds Space, drags with the Ping/fog tool and asserts the camera moved and no ping/fog change reached the other window | 3bf008c - new check C80 (Space pan with Ping and both fog tools; fails on 6677226) |
| DICE-04 modifier bound -1000..1000 is enforced per constant, not on the expression's modifier: `1d6+1000+1000` (modifier +2000) and ten `+1000` terms (total 10000) are accepted | Own example at HEAD: `parseDice('1d6+1000+1000')` returns terms, `parseDice('1000+...+1000')` (10 terms) rolls to 10000. `src/core/dice.ts:36-38` compares each constant to `maxConst`; C54 only tries a single `+2000` | Sum the signed constants and refuse when the sum leaves -1000..1000 (or confirm with the user that the bound is per term and record it in the spec); add the case to C54's test | 614d9de - modifier is the signed sum of constants; C54 covers `1d6+1000+1000`; spec Assumptions row updated (c04bef8) |
| Names and chat count UTF-16 units, not characters: a 24-character name ending in an emoji gets "Nome inválido", and a 500-character message with one emoji is not sent | Own example at HEAD: `validateJoin('a'.repeat(23) + '🐉', [], 0)` → 'Nome inválido'; `validChat('x'.repeat(499) + '🐉')` → false. `src/core/session-rules.ts:25` and `src/core/chat.ts` use `.length` | Count code points (`[...s].length`) in `validateJoin` and `validChat` (and drop or match the input `maxlength`); add the emoji case to the NET-07 and CHAT-02 tests | 0fb17c7 - code-point length in validateJoin and validChat; emoji cases in the NET-07 test and C56 |
