# Mesa RPG LAN — MVP Specification

**Approved**: 2026-11-08 - user: "o projeto está aprovado sim"

## Problem Statement

O grupo quer jogar a campanha numa mesa virtual própria, com os mapas e tokens da campanha, sem depender de serviço na internet. Hoje não existe app: o mestre precisa de um `.exe` portátil que hospede a mesa no PC dele, e os jogadores entram pelo IP do mestre numa rede virtual (Hamachi ou Radmin VPN).

## Goals

- [ ] Uma sessão real com até 5 pessoas (mestre + 4) roda pelo Hamachi com mapa, tokens, dados, chat, régua, ping, desenho e névoa sincronizados.
- [ ] Um token movido numa janela aparece na posição nova em todas as outras janelas em menos de 500 ms numa rede local.
- [ ] O mestre importa a pasta de tokens do kit do Blender e um mapa de seção sem conversão manual.
- [ ] A cena inteira (mapa, grid, tokens, névoa) volta igual depois de salvar e carregar um `.mesa`.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Rastreador de iniciativa, condições nos tokens, fichas | Pós-MVP pelo plano |
| Regras e mecânicas da campanha | Regras próprias entram como módulo depois do MVP (context.md) |
| Navegação pelas seções do mapa-múndi | Pós-MVP (user: "Fica para depois") |
| Descoberta automática da mesa por broadcast | Costuma falhar em VPN; entrar por IP e porta |
| Senha da mesa, contas de usuário | Só quem está na rede VPN do grupo alcança o IP |
| Servidor na internet, relay, NAT traversal | O plano exige só rede local virtual |
| Builds Linux/Mac | Todos jogam em Windows (user: "Até 5, todos Windows") |
| Auto-update, voz, vídeo | Fora do plano |
| Teste real pelo Hamachi com um amigo | Feito pelo usuário em Windows; aqui verificamos o `.exe` gerado e duas janelas em 127.0.0.1 |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Sistema de jogo | Rolador genérico, sem regras de sistema | user: "Regras próprias" | y |
| Escopo | Fases 1–6 do plano | user: "MVP completo, Fases 1–6 (Recomendado)" | y |
| Pasta do projeto | `/home/usuario/Projects/basement-tabletop/mesa-rpg`, Node via nvm | user: "Aqui, em ./mesa-rpg (Recomendado)" | y |
| Tamanho do grupo e SO | Até 5 pessoas, todos Windows; só `.exe` portátil x64 | user: "Até 5, todos Windows (Recomendado)" | y |
| Dono dos tokens | Mestre atribui; reconectar com o mesmo nome recupera | user: "Mestre atribui (Recomendado)" | y |
| Mapa-múndi | Carregado como mapa comum; sem navegação por seções | user: "Fica para depois (Recomendado)" | y |
| Tokens sob névoa | Invisíveis para jogadores, exceto os próprios; servidor não os envia | user: "Ficam invisíveis (Recomendado)" | y |
| Idioma da interface | Português | O grupo e o plano são em português | n |
| "Vantagem" na notação | Sufixos genéricos `kh`/`kl` (manter maiores/menores): `2d20kh1` é vantagem, `2d20kl1` desvantagem | Regras próprias: sem amarrar a D&D, mas cobre o exemplo do plano | n |
| Limites da notação de dados | 1–100 dados por termo, 2–1000 faces, até 10 termos; o modificador é a soma das constantes e fica em -1000..1000 (`1d6+1000+1000` é inválido) | Evita travar o servidor com `99999d6`; a soma foi escolhida após o Verifier apontar a ambiguidade | n |
| Limite de conexões | Até 8 jogadores além do mestre | Folga sobre o grupo de 5 | n |
| Nome do jogador | 1–24 caracteres; único entre conectados | Identifica o dono dos tokens | n |
| Resolução da névoa | Por célula do grid; pincel com raio em células, retângulo em células | Torna "token sob névoa" exato e o estado pequeno | n |
| Mestre pode recobrir | Pincel e retângulo têm modo Revelar e Cobrir, mais "Cobrir tudo" | Corrige um revelar errado sem recarregar a cena | n |
| Distância da régua | Diagonal conta 1 célula (máximo entre dx e dy) | Regra mais simples de grid; regras próprias podem trocar depois | n |
| Régua, ping e desenho | Visíveis para todos; desenho some 5 s depois de terminado, ping dura 2 s | "Desenho rápido que some sozinho" do plano | n |
| Formato `.mesa` | JSON único com as imagens embutidas em base64 | Arquivo portátil: abre em outro PC sem as pastas originais | n |
| Cache de assets | Pasta `cache` em `userData` do app, por hash SHA-256 | O jogador só baixa o que falta | n |
| Tipos e tamanho de imagem | PNG, JPG e WebP; até 50 MB por arquivo | Cobre os mapas 2000x1500 e tokens 512x512 | n |
| Manifesto do token | Lê `<nome>.json` ao lado do PNG se existir; sem ele, facção `neutro`, tamanho 1 | O kit ainda não grava o manifesto | n |
| Paleta | Lê um `palette.json` escolhido pelo mestre; sem ele, cores padrão por facção | O caminho do kit é do PC Windows do mestre | n |
| Formato do `palette.json` | Cores `#rrggbb` com chaves `grupo`, `inimigo`, `npc`, `neutro` na raiz ou em `faccoes`; facção ausente usa a cor padrão | O formato do arquivo do kit não está no plano e o arquivo está no PC Windows; confirmar com um `palette.json` real | n |
| Firewall do Windows | O app escuta em `0.0.0.0`; o Windows mostra o próprio pedido de liberação na primeira vez, e a tela de hospedar explica que é preciso aceitar | O app não altera o firewall sozinho (exigiria administrador) | n |
| Queda de conexão | O jogador vê o aviso e o app tenta reconectar a cada 3 s por até 60 s | Quedas curtas do Hamachi são comuns | n |
| Janela | Funciona a partir de 1280x720 | Notebooks do grupo | n |
| Build do `.exe` no Linux | electron-builder `portable` x64 sem assinatura nem edição do executável (`signAndEditExecutable: false`), sem Wine | Esta máquina é Linux; o executável não precisa de ícone customizado no MVP | n |

**Open questions:** none - all resolved or logged above (required before the spec is confirmed).

---

## User Stories

### P1: Hospedar e entrar na mesa ⭐ MVP

**User Story**: As a mestre, I want hospedar a mesa no meu PC e que os jogadores entrem pelo meu IP so that jogamos sem servidor na internet.

**Why P1**: Sem conexão não existe mesa (Fase 1).

**Acceptance Criteria**:

1. WHEN o app abre THEN the app SHALL mostrar a tela inicial com os botões "Hospedar" e "Entrar".  <!-- NET-01 -->
2. WHEN o mestre usa "Hospedar" com a porta 47800 preenchida por padrão THEN the app SHALL iniciar o servidor nessa porta em `0.0.0.0` e abrir a mesa como mestre.  <!-- NET-02 -->
3. WHILE o app hospeda a mesa the app SHALL mostrar os IPv4 da máquina e a porta, marcando endereços `25.x.x.x` como "Hamachi" e `26.x.x.x` como "Radmin", cada um com um botão "Copiar" que copia `IP:porta`.  <!-- NET-03 -->
4. IF a porta digitada não é um inteiro entre 1024 e 65535 THEN the app SHALL mostrar "Porta inválida" e não iniciar o servidor.  <!-- NET-04 -->
5. IF a porta já está em uso THEN the app SHALL mostrar "Porta <porta> em uso" e voltar à tela inicial.  <!-- NET-05 -->
6. WHEN um jogador usa "Entrar" com IP, porta e nome válidos THEN the app SHALL conectar ao servidor e mostrar a mesa atual com o nome do jogador na lista de conectados de todas as janelas.  <!-- NET-06 -->
7. IF o nome está vazio, tem mais de 24 caracteres ou já está em uso por um jogador conectado THEN the server SHALL recusar a entrada e the app SHALL mostrar "Nome inválido" ou "Nome já em uso".  <!-- NET-07 -->
8. IF o servidor não responde em 5 s THEN the app SHALL mostrar "Não foi possível conectar a <IP>:<porta>" e manter os campos preenchidos.  <!-- NET-08 -->
9. IF já há 8 jogadores conectados THEN the server SHALL recusar a nova entrada com "Mesa cheia".  <!-- NET-09 -->
10. WHEN a conexão de um jogador cai THEN the app SHALL mostrar "Conexão com o mestre perdida — tentando reconectar" e tentar reconectar a cada 3 s por até 60 s.  <!-- NET-10 -->
11. WHEN um jogador reconecta com o mesmo nome THEN the server SHALL devolver a ele a posse dos mesmos tokens.  <!-- NET-11 -->
12. IF a reconexão falha por 60 s THEN the app SHALL mostrar "Conexão perdida" com o botão "Voltar ao início".  <!-- NET-12 -->
13. WHEN o mestre fecha a mesa ou o app THEN every connected app SHALL mostrar "O mestre encerrou a mesa" com o botão "Voltar ao início".  <!-- NET-13 -->
14. The server SHALL ser a única fonte do estado da cena: cada ação de cliente é validada no servidor antes de alterar o estado e ser transmitida.  <!-- NET-14 -->
15. IF uma mensagem recebida pelo servidor não é JSON válido ou não segue o formato de uma ação conhecida THEN the server SHALL descartá-la sem alterar o estado nem derrubar o servidor.  <!-- NET-15 -->

**Independent Test**: Duas janelas no mesmo PC; uma hospeda em 47800, a outra entra em `127.0.0.1:47800` com o nome "Ana" e "Ana" aparece na lista das duas.

---

### P1: Mapa com grid ⭐ MVP

**User Story**: As a mestre, I want carregar um mapa da campanha com grid ajustável so that os tokens encaixam nas células do desenho.

**Why P1**: É o tabuleiro (Fase 2).

**Acceptance Criteria**:

1. WHILE nenhum mapa está carregado the app SHALL mostrar ao mestre "Nenhum mapa carregado" com o botão "Importar mapa", e aos jogadores "Aguardando o mestre carregar um mapa".  <!-- MAP-01 -->
2. WHEN o mestre usa "Importar mapa" e escolhe uma imagem PNG, JPG ou WebP THEN the app SHALL mostrar a imagem como mapa da cena em todas as janelas.  <!-- MAP-02 -->
3. WHEN um mapa é importado THEN the app SHALL detectar o tamanho da célula do grid pela média de brilho por coluna e por linha com FFT, e para um mapa 2000x1500 com grid 24x18 SHALL obter célula entre 82 e 85 px.  <!-- MAP-03 -->
4. IF a detecção não encontra um período entre 20 e 400 px THEN the app SHALL usar célula de 70 px e mostrar "Grid não detectado — ajuste manualmente".  <!-- MAP-04 -->
5. WHEN o mestre altera tamanho da célula (10–500 px), deslocamento X/Y (0 até o tamanho da célula), cor ou opacidade (0–100%) do grid THEN the app SHALL redesenhar o grid com os novos valores em todas as janelas.  <!-- MAP-05 -->
6. IF um valor do grid está fora dos limites THEN the app SHALL limitar o valor ao extremo mais próximo.  <!-- MAP-06 -->
7. WHEN qualquer usuário gira a roda do mouse sobre o mapa THEN the app SHALL aplicar zoom entre 10% e 400% centrado no cursor, só na janela dele.  <!-- MAP-07 -->
8. WHEN qualquer usuário arrasta o mapa com o botão do meio ou com espaço pressionado THEN the app SHALL deslocar a visão só na janela dele.  <!-- MAP-08 -->
9. IF o arquivo escolhido não é uma imagem PNG, JPG ou WebP decodificável ou passa de 50 MB THEN the app SHALL mostrar "Imagem inválida" e manter o mapa atual.  <!-- MAP-09 -->

**Independent Test**: O mestre importa um mapa 2000x1500 com grid 24x18; as duas janelas mostram o mapa e o grid de ~83 px alinhado ao desenho.

---

### P1: Tokens ⭐ MVP

**User Story**: As a mestre, I want importar os tokens do kit e movê-los no grid so that represento personagens, inimigos e NPCs na cena.

**Why P1**: Mover token sincronizado é o núcleo da mesa (Fases 2 e 3).

**Acceptance Criteria**:

1. WHEN o mestre usa "Importar pasta de tokens" e escolhe uma pasta THEN the app SHALL listar cada PNG da pasta como token na biblioteca, com o nome do arquivo sem extensão como nome do token.  <!-- TOK-01 -->
2. WHERE existe `<nome>.json` ao lado do PNG com `nome`, `faccao` (`grupo`, `inimigo`, `npc`, `neutro`) e `tamanho` (1, 2 ou 3) the app SHALL usar esses valores no token.  <!-- TOK-02 -->
3. IF o manifesto não existe, não é JSON válido ou tem valor fora do permitido THEN the app SHALL usar facção `neutro` e tamanho 1 para o campo inválido ou ausente.  <!-- TOK-03 -->
4. WHEN o mestre arrasta um token da biblioteca para o mapa THEN the app SHALL colocar o token encaixado na célula sob o cursor em todas as janelas.  <!-- TOK-04 -->
5. WHEN um usuário com permissão solta um token arrastado THEN the app SHALL encaixar o canto superior esquerdo do token na célula sob esse canto e mostrar a nova posição em todas as janelas.  <!-- TOK-05 -->
6. The app SHALL desenhar cada token ocupando tamanho×tamanho células (1x1, 2x2 ou 3x3), com o nome abaixo e um anel na cor da facção.  <!-- TOK-06 -->
7. WHEN o mestre muda nome, facção ou tamanho de um token na cena THEN the app SHALL mostrar o token atualizado em todas as janelas.  <!-- TOK-07 -->
8. WHEN o mestre remove um token da cena THEN the app SHALL tirar o token de todas as janelas.  <!-- TOK-08 -->
9. WHERE o mestre escolheu um `palette.json` the app SHALL usar as cores dele para os anéis de facção; sem paleta, SHALL usar `grupo` #3b82f6, `inimigo` #ef4444, `npc` #eab308, `neutro` #9ca3af.  <!-- TOK-09 -->
10. IF o token é solto fora da área do mapa THEN the app SHALL devolver o token à posição anterior.  <!-- TOK-10 -->

**Independent Test**: O mestre importa uma pasta com `goblin.png` e `goblin.json` (`inimigo`, 2); arrasta o goblin para o mapa e ele aparece 2x2 com anel vermelho nas duas janelas.

---

### P1: Assets por hash ⭐ MVP

**User Story**: As a jogador, I want receber os mapas e tokens pela conexão uma única vez so that a mesa abre rápido e não preciso das pastas do mestre.

**Why P1**: Jogadores não têm os arquivos (Fase 3).

**Acceptance Criteria**:

1. The server SHALL identificar cada imagem pelo hash SHA-256 do conteúdo.  <!-- ASSET-01 -->
2. WHEN a cena referencia um hash que o jogador não tem em cache THEN the app SHALL baixar o arquivo do servidor e gravá-lo no cache.  <!-- ASSET-02 -->
3. WHEN a cena referencia um hash que já está no cache do jogador THEN the app SHALL usar o arquivo do cache sem baixá-lo.  <!-- ASSET-03 -->
4. WHILE há arquivos baixando the app SHALL mostrar "Baixando arquivos <n>/<total>".  <!-- ASSET-04 -->
5. IF o arquivo baixado não tem o hash pedido THEN the app SHALL descartá-lo e pedir de novo, no máximo 3 vezes, e depois mostrar "Falha ao baixar arquivo".  <!-- ASSET-05 -->
6. IF um cliente pede um hash que não pertence à cena atual nem à biblioteca do mestre THEN the server SHALL recusar o pedido.  <!-- ASSET-06 -->

**Independent Test**: Jogador entra com cache vazio e baixa mapa e tokens; ao reentrar, nenhum arquivo é transferido.

---

### P1: Permissões ⭐ MVP

**User Story**: As a mestre, I want controlar quem move cada token e esconder tokens so that jogadores só mexem nos próprios personagens.

**Why P1**: Sem isso um jogador move os inimigos (Fase 4).

**Acceptance Criteria**:

1. WHEN o mestre escolhe um jogador como dono de um token THEN the server SHALL registrar o nome do jogador como dono e mostrar o dono no token na janela do mestre.  <!-- PERM-01 -->
2. The server SHALL aceitar do mestre mover, editar, esconder, mostrar e remover qualquer token.  <!-- PERM-02 -->
3. IF um jogador tenta mover um token que não é dele THEN the server SHALL recusar a ação e the app do jogador SHALL devolver o token à posição anterior.  <!-- PERM-03 -->
4. IF um jogador envia ação exclusiva do mestre (editar, esconder, remover token, grid, mapa, névoa, carregar cena) THEN the server SHALL recusá-la sem alterar o estado.  <!-- PERM-04 -->
5. WHEN o mestre esconde um token THEN the server SHALL deixar de enviar esse token aos jogadores e the app do mestre SHALL mostrá-lo semitransparente.  <!-- PERM-05 -->
6. WHEN o mestre mostra um token escondido THEN the app SHALL fazê-lo aparecer para todos os jogadores.  <!-- PERM-06 -->
7. The app do jogador SHALL permitir arrastar só os tokens cujo dono é ele.  <!-- PERM-07 -->

**Independent Test**: O mestre atribui "Guerreira" a Ana; Ana move "Guerreira" e não consegue mover "Goblin"; o mestre esconde "Goblin" e ele some da janela de Ana.

---

### P1: Dados e chat ⭐ MVP

**User Story**: As a jogador, I want rolar dados por notação e conversar so that a mesa inteira vê o mesmo resultado.

**Why P1**: Rolagem compartilhada é parte da sessão (Fase 4).

**Acceptance Criteria**:

1. WHEN um usuário rola uma expressão com termos `NdM`, `NdMkhK`, `NdMklK` e constantes somados ou subtraídos (ex.: `2d6+3`, `2d20kh1`, `1d8+1d6-2`) THEN the server SHALL sortear os dados e adicionar ao histórico o nome de quem rolou, a expressão, cada dado sorteado e o total.  <!-- DICE-01 -->
2. The server SHALL sortear cada dado com distribuição uniforme entre 1 e M usando `crypto.randomInt`.  <!-- DICE-02 -->
3. WHEN a expressão usa `khK` ou `klK` THEN the server SHALL somar só os K maiores ou K menores dados do termo e marcar os descartados no histórico.  <!-- DICE-03 -->
4. IF a expressão não segue a notação ou passa dos limites (1–100 dados, 2–1000 faces, 10 termos, modificador -1000..1000, K entre 1 e N) THEN the app SHALL mostrar "Notação inválida: <expressão>" e nada entra no histórico.  <!-- DICE-04 -->
5. WHEN um usuário envia uma mensagem de chat de 1 a 500 caracteres THEN the app SHALL mostrá-la no histórico de todas as janelas com o nome do autor.  <!-- CHAT-01 -->
6. IF a mensagem está vazia ou passa de 500 caracteres THEN the app SHALL não enviá-la.  <!-- CHAT-02 -->
7. WHEN um jogador entra THEN the server SHALL enviar as últimas 200 entradas do histórico de dados e chat.  <!-- CHAT-03 -->
8. The app SHALL mostrar texto de chat e nomes como texto puro, sem interpretar HTML.  <!-- CHAT-04 -->

**Independent Test**: Ana rola `2d20kh1+5`; as duas janelas mostram os dois d20, o descartado marcado e o total.

---

### P1: Régua, ping e desenho ⭐ MVP

**User Story**: As a jogador, I want medir distâncias, apontar e rabiscar no mapa so that explico movimentos sem descrever em palavras.

**Why P1**: Está no MVP do plano (item 6, Fase 4).

**Acceptance Criteria**:

1. WHILE um usuário arrasta com a ferramenta Régua the app SHALL mostrar a linha e a distância em células, contando cada diagonal como 1 célula, em todas as janelas.  <!-- TOOL-01 -->
2. WHEN o usuário solta a Régua THEN the app SHALL apagar a régua em todas as janelas.  <!-- TOOL-02 -->
3. WHEN um usuário clica no mapa com a ferramenta Ping THEN the app SHALL mostrar um pulso na cor do usuário naquele ponto em todas as janelas por 2 s.  <!-- TOOL-03 -->
4. WHEN um usuário desenha com a ferramenta Desenho THEN the app SHALL mostrar o traço em todas as janelas e apagá-lo 5 s depois de o usuário soltar o mouse.  <!-- TOOL-04 -->
5. IF um usuário envia mais de 30 pings ou traços em 10 s THEN the server SHALL descartar os excedentes.  <!-- TOOL-05 -->

**Independent Test**: Ana mede 5 células na diagonal e vê "5"; o mestre vê a mesma régua; um traço some 5 s depois.

---

### P1: Névoa de guerra ⭐ MVP

**User Story**: As a mestre, I want esconder o mapa e revelar áreas aos poucos so that os jogadores descobrem o terreno.

**Why P1**: Item 5 do MVP (Fase 5).

**Acceptance Criteria**:

1. WHEN um mapa é importado THEN the server SHALL cobrir todas as células com névoa.  <!-- FOG-01 --> (substituído por FOGD-01, AD-005: o mapa vem sem névoa)
2. WHILE uma célula está coberta the app do jogador SHALL desenhá-la totalmente opaca e the app do mestre SHALL desenhá-la com 50% de opacidade.  <!-- FOG-02 -->
3. WHEN o mestre pinta com o Pincel de névoa (raio de 1 a 10 células) no modo Revelar ou Cobrir THEN the server SHALL revelar ou cobrir as células cujo centro está dentro do raio e transmitir a mudança.  <!-- FOG-03 -->
4. WHEN o mestre arrasta um retângulo de névoa no modo Revelar ou Cobrir THEN the server SHALL revelar ou cobrir as células cujo centro está dentro do retângulo.  <!-- FOG-04 -->
5. WHEN o mestre usa "Cobrir tudo" THEN the server SHALL cobrir todas as células.  <!-- FOG-05 -->
6. WHILE alguma célula ocupada por um token está coberta the server SHALL não enviar esse token aos jogadores que não são donos dele.  <!-- FOG-06 -->
7. WHEN uma área é revelada e passa a mostrar um token THEN the server SHALL enviar esse token aos jogadores.  <!-- FOG-07 -->
8. WHEN o mestre muda tamanho da célula ou deslocamento do grid THEN the server SHALL recobrir todas as células com névoa.  <!-- FOG-08 --> (substituído por FOGD-04 e FOGD-05, AD-005)

**Independent Test**: O mestre revela um retângulo; Ana vê só aquela área e só os tokens dentro dela.

---

### P1: Salvar e carregar cena ⭐ MVP

**User Story**: As a mestre, I want salvar a cena num arquivo `.mesa` so that continuo a sessão outro dia.

**Why P1**: Item 7 do MVP (Fase 5).

**Acceptance Criteria**:

1. WHEN o mestre usa "Salvar cena" THEN the app SHALL gravar um arquivo `.mesa` com mapa, grid, tokens (posição, nome, facção, tamanho, dono, escondido), névoa e as imagens usadas embutidas.  <!-- SAVE-01 -->
2. WHEN o mestre usa "Carregar cena" e escolhe um `.mesa` válido THEN the app SHALL substituir a cena e mostrar a cena carregada em todas as janelas.  <!-- SAVE-02 -->
3. The app SHALL restaurar de um `.mesa` uma cena igual à salva em mapa, grid, tokens e névoa.  <!-- SAVE-03 -->
4. IF o arquivo não é um `.mesa` válido THEN the app SHALL mostrar "Arquivo .mesa inválido" e manter a cena atual.  <!-- SAVE-04 -->
5. WHEN o mestre usa "Carregar cena" com tokens na cena atual THEN the app SHALL pedir confirmação "Substituir a cena atual?" antes de carregar.  <!-- SAVE-05 -->

**Independent Test**: Salvar, fechar o app, hospedar de novo, carregar o `.mesa`: a cena é a mesma.

---

### P1: Executável portátil ⭐ MVP

**User Story**: As a mestre, I want um único `.exe` portátil so that mando um arquivo aos amigos e eles só abrem.

**Why P1**: Fase 6.

**Acceptance Criteria**:

1. WHEN o build de distribuição roda THEN the build SHALL gerar um único `.exe` portátil Windows x64 que abre o app sem instalação.  <!-- PKG-01 -->
2. The app SHALL funcionar no `.exe` sem acesso à internet.  <!-- PKG-02 -->

**Independent Test**: `npm run dist` gera `dist/MesaRPG-<versão>-portable.exe`; o usuário abre no Windows e hospeda.

---

## Edge Cases

- IF dois usuários movem o mesmo token ao mesmo tempo THEN the server SHALL aplicar as ações na ordem em que chegam e todas as janelas SHALL terminar na mesma posição.  <!-- NET-16 -->
- IF o mestre remove um token que um jogador está arrastando THEN the app do jogador SHALL cancelar o arraste.  <!-- TOK-11 -->
- WHEN um jogador sem tokens entra THEN the app SHALL deixá-lo ver a mesa, rolar dados, conversar e usar régua, ping e desenho.  <!-- PERM-08 -->
- WHEN o mestre clica num token logo depois de uma atualização da cena THEN the app SHALL selecionar esse token no editor.  <!-- TOK-12 --> (achado na caminhada: um clique logo após uma atualização errava o token)

---

## Implicit-requirement dimensions sweep

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | NET-04, NET-07, MAP-06, MAP-09, TOK-03, DICE-04, CHAT-02, NET-15 |
| Failure / partial-failure states | NET-05, NET-08, NET-10, NET-12, ASSET-05, SAVE-04 |
| Idempotency / retry / duplicate handling | ASSET-03, ASSET-05, NET-11 |
| Auth boundaries & rate limits | PERM-02..07, ASSET-06, TOOL-05, NET-09 |
| Concurrency / ordering | NET-14, NET-16 |
| Data lifecycle / expiry | TOOL-02, TOOL-03, TOOL-04, CHAT-03; cache sem expiração no MVP (cache pequeno, grupo de 5) |
| Observability | N/A because é um app desktop de um grupo: erros aparecem na tela; sem telemetria |
| External-dependency failure | NET-08, NET-10, NET-13 (a VPN é a única dependência externa) |
| State-transition integrity | FOG-01, FOG-08, SAVE-02, SAVE-05, NET-13 |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| NET-01 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-02 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-03 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-04 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-05 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-06 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-07 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-08 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-09 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-10 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-11 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-12 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-13 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-14 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-15 | P1: Hospedar e entrar na mesa | Design | Pending |
| NET-16 | Edge cases | Design | Pending |
| MAP-01 | P1: Mapa com grid | Design | Pending |
| MAP-02 | P1: Mapa com grid | Design | Pending |
| MAP-03 | P1: Mapa com grid | Design | Pending |
| MAP-04 | P1: Mapa com grid | Design | Pending |
| MAP-05 | P1: Mapa com grid | Design | Pending |
| MAP-06 | P1: Mapa com grid | Design | Pending |
| MAP-07 | P1: Mapa com grid | Design | Pending |
| MAP-08 | P1: Mapa com grid | Design | Pending |
| MAP-09 | P1: Mapa com grid | Design | Pending |
| TOK-01 | P1: Tokens | Design | Pending |
| TOK-02 | P1: Tokens | Design | Pending |
| TOK-03 | P1: Tokens | Design | Pending |
| TOK-04 | P1: Tokens | Design | Pending |
| TOK-05 | P1: Tokens | Design | Pending |
| TOK-06 | P1: Tokens | Design | Pending |
| TOK-07 | P1: Tokens | Design | Pending |
| TOK-08 | P1: Tokens | Design | Pending |
| TOK-09 | P1: Tokens | Design | Pending |
| TOK-10 | P1: Tokens | Design | Pending |
| TOK-11 | Edge cases | Design | Pending |
| TOK-12 | Edge cases | Design | Pending |
| ASSET-01 | P1: Assets por hash | Design | Pending |
| ASSET-02 | P1: Assets por hash | Design | Pending |
| ASSET-03 | P1: Assets por hash | Design | Pending |
| ASSET-04 | P1: Assets por hash | Design | Pending |
| ASSET-05 | P1: Assets por hash | Design | Pending |
| ASSET-06 | P1: Assets por hash | Design | Pending |
| PERM-01 | P1: Permissões | Design | Pending |
| PERM-02 | P1: Permissões | Design | Pending |
| PERM-03 | P1: Permissões | Design | Pending |
| PERM-04 | P1: Permissões | Design | Pending |
| PERM-05 | P1: Permissões | Design | Pending |
| PERM-06 | P1: Permissões | Design | Pending |
| PERM-07 | P1: Permissões | Design | Pending |
| PERM-08 | Edge cases | Design | Pending |
| DICE-01 | P1: Dados e chat | Design | Pending |
| DICE-02 | P1: Dados e chat | Design | Pending |
| DICE-03 | P1: Dados e chat | Design | Pending |
| DICE-04 | P1: Dados e chat | Design | Pending |
| CHAT-01 | P1: Dados e chat | Design | Pending |
| CHAT-02 | P1: Dados e chat | Design | Pending |
| CHAT-03 | P1: Dados e chat | Design | Pending |
| CHAT-04 | P1: Dados e chat | Design | Pending |
| TOOL-01 | P1: Régua, ping e desenho | Design | Pending |
| TOOL-02 | P1: Régua, ping e desenho | Design | Pending |
| TOOL-03 | P1: Régua, ping e desenho | Design | Pending |
| TOOL-04 | P1: Régua, ping e desenho | Design | Pending |
| TOOL-05 | P1: Régua, ping e desenho | Design | Pending |
| FOG-01 | P1: Névoa de guerra | Design | Pending |
| FOG-02 | P1: Névoa de guerra | Design | Pending |
| FOG-03 | P1: Névoa de guerra | Design | Pending |
| FOG-04 | P1: Névoa de guerra | Design | Pending |
| FOG-05 | P1: Névoa de guerra | Design | Pending |
| FOG-06 | P1: Névoa de guerra | Design | Pending |
| FOG-07 | P1: Névoa de guerra | Design | Pending |
| FOG-08 | P1: Névoa de guerra | Design | Pending |
| SAVE-01 | P1: Salvar e carregar cena | Design | Pending |
| SAVE-02 | P1: Salvar e carregar cena | Design | Pending |
| SAVE-03 | P1: Salvar e carregar cena | Design | Pending |
| SAVE-04 | P1: Salvar e carregar cena | Design | Pending |
| SAVE-05 | P1: Salvar e carregar cena | Design | Pending |
| PKG-01 | P1: Executável portátil | Design | Pending |
| PKG-02 | P1: Executável portátil | Design | Pending |

**Coverage:** 79 total, 0 mapped to tasks, 79 unmapped ⚠️ (mapped in Tasks)

---

## Sources

- `Mesa RPG LAN — plano do app.md` - objetivo, arquitetura, stack, MVP, integração com o kit, rede e fases.
- `.specs/features/mesa-mvp/context.md` - respostas do usuário às decisões em aberto.

---

## Success Criteria

- [ ] Duas janelas no mesmo PC (hospedar em 47800, entrar em 127.0.0.1) passam por todas as histórias acima.
- [ ] O usuário abre o `.exe` no Windows, hospeda e um amigo entra pelo IP `25.x` do Hamachi.
