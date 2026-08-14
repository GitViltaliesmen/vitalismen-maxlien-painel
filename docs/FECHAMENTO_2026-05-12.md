# Fechamento operacional 2026-05-12

## Projeto oficial fechado neste ciclo

Caminho unico local:

```text
/Users/greson/Documents/Vitalismen Automacao
```

Caminho oficial VPS:

```text
/opt/vitalismen-automacao/current
```

Este ciclo encerrou com a automacao Vitalismen / Vit Power Ecuador limpa, blindada contra confusao com outros projetos e rodando localmente.

## Blindagem criada

- marcador oficial de raiz: `.vitalismen-official-root`;
- verificador de caminho unico: `scripts/assert-official-root.mjs`;
- comando de validacao: `npm run official:path`;
- documentacao: `docs/CAMINHO_OFICIAL_UNICO.md`;
- `senior-guard` agora bloqueia execucao fora do caminho oficial;
- regras reforcadas em `AGENTS.md`, `PROJETO_OFICIAL_VITALISMEN.md` e `docs/REGRA_OPERACIONAL_VPS.md`.

Regra final: se o usuario disser "retome", "continue", "o bot" ou "a automacao", usar sempre o caminho oficial Vitalismen. Nao abrir nem usar outros projetos sem confirmacao explicita.

## Limpeza feita

- removidas midias soltas/lixo em `public/media/`;
- removido `public/media/generated`;
- removido `public/qrcode.png`;
- removidos diretorios vazios de midia;
- removidos 2 registros orfaos no MongoDB que geravam avisos na auditoria oficial;
- mantidos apenas assets oficiais:
  - `public/media/templates/EC`;
  - `public/media/sales/ec`;
  - `public/media/sales/shared`.

## Estado final validado

- API local: `http://127.0.0.1:3001`;
- MongoDB local: `127.0.0.1:27017`;
- WhatsApp conectado: `5515991418416`;
- `npm run official:path`: OK;
- `npm run senior:check`: OK;
- `npm run official:audit`: OK, 0 avisos.

## Como retomar depois

```sh
cd "/Users/greson/Documents/Vitalismen Automacao"
npm run official:path
npm run senior:check
npm run official:audit
```

Se a API nao estiver rodando:

```sh
./scripts/start-mongo-local.sh
./scripts/start-api-local.sh
```

Painel local:

```text
http://127.0.0.1:3001/qr.html
```

## Observacao

Nao fazer novo desenvolvimento, teste real ou deploy sem antes passar pelo caminho unico e pela auditoria oficial.
