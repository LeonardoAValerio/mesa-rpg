# Mesa RPG — Instalador, atualização automática e versão na mesa

**Approved**: 2026-11-09 - user: "Aprovo a spec"

## Problem Statement

Hoje cada versão nova do Mesa RPG é um `.exe` portátil que o mestre precisa mandar para cada amigo, e nada impede um jogador com uma versão antiga de entrar numa mesa mais nova, onde o protocolo pode ter mudado. O usuário quer "garantir um versionamento da ferramenta" e "facilitar as atualizações depois": publicar uma tag no GitHub e todos os apps se atualizarem sozinhos, com a mesa recusando versões diferentes.

## Goals

- [ ] Depois de instalar uma vez, um amigo recebe cada versão nova sem baixar nada à mão: basta abrir o app e clicar em "Reiniciar e atualizar", ou fechar o app.
- [ ] Publicar uma versão é `npm version <patch|minor|major>` seguido de `git push --follow-tags`, sem token na máquina do usuário.
- [ ] Nenhum jogador entra numa mesa cuja versão é diferente da dele.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Assinatura de código | Custa um certificado; o Windows mostra o aviso do SmartScreen na instalação (context.md, Deferred) |
| Ícone próprio do app | Feature separada (context.md, Deferred) |
| Builds macOS e Linux | Todos jogam em Windows |
| Canais beta, rollback, escolher versão | Um grupo de 5 só precisa da última versão |
| Atualizar de dentro do `.exe` portátil 0.1.0 | O portátil não se atualiza; cada amigo instala o instalador uma vez |
| Criar o repositório no GitHub e fazer o primeiro push | Ação remota: só com o seu ok explícito, depois da implementação |
| Rodar a GitHub Action de verdade | Só roda no GitHub depois do push; localmente verificamos o workflow e o build do instalador |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Organização do repositório | `mesa-rpg` vira a raiz do git, com `.specs` dentro dele e o histórico dos dois mantido; o plano `.md` e as pastas de skills ficam fora | user: "mesa-rpg vira a raiz (Recomendado)" | y |
| Fluxo da atualização | Baixa em segundo plano, oferece "Reiniciar e atualizar", instala ao fechar se a pessoa não reiniciar, nunca reinicia sozinho | user: "Baixa e oferece reiniciar (Recomendado)" | y |
| Versão compatível | Exatamente igual (`0.2.0` só com `0.2.0`) | user: "Versão exatamente igual (Recomendado)" | y |
| Publicação | GitHub Action no push de uma tag `v*`, build no Windows | user: "GitHub Action na tag (Recomendado)" | y |
| Endereço do repositório | `LeonardoAValerio/mesa-rpg` no GitHub, público | user: "Vai ser no meu repositorio: https://github.com/LeonardoAValerio" | y |
| Instalador | NSIS de um clique, por usuário (sem administrador), atalho na área de trabalho e no menu Iniciar; o alvo portátil sai do build | O portátil não se atualiza; sem administrador o update também não pede permissão | n |
| Quando checar | Uma vez, ao abrir o app instalado | Uma sessão dura poucas horas; abrir o app de novo pega a próxima | n |
| Aviso durante o download | "Baixando atualização <versão>…" enquanto baixa, depois "Atualização <versão> pronta" com o botão | A pessoa sabe por que a rede está ocupada | n |
| Onde aparece o aviso | Uma faixa fixa no topo da janela, na tela inicial e na mesa | Visível sem tirar ninguém da sessão | n |
| Reiniciar enquanto hospeda | O mestre vê a confirmação "Reiniciar encerra a mesa para todos. Continuar?"; o jogador reinicia direto | Um clique do mestre derruba os outros 4 | n |
| Falha na checagem ou no download | Nada aparece para o usuário; o app segue normal e tenta de novo na próxima abertura | Sem internet o app continua útil pelo Hamachi | n |
| Mensagem de versão diferente | `Versão diferente da do mestre: mestre <versão do mestre>, você <sua versão>. Atualize o app.`; versão ausente aparece como `desconhecida` | Diz as duas versões e o que fazer | n |
| Versão na tela inicial | `Versão <versão>` no rodapé da tela inicial | Quem dá suporte pergunta "qual versão você tem?" | n |
| Gate da Action | A Action roda typecheck e testes de unidade antes de publicar; os E2E rodam localmente | E2E com várias janelas Electron no runner Windows é lento e instável | n |
| Release publicada | A Action cria a release `v<versão>` como rascunho, o electron-builder envia o instalador, o `.blockmap` e o `latest.yml` para ela, e a Action a publica (não rascunho) no fim | O atualizador ignora rascunhos; sem o rascunho prévio o electron-builder criou duas releases `0.2.0` na v0.2.0 | n |
| README | `README.md` em português com como instalar, como jogar e como publicar uma versão | Repositório público; os amigos baixam pela página de releases | n |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Instalador que se atualiza sozinho ⭐ MVP

**User Story**: Como jogador, quero que o Mesa RPG se atualize sozinho para não ter que baixar cada versão nova que o mestre publicar.

**Why P1**: É o motivo da feature.

**Acceptance Criteria**:

1. UPD-01: The build SHALL produce a Windows NSIS installer `MesaRPG-Setup-<versão>.exe`, its `.blockmap` and `latest.yml`, installing per user without administrator rights.
2. UPD-02: The build SHALL NOT produce the portable `.exe`.
3. UPD-03: WHEN the installed app starts THEN the app SHALL check the latest GitHub release of the repository for a version newer than its own.
4. UPD-04: WHEN a newer version is found THEN the app SHALL download it in the background and show "Baixando atualização <versão>…" in the top bar while it downloads.
5. UPD-05: WHEN the download finishes THEN the app SHALL show "Atualização <versão> pronta" and a "Reiniciar e atualizar" button in the top bar, on the start screen and on the table.
6. UPD-06: WHEN a player uses "Reiniciar e atualizar" THEN the app SHALL close, install the downloaded version and open again.
7. UPD-07: WHILE the master is hosting, WHEN the master uses "Reiniciar e atualizar" THEN the app SHALL ask "Reiniciar encerra a mesa para todos. Continuar?" and restart only if the master confirms.
8. UPD-08: WHEN the master confirms the restart THEN the players SHALL see "O mestre encerrou a mesa".
9. UPD-09: IF the user closes the app with a downloaded update THEN the app SHALL install it on quit, and the next start SHALL run the new version.
10. UPD-10: The app SHALL NOT restart by itself.
11. UPD-11: IF the latest release is the same version or older THEN the app SHALL show nothing.
12. UPD-12: IF the check or the download fails THEN the app SHALL show nothing and keep working.
13. UPD-13: WHILE the app runs unpackaged (`npm run dev`, tests) the app SHALL NOT check for updates.
14. UPD-14: The start screen SHALL show "Versão <versão>".

**Independent Test**: com um atualizador simulado, a faixa mostra o download, o botão, a confirmação do mestre e o reinício; o build gera o instalador e o `latest.yml`.

---

### P1: Mesa recusa versão diferente ⭐ MVP

**User Story**: Como mestre, quero que só entre na mesa quem tem a mesma versão que eu, para ninguém jogar com o app quebrando.

**Why P1**: Pedido explícito ("tenha essa checagem de versão no entrar").

**Acceptance Criteria**:

1. VER-01: WHEN a player joins with a version different from the master's THEN the master SHALL refuse the join and the player SHALL see "Versão diferente da do mestre: mestre <versão do mestre>, você <versão do jogador>. Atualize o app." on the start screen, with the IP, port and name kept.
2. VER-02: IF the join carries no version (app 0.1.0) THEN the master SHALL refuse it with the same message, with `desconhecida` as the player's version.
3. VER-03: IF the master's reply carries no version or a different one THEN the player's app SHALL disconnect and show the same message, with `desconhecida` as the master's version when absent.
4. VER-04: WHEN a player joins with the same version as the master THEN the join SHALL proceed as before.
5. VER-05: IF a join is refused for the version THEN the player SHALL NOT appear in the players list of either window.

**Independent Test**: duas janelas com versões diferentes (forçadas no modo de teste): o jogador vê a mensagem e a lista de jogadores do mestre continua só com "Mestre".

---

### P1: Publicar uma versão com uma tag ⭐ MVP

**User Story**: Como mestre e mantenedor, quero publicar uma versão só criando uma tag, sem token na minha máquina.

**Why P1**: Sem publicação não há o que atualizar.

**Acceptance Criteria**:

1. REL-01: WHEN a tag `v<versão>` is pushed THEN the GitHub Action SHALL build the installer on Windows and publish a public (not draft) release named `v<versão>` with the installer, the `.blockmap` and `latest.yml`.
2. REL-02: IF the tag differs from `v` plus the `package.json` version THEN the Action SHALL fail without publishing.
3. REL-03: IF the typecheck or the unit tests fail THEN the Action SHALL fail without publishing.
4. REL-04: The update and publish configuration SHALL point at the GitHub repository `LeonardoAValerio/mesa-rpg`.

**Independent Test**: o workflow tem o gatilho, a checagem da tag e os passos de teste antes do publish; o script de checagem da tag recusa uma tag diferente.

---

### P1: Repositório só com o mesa-rpg ⭐ MVP

**User Story**: Como dono do projeto, quero que o repositório público tenha só o `mesa-rpg`, com as specs junto.

**Why P1**: user: "a ideia é que seja apenas o mesa-rpg o repositorio".

**Acceptance Criteria**:

1. REPO-01: The `mesa-rpg` folder SHALL be the git repository root, with `.specs` inside it.
2. REPO-02: The new repository's history SHALL keep every existing commit that touched `mesa-rpg` or `.specs`, with the paths rewritten to the new root.
3. REPO-03: The repository SHALL NOT contain the plan `Mesa RPG LAN — plano do app.md`, the skill folders (`.claude`, `.cursor`, `.windsurf`, `.agents`), `node_modules`, `out`, `dist` or `test-results`.
4. REPO-04: The repository SHALL have a `README.md` in Portuguese with how to install, how to play and how to publish a version.

**Independent Test**: `git log` na nova raiz mostra os commits antigos; `git ls-files` não lista nenhum dos itens excluídos.

---

## Edge Cases

- IF the player's join reaches a master on 0.1.0 THEN VER-03 applies (the old master accepts it, and the new player leaves with the message).
- IF a player on 0.1.0 joins a master on a newer version THEN VER-02 applies, and the 0.1.0 app shows the master's message on its start screen as it already does for join errors.
- IF the update download is interrupted THEN UPD-12 applies, and the next start downloads again.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| UPD-01 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-02 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-03 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-04 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-05 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-06 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-07 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-08 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-09 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-10 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-11 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-12 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-13 | P1: Instalador que se atualiza sozinho | Design | Pending |
| UPD-14 | P1: Instalador que se atualiza sozinho | Design | Pending |
| VER-01 | P1: Mesa recusa versão diferente | Design | Pending |
| VER-02 | P1: Mesa recusa versão diferente | Design | Pending |
| VER-03 | P1: Mesa recusa versão diferente | Design | Pending |
| VER-04 | P1: Mesa recusa versão diferente | Design | Pending |
| VER-05 | P1: Mesa recusa versão diferente | Design | Pending |
| REL-01 | P1: Publicar uma versão com uma tag | Design | Pending |
| REL-02 | P1: Publicar uma versão com uma tag | Design | Pending |
| REL-03 | P1: Publicar uma versão com uma tag | Design | Pending |
| REL-04 | P1: Publicar uma versão com uma tag | Design | Pending |
| REPO-01 | P1: Repositório só com o mesa-rpg | Design | Pending |
| REPO-02 | P1: Repositório só com o mesa-rpg | Design | Pending |
| REPO-03 | P1: Repositório só com o mesa-rpg | Design | Pending |
| REPO-04 | P1: Repositório só com o mesa-rpg | Design | Pending |

**Coverage:** 27 total, 0 mapped to tasks, 27 unmapped ⚠️

---

## Sources

- user: "Será que seria possível eu apenas colocar um repositorio no git e ele realizar requisição para ver qual é a tag, e se estiver diferente ele realizar a atualização?" - the feature itself
- user: "Eu prefiro que seja um instaldor com atualizações automáticas e tenha essa checagem de versão no entrar" - installer, auto-update, version check
- `.specs/features/auto-update/context.md` - every decision with the user's words

---

## Success Criteria

- [ ] Um amigo com a versão N instalada abre o app, clica em "Reiniciar e atualizar" e volta na versão N+1.
- [ ] Uma tag publicada vira uma release com `latest.yml` sem nenhum passo manual além do push.
- [ ] Um jogador com versão diferente não aparece na lista de jogadores do mestre.
