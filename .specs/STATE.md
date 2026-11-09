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
