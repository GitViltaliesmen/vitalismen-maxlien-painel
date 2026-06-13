# Sistema de números WhatsApp e áudios prontos

## Objetivo

Reduzir custo de geração de áudio e manter operação saudável, controlada e rastreável. O sistema deve respeitar atendimento humano, limites de envio, histórico do cliente e qualidade da conversa.

## Áudios prontos

- `BOT_USE_APPROVED_AUDIO_ONLY=true` bloqueia geração automática de TTS pago.
- O atendente usa os áudios aprovados no painel em **Cliente selecionado > Audios do funil**.
- Para Equador já estão prontos:
  - `Chegou_01`
  - `Chegou_02`
  - `Chegou_03`

## Rodízio seguro de números

O rodízio foi criado como gestão de saúde de remetentes, não como disparo agressivo.

Regras:
- Começar com um número: `WHATSAPP_ROTATION_ENABLED=false`.
- Preparado para vários números via `WHATSAPP_SESSION_IDS=numero1,numero2`.
- Cada cliente mantém afinidade com o mesmo número por 7 dias.
- O sistema respeita limite diário, limite horário e intervalo mínimo por número.
- Números podem ser pausados por `WHATSAPP_PAUSED_SESSION_IDS`.
- Se o atendente envia manualmente, o contato entra em modo humano.

## Configuração inicial atual

```env
WHATSAPP_DEFAULT_SESSION_ID=5515991418416
WHATSAPP_SESSION_IDS=5515991418416
WHATSAPP_ROTATION_ENABLED=false
WHATSAPP_SENDER_DAILY_LIMIT=120
WHATSAPP_SENDER_HOURLY_LIMIT=30
WHATSAPP_SENDER_MIN_GAP_MS=45000
WHATSAPP_SENDER_AFFINITY_DAYS=7
BOT_USE_APPROVED_AUDIO_ONLY=true
```

## Para adicionar um novo número depois

1. Adicionar o número em `WHATSAPP_SESSION_IDS`, separado por vírgula.
2. Reiniciar a API.
3. Abrir `http://127.0.0.1:3001/qr.html?sessionId=NUMERO`.
4. Ler o QR do novo número.
5. Conferir em `/api/whatsapp/sender-pool`.
6. Só depois ativar `WHATSAPP_ROTATION_ENABLED=true`.

## Diagnóstico

- Painel: bloco **Automacao geral > Numeros WhatsApp**.
- API: `GET /api/whatsapp/sender-pool`.
- API: `GET /api/automation/status`.

## Limites recomendados para início

- Um número em teste.
- Envio manual ou lista permitida.
- Auto-resposta apenas para número de teste enquanto validamos texto, áudio e comportamento.
- Aumentar volume somente depois de confirmar taxa de resposta, bloqueios, reclamações e qualidade dos leads.
