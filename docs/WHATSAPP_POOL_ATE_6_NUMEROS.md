# Pool WhatsApp Real - Estrutura Ate 6 Numeros

Status aprovado em 2026-05-15:

- Painel Atendimento: `https://ec.maxlien.shop/qr.html`
- Leads Clientes: `https://ec.maxlien.shop/admin/dashboard?country=EC`
- Nao mexer nas paginas congeladas sem autorizacao explicita.

## Configuracao atual

O painel real ja esta preparado para revezamento/failover por sessoes WhatsApp.

Configuracao online atual:

```env
WHATSAPP_DEFAULT_SESSION_ID=553183002800
WHATSAPP_SESSION_IDS=553183002800,553171862958,5515991418416
WHATSAPP_ROTATION_ENABLED=true
WHATSAPP_SENDER_AFFINITY_DAYS=45
WHATSAPP_SENDER_DAILY_LIMITS=553171862958:5
WHATSAPP_AUTOMATION_PILOT_ONLY=false
```

Numeros atuais:

- `553183002800`
- `553171862958`
- `5515991418416`

## Estrutura pronta para 6 numeros

Quando existirem mais 3 celulares reais, adicionar somente numeros reais em `WHATSAPP_SESSION_IDS`.

Para aquecer um celular novo aos poucos, usar `WHATSAPP_SENDER_DAILY_LIMITS`.
Exemplo: `553171862958:5` limita o numero final 2958 a 5 clientes/envios no dia, enquanto os outros numeros seguem o limite geral.
Nao adicionar numero falso ou placeholder, porque o sistema vai criar QR fantasma.

Modelo:

```env
WHATSAPP_DEFAULT_SESSION_ID=553183002800
WHATSAPP_SESSION_IDS=553183002800,553171862958,5515991418416,55NOVO_NUMERO_4,55NOVO_NUMERO_5,55NOVO_NUMERO_6
WHATSAPP_ROTATION_ENABLED=true
WHATSAPP_SENDER_AFFINITY_DAYS=45
```

Depois de alterar:

```bash
pm2 reload vitalismen-automation --update-env
```

## Como conectar cada numero

Abrir o QR pelo `sessionId` exato:

- `https://ec.maxlien.shop/qr.html?sessionId=553183002800`
- `https://ec.maxlien.shop/qr.html?sessionId=553171862958`
- `https://ec.maxlien.shop/qr.html?sessionId=5515991418416`
- `https://ec.maxlien.shop/qr.html?sessionId=55NOVO_NUMERO_4`
- `https://ec.maxlien.shop/qr.html?sessionId=55NOVO_NUMERO_5`
- `https://ec.maxlien.shop/qr.html?sessionId=55NOVO_NUMERO_6`

## Regra operacional

- Cliente novo: sistema escolhe o numero com menor uso/capacidade disponivel.
- Cliente com historico: sistema tenta manter o mesmo numero/carteira.
- Numero caiu/restrito/desconectado: sistema tenta outro numero conectado e preserva o historico no banco.
- Nao usar o mesmo numero em outro WhatsApp Web fora do painel, para evitar conflito.
