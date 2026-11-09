# Roadmap

Agreed on 2026-11-09 after v0.2.1. One feature at a time, each with its own spec, tests and release.
user: "Sim, nessa ordem (Recomendado)".

| # | Feature | Folder | Status |
| --- | --- | --- | --- |
| A | Névoa em formas livres, com ferramentas claras | `.specs/features/fog-shapes/` | Done - v0.3.0 |
| B | Tokens e objetos: PNG no tamanho natural, anel de facção opcional, tipo Objeto | `.specs/features/tokens-objects/` | Done - v0.4.0 |
| C | Abas na barra lateral: Tokens, Mapas, Dados, Chat, Sons (depois Ficha e outras) | - | Pending |
| D | Pasta da campanha em `Documentos/Mesa RPG/<Campanha>/` com mapas, tokens, objetos, músicas, efeitos e cenas; as abas listam o que está nela | - | Pending |
| E | Sons: músicas e efeitos tocados pelo mestre, sincronizados com os jogadores, volume por pessoa | - | Pending |

## Decisions already taken (user's words)

- Fog: free-form shapes, pixel accurate, not grid cells. user: "Formas livres (Recomendado)" (option: brush, rectangle and polygon like Owlbear; a token is hidden when its centre is under fog).
- Tokens: the PNG at its natural size and aspect ratio, scaled by the grid; no frame by default; the faction ring is an option per token; objects (chest, item) never have a ring. user: "PNG puro, anel opcional (Recomendado)".
- Campaign folder: `Documentos/Mesa RPG/` with one subfolder per campaign; choose or create the campaign when hosting; open the folder from the app. user: "Documentos/Mesa RPG (Recomendado)".
- Order A → B → C → D → E, one release per feature. user: "Sim, nessa ordem (Recomendado)".

## The user's request (2026-11-09), kept for the later features

- Tabs: "uma aba de tokens, uma de mapas, uma de dados, uma de chat, uma de sons (...), futuramente ficha e entre outras seções".
- Fog: "a Fog ainda está meio estranha, não está funcionando, apenas o botão de cobrir tudo e revelar tudo" (test map: `Florestas Frias.jpg`, 2048x1536, ~85 px grid). Cause found: the brush and rectangle start in "Revelar" and, since 0.2.1, a new map has no fog, so nothing visible happens; the modes sit in the side panel far from the tools.
- Folder: "o aplicativo criar uma pasta para ele, onde da ir adicionado as imagens e coisas, e nessa pasta quando você tenta buscar um token, ou mapa, ele já mostra os que estão salvos dentro dele"; "gerenciamento de música e efeitos sonoros (...) deixar os efeitos sonoros e musicas separadas"; "criar uma pasta do RPG, e dentro dela eu coloco tudo dele, daí ali eu posso deixar configurados cenas já com tokens, as musicas e tudo mais".
- Tokens: "os tokens que você colocou ali de serem 'neutros', não sei se é muito interessante, as vezes eu vou querer colocar um token como um item no chão, um báu, etc."; "os tokens eles estão colocando uma borda e achatando o elemento, mas na verdade acho que deve ser do tamanho do PNG ou fazer alguma escala".
- References researched: Owlbear Rodeo (layers map/prop/character/attachment, pixel-accurate fog shapes, asset library with type folders and per-campaign collections), Foundry VTT (sidebar tabs, Playlists for music and effects, scene playlists).
