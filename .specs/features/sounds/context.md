# Sounds Context

**Gathered:** 2026-11-10
**Spec:** `.specs/features/sounds/spec.md`
**Status:** Ready for tasks

---

## Feature Boundary

Feature E of `.specs/ROADMAP.md`: the master plays music and sound effects from the campaign's `musicas/` and `efeitos/` folders, everyone at the table hears them in sync, and each person sets their own volume. user (request): "gerenciamento de música e efeitos sonoros (...) deixar os efeitos sonoros e musicas separadas"; "criar uma pasta do RPG (...) deixar configurados cenas já com tokens, as musicas e tudo mais"; tabs: "uma aba de sons".

---

## Implementation Decisions

### Music

- Several music tracks play at once as layers (rain + tavern + music), each looping. user: "Várias camadas ao mesmo tempo".
- A click on a track turns its layer on (fades in over about 2 s); a click again turns it off (fades out); "Parar tudo" stops every layer; up to 8 layers. user: "Clique liga/desliga, com fade (Recomendado)".
- The master sets each playing layer's volume, the same for everyone. user: "Mestre define a mistura (Recomendado)".

### Effects

- Only the master plays effects; an effect plays once for everyone, and several can overlap. user: "Só o mestre (Recomendado)".

### Scenes

- A saved scene keeps the layers playing (and their volumes); loading it starts them and stops the others, or stops all music when the scene had none. user: "Sim, a música tocando (Recomendado)".

### Volume

- Each person has two controls, "Música" and "Efeitos", plus mute, only for themselves and kept on their computer; the master does not set anyone else's. user: "Cada um tem 2 controles (Recomendado)". The master's layer volume and the person's "Música" multiply.

### Agent's Discretion

None delegated.

### Declined / Undiscussed Gray Areas → Assumptions

Formats, size limit, sync tolerance, late joiners, effect preload, what players see in Sons and `.mesa` are low-stakes defaults written to the spec's Assumptions table for the user to correct.
