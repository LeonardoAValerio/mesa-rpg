# map-tools proofs

**HEAD**: a66f06f
**Tree**: clean
**Shell**: /bin/sh
**Result**: 18 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ✓ [C1] MTB-01` | pass |
| C2 | `run e2e / ✓ [C2] MTB-02` | pass |
| C3 | `run e2e / ✓ [C3] MTB-03` | pass |
| C4 | `run e2e / ✓ [C4] MTB-04` | pass |
| C5 | `run e2e / ✓ [C5] MTB-05` | pass |
| C6 | `run e2e / ✓ [C6] MTB-06` | pass |
| C7 | `run e2e / ✓ [C7] MTB-07` | pass |
| C8 | `run e2e / ✓ [C8] MTB-08` | pass |
| C9 | `run e2e / ✓ [C9] MTB-09` | pass |
| C10 | `run e2e / ✓ [C10] MTB-10` | pass |
| C11 | `run e2e / ✓ [C11] MTB-11` | pass |
| C12 | `run e2e / ✓ [C12] MTB-12` | pass |
| C13 | `run e2e / ✓ [C13] MTB-13` | pass |
| C14 | `run e2e / ✓ [C14] MTB-14` | pass |
| C15 | `run e2e / ✓ [C15] MTB-15` | pass |
| Build | `scripts/with-node npm run build` | pass |
| Build | `scripts/with-node npm run typecheck` | pass |
| Build | `scripts/with-node npm run lint` | pass |

## Output

`Run e2e` - exit 0

```
  ✓  113 e2e/update.spec.ts:39:1 › [C4] UPD-04 a newer version shows "Baixando atualização <versão>…" in the top bar while it downloads (817ms)
  ✓  112 e2e/tools.spec.ts:88:1 › the ruler tool does not move tokens (TOOL-01) (2.2s)
  ✓  114 e2e/update.spec.ts:51:1 › [C5] UPD-05 a finished download shows "Atualização <versão> pronta" and "Reiniciar e atualizar", on the start screen and on the table (1.2s)
  ✓  115 e2e/version.spec.ts:18:1 › [C14] UPD-14 the start screen shows "Versão <versão>" of the app (1.5s)
  ✓  116 e2e/update.spec.ts:71:1 › [C6] UPD-06 a player's "Reiniciar e atualizar" runs the install at once (2.0s)
  ✓  117 e2e/version.spec.ts:25:1 › [C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept (1.8s)
  ✓  118 e2e/update.spec.ts:81:1 › [C7] UPD-07 while hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs (2.2s)
  ✓  119 e2e/version.spec.ts:40:1 › [C19] VER-05 a player refused for the version is in neither window players list (2.9s)
  ✓  120 e2e/update.spec.ts:99:1 › [C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa" (2.0s)
  ✓  121 e2e/update.spec.ts:109:1 › [C13] UPD-13 an unpackaged app (npm run dev) never checks for updates and shows no bar (610ms)
  ✓  122 e2e/update.spec.ts:117:1 › [C11] UPD-11 the same or an older version shows no bar (608ms)
  ✓  123 e2e/update.spec.ts:125:1 › [C12] UPD-12 a failed check or download shows no bar and the app keeps working (815ms)
  ✓   75 e2e/net.spec.ts:111:1 › [C12] NET-12 after 60 s without reconnecting the player sees "Conexão perdida" and "Voltar ao início", which goes home (1.0m)

  123 passed (2.4m)
```
