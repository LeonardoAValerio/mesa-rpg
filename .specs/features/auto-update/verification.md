# Auto-update verification

**Verdict**: FAIL
**Proofs**: `proofs.md` at 6e53382
**Verifier**: independent sub-agent (author != verifier)

## Checks

| Check | Test | Holds |
| --- | --- | --- |
| C1 | shell proof (`npm run dist`, `test -f` installer and `.blockmap`, `latest.yml` version) + `scripts/build-config.test.ts` `[C1] UPD-01 the Windows build is a one-click NSIS installer per user, named MesaRPG-Setup-<versão>` | yes - files checked by exact name; `perMachine: false`, `oneClick: true` asserted |
| C2 | `scripts/build-config.test.ts` `[C2] UPD-02 the build has no portable target` | yes - target list is exactly `['nsis']`, no `portable` block, scripts name no portable |
| C3 | `src/main/updater.test.ts` `[C3] UPD-03 packaged, the updater checks the latest release once on start and downloads on its own` | yes - `checks` is exactly 1, `autoDownload` true; the repo it checks is C23's publish config (`app-update.yml` in `dist/win-unpacked` names `LeonardoAValerio/mesa-rpg`) |
| C4 | `e2e/update.spec.ts` `[C4] UPD-04 a newer version shows "Baixando atualização <versão>…" in the top bar while it downloads` | yes - exact text, before and during progress, no button |
| C5 | `e2e/update.spec.ts` `[C5] UPD-05 a finished download shows "Atualização <versão> pronta" and "Reiniciar e atualizar", on the start screen and on the table` | yes - exact text and button on the start screen, after reload, and on the table, with the bar above the table header |
| C6 | `e2e/update.spec.ts` `[C6] UPD-06 a player's "Reiniciar e atualizar" runs the install at once` | yes - `quitAndInstall(false, true)` recorded with no confirm shown |
| C7 | `e2e/update.spec.ts` `[C7] UPD-07 while hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs` | yes - exact question; "Não" keeps the table and records no install; "Sim" installs |
| C8 | `e2e/update.spec.ts` `[C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa"` | yes - exact text in the player's window, server gone |
| C9 | `src/main/updater.test.ts` `[C9] UPD-09 a downloaded update installs on quit: autoInstallOnAppQuit is on` | yes - at the layer reachable without a real install |
| C10 | `src/main/updater.test.ts` `[C10] UPD-10 no updater event calls quitAndInstall; install() stops the server first, then quitAndInstall(false, true)` | yes - every event electron-updater emits, then `installs` is `[]`; order stopServer → quitAndInstall asserted |
| C11 | `e2e/update.spec.ts` `[C11] UPD-11 the same or an older version shows no bar` | yes - bar hidden and state `idle` after `update-not-available` |
| C12 | `e2e/update.spec.ts` `[C12] UPD-12 a failed check or download shows no bar and the app keeps working` (+ `updater.test.ts` `[C12]` for the rejected check) | yes - error before and during the download hides the bar, hosting still works; a rejected check raises no unhandled rejection |
| C13 | `src/main/updater.test.ts` `[C13] UPD-13 unpackaged, the updater never checks for updates and ignores its events` | no - tests `startUpdater({ isPackaged: false })` only; the decision of what `isPackaged` is (`src/main/index.ts:41`) has no test (F2) |
| C14 | `e2e/version.spec.ts` `[C14] UPD-14 the start screen shows "Versão <versão>" of the app` | yes - exact text from `package.json`, and an overridden 0.0.9 |
| C15 | `e2e/version.spec.ts` `[C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept` | yes - exact message, three fields asserted |
| C16 | `src/main/table-server.version.test.ts` `[C16] VER-02 refuses a join with no version, naming the player version "desconhecida", and keeps no session` | yes - exact reason, no welcome, players stay `['Mestre']` |
| C17 | `src/renderer/net/table-client.version.test.ts` `[C17] VER-03 leaves a master whose welcome has no version or another one, with the message and "desconhecida" when absent` | yes - against a real versionless server and a fake 0.3.0 master: exact message, socket closed |
| C18 | `src/main/table-server.version.test.ts` `[C18] VER-04 a join with the same version gets welcome carrying the master version and joins the table` | yes |
| C19 | `e2e/version.spec.ts` `[C19] VER-05 a player refused for the version is in neither window players list` | yes - a later same-version join proves the master's list is live, not stale |
| C20 | `scripts/release-workflow.test.ts` `[C20] REL-01 runs on v* tags, on windows-latest, and publishes with npm run release as a public release` | no - REL-01 fixes the release name `v<versão>`; the test does not assert it and electron-builder names it `0.1.0` (F1) |
| C21 | `scripts/check-tag.test.ts` `[C21] REL-02 a tag different from "v" + the package.json version fails with the message` | yes - run as a process; exit 1 and exact stderr for a bumped tag and a tag without `v` |
| C22 | `scripts/release-workflow.test.ts` `[C22] REL-03 the tag check, typecheck and unit tests run before the publish step` | yes - and a companion test shows the order check fails when publish moves first |
| C23 | `scripts/build-config.test.ts` `[C23] REL-04 updates and releases point at the GitHub repository LeonardoAValerio/mesa-rpg as public releases` | yes - `toEqual` on the whole publish block |
| C24 | shell proof (`git rev-parse --show-toplevel`, `git ls-files --error-unmatch`) | yes |
| C25 | shell proof (two subjects and one path in `git log`, no `mesa-rpg/` path) | no - proves "every commit kept" on 2 of 46 commits (F3); the history itself is complete |
| C26 | shell proof (`git log --all --name-only` has no excluded path) | yes - the history covers the tree; only `refs/heads/main` exists |
| C27 | shell proof (`grep -qx` the three headings) | yes - the sections hold install, play and publish steps |

## Findings

| Finding | Evidence | Fix | Closed |
| --- | --- | --- | --- |
| F1 (C20, REL-01): the release is named `0.1.0`, not `v0.1.0`, and no test fails | `node_modules/electron-publish/out/gitHubPublisher.js:177` sets `name: this.releaseName \|\| this.version`; `electron-builder.yml:20` has no `releaseInfo.releaseName`; `scripts/release-workflow.test.ts:42` never asserts the name. The README (`## Publicar uma versão`, step 3) also promises `v<versão>` | set the release name to `v<versão>` (e.g. `releaseInfo.releaseName` in `electron-builder.yml`, checking how electron-builder expands it) and assert it in C20's test || 47f4202 - the workflow passes `-c.releaseInfo.releaseName=${{ github.ref_name }}` (a literal in electron-builder.yml is not expanded); C20 asserts it through electron-builder's own CLI parser |
| F2 (C13, UPD-13): the unpackaged-means-no-check decision is untested | `src/main/index.ts:41` `isPackaged: test \|\| app.isPackaged`; `src/main/updater.test.ts:36` calls `startUpdater` with a literal `false`, and every e2e runs with `MESA_TEST=1`, so replacing the line with `isPackaged: true` (an `npm run dev` that asks GitHub) leaves every proof green | move the choice of updater and `isPackaged` into a function in `updater.ts` (e.g. `updaterMode({ isPackaged, test })`) and test that unpackaged without `MESA_TEST` gives no check || 3b29140 - C13 is now an e2e with Electron's own `isPackaged` through `src/main/index.ts` (`MESA_TEST_UNPACKAGED`); replacing it with `true` fails it |
| F3 (C25, REPO-02): "every existing commit" is proved on two subjects | `.specs/features/auto-update/tasks.md:418` C25's proof greps 2 subjects and `src/core/dice.ts`; dropping 44 of the 46 old commits keeps it green. Own check: the sorted subjects of `../.git-pre-split` `log -- mesa-rpg .specs` equal those of `git log 648d405` (46 each) | make the proof compare the subject list against `../.git-pre-split` (or a committed list of the 46 subjects) || d19997e - C25 compares subject, author and time of all 46 commits with `../.git-pre-split` |

Own examples run at `HEAD` as throwaway tests (deleted): a player on 0.3.0 joining a 0.2.0 master (newer side) gets the exact VER-01 message; `downloaded` with no prior `available` still shows "Atualização 0.2.0 pronta"; `downloaded` with no version stays idle. Both rules hold on these. Off-spec only: a version longer than 64 characters is dropped by the protocol schema with no message (the player times out), and an empty-string version prints `você .` rather than `desconhecida`; neither value comes from `app.getVersion()`.
