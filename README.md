# Mesa RPG

Mesa virtual de RPG para jogar com os amigos pela rede local ou por uma VPN como Hamachi ou Radmin. Um mestre hospeda a mesa e os jogadores entram pelo IP dele.

## Instalar

1. Abra a página de releases: https://github.com/LeonardoAValerio/mesa-rpg/releases
2. Na versão mais recente, baixe `MesaRPG-Setup-<versão>.exe`.
3. Abra o instalador. Ele instala só para o seu usuário e não pede administrador.
4. O Windows pode mostrar o aviso do SmartScreen, porque o app não é assinado. Clique em **Mais informações** e depois em **Executar assim mesmo**.
5. O instalador cria um atalho na área de trabalho e no menu Iniciar.

Você só instala uma vez. Ao abrir, o app procura uma versão nova e baixa sozinho. Quando aparecer "Atualização <versão> pronta", clique em **Reiniciar e atualizar**, ou só feche o app: a atualização é instalada ao fechar.

Mestre e jogadores precisam estar na mesma versão. Se a versão for diferente, a mesa recusa a entrada e mostra as duas versões.

## Jogar

Todos entram na mesma rede do Hamachi ou do Radmin (ou estão na mesma rede local).

**Mestre**

1. Abra o app e clique em **Hospedar**. A porta padrão é `47800`.
2. Passe para os jogadores o seu IP do Hamachi ou do Radmin (por exemplo `25.x.x.x`) e a porta.

**Jogador**

1. Abra o app e, em **Entrar**, preencha o **IP do mestre**, a **Porta** (`47800`, se o mestre não mudou) e **Seu nome**.
2. Clique em **Entrar**.

Se não conectar, confira se o firewall do Windows do mestre libera o Mesa RPG na rede do Hamachi ou do Radmin.

## Publicar uma versão

A publicação roda numa GitHub Action. Nenhum token fica na sua máquina.

1. Com tudo commitado, suba a versão:

   ```bash
   npm version minor   # ou: npm version patch
   ```

   Isso muda a versão no `package.json`, cria o commit e a tag `v<versão>`.

2. Envie o commit e a tag:

   ```bash
   git push --follow-tags
   ```

3. A Action roda o typecheck e os testes de unidade, cria a release `v<versão>` como rascunho, gera o instalador no Windows, envia o instalador, o `.blockmap` e o `latest.yml` e só então publica a release.
4. Na próxima vez que abrirem o app, os amigos recebem a versão nova.

Se a tag não bater com a versão do `package.json`, ou se um teste falhar, a Action falha e nada é publicado. Se o build falhar depois do rascunho criado, o rascunho fica na página de releases: apague-o antes de tentar de novo.

## Rodar localmente

Precisa do Node da versão em `.nvmrc` (pelo nvm). O script `scripts/with-node` carrega essa versão antes de cada comando.

```bash
scripts/with-node npm ci
scripts/with-node npm run dev                 # abre o app em modo de desenvolvimento
scripts/with-node npx vitest run              # testes de unidade
scripts/with-node npm run build && scripts/with-node npx playwright test   # testes E2E
```

Em modo de desenvolvimento o app não procura atualizações.

Para gerar o instalador localmente (sem publicar), rode `scripts/with-node npm run dist`. No Linux o NSIS precisa do Wine, então o empacotamento roda na imagem Docker `electronuserland/builder:22-wine-10.26`: é preciso ter o Docker instalado e utilizável sem `sudo`. O instalador, o `.blockmap` e o `latest.yml` ficam em `dist/`.
