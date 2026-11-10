# Mesa RPG — Ferramentas no mapa e painel Rede

**Approved**: 2026-11-09 - user: "Sim"

## Problem Statement

As ferramentas do mapa (Mover, Régua, Ping, Desenho e as três de névoa, mais Cobrir/Revelar e o raio) ocupam a barra de cima como botões de texto, longe do mapa em que agem, e as informações de rede do mestre (porta, aviso do firewall, IPs) ocupam o resto dela. user: "daria pra deixar um painel separado chamado 'Rede', onde nele tem aquelas questões de rede que tem na parte superior do mestre"; "os botões de mover, régua e etc, deveria estar dentro da box do Mapa (...) podemos utilizar icones para representar, e talvez o de névoa ele tem um 'dropdown' e aparece qual tipo de pintura ele quer e consegue configurar o tamanho da névoa".

## Goals

- [ ] As ferramentas ficam junto do mapa, com ícones, e a névoa num botão só.
- [ ] A barra de cima fica só com o nome, "Painéis" e "Encerrar mesa"/"Sair".

## Out of Scope

| Feature | Reason |
| --- | --- |
| Painel Rede para o jogador | user: "Só do mestre (Recomendado)" |
| Mover a barra de ferramentas para outro lugar | Fica fixa na borda esquerda do mapa |
| Novas ferramentas | Só reorganiza as que existem |
| Pasta da campanha, sons | Features D e E |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Lugar das ferramentas | Uma coluna de ícones colada na borda esquerda do mapa, por cima dele, dentro do painel da mesa | user: "Vertical, à esquerda (Recomendado)" | y |
| Ícones | Biblioteca Lucide (ISC), em SVG embutido; cada botão tem uma dica com o nome e o atalho | Ícones claros sem quebrar a CSP | n |
| Atalhos | V Mover, R Régua, P Ping, D Desenho, N Névoa (só mestre); não valem enquanto se digita num campo | user: "Sim, uma letra cada (Recomendado)" | y |
| Névoa | Um botão só (mestre); clicar abre, ao lado da coluna, um painel com Pincel, Retângulo e Polígono, Cobrir/Revelar e o raio do pincel; o botão mostra o ícone da última forma escolhida | user: "o de névoa ele tem um 'dropdown' e aparece qual tipo de pintura ele quer e consegue configurar o tamanho da névoa" | y |
| Abrir e fechar o painel da névoa | Abre ao clicar no botão Névoa ou com N; fecha com Esc, com um clique fora dele ou ao escolher outra ferramenta; a forma e o modo escolhidos continuam ativos com ele fechado | Não fica cobrindo o mapa | n |
| Painel Rede | Só do mestre; porta, aviso do firewall e cada IP com o nome da rede (Hamachi, Radmin, Rede) e "Copiar" | user: "Só do mestre (Recomendado)" | y |
| Onde o Rede começa | Como aba no grupo de Conectados (Conectados · Rede, com Conectados aberto) | Os dois tratam de quem está na mesa | n |
| Layout salvo pela 0.5.0 | É ignorado uma vez (a chave do layout muda de versão) e o layout inicial aparece, já com Rede | Um layout antigo não teria o painel Rede | n |
| Substitui | FOGT-01 e FOGT-07 (modos na barra de cima) da feature fog-shapes: os modos e o raio vão para o painel da névoa | Pedido do usuário | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Ferramentas dentro do mapa ⭐ MVP

**User Story**: Como mestre, quero as ferramentas do mapa como ícones na borda do próprio mapa, para usá-las sem ir até a barra de cima.

**Why P1**: É o pedido.

**Acceptance Criteria**:

1. MTB-01: The table panel SHALL show a vertical column of icon buttons on the left edge of the map: Mover, Régua, Ping, Desenho, and for the master also Névoa.
2. MTB-02: WHEN someone points at a tool button THEN the app SHALL show its name and shortcut, as "Régua (R)".
3. MTB-03: WHEN someone clicks a tool button THEN that tool SHALL become the active one and its button SHALL show as active.
4. MTB-04: WHEN someone presses V, R, P or D, or the master presses N, while not typing in a field THEN the app SHALL pick Mover, Régua, Ping, Desenho or Névoa.
5. MTB-05: WHILE the focus is in a text field THEN those letters SHALL type and SHALL not change the tool.
6. MTB-06: The top bar SHALL not show tool buttons, fog modes or the brush radius.
7. MTB-07: WHEN someone clicks or drags on the tool column THEN the map SHALL not receive it (no ping, stroke, fog or item drag).

**Independent Test**: o mestre passa o mouse na régua e vê "Régua (R)"; aperta P e o ping fica ativo; um clique na coluna não faz ping.

---

### P1: Névoa num botão ⭐ MVP

**User Story**: Como mestre, quero escolher a forma da névoa, o modo e o tamanho num painel que sai do botão Névoa.

**Why P1**: user: "o de névoa ele tem um 'dropdown' e aparece qual tipo de pintura ele quer e consegue configurar o tamanho da névoa".

**Acceptance Criteria**:

1. MTB-08: WHEN the master clicks Névoa or presses N THEN the app SHALL open, beside the column, a panel with Pincel, Retângulo and Polígono, Cobrir and Revelar, and the brush radius, and SHALL make the last fog shape the active tool (Pincel the first time), in Cobrir the first time.
2. MTB-09: WHEN the master picks a shape in that panel THEN that fog tool SHALL become active and the Névoa button SHALL show that shape's icon.
3. MTB-10: WHILE the brush is not the chosen shape THEN the panel SHALL not show the radius.
4. MTB-11: WHEN the master presses Esc, clicks outside the panel or picks another tool THEN the panel SHALL close, and the chosen shape and mode SHALL stay for the next time.

**Independent Test**: o mestre abre Névoa, escolhe Retângulo e Revelar, fecha com Esc, arrasta no mapa e revela; o botão mostra o ícone do retângulo.

---

### P1: Painel Rede ⭐ MVP

**User Story**: Como mestre, quero as informações de rede num painel, fora da barra de cima.

**Why P1**: user: "deixar um painel separado chamado 'Rede'".

**Acceptance Criteria**:

1. MTB-12: The master's panels SHALL include "Rede", holding the port, the firewall hint and each address with its network name and "Copiar", and the top bar SHALL not show them.
2. MTB-13: WHEN the master's table opens with no saved layout THEN "Rede" SHALL be a tab in the group of "Conectados", with "Conectados" open.
3. MTB-14: A player's panels SHALL not include "Rede".
4. MTB-15: WHEN the master opens a table with a layout saved by version 0.5.0 THEN the app SHALL show the starting layout, with "Rede".

**Independent Test**: o mestre abre a mesa: a barra de cima tem só o nome, "Painéis" e "Encerrar mesa"; a aba Rede mostra os IPs e "Copiar" copia "IP:porta".

---

## Edge Cases

- WHEN the table panel is narrow THEN the tool column SHALL stay inside it (it never covers other panels).
- WHEN a player presses N THEN nothing SHALL change (no fog for players).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| MTB-01 | P1: Ferramentas dentro do mapa | Execute | Pending |
| MTB-02 | P1: Ferramentas dentro do mapa | Execute | Pending |
| MTB-03 | P1: Ferramentas dentro do mapa | Execute | Pending |
| MTB-04 | P1: Ferramentas dentro do mapa | Execute | Pending |
| MTB-05 | P1: Ferramentas dentro do mapa | Execute | Pending |
| MTB-06 | P1: Ferramentas dentro do mapa | Execute | Pending |
| MTB-07 | P1: Ferramentas dentro do mapa | Execute | Pending |
| MTB-08 | P1: Névoa num botão | Execute | Pending |
| MTB-09 | P1: Névoa num botão | Execute | Pending |
| MTB-10 | P1: Névoa num botão | Execute | Pending |
| MTB-11 | P1: Névoa num botão | Execute | Pending |
| MTB-12 | P1: Painel Rede | Execute | Pending |
| MTB-13 | P1: Painel Rede | Execute | Pending |
| MTB-14 | P1: Painel Rede | Execute | Pending |
| MTB-15 | P1: Painel Rede | Execute | Pending |

**Coverage:** 15 total, 15 mapped to checks, 0 unmapped

---

## Sources

- The user's request of 2026-11-09 after v0.5.0 (quoted above) and the answers "Vertical, à esquerda (Recomendado)", "Sim, uma letra cada (Recomendado)", "Só do mestre (Recomendado)"
- `.specs/features/fog-shapes/spec.md` FOGT-01, FOGT-07 - replaced here
- `lucide` on npm (1.70.0, ISC) - the icons

---

## Success Criteria

- [ ] Na sessão, o mestre usa régua, ping e névoa sem tirar o olho do mapa.

---

## Checks

**Build**: `scripts/with-node npm run build`; `scripts/with-node npm run typecheck`; `scripts/with-node npm run lint`
**Run unit**: `scripts/with-node npx vitest run --reporter=verbose`
**Run e2e**: `scripts/with-node npm run build && scripts/with-node npx playwright test --reporter=list`

Steps (inline, no tasks.md): 1) the Rede panel and the layout key v2 (MTB-12..15); 2) the tool column with icons, tooltips and shortcuts, removed from the top bar (MTB-01..07); 3) the fog button and its panel, the fog e2e moved to it (MTB-08..11). Each step: its e2e plus unit; the whole e2e suite after step 3.

**C1** - The map shows a vertical column of tool icons on its left edge: Mover, Régua, Ping, Desenho, plus Névoa for the master (MTB-01, AC 1)
Proof: run e2e | ✓ [C1] MTB-01

**C2** - Pointing at a tool shows its name and shortcut (MTB-02, AC 2)
Proof: run e2e | ✓ [C2] MTB-02

**C3** - Clicking a tool makes it active and marks its button (MTB-03, AC 3)
Proof: run e2e | ✓ [C3] MTB-03

**C4** - V, R, P, D and N (master) pick the tools (MTB-04, AC 4)
Proof: run e2e | ✓ [C4] MTB-04

**C5** - In a text field those letters type and do not change the tool (MTB-05, AC 5)
Proof: run e2e | ✓ [C5] MTB-05

**C6** - The top bar has no tool buttons, fog modes or radius (MTB-06, AC 6)
Proof: run e2e | ✓ [C6] MTB-06

**C7** - Clicks and drags on the tool column do not reach the map (MTB-07, AC 7)
Proof: run e2e | ✓ [C7] MTB-07

**C8** - Névoa (click or N) opens the fog panel and activates the last shape, Pincel and Cobrir the first time (MTB-08, AC 1)
Proof: run e2e | ✓ [C8] MTB-08

**C9** - Picking a shape activates it and the Névoa button shows its icon (MTB-09, AC 2)
Proof: run e2e | ✓ [C9] MTB-09

**C10** - The radius shows only with the brush (MTB-10, AC 3)
Proof: run e2e | ✓ [C10] MTB-10

**C11** - Esc, a click outside or another tool closes the panel and keeps shape and mode (MTB-11, AC 4)
Proof: run e2e | ✓ [C11] MTB-11

**C12** - Rede holds the port, the firewall hint and the addresses with "Copiar"; the top bar does not (MTB-12, AC 1)
Proof: run e2e | ✓ [C12] MTB-12

**C13** - The master starts with Rede as a tab beside Conectados, Conectados open (MTB-13, AC 2)
Proof: run e2e | ✓ [C13] MTB-13

**C14** - A player has no Rede (MTB-14, AC 3)
Proof: run e2e | ✓ [C14] MTB-14

**C15** - A layout saved by 0.5.0 gives the starting layout with Rede (MTB-15, AC 4)
Proof: run e2e | ✓ [C15] MTB-15

---

## Handoff

**Settled mid-build:** steps 2 and 3 went in one commit (the tool column and the fog panel share `src/renderer/ui/map-toolbar.ts`). The fog e2e that started drags at map (10, 10) now start mid-map, since the column covers the map's top-left corner. Letting `pointerup` pass the column was meant to stop a drag sticking there; a mutation showed Pixi ends the drag either way, so that test is only a regression guard. FOGT-01 and FOGT-07 tests (fog-shapes C10, C16) were removed as replaced (AD-008).
**Dispatched:** none
**Walked:** none
