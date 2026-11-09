# Mesa RPG — Mapa importado sem névoa e "Revelar tudo"

**Approved**: 2026-11-09 - user: "Aprovo sim"

## Problem Statement

Todo mapa importado vem 100% coberto pela névoa (FOG-01 do MVP): o mestre o vê 50% escuro e os jogadores veem preto, e não há como limpar tudo de uma vez. user: "quando eu importo um mapa ele fica meio escurecido, mesmo eu não tendo colocado névoa (...) não estou conseguindo deixar ele totalmente claro". Ajustar o grid também recobre tudo (FOG-08), então o mapa volta a escurecer depois de cada ajuste.

## Goals

- [ ] Um mapa recém-importado aparece claro para o mestre e para os jogadores.
- [ ] O mestre deixa o mapa inteiro claro com um clique.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Perguntar "Com névoa / Sem névoa" ao importar | user escolheu "Mapa vem sem névoa (Recomendado)" |
| Mudar a opacidade da névoa do mestre (50%) | Não pedido; FOG-02 segue igual |
| Mapear a névoa antiga para o grid novo célula a célula | O grid muda o tamanho das células; ver Assumptions |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Névoa ao importar | Mapa importado vem com todas as células reveladas; substitui FOG-01 do MVP | user: "Mapa vem sem névoa (Recomendado)" | y |
| Botão novo | "Revelar tudo" no painel de névoa, ao lado de "Cobrir tudo", só para o mestre | user: "Mapa vem sem névoa (Recomendado)" (a opção incluía o botão) | y |
| Quando publicar | A correção sai na 0.2.1, a release do teste de atualização | user: "Com a correção da névoa (Recomendado)" | y |
| Grid ajustado (substitui FOG-08) | Se a névoa estava toda revelada, continua toda revelada; se havia alguma célula coberta, tudo é coberto de novo, como hoje | Mantém o mapa claro de quem não usa névoa, e nunca revela de repente aos jogadores o que o mestre tinha escondido; user: "Aprovo sim" | y |
| Cenas `.mesa` salvas antes | Carregam com a névoa que foi salva | O arquivo guarda a névoa; nada muda nele | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Mapa claro por padrão ⭐ MVP

**User Story**: Como mestre, quero importar um mapa e vê-lo claro, sem névoa, para só usar névoa quando eu quiser.

**Why P1**: É o problema relatado.

**Acceptance Criteria**:

1. FOGD-01: WHEN the master imports a map THEN the server SHALL leave every fog cell revealed.
2. FOGD-02: WHEN the master uses "Revelar tudo" THEN the server SHALL reveal every fog cell and every window SHALL show the map with no fog.
3. FOGD-03: IF a player sends the "Revelar tudo" action THEN the server SHALL refuse it with "Sem permissão" and change nothing.
4. FOGD-04: WHILE every fog cell is revealed, WHEN the master changes the cell size or the grid offset THEN the server SHALL keep every cell revealed.
5. FOGD-05: WHILE at least one fog cell is covered, WHEN the master changes the cell size or the grid offset THEN the server SHALL cover every cell.

**Independent Test**: o mestre importa um mapa e o vê claro; o jogador vê o mapa; o mestre usa "Cobrir tudo", o jogador vê preto; "Revelar tudo" e o jogador vê o mapa de novo.

---

## Edge Cases

- WHEN the master uses "Revelar tudo" with no map THEN the server SHALL refuse it with the same message "Cobrir tudo" gives with no map.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| FOGD-01 | P1: Mapa claro por padrão | Execute | Pending |
| FOGD-02 | P1: Mapa claro por padrão | Execute | Pending |
| FOGD-03 | P1: Mapa claro por padrão | Execute | Pending |
| FOGD-04 | P1: Mapa claro por padrão | Execute | Pending |
| FOGD-05 | P1: Mapa claro por padrão | Execute | Pending |

**Coverage:** 5 total, 5 mapped to checks, 0 unmapped

---

## Sources

- user: "quando eu importo um mapa ele fica meio escurecido, mesmo eu não tendo colocado névoa (Não sei se tá vindo como oadrão, mas não estou conseguindo deixar ele totalmente claro)" - the problem
- user: "Mapa vem sem névoa (Recomendado)"; "Com a correção da névoa (Recomendado)" - the decisions
- `.specs/features/mesa-mvp/spec.md` FOG-01, FOG-08 - the rules this replaces

---

## Success Criteria

- [ ] No notebook Windows, depois da atualização para 0.2.1, um mapa importado aparece claro.

---

## Checks

**Build**: `scripts/with-node npm run build`; `scripts/with-node npm run typecheck`; `scripts/with-node npm run lint`
**Run unit**: `scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

Steps (inline, no tasks.md): 1) core - `revealAll`, `map/set` revealed, the `grid/set` rule, `fog/revealAll` in protocol and reducer, unit tests; 2) the "Revelar tudo" button and e2e, updating the MVP tests that relied on a covered start; 3) release 0.2.1.

**C1** - Importing a map leaves every fog cell revealed (FOGD-01, AC 1)
Proof: run unit | ✓ [C1] FOGD-01

**C2** - "Revelar tudo" clears the fog in the master's and the player's windows (FOGD-02, AC 2)
Proof: run e2e | ✓ [C2] FOGD-02

**C3** - A player's "Revelar tudo" is refused with "Sem permissão" and changes nothing (FOGD-03, AC 3)
Proof: run unit | ✓ [C3] FOGD-03

**C4** - Changing the grid with no covered cell keeps everything revealed (FOGD-04, AC 4)
Proof: run unit | ✓ [C4] FOGD-04

**C5** - Changing the grid with one covered cell covers everything (FOGD-05, AC 5)
Proof: run unit | ✓ [C5] FOGD-05

---

## Handoff

**Settled mid-build:** none
**Dispatched:** Verifier (validate.md) at the proofs commit after c05e7ed
**Walked:** at c05e7ed with real clicks in Electron (MESA_TEST=1, master + player "Ana" on 127.0.0.1): the master's map/set of an 800x600 map with 100 px cells shows the map fully clear with the grid in the master's window, and the player's window shows it too; "Cobrir tudo" in the Névoa panel darkens the master's view 50% (player black); "Revelar tudo", next to it, clears both again.
