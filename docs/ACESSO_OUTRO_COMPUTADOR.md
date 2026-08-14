# Acesso em outro computador

## Estado atual

Branch oficial:

```text
codex-vitpower-unified-front
```

Commit oficial atual:

```text
c2df4e1 atualiza github oficial
```

Repositorio ponte no VPS:

```text
root@maxlien.shop:/opt/git/vitalismen-automacao.git
```

Repositorio GitHub oficial para sincronizar:

```text
GitViltaliesmen/vitalismen-maxlien-painel
```

## Regra de seguranca

Nao subir nem copiar por Git:

- `.env`
- `auth_info_baileys/`
- `.local/`
- `node_modules/`
- `exports/`

Esses caminhos ficam ignorados no `.gitignore`.

## Caminho 1: GitHub

No outro computador:

```sh
git clone git@github.com:GitViltaliesmen/vitalismen-maxlien-painel.git
cd vitalismen-maxlien-painel
git checkout codex-vitpower-unified-front
npm install
cp .env.example .env
```

Preencher o `.env` manualmente com as chaves reais.

Depois disso, o trabalho diario nas duas maquinas e:

```sh
git checkout codex-vitpower-unified-front
git pull
```

Depois de alterar e testar:

```sh
git add -A
git commit -m "descreva a alteracao"
npm run sync:official
```

O comando `npm run sync:official` envia a mesma branch para:

- GitHub `origin`;
- espelho `vps`.

Antes de trocar de computador, sempre rode:

```sh
git status
npm run sync:official
```

No outro computador, sempre comece com:

```sh
git pull
```

## Caminho 2: ponte pelo VPS

No outro computador, com a chave SSH autorizada no VPS:

```sh
GIT_SSH_COMMAND='ssh -i ~/.ssh/vps_auditoria_codex' git clone root@maxlien.shop:/opt/git/vitalismen-automacao.git "Vitalismen Automacao"
cd "Vitalismen Automacao"
git checkout codex-vitpower-unified-front
npm install
cp .env.example .env
```

Preencher o `.env` manualmente.

## Se o outro computador ainda nao tem chave do VPS

No outro computador:

```sh
ssh-keygen -t ed25519 -C "vitalismen-outro-computador"
cat ~/.ssh/id_ed25519.pub
```

Enviar apenas a chave publica `.pub` para adicionar no VPS.

Nunca enviar a chave privada.
