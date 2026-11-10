# sidebar-tabs proofs

**HEAD**: 02384d3
**Tree**: clean
**Shell**: /bin/sh
**Result**: 22 pass, 0 fail

| Check | Proof | Result |
| --- | --- | --- |
| C1 | `run e2e / ✓ [C1] PANEL-01` | pass |
| C2 | `run e2e / ✓ [C2] PANEL-02` | pass |
| C3 | `run e2e / ✓ [C3] PANEL-03` | pass |
| C4 | `run e2e / ✓ [C4] PANEL-04` | pass |
| C5 | `run e2e / ✓ [C5] PANEL-05` | pass |
| C6 | `run e2e / ✓ [C6] PANEL-06` | pass |
| C7 | `run e2e / ✓ [C7] PANEL-07` | pass |
| C8 | `run e2e / ✓ [C8] PANEL-08` | pass |
| C9 | `run e2e / ✓ [C9] PANEL-09` | pass |
| C10 | `run e2e / ✓ [C10] PANEL-10` | pass |
| C11 | `run e2e / ✓ [C11] PANEL-11` | pass |
| C12 | `run e2e / ✓ [C12] PANEL-12` | pass |
| C13 | `run e2e / ✓ [C13] PANEL-13` | pass |
| C14 | `run e2e / ✓ [C14] PANEL-14` | pass |
| C15 | `run e2e / ✓ [C15] PANEL-15` | pass |
| C16 | `run e2e / ✓ [C16] PANEL-16` | pass |
| C17 | `run e2e / ✓ [C17] PANEL-17` | pass |
| C18 | `run e2e / ✓ [C18] PANEL-18` | pass |
| C19 | `run e2e / ✓ [C19] PANEL-19` | pass |
| Build | `scripts/with-node npm run build` | pass |
| Build | `scripts/with-node npm run typecheck` | pass |
| Build | `scripts/with-node npm run lint` | pass |

## Output

`Run e2e` - exit 0

```
  ✓   98 e2e/update.spec.ts:39:1 › [C4] UPD-04 a newer version shows "Baixando atualização <versão>…" in the top bar while it downloads (1.3s)
  ✓   97 e2e/panels.spec.ts:385:1 › [C19] PANEL-19 showing Tokens clears the dot and shows the item's editor; clearing the selection first clears it too (3.8s)
  ✓   69 e2e/net.spec.ts:110:1 › [C12] NET-12 after 60 s without reconnecting the player sees "Conexão perdida" and "Voltar ao início", which goes home (1.1m)
  ✓   99 e2e/update.spec.ts:51:1 › [C5] UPD-05 a finished download shows "Atualização <versão> pronta" and "Reiniciar e atualizar", on the start screen and on the table (1.9s)
  ✓  100 e2e/version.spec.ts:18:1 › [C14] UPD-14 the start screen shows "Versão <versão>" of the app (2.1s)
  ✓  101 e2e/update.spec.ts:71:1 › [C6] UPD-06 a player's "Reiniciar e atualizar" runs the install at once (3.0s)
  ✓  102 e2e/version.spec.ts:25:1 › [C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept (2.8s)
  ✓  103 e2e/update.spec.ts:81:1 › [C7] UPD-07 while hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs (3.2s)
  ✓  104 e2e/version.spec.ts:40:1 › [C19] VER-05 a player refused for the version is in neither window players list (4.2s)
  ✓  105 e2e/update.spec.ts:99:1 › [C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa" (2.9s)
  ✓  106 e2e/update.spec.ts:109:1 › [C13] UPD-13 an unpackaged app (npm run dev) never checks for updates and shows no bar (965ms)
  ✓  107 e2e/update.spec.ts:117:1 › [C11] UPD-11 the same or an older version shows no bar (975ms)
  ✓  108 e2e/update.spec.ts:125:1 › [C12] UPD-12 a failed check or download shows no bar and the app keeps working (1.2s)

  108 passed (2.6m)
```
