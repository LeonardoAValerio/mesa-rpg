# Mesa RPG — Sons

**Approved**: 2026-11-10 - user: "Aprovo"

## Problem Statement

A mesa não tem som: o mestre que quer chuva, taverna ou trilha de combate toca num outro programa, e cada jogador ouve (ou não) pelo Discord. A pasta da campanha já tem `musicas/` e `efeitos/`, vazias de função. user: "gerenciamento de música e efeitos sonoros (...) deixar os efeitos sonoros e musicas separadas"; "criar uma pasta do RPG (...) deixar configurados cenas já com tokens, as musicas e tudo mais"; "uma aba de sons".

## Goals

- [ ] O mestre monta o ambiente sonoro (várias camadas em loop) com cliques, e todos na mesa ouvem a mesma coisa no mesmo ponto.
- [ ] O mestre dispara efeitos que todos ouvem na hora.
- [ ] Cada pessoa regula o som só para si.
- [ ] Uma cena salva volta com o seu som.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Jogadores tocarem sons | Decidido: só o mestre. user: "Só o mestre (Recomendado)" |
| Pausar e retomar uma camada do mesmo ponto | Decidido: clique liga/desliga |
| Playlists em sequência ou aleatórias | Decidido: camadas em loop |
| O mestre mudar o volume pessoal de alguém | Decidido: cada um tem os seus controles |
| Sons dentro do `.mesa` exportado | O `.mesa` leva só imagens, como hoje; o som mora na pasta da campanha |
| Áudio de microfone, voz | Fora do produto; a mesa usa Discord para voz |
| Editar, cortar ou normalizar áudio | O mestre prepara os arquivos fora do app |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Músicas | Várias camadas ao mesmo tempo, cada uma em loop | user: "Várias camadas ao mesmo tempo" | y |
| Ligar e desligar | Clique liga (entra em 2 s) e clique de novo desliga (sai em 2 s); "Parar tudo"; até 8 camadas | user: "Clique liga/desliga, com fade (Recomendado)" | y |
| Mistura | O mestre define o volume de cada camada, igual para todos | user: "Mestre define a mistura (Recomendado)" | y |
| Efeitos | Só o mestre toca; cada efeito toca uma vez para todos e vários podem se sobrepor | user: "Só o mestre (Recomendado)" | y |
| Cena | A cena guarda as camadas tocando e seus volumes; carregar liga essas e desliga as outras | user: "Sim, a música tocando (Recomendado)" | y |
| Volume pessoal | "Música", "Efeitos" e "Mudo" por pessoa, guardados no computador dela; volume ouvido de uma camada = volume da camada × "Música" | user: "Cada um tem 2 controles (Recomendado)" | y |
| Formatos | MP3, OGG, WAV e M4A até 100 MB por arquivo; outros arquivos não aparecem | Os formatos que o Electron toca; 100 MB cobre trilhas longas | n |
| Volumes iniciais | Camada nova em 100; "Música" e "Efeitos" em 80 na primeira vez | Deixa folga para subir | n |
| Sincronia | Duas janelas tocam a mesma camada com no máximo 1 s de diferença | Ninguém percebe 1 s numa ambientação | n |
| Quem entra no meio | Quem entra ou reconecta ouve as camadas já no ponto atual, sem entrada suave | Mesmo som que os outros | n |
| Arquivo ainda baixando | A camada toca naquela janela assim que o arquivo chega, já no ponto atual | Música longa pode demorar a baixar | n |
| Efeitos sem atraso | As janelas dos jogadores baixam os efeitos da campanha logo ao entrar; um efeito que ainda não chegou toca se chegar até 2 s depois do clique, senão é pulado | Efeito atrasado não faz sentido | n |
| O que o jogador vê em Sons | Só os seus controles "Música", "Efeitos" e "Mudo" | O mestre não revela o que vai tocar | n |
| Painel Sons | Nova aba "Sons" no grupo de Tokens, Mapas, Dados e Chat; um layout salvo pela 0.7.0 volta ao inicial com Sons | Sem isso a aba nova não apareceria (lição do MTB-15) | n |
| Fim da mesa | Ao encerrar a mesa ou cair a conexão, o som para naquela janela; ao reconectar, volta no ponto atual | Não fica som tocando numa mesa que acabou | n |
| `.mesa` | Exportar não leva os sons; importar não muda as camadas tocando | O `.mesa` continua só com imagens | n |
| Arquivo apagado com a camada tocando | A camada continua tocando até ser desligada; some da lista | O som já está na memória; não corta a sessão | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Sons na pasta ⭐ MVP

**User Story**: Como mestre, quero ver na aba Sons as músicas e efeitos que pus na pasta da campanha.

**Why P1**: Sem lista não há o que tocar.

**Acceptance Criteria**:

1. SOM-01: WHEN the master's table opens THEN the "Sons" panel SHALL list the audio files of `musicas/` under "Músicas" and of `efeitos/` under "Efeitos", each by its file name without extension, with subfolders as groups titled with their path that open and close.
2. SOM-02: WHEN an audio file is added, renamed or removed in `musicas/` or `efeitos/` outside the app THEN the lists SHALL show the change within 2 seconds.
3. SOM-03: IF a file in `musicas/` or `efeitos/` is not MP3, OGG, WAV or M4A, or is larger than 100 MB, THEN the app SHALL not list it.
4. SOM-04: WHEN the master uses "Adicionar arquivos" in "Músicas" or "Efeitos" THEN the app SHALL copy the chosen files into that folder, a repeated name becoming `nome (2).ext`.
5. SOM-05: The "Sons" panel SHALL be in the starting layout of every window and in "Painéis"; a layout saved by version 0.7.0 SHALL give the starting layout, with "Sons".

**Independent Test**: o mestre copia `chuva.mp3` para `musicas/Ambiente/` e `espada.ogg` para `efeitos/`, e os vê na aba Sons em até 2 s.

---

### P1: Camadas de música ⭐ MVP

**User Story**: Como mestre, quero ligar e desligar músicas em camadas e ajustar a mistura, e que todos ouçam igual.

**Why P1**: É o pedido central de som.

**Acceptance Criteria**:

1. SOM-06: WHEN the master clicks a music that is not playing THEN every window SHALL start playing it in a loop, rising from silence to the layer's volume over 2 seconds, and the master's list SHALL mark it as playing.
2. SOM-07: WHEN the master clicks a music that is playing THEN every window SHALL fade it to silence over 2 seconds and stop it, and the mark SHALL go.
3. SOM-08: WHILE music layers are playing the master's "Sons" panel SHALL show each one with its name and a volume control from 0 to 100, starting at 100.
4. SOM-09: WHEN the master changes a layer's volume THEN every window SHALL play that layer at the new volume within 1 second.
5. SOM-10: IF 8 layers are playing and the master clicks another music THEN the app SHALL show "Máximo de 8 camadas" and start nothing.
6. SOM-11: WHEN the master uses "Parar tudo" THEN every window SHALL fade every layer to silence over 2 seconds and stop it.
7. SOM-12: WHEN someone joins or reconnects while layers are playing THEN their window SHALL play each layer from the point the master's is at, within 1 second, at full layer volume without the 2-second rise.
8. SOM-13: WHILE a layer plays in two windows the two playing points SHALL differ by at most 1 second.
9. SOM-14: IF a window does not have a layer's file yet THEN it SHALL play that layer as soon as the file arrives, from the current point.
10. SOM-15: WHEN the master ends the table or a window loses its connection THEN that window SHALL stop every sound.

**Independent Test**: o mestre liga "chuva" e "taverna", baixa a chuva para 30; a jogadora Ana, que entra depois, ouve as duas no mesmo ponto do mestre com a chuva baixa.

---

### P1: Efeitos ⭐ MVP

**User Story**: Como mestre, quero disparar efeitos que todos ouvem na hora.

**Why P1**: É a outra metade do pedido.

**Acceptance Criteria**:

1. SOM-16: WHEN the master clicks an effect THEN every connected window SHALL play it once from the start, over whatever else is playing, several effects overlapping.
2. SOM-17: WHEN a player joins THEN their window SHALL download the campaign's effects, so an effect played later starts without a download.
3. SOM-18: IF a window gets the file of an effect more than 2 seconds after the master clicked it THEN it SHALL not play that effect.
4. SOM-19: A player's "Sons" panel SHALL have no control that plays or stops a sound, and the table SHALL refuse a sound action from a player with "Sem permissão".

**Independent Test**: o mestre clica "espada" duas vezes seguidas; o mestre e Ana ouvem os dois golpes sobrepostos.

---

### P1: Volume de cada um ⭐ MVP

**User Story**: Como jogador ou mestre, quero regular a música e os efeitos só para mim.

**Why P1**: Cada um tem caixa de som e Discord diferentes.

**Acceptance Criteria**:

1. SOM-20: The "Sons" panel of every window SHALL have "Música" and "Efeitos" controls from 0 to 100, starting at 80, and a "Mudo" switch.
2. SOM-21: WHEN a person moves "Música" THEN their window SHALL play every layer at the layer's volume times "Música" / 100, and no other window SHALL change.
3. SOM-22: WHEN a person moves "Efeitos" THEN their window SHALL play effects at "Efeitos" / 100, and no other window SHALL change.
4. SOM-23: WHILE "Mudo" is on the window SHALL play no sound, and turning it off SHALL bring back the volumes set.
5. SOM-24: WHEN the app opens again on the same computer THEN "Música", "Efeitos" and "Mudo" SHALL be as the person left them.

**Independent Test**: Ana põe "Música" em 20 e "Mudo" desligado; o mestre continua ouvindo no volume dele; Ana fecha e abre o app e o 20 continua lá.

---

### P2: Som na cena

**User Story**: Como mestre, quero que a cena salva volte com o som dela.

**Why P2**: O pedido de cenas prontas cita as músicas; as camadas funcionam sem isso.

**Acceptance Criteria**:

1. SOM-25: WHEN the master saves a scene THEN its `.cena` SHALL keep each playing layer's path in the campaign and its volume.
2. SOM-26: WHEN the master loads a scene with layers THEN every window SHALL fade out the layers not in it, start the missing ones as in SOM-06, and play those already playing at the scene's volume.
3. SOM-27: WHEN the master loads a scene with no layers, or one saved before this feature, THEN every window SHALL fade out every layer.
4. SOM-28: IF a layer's file in the scene is no longer in the campaign THEN the scene SHALL not load and the app SHALL show "Arquivo não encontrado: <caminho>".
5. SOM-29: WHEN the master imports a `.mesa` THEN the layers playing SHALL keep playing.

**Independent Test**: o mestre salva "Taverna" com "taverna" a 60, liga "batalha", carrega "Taverna": a batalha sai e a taverna fica a 60.

---

## Edge Cases

- WHEN the file of a playing layer is removed from the folder THEN the layer SHALL keep playing until it is turned off, and leave the list.
- WHEN the master clicks the same effect while it is still playing THEN a second copy SHALL play over the first.
- WHEN a music is clicked again while it is fading out THEN it SHALL rise again to its volume from where it is.
- WHEN a layer's volume is 0 THEN it SHALL keep playing silently and keep its place in the 8.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| SOM-01 | P1: Sons na pasta | Design | Pending |
| SOM-02 | P1: Sons na pasta | Design | Pending |
| SOM-03 | P1: Sons na pasta | Design | Pending |
| SOM-04 | P1: Sons na pasta | Design | Pending |
| SOM-05 | P1: Sons na pasta | Design | Pending |
| SOM-06 | P1: Camadas de música | Design | Pending |
| SOM-07 | P1: Camadas de música | Design | Pending |
| SOM-08 | P1: Camadas de música | Design | Pending |
| SOM-09 | P1: Camadas de música | Design | Pending |
| SOM-10 | P1: Camadas de música | Design | Pending |
| SOM-11 | P1: Camadas de música | Design | Pending |
| SOM-12 | P1: Camadas de música | Design | Pending |
| SOM-13 | P1: Camadas de música | Design | Pending |
| SOM-14 | P1: Camadas de música | Design | Pending |
| SOM-15 | P1: Camadas de música | Design | Pending |
| SOM-16 | P1: Efeitos | Design | Pending |
| SOM-17 | P1: Efeitos | Design | Pending |
| SOM-18 | P1: Efeitos | Design | Pending |
| SOM-19 | P1: Efeitos | Design | Pending |
| SOM-20 | P1: Volume de cada um | Design | Pending |
| SOM-21 | P1: Volume de cada um | Design | Pending |
| SOM-22 | P1: Volume de cada um | Design | Pending |
| SOM-23 | P1: Volume de cada um | Design | Pending |
| SOM-24 | P1: Volume de cada um | Design | Pending |
| SOM-25 | P2: Som na cena | Design | Pending |
| SOM-26 | P2: Som na cena | Design | Pending |
| SOM-27 | P2: Som na cena | Design | Pending |
| SOM-28 | P2: Som na cena | Design | Pending |
| SOM-29 | P2: Som na cena | Design | Pending |

**Coverage:** 29 total, 0 mapped to tasks, 29 unmapped ⚠️

---

## Sources

- `.specs/ROADMAP.md` - feature E and the user's words
- `.specs/features/sounds/context.md` - this feature's answers
- `.specs/features/campaign-folder/spec.md` CAMP-10, CAMP-11, CAMP-14, CAMP-16..19 - the folder lists, "Adicionar arquivos" and scenes this builds on
- `.specs/features/sidebar-tabs/spec.md` and `.specs/features/map-tools/spec.md` MTB-15 - the panels and the layout reset

---

## Success Criteria

- [ ] Numa sessão, o mestre liga a ambientação de cada cena com um clique (ou carregando a cena) e ninguém precisa de outro programa para ouvir.
- [ ] Nenhum jogador ouve a música num ponto diferente do mestre por mais de 1 s.
