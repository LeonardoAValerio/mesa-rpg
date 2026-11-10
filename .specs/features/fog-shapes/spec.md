# Mesa RPG — Névoa em formas livres

**Approved**: 2026-11-09 - user: "Aprovo"

## Problem Statement

A névoa segue as células do grid, então o resultado fica quadriculado, e as ferramentas confundem: o pincel e o retângulo começam em "Revelar" e, como desde a 0.2.1 o mapa vem sem névoa, pintar não muda nada; os modos ficam no painel lateral, longe das ferramentas. user: "a Fog ainda está meio estranha, não está funcionando, apenas o botão de cobrir tudo e revelar tudo" (mapa de teste `Florestas Frias.jpg`). O usuário escolheu névoa em formas livres, como no Owlbear Rodeo.

## Goals

- [ ] No mapa `Florestas Frias.jpg`, o mestre cobre o mapa e revela uma área de formato livre (uma trilha, uma clareira) com o pincel, o retângulo e o polígono, e o jogador vê exatamente essa área.
- [ ] Um mestre que nunca usou o app consegue cobrir uma área no primeiro clique com uma ferramenta de névoa.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Névoa dinâmica, linha de visão, paredes, luz | Outra feature; o pedido é névoa manual |
| Borda suave (desfocada) da névoa | Bordas nítidas primeiro; pode vir depois |
| Selecionar, mover ou apagar uma forma já desenhada | As formas se desfazem pintando o modo oposto, ou com "Cobrir tudo" / "Revelar tudo" |
| Abas, pasta da campanha, tokens novos, sons | Features B a E do `.specs/ROADMAP.md` |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Modelo da névoa | Formas livres com precisão de pixel: pincel redondo, retângulo e polígono, cada um em Cobrir ou Revelar; substitui a névoa por células (FOG-03, FOG-04, FOG-06 do MVP e FOGD-04, FOGD-05) | user: "Formas livres (Recomendado)" | y |
| Token sob a névoa | Fica oculto para quem não é dono quando o centro dele está sob a névoa | Fazia parte da opção escolhida | y |
| Como as formas se combinam | Em ordem: num ponto, vale a última forma que o contém; um ponto que nenhuma forma contém está revelado | Pintar "Revelar" por cima de "Cobrir" abre um buraco, e vice-versa, como num programa de desenho | n |
| Modo inicial | "Cobrir" | O mapa vem sem névoa, então a primeira ação útil é cobrir | n |
| Onde ficam os modos | Na barra de ferramentas, logo depois das ferramentas de névoa, visíveis só com uma ferramenta de névoa escolhida; segurar Alt inverte o modo enquanto pinta | Ficam junto da ferramenta; o Alt evita trocar de modo a toda hora | n |
| Pincel | Raio de 0,5 a 10 células, em passos de 0,5, padrão 1; um círculo mostra o pincel sob o cursor | Medido em células para acompanhar o tamanho do mapa | n |
| Polígono | Cada clique adiciona um ponto; clicar no primeiro ponto, dar duplo clique ou Enter fecha (mínimo 3 pontos); Esc cancela | Padrão de ferramentas de desenho | n |
| Quando a forma chega aos jogadores | Ao soltar o mouse (pincel e retângulo) ou ao fechar o polígono; o mestre vê o preview enquanto desenha | Uma forma por traço mantém a névoa pequena e evita dezenas de mensagens por segundo | n |
| Limite de formas | Até 2000 formas por cena e 2000 pontos por traço; "Cobrir tudo" e "Revelar tudo" recomeçam a lista do zero | Uma sessão longa fica bem abaixo disso | n |
| Ao atingir o limite | A forma nova é recusada com "Névoa com formas demais: use Cobrir tudo ou Revelar tudo" | O mestre sabe o que fazer | n |
| Área da névoa | Só dentro do mapa; "Cobrir tudo" cobre o mapa inteiro | Fora do mapa não há nada a esconder | n |
| Grid ajustado | Não mexe mais na névoa | A névoa não depende mais das células | n |
| Cenas `.mesa` antigas | Carregam com a névoa convertida: cada faixa de células cobertas vira um retângulo coberto | Ninguém perde uma cena salva | n |
| Opacidade | Jogador 100%, mestre 50%, como hoje (FOG-02) | Já aprovado no MVP | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Desenhar a névoa em formas livres ⭐ MVP

**User Story**: Como mestre, quero cobrir e revelar áreas de qualquer formato, para seguir trilhas, clareiras e salas do mapa e não um quadriculado.

**Why P1**: É o pedido; a névoa atual não serve para o mapa de teste.

**Acceptance Criteria**:

1. FOGS-01: WHEN the master drags the brush THEN every window SHALL show, after the mouse is released, the fog changed exactly in the stroke's area: points within the brush radius of the dragged path, and no others.
2. FOGS-02: WHEN the master drags a fog rectangle THEN every window SHALL show the fog changed exactly inside the rectangle.
3. FOGS-03: WHEN the master closes a polygon of at least 3 points THEN every window SHALL show the fog changed exactly inside the polygon.
4. FOGS-04: WHEN a point lies in several fog shapes THEN the app SHALL treat it as covered if and only if the last of those shapes is in Cobrir mode; a point in no shape SHALL be revealed.
5. FOGS-05: WHEN the master uses "Cobrir tudo" THEN the whole map SHALL be covered, and WHEN the master uses "Revelar tudo" THEN the whole map SHALL be revealed, in every window.
6. FOGS-06: WHILE a token's centre is under the fog the server SHALL not send it to players who do not own it, and WHEN its centre is revealed the server SHALL send it.
7. FOGS-07: IF a player sends a fog action THEN the server SHALL refuse it with "Sem permissão" and change nothing.
8. FOGS-08: IF a fog shape would make the scene hold more than 2000 shapes, or a stroke has more than 2000 points, THEN the server SHALL refuse it with "Névoa com formas demais: use Cobrir tudo ou Revelar tudo" and change nothing.
9. FOGS-09: WHEN the master changes the grid THEN the fog SHALL stay the same.

**Independent Test**: no mapa `Florestas Frias.jpg`, o mestre usa "Cobrir tudo", revela com o pincel a trilha que sai do castelo, revela a clareira com um polígono e um retângulo no canto; o jogador vê só essas áreas e só os tokens cujo centro está nelas.

---

### P1: Ferramentas de névoa claras ⭐ MVP

**User Story**: Como mestre, quero que a ferramenta de névoa faça algo visível no primeiro uso e que eu veja o que vou pintar.

**Why P1**: user: "não está funcionando, apenas o botão de cobrir tudo e revelar tudo".

**Acceptance Criteria**:

1. FOGT-01 (replaced by MTB-08, AD-008: the modes are in the Névoa panel): WHEN the master picks a fog tool THEN the toolbar SHALL show the modes "Cobrir" and "Revelar" next to the fog tools, with "Cobrir" selected the first time.
2. FOGT-02: WHILE the master holds Alt and paints with a fog tool THEN the app SHALL use the opposite of the selected mode.
3. FOGT-03: WHILE the brush tool is selected the master's window SHALL draw a circle of the brush radius under the cursor.
4. FOGT-04: WHILE the master drags the brush or the rectangle, or adds polygon points, the master's window SHALL draw a preview of the shape, and the other windows SHALL not change until it is released or closed.
5. FOGT-05: WHEN the master presses Esc while drawing a polygon THEN the app SHALL discard it and send nothing.
6. FOGT-06: WHEN the master sets the brush radius THEN the app SHALL accept 0,5 to 10 cells in steps of 0,5 and clamp any other value into that range.
7. FOGT-07 (replaced by MTB-06, MTB-11, AD-008): WHILE no fog tool is selected the toolbar SHALL not show the fog modes.

**Independent Test**: com o mapa sem névoa, o mestre escolhe o Pincel de névoa e arrasta: a área fica escura para ele e preta para o jogador; segurando Alt, a mesma ação revela.

---

### P2: Cenas antigas continuam abrindo

**User Story**: Como mestre, quero abrir as cenas `.mesa` que já salvei.

**Why P2**: Poucas cenas existem ainda, mas nenhuma deve se perder.

**Acceptance Criteria**:

1. FOGS-10: WHEN the master loads a `.mesa` saved with the cell fog THEN the app SHALL show the same areas covered, each run of covered cells in a row becoming a covered rectangle.
2. FOGS-11: WHEN the master saves and loads a scene THEN the fog SHALL come back with the same shapes in the same order.

**Independent Test**: carregar um `.mesa` salvo pela 0.2.1 com uma área revelada mostra a mesma área revelada.

---

## Edge Cases

- WHEN a brush stroke is a single click without moving THEN the fog SHALL change in a circle of the brush radius around the click.
- IF a rectangle has zero width or height, or a polygon has fewer than 3 distinct points, THEN the app SHALL send nothing.
- WHEN a shape goes past the map's edge THEN only the part inside the map SHALL count.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| FOGS-01 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGS-02 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGS-03 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGS-04 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGS-05 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGS-06 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGS-07 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGS-08 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGS-09 | P1: Desenhar a névoa em formas livres | Design | Pending |
| FOGT-01 | P1: Ferramentas de névoa claras | Design | Pending |
| FOGT-02 | P1: Ferramentas de névoa claras | Design | Pending |
| FOGT-03 | P1: Ferramentas de névoa claras | Design | Pending |
| FOGT-04 | P1: Ferramentas de névoa claras | Design | Pending |
| FOGT-05 | P1: Ferramentas de névoa claras | Design | Pending |
| FOGT-06 | P1: Ferramentas de névoa claras | Design | Pending |
| FOGT-07 | P1: Ferramentas de névoa claras | Design | Pending |
| FOGS-10 | P2: Cenas antigas continuam abrindo | Design | Pending |
| FOGS-11 | P2: Cenas antigas continuam abrindo | Design | Pending |

**Coverage:** 18 total, 0 mapped to tasks, 18 unmapped ⚠️

---

## Sources

- user: "a Fog ainda está meio estranha, não está funcionando, apenas o botão de cobrir tudo e revelar tudo" - the problem
- user: "Formas livres (Recomendado)" - the fog model
- `.specs/ROADMAP.md` - the order and the decisions for the next features
- `Florestas Frias.jpg` (2048x1536, grid ~85 px) - the test map; reproduced on 2026-11-09: the tools work in "Cobrir" but start in "Revelar"
- Owlbear Rodeo: pixel-accurate fog shapes (blog.owlbear.rodeo, 2.0 Beta Patch 6 and 2.2 notes) - the reference

---

## Success Criteria

- [ ] No notebook, depois da atualização, o mestre esconde a ilha do `Florestas Frias.jpg` e revela a trilha até Nosferato sem quadriculado.
