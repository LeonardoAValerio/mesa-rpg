# Auto-update Context

**Gathered:** 2026-11-09
**Spec:** `.specs/features/auto-update/spec.md`
**Status:** Ready for design

---

## Feature Boundary

Mesa RPG ships as a Windows installer that updates itself from the public GitHub releases of the `mesa-rpg` repository, a tag push publishes a release, and a player whose version differs from the master's cannot join the table.

---

## Implementation Decisions

### Why

- user: "para conseguirmos garantir um versionamento da ferramenta"; "acho que é importante a gente já implementar isso para facilitar as atualizações depois".
- user: "Eu prefiro que seja um instaldor com atualizações automáticas e tenha essa checagem de versão no entrar".

### Repository

- The public repository holds only `mesa-rpg`. user: "o repositorio ele vai ser público, mas a ideia é que seja apenas o mesa-rpg o repositorio".
- `mesa-rpg` becomes the repository root, with `.specs` moved inside it and history kept. user: "mesa-rpg vira a raiz (Recomendado)".

### Update flow

- Downloads in the background and offers a restart; installs on quit when not restarted; never restarts on its own. user: "Baixa e oferece reiniciar (Recomendado)".

### Version check on join

- Master and player must have exactly the same version. user: "Versão exatamente igual (Recomendado)".

### Publishing

- A GitHub Action on a `v*` tag builds on Windows and publishes the release; no token on the user's machine. user: "GitHub Action na tag (Recomendado)".

### Agent's Discretion

- Messages, where the update notice sits, NSIS options and the repository rewrite method - recorded as assumptions in the spec.

### Declined / Undiscussed Gray Areas → Assumptions

- See the spec's Assumptions table.

---

## Specific References

- electron-updater with the GitHub provider (the portable target cannot self-update, so the installer replaces it).

---

## Deferred Ideas

- Code signing (removes the SmartScreen warning).
- A custom app icon.
- Builds for macOS or Linux.
