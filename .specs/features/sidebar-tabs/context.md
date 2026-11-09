# Abas na barra lateral — Context

**Gathered:** 2026-11-09
**Spec:** `.specs/features/sidebar-tabs/spec.md`

## Feature Boundary

Feature C of `.specs/ROADMAP.md`: the sidebar becomes tabs. user (request): "seria importante a gente conseguir dividir as abas, uma aba de tokens, uma de mapas, uma de dados, uma de chat, uma de sons (...), futuramente ficha e entre outras seções".

## Implementation Decisions

- Dados and Chat are separate tabs: Dados has the roller and only the rolls; Chat only the messages; each shows a count of what arrived while it was closed. user: "Separadas (Recomendado)".
- The Sons tab comes with feature E, not before; no empty tab. user: "Só com a feature de sons (Recomendado)".
- Mapas holds Cena (Salvar/Carregar), Importar mapa, the grid and the fog buttons; Conectados stays visible above the tabs. user: "Na aba Mapas (Recomendado)".
- A click on an item does not switch tabs; the Tokens tab is highlighted and has the editor of the selected item when opened. user: "Não, só mostra um aviso (Recomendado)".

## Deferred Ideas

- Ficha and other sections (later features).

## Change of scope (same day, before approval)

- user: "Será que a gente não conseguiria fazer alguma coisa como aqueles editores complexos, como photoshop, e outros, onde você consegue liberar ou esconder as abas e organizar elas dentro da tela?"
- Answer: docking panels with `dockview-core` (8.9.0, MIT, zero dependencies, vanilla TypeScript); plain tabs would be thrown away later. user: "Direto no estilo Photoshop (Recomendado)" (option: panels Tokens, Mapas, Dados, Chat and Conectados as tabs that are dragged, split, floated, closed and reopened; layout saved per computer with "Restaurar layout"; the starting layout is the tabs right of the table).
- The earlier answers still hold: Dados and Chat separate with counts; Mapas holds Cena and the fog buttons; a click on an item only highlights Tokens; Sons comes with feature E.
