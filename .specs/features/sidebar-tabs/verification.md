# Painéis encaixáveis verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 02384d3
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | `panels.spec.ts` `[C1] PANEL-01 the master starts with the table in the centre and, on its right, Conectados above Tokens · Mapas · Dados · Chat with Mapas open` | yes - exact groups, order, positions, active tab, visible set, labels |
| C2 | `panels.spec.ts` `[C2] PANEL-02 a player starts with Conectados above Dados · Chat with Dados open, and no Tokens or Mapas` | yes |
| C3 | `panels.spec.ts` `[C3] PANEL-03 clicking a tab shows that panel in its group and marks the tab active` | yes - each tab, the others hidden, `dv-active-tab` class |
| C4 | `panels.spec.ts` `[C4] PANEL-04 Tokens holds the token import, the palette, the library and the item editor` | yes - each control located inside `panel-tokens` |
| C5 | `panels.spec.ts` `[C5] PANEL-05 Mapas holds Salvar cena, Carregar cena, Importar mapa, the grid settings, Cobrir tudo and Revelar tudo` | yes |
| C6 | `panels.spec.ts` `[C6] PANEL-06 a tab dropped on another group moves there; dropped on a group's bottom edge it splits that group` | yes - real drags, both cases, the new group below |
| C7 | `panels.spec.ts` `[C7] PANEL-07 dragging the divider between the table and the panels resizes both, and the table fits` | partly - table/group divider and canvas width are held; the divider between two groups (named by the criterion) is never dragged (F4) |
| C8 | `panels.spec.ts` `[C8] PANEL-08 a floated group shows over the table and moves; with the right column empty the table takes its space` | yes |
| C9 | `panels.spec.ts` `[C9] PANEL-09 a closed panel leaves the screen and shows unmarked in "Painéis"; picking it opens it again` | yes |
| C10 | `panels.spec.ts` `[C10] PANEL-10 "Restaurar layout" brings back the starting layout` | yes - master only; my own player example (float Dados, close Conectados, restore) also gives PANEL-02 |
| C11 | `panels.spec.ts` `[C11] PANEL-11 the layout is saved per role on the computer and comes back at the next table` | no - passes with both roles on the same storage key; the player case never saves a player layout (F1) |
| C12 | `panels.spec.ts` `[C12] PANEL-12 an unreadable saved layout, or one with another role's panels, gives the starting layout` | partly - the three unreadable values hold; the "other role's panels" case copies an empty master key, so it passes with the role filter removed (F2) |
| C13 | `panels.spec.ts` `[C13] PANEL-13 the table has no tab, and a tab dropped on its centre does not join it` | yes - fails when `group.locked = true` is removed |
| C14 | `panels.spec.ts` `[C14] PANEL-14 text typed in a panel stays when it is moved, floated, closed and reopened` | yes - all four moves on `dice-input` |
| C15 | `panels.spec.ts` `[C15] PANEL-15 Dados holds the roller and only the rolls; Chat only the messages and the input` | yes - both windows |
| C16 | `panels.spec.ts` `[C16] PANEL-16 a hidden Dados or Chat tab shows how many entries arrived, up to "9+"` | no - 1, 2, then 10 → "9+"; the count at 9 is never shown, so `n >= 9` passes (F3) |
| C17 | `panels.spec.ts` `[C17] PANEL-17 the count disappears when its panel is shown, also when shown by floating it` | yes - tab click and closing the sibling; the title says "floating" but the test closes Dados (wording only) |
| C18 | `panels.spec.ts` `[C18] PANEL-18 selecting an item while Tokens is hidden keeps the visible panels and dots the Tokens tab` | yes - also the negative case with Tokens visible |
| C19 | `panels.spec.ts` `[C19] PANEL-19 showing Tokens clears the dot and shows the item's editor; clearing the selection first clears it too` | yes |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 (C11) - "separately for master and player" is not proven: C11 passes when the player key equals the master key | Mutation `LAYOUT_KEY.player = 'mesa-layout-v1-master'` (`src/renderer/ui/layout.ts:13`), C11 still passes: the master layout is rejected by the role filter, so the player gets the starting layout anyway (`e2e/panels.spec.ts:232-241`). No test saves a player layout and reads it back (throwaway check at HEAD: it does come back) | in C11, have the player change their layout (e.g. close Chat), relaunch with the same profile as master and as player, and assert each role sees its own arrangement | 614de85 - C11 saves a master and a player layout on one computer and each comes back; fails with one shared key |
| F2 (C12) - the "another role's panels" case does not test the role filter | Mutation removing `ids.some((id) => !allowed.includes(id))` (`src/renderer/ui/layout.ts:76`), C12 still passes. `e2e/panels.spec.ts:257-260` copies `mesa-layout-v1-master`, which after the loop holds no master layout (read back as null at HEAD), so the player key gets an unreadable value | write a real master layout (with `tokens`/`mapas`) into `mesa-layout-v1-player` before joining, and assert the starting player layout | 614de85 - C12 copies a real saved master layout into the player key; fails without the role filter |
| F3 (C16) - the "up to 9+" bound is not held at 9 | `e2e/panels.spec.ts:321-326` checks 1, 2, then 10 → "9+". Mutation `n > 9` → `n >= 9` (`src/renderer/ui/layout.ts:246`), C16 still passes. The Design fixes "1..9 or 9+" (throwaway check at HEAD: 9 shows "9") | assert "9" after nine arrivals and "9+" after the tenth | 614de85 - C16 checks "9" at nine and "9+" at ten; fails with >= 9 |
| F4 (C7) - the divider between two groups is not tested | PANEL-07 names "between groups or between the table and a group"; `e2e/panels.spec.ts:137-153` drags only the table/group divider | also drag the divider between Conectados and the tab group and assert both heights change | 614de85 - C7 also drags the divider between Conectados and the tab group |

Probed with no finding: the CSP stays strict (`dockview.css` is linked as `assets/index-*.css`; the only `<style>` creation in the bundle is dockview's popout-window copy, which is not used; `offline.spec.ts` C78 sees no CSP console errors on the table); board's own "Importar mapa" with Mapas closed imports the map; the master's layout survives "Encerrar mesa" and hosting again in the same run; a count gathered while Chat is closed clears when Chat is reopened from "Painéis"; dragging a tab onto the table centre does not join it. The two Edge Cases in the spec have no check (the floating-off-window restore was not probed).
