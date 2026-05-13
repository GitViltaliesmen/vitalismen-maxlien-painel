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

## Multi-sessao WhatsApp

O projeto agora suporta varias sessoes de WhatsApp ao mesmo tempo.

Variaveis:

- `WHATSAPP_DEFAULT_SESSION_ID=default`
- `WHATSAPP_SESSION_IDS=default,numero2,numero3`

Cada sessao usa sua propria pasta em:

- `auth_info_baileys/default`
- `auth_info_baileys/numero2`
- `auth_info_baileys/numero3`

Fluxo:

1. Ajuste `WHATSAPP_SESSION_IDS` no `.env`.
2. Suba a API com `./scripts/start-api-local.sh`.
3. Gere e acompanhe o status das sessoes nas rotas:
   - `GET /api/whatsapp/status`
   - `GET /api/whatsapp/status?sessionId=numero2`
   - `GET /api/whatsapp/sessions`
   - `POST /api/whatsapp/sessions/:sessionId/start`
4. Para envio manual, informe `sessionId` no body de `POST /api/whatsapp/send`.

Exemplo de body:

```json
{
  "sessionId": "numero2",
  "phone": "573001112233",
  "message": "Hola"
}
```

## Dropi Ecuador

O projeto fica focado em Equador/Vit Power:

- modelo `Shipment`
- scheduler de avisos de guia/retirada/devolucao
- servico de preparacao do payload de pedido
- servico de browser para submit/sync do painel da Dropi
- importacao manual por texto/tabela da Dropi
- envio de guia/fatura PDF por URL ou arquivo local quando disponivel

Observacao:

- a automacao real do painel requer um runner de navegador compatível, como `playwright`, instalado no ambiente
- sem essa dependencia, o servico de browser falha de forma controlada, sem quebrar a API
- se a Dropi pedir autenticacao de dois fatores, salve uma sessao manual antes de rodar a automacao:
  `node scripts/save-dropi-session.mjs ec`

### Rotas logisticas

- `GET /api/shipments`
- `POST /api/shipments/droppi/ec/sync`
- `POST /api/shipments/droppi/ec/import-text`
- `POST /api/shipments/droppi/ec/orders/:orderId/submit`
- `POST /api/shipments/:orderId/panel-sync`
- `POST /api/shipments/:orderId/notify-guide`
- `POST /api/shipments/:orderId/notify-pickup`
- `POST /api/shipments/:orderId/notify-returned`

### Importador Ecuador

Use o importador EC para textos/tabelas da Dropi Ecuador.

### Teste seguro sem avisar cliente real

1. Faça login na API para obter um token JWT.
2. Importe um pedido fake usando seu proprio numero com `autoNotify=false`.
3. Dispare `notify-guide` manualmente para esse `orderId`.

Exemplo de import de teste:

```sh
curl -s -X POST http://127.0.0.1:3001/api/shipments/droppi/ec/import-text \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "sessionId":"5515991418416",
    "autoNotify": false,
    "text":"Pedido 1\n\nID: 99990001\nProduto: Vit Power\nCliente: Teste Ecuador\nEndereco: Av. teste 123\nCidade: Guayaquil - Guayas\nTelefone: 999999999\nStatus: Para retiro en agencia\nGuia: 185000001\nTransportadora: Servientrega\nTipo de Envio: CON RECAUDO"
  }'
```

Disparo manual do aviso:

```sh
curl -s -X POST http://127.0.0.1:3001/api/shipments/99990001/notify-guide \
  -H 'Authorization: Bearer SEU_TOKEN'
```

## Observacoes de versionamento

- `node_modules/`, `.local/`, `auth_info_baileys/`, `.env` e midias geradas nao entram no Git
- `public/media/templates/` permanece versionado por ser asset funcional do funil
