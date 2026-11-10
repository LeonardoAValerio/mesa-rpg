# Pasta da campanha — Context

**Gathered:** 2026-11-09
**Spec:** `.specs/features/campaign-folder/spec.md`

## Feature Boundary

Feature D of `.specs/ROADMAP.md`. user (request): "o aplicativo criar uma pasta para ele, onde da ir adicionado as imagens e coisas, e nessa pasta quando você tenta buscar um token, ou mapa, ele já mostra os que estão salvos dentro dele"; "deixar os efeitos sonoros e musicas separadas"; "criar uma pasta do RPG, e dentro dela eu coloco tudo dele, daí ali eu posso deixar configurados cenas já com tokens, as musicas e tudo mais".

## Implementation Decisions

- Folder: `Documentos/Mesa RPG/<Campanha>/` with `mapas/`, `tokens/`, `objetos/`, `musicas/`, `efeitos/`, `cenas/`; the folder can be opened from the app. user: "Documentos/Mesa RPG (Recomendado)" (roadmap).
- The campaign is chosen when hosting: the start screen lists the campaigns and has "Nova campanha"; the last one is remembered. user: "Ao hospedar (Recomendado)".
- Scenes are light files in `cenas/` that point at the campaign's own files; "Salvar cena" asks only a name; Mapas lists the scenes; "Exportar .mesa" keeps making the full file. user: "Leves, apontando para a pasta (Recomendado)".
- The app watches the folder: files added in Explorer show within 2 s. user: "Sozinho (Recomendado)".
- Subfolders of `tokens/`, `objetos/` and `mapas/` are groups that open and close. user: "Sim, como grupos (Recomendado)".

## Deferred Ideas

- Listing and playing `musicas/` and `efeitos/` (feature E).
