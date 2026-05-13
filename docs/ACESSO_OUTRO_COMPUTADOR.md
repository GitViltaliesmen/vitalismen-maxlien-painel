# Acesso em outro computador

## Estado atual

Branch oficial:

```text
codex-vitpower-unified-front
```

Commit oficial:

```text
46bc1db oficializa vitalismen ec
```

Repositorio ponte no VPS:

```text
root@maxlien.shop:/opt/git/vitalismen-automacao.git
```

Repositorio GitHub planejado:

```text
Tycoonwhite/flowvendas-ec
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

Autorizar a chave SSH desta maquina no GitHub/repo:

```text
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOg8l4SNLXbwIyIqGFvFzF1P7kcIRtvTZUt3mOYZ1tFv maxlienoficial@proton.me
```

Depois, nesta maquina:

```sh
git push -u origin codex-vitpower-unified-front
```

No outro computador:

```sh
git clone git@github.com:Tycoonwhite/flowvendas-ec.git
cd flowvendas-ec
git checkout codex-vitpower-unified-front
npm install
cp .env.example .env
```

Preencher o `.env` manualmente com as chaves reais.

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
