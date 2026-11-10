# Mesa RPG — Pasta da campanha

## Problem Statement

Cada mapa e cada token entra por uma janela de "abrir arquivo", e uma cena salva é um `.mesa` com todas as imagens embutidas, onde o mestre escolher. Não há um lugar onde a campanha mora. user: "o aplicativo criar uma pasta para ele (...) e nessa pasta quando você tenta buscar um token, ou mapa, ele já mostra os que estão salvos dentro dele"; "deixar os efeitos sonoros e musicas separadas"; "criar uma pasta do RPG, e dentro dela eu coloco tudo dele, daí ali eu posso deixar configurados cenas já com tokens".

## Goals

- [ ] O mestre põe mapas e tokens na pasta da campanha pelo Explorer e os vê no app sem importar nada.
- [ ] O mestre prepara cenas com nome antes da sessão e as abre com um clique durante a sessão.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Tocar músicas e efeitos | Feature E; as pastas `musicas/` e `efeitos/` já são criadas |
| Mandar a pasta aos jogadores | Os jogadores continuam recebendo só as imagens em uso, como hoje |
| Pasta fora de Documentos, várias pastas de campanhas | Decidido: `Documentos/Mesa RPG` |
| Renomear, apagar ou mover arquivos de dentro do app | O Explorer faz isso; o app acompanha |
| Editar o `.json` do token pelo app | O editor já ajusta o item na mesa |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Onde | `Documentos/Mesa RPG/<Campanha>/` com `mapas/`, `tokens/`, `objetos/`, `musicas/`, `efeitos/`, `cenas/` | user: "Documentos/Mesa RPG (Recomendado)" | y |
| Escolher a campanha | Na tela inicial, junto de "Hospedar": lista das campanhas e "Nova campanha"; a última usada vem marcada | user: "Ao hospedar (Recomendado)" | y |
| Cenas | Arquivo leve `cenas/<nome>.cena` que aponta para os arquivos da pasta; "Salvar cena" pede só o nome; Mapas lista as cenas; "Exportar .mesa" e "Importar .mesa" continuam com o arquivo completo | user: "Leves, apontando para a pasta (Recomendado)" | y |
| Atualização | O app observa a pasta; o que muda nela aparece nas listas em até 2 s | user: "Sozinho (Recomendado)" | y |
| Subpastas | Cada subpasta (em qualquer nível) é um grupo com o caminho como título, que abre e fecha | user: "Sim, como grupos (Recomendado)" | y |
| Nome de campanha e de cena | 1 a 60 caracteres, sem `\ / : * ? " < > |`, sem espaço no começo ou no fim, e não pode já existir (sem diferenciar maiúsculas) | Nomes válidos no Windows | n |
| Campanha criada pelo Explorer | Uma pasta criada à mão em `Mesa RPG/` aparece na lista; as subpastas que faltarem são criadas ao hospedar | O mestre pode organizar pelo Explorer | n |
| Tipos de arquivo | PNG, JPG e WebP até 50 MB, como hoje; outros arquivos não aparecem | Regras já existentes (ASSET) | n |
| Tokens e objetos | Imagens em `tokens/` entram como personagem e em `objetos/` como objeto; o `.json` ao lado do PNG continua valendo (ITEM-11), e o `tipo` dele vence a pasta | Mantém o kit funcionando | n |
| Miniaturas | Cada item das listas mostra uma miniatura de 48 px e o nome do arquivo sem extensão | Achar o token pelo desenho | n |
| Carregar um mapa da lista | Um clique num mapa da lista faz o mesmo que "Importar mapa" hoje (troca o mapa, detecta o grid) | Mesmo comportamento já testado | n |
| Adicionar pelo app | "Adicionar arquivos" em Tokens, Objetos e Mapas copia os arquivos escolhidos para a subpasta certa; nome repetido vira `goblin (2).png` | Para quem não quer abrir o Explorer | n |
| Abrir a pasta | "Abrir pasta" no painel Mapas abre a pasta da campanha no Explorer | Pedido do roadmap | y |
| Arquivo da cena faltando | Ao carregar uma cena, se um arquivo dela não existe mais na pasta, a cena não carrega e aparece "Arquivo não encontrado: <caminho>" | Não mostra uma cena pela metade | n |
| Arquivo da cena alterado | Se o arquivo existe mas mudou (o mestre redesenhou o token), a cena usa a versão nova | O mestre espera ver a arte atual | n |
| Última campanha | Guardada nos dados do app; se a pasta sumiu, nenhuma vem marcada | Abre direto na campanha da semana | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: A campanha ao hospedar ⭐ MVP

**User Story**: Como mestre, quero escolher ou criar a campanha antes de hospedar, para a mesa abrir já com os arquivos dela.

**Why P1**: Sem campanha não há pasta.

**Acceptance Criteria**:

1. CAMP-01: WHEN the start screen opens THEN it SHALL list the folders inside `Documentos/Mesa RPG/` as campaigns, creating `Mesa RPG` if it does not exist.
2. CAMP-02: WHEN the master uses "Nova campanha" with a valid name THEN the app SHALL create `Mesa RPG/<nome>/` with `mapas/`, `tokens/`, `objetos/`, `musicas/`, `efeitos/` and `cenas/`, and select it.
3. CAMP-03: IF the new campaign's name is empty, longer than 60 characters, has `\ / : * ? " < > |` or already exists THEN the app SHALL show "Nome inválido" or "Campanha já existe" and create nothing.
4. CAMP-04: WHILE no campaign is selected the "Hospedar" button SHALL be disabled.
5. CAMP-05: WHEN the master hosts with a campaign selected THEN the app SHALL create any of the six subfolders that are missing, remember the campaign, and show its name in the "Mapas" panel.
6. CAMP-06: WHEN the start screen opens again THEN the last campaign used SHALL be selected, if its folder still exists.
7. CAMP-07: WHEN the master uses "Abrir pasta" in "Mapas" THEN the app SHALL open the campaign folder in the system's file manager.

**Independent Test**: com `Documentos/Mesa RPG` vazio, o mestre cria "Florestas Frias", vê as seis pastas no Explorer, hospeda, e na próxima abertura a campanha já vem marcada.

---

### P1: A pasta como biblioteca ⭐ MVP

**User Story**: Como mestre, quero ver no app os mapas, tokens e objetos que pus na pasta, organizados pelas subpastas.

**Why P1**: É o centro do pedido.

**Acceptance Criteria**:

1. CAMP-08: The "Tokens" panel SHALL list every PNG, JPG and WebP in `tokens/` and `objetos/` (and their subfolders) with a thumbnail and the file name without extension; files in `objetos/` SHALL be objects and files in `tokens/` characters, unless the file's `.json` says otherwise.
2. CAMP-09: The "Mapas" panel SHALL list every image in `mapas/` (and its subfolders) with a thumbnail and the file name.
3. CAMP-10: The lists SHALL show each subfolder as a group titled with its path inside the section, which opens and closes.
4. CAMP-11: WHEN a file is added, removed or renamed in the campaign folder outside the app THEN the lists SHALL show the change within 2 seconds.
5. CAMP-12: WHEN the master drags a token or object from the list onto the map THEN the app SHALL place it as a library drop does (ITEM-10), in every window.
6. CAMP-13: WHEN the master clicks a map in the list THEN the app SHALL load it as "Importar mapa" does, in every window.
7. CAMP-14: WHEN the master uses "Adicionar arquivos" in Tokens, Objetos or Mapas and picks files THEN the app SHALL copy them into that subfolder, naming a repeated name `<nome> (2).<ext>`, `(3)` and so on.
8. CAMP-15: IF a file in the folder is not a readable image or is over 50 MB THEN it SHALL not be listed.

**Independent Test**: o mestre copia `goblin.png` para `tokens/Goblins/` pelo Explorer: em até 2 s aparece no grupo "Goblins" de Tokens; arrastado para o mapa, aparece no jogador.

---

### P1: Cenas na pasta ⭐ MVP

**User Story**: Como mestre, quero salvar cenas prontas na campanha e abri-las com um clique na sessão.

**Why P1**: user: "deixar configurados cenas já com tokens".

**Acceptance Criteria**:

1. CAMP-16: WHEN the master uses "Salvar cena" and types a valid name THEN the app SHALL write `cenas/<nome>.cena`, a file that points at the campaign files the scene uses instead of holding the images.
2. CAMP-17: IF a scene with that name exists THEN the app SHALL ask "Substituir a cena <nome>?" and write only if confirmed.
3. CAMP-18: The "Mapas" panel SHALL list the scenes in `cenas/`, and WHEN the master picks one THEN the app SHALL load it in every window, asking first as SAVE-05 does when the table has items.
4. CAMP-19: IF a file the scene points at is missing THEN the app SHALL not load it and SHALL show "Arquivo não encontrado: <caminho>".
5. CAMP-20: WHEN a file the scene points at has changed since it was saved THEN the app SHALL load the scene with the current file.
6. CAMP-21: WHEN the master uses "Exportar .mesa" THEN the app SHALL save the full `.mesa` file, with the images, where the master chooses; and "Importar .mesa" SHALL load one as "Carregar cena" did.
7. CAMP-22: WHEN the master saves a scene whose map or items came from outside the campaign (an imported `.mesa`) THEN the app SHALL copy those images into the campaign (`mapas/importados/`, `tokens/importados/`) so the scene points at them.

**Independent Test**: o mestre monta uma cena com mapa e três tokens, salva como "Emboscada", troca a cena, e um clique em "Emboscada" traz tudo de volta para ele e para o jogador.

---

## Edge Cases

- WHEN the campaign folder is deleted while the table is open THEN the lists SHALL become empty and the table SHALL keep the scene already loaded.
- WHEN two files in different subfolders have the same name THEN both SHALL be listed, each in its group.
- WHEN a scene name has the same letters as an existing one with other capitals THEN it SHALL count as the same name (Windows).

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| CAMP-01 | P1: A campanha ao hospedar | Design | Pending |
| CAMP-02 | P1: A campanha ao hospedar | Design | Pending |
| CAMP-03 | P1: A campanha ao hospedar | Design | Pending |
| CAMP-04 | P1: A campanha ao hospedar | Design | Pending |
| CAMP-05 | P1: A campanha ao hospedar | Design | Pending |
| CAMP-06 | P1: A campanha ao hospedar | Design | Pending |
| CAMP-07 | P1: A campanha ao hospedar | Design | Pending |
| CAMP-08 | P1: A pasta como biblioteca | Design | Pending |
| CAMP-09 | P1: A pasta como biblioteca | Design | Pending |
| CAMP-10 | P1: A pasta como biblioteca | Design | Pending |
| CAMP-11 | P1: A pasta como biblioteca | Design | Pending |
| CAMP-12 | P1: A pasta como biblioteca | Design | Pending |
| CAMP-13 | P1: A pasta como biblioteca | Design | Pending |
| CAMP-14 | P1: A pasta como biblioteca | Design | Pending |
| CAMP-15 | P1: A pasta como biblioteca | Design | Pending |
| CAMP-16 | P1: Cenas na pasta | Design | Pending |
| CAMP-17 | P1: Cenas na pasta | Design | Pending |
| CAMP-18 | P1: Cenas na pasta | Design | Pending |
| CAMP-19 | P1: Cenas na pasta | Design | Pending |
| CAMP-20 | P1: Cenas na pasta | Design | Pending |
| CAMP-21 | P1: Cenas na pasta | Design | Pending |
| CAMP-22 | P1: Cenas na pasta | Design | Pending |

**Coverage:** 22 total, 0 mapped to tasks, 22 unmapped ⚠️

---

## Sources

- `.specs/ROADMAP.md` - feature D, the user's words and the folder decision
- `.specs/features/campaign-folder/context.md` - this feature's answers
- `.specs/features/mesa-mvp/spec.md` SAVE-01..05 and `.specs/features/tokens-objects/spec.md` ITEM-10, ITEM-11 - what this builds on

---

## Success Criteria

- [ ] Antes da sessão, o mestre deixa as cenas da campanha prontas na pasta; na sessão, abre cada uma com um clique.
