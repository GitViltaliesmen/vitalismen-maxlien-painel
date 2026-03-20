# Vitalismen Automacao

Backend Express com motor WhatsApp via Baileys, automacoes de funil e integracoes operacionais.

## Requisitos

- Node.js 20+
- MongoDB em `127.0.0.1:27017`

## Ambiente

1. Copie `.env.example` para `.env` se precisar recriar o ambiente.
2. Ajuste `MONGODB_URI`, `JWT_SECRET` e as chaves externas no `.env`.

## Execucao local

API:

```sh
./scripts/start-api-local.sh
```

MongoDB local:

```sh
./scripts/start-mongo-local.sh
```

Os scripts usam binarios em `.local/` quando existirem e caem para `node`/`mongod` do sistema quando disponiveis.

## Healthchecks

- `GET /health`
- `GET /api/health`

## Pareamento do WhatsApp

- Abra `http://127.0.0.1:3001/qr.html`
- Se o status estiver `SCANNING`, escaneie o QR no WhatsApp
- Se o status estiver `LOGGED_OUT`, apague `auth_info_baileys/` e reinicie a API para gerar um novo QR

## Observacoes de versionamento

- `node_modules/`, `.local/`, `auth_info_baileys/`, `.env` e midias geradas nao entram no Git
- `public/media/templates/` permanece versionado por ser asset funcional do funil
