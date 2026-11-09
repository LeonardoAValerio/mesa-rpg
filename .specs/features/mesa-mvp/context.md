# Mesa MVP Context

**Gathered:** 2026-11-08
**Spec:** `.specs/features/mesa-mvp/spec.md`
**Status:** Ready for spec review

---

## Feature Boundary

O MVP inteiro do documento "Mesa RPG LAN — plano do app" (Fases 1–6): app Electron único para mestre e jogadores, servidor embutido no PC do mestre, mapa com grid, tokens, permissões, dados, chat, régua, ping, desenho, névoa, arquivo `.mesa` e `.exe` portátil.

---

## Implementation Decisions

### Sistema de jogo
- Regras próprias da campanha. Rolador genérico agora; mecânicas da campanha entram como módulo depois do MVP. (user: "Regras próprias")

### Escopo
- MVP completo, Fases 1–6. (user: "MVP completo, Fases 1–6 (Recomendado)")

### Pasta e ambiente
- Projeto em `/home/usuario/Projects/basement-tabletop/mesa-rpg`; Node instalado via nvm no usuário; desenvolvimento e testes nesta máquina Linux; `.exe` portátil de Windows gerado com electron-builder. (user: "Aqui, em ./mesa-rpg (Recomendado)")

### Grupo
- Até 5 pessoas contando o mestre, todos em Windows; o build final é só o `.exe` portátil. (user: "Até 5, todos Windows (Recomendado)")

### Dono dos tokens
- O jogador entra com um nome; o mestre atribui o dono de cada token. Reconectar com o mesmo nome recupera os tokens. (user: "Mestre atribui (Recomendado)")

### Mapa-múndi
- Navegação por seções fica para depois do MVP; no MVP o mestre carrega qualquer imagem como mapa, inclusive o mapa-múndi. (user: "Fica para depois (Recomendado)")

### Tokens sob névoa
- Para jogadores, token em área coberta não aparece (exceto os do próprio jogador) e o servidor não envia os dados dele. (user: "Ficam invisíveis (Recomendado)")

### Agent's Discretion
- Detalhes não perguntados estão como Assumptions na spec, para o usuário corrigir antes de aprovar.

---

## Specific References

- Documento "Mesa RPG LAN — plano do app.md" (raiz do repo).
- Detecção de grid: método do kit do Blender (média de brilho por coluna + FFT).

---

## Deferred Ideas

- Navegação pelas 12 seções do mapa-múndi (pós-MVP).
- Iniciativa, condições, fichas, regras da campanha (pós-MVP, pelo plano).

---

## Decisions after spec approval (2026-11-08)

- Node: instalar Node 22 via o `~/.nvm` existente. (user: "Instale Node 22 via nvm")
- Arquitetura: servidor `ws` no processo main do Electron; a janela do mestre conecta em 127.0.0.1 como qualquer jogador; regras num módulo TypeScript puro. (user: "Servidor no main, todos via ws (Recomendado)")
- Testes: Vitest para regras e servidor com clientes ws reais; Playwright Electron com duas janelas reais. (user: "Vitest + Playwright Electron (Recomendado)")
