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
