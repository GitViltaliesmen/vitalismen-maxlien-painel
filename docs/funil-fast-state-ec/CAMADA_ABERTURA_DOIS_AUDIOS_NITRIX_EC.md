# Camada Nitrix EC — abertura com dois áudios

## Escopo

Somente clientes que chegam pela VSL Nitrix EC (`/n/`) e passam pelo rollout explícito da camada.

1. Áudio `NITRIX_INICIO_01_VALERIA_ZAMBRANO_UNIVERSAL` aos 10 segundos da entrada.
2. Áudio `NITRIX_INICIO_02_VALERIA_ZAMBRANO_UNIVERSAL` 20 segundos após o primeiro envio aceito.

Não envia texto inicial, prova social, frasco, preço, pedido de nome, uso, Dropi ou conteúdo de Vit Power.

## Proteções

- A entrada é persistida antes do primeiro envio.
- Mensagem do cliente ou assunção humana cancela o áudio pendente.
- A fila global preserva uma pequena separação entre clientes simultâneos para não criar rajada.
- Falha de envio não avança para o próximo áudio; após as tentativas, o caso é atribuído ao humano.
- Áudios aprovados são exclusivos de Nitrix EC.

## Liberação

Permanece desativada até teste controlado e ativação explícita no VPS:

```dotenv
NITRIX_FAST_STATE_ENABLED=true
NITRIX_FAST_STATE_ROLLOUT_MODE=full
NITRIX_FAST_STATE_ENTRY_LAYER=two_audio_only
NITRIX_FAST_STATE_ENTRY_AUDIO_01_DELAY_MS=10000
NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_FIRST_MS=20000
```

Para QA, manter `NITRIX_FAST_STATE_ROLLOUT_MODE=qa` e preencher somente o telefone de teste permitido.
