# State

## Decisions

### AD-001
- **Decision**: O servidor da mesa roda no processo main do Electron e toda janela, inclusive a do mestre, é cliente via WebSocket; o mestre se identifica por um `hostToken` local.
- **Reason**: Um único caminho de rede; o teste de duas janelas exercita a rede real. user: "Servidor no main, todos via ws (Recomendado)".
- **Trade-off**: A janela do mestre passa pelo loopback em vez de IPC direto.
- **Scope**: mesa-rpg inteiro (main, renderer, protocolo).
- **Date**: 2026-11-08
- **Status**: active

### AD-002
- **Decision**: Toda regra que muda o que um usuário vê (permissões, visibilidade, névoa, dados, grid, validação) mora em `mesa-rpg/src/core`, TypeScript puro sem Node nem DOM, testado com Vitest; Playwright Electron cobre fluxos de tela com duas janelas.
- **Reason**: As regras ficam ao alcance dos testes; o canvas PixiJS não é testável de outra forma. user: "Vitest + Playwright Electron (Recomendado)".
- **Trade-off**: O renderer não pode ter lógica própria de regra; a UI depende de um hook de teste para expor o que desenhou.
- **Scope**: mesa-rpg inteiro.
- **Date**: 2026-11-08
- **Status**: active

### AD-003
- **Decision**: O Mesa RPG é distribuído como instalador NSIS por usuário que se atualiza pelas releases do GitHub (`LeonardoAValerio/mesa-rpg`) com electron-updater; o `.exe` portátil sai do build.
- **Reason**: O portátil não se atualiza sozinho. user: "Eu prefiro que seja um instaldor com atualizações automáticas e tenha essa checagem de versão no entrar".
- **Trade-off**: Cada amigo instala uma vez; substitui PKG-01 do MVP (o check do `.exe` portátil deixa de valer).
- **Scope**: empacotamento, processo main, publicação.
- **Date**: 2026-11-09
- **Status**: active

### AD-004
- **Decision**: `mesa-rpg` é a raiz do repositório git, com `.specs` dentro dela; o histórico antigo é reescrito para os novos caminhos e o `.git` de `basement-tabletop` fica guardado como `basement-tabletop/.git-pre-split`.
- **Reason**: O repositório público tem só o app. user: "mesa-rpg vira a raiz (Recomendado)".
- **Trade-off**: Os hashes de commit antigos mudam; `proofs.md` e `verification.md` do MVP citam hashes do repositório anterior, guardado no backup.
- **Scope**: repositório.
- **Date**: 2026-11-09
- **Status**: active

### AD-005
- **Decision**: Um mapa importado vem sem névoa; o painel de névoa ganha "Revelar tudo"; ajustar o grid só recobre tudo quando havia alguma célula coberta. Substitui FOG-01 e FOG-08 do MVP.
- **Reason**: user: "quando eu importo um mapa ele fica meio escurecido (...) não estou conseguindo deixar ele totalmente claro"; "Mapa vem sem névoa (Recomendado)"; spec aprovada: "Aprovo sim".
- **Trade-off**: Quem quer névoa precisa usar "Cobrir tudo" depois de importar; os checks C64 (FOG-01) e o de FOG-08 do MVP passam a provar a regra nova.
- **Scope**: `src/core/reducer.ts`, `src/core/fog.ts`, painel de névoa.
- **Date**: 2026-11-09
- **Status**: active
