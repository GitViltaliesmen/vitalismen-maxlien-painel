# Camada Nitrix EC — abertura com dois áudios

## Escopo

Somente clientes que chegam pela VSL Nitrix EC (`/n/`) e passam pelo rollout explícito da camada.

1. Áudio `NITRIX_INICIO_01_VALERIA_ZAMBRANO_UNIVERSAL` em janela sorteada de 5 a 30 segundos após a entrada (10 s como referência).
2. Áudio `NITRIX_INICIO_02_VALERIA_ZAMBRANO_UNIVERSAL` em janela sorteada de 35 a 59 segundos após a entrada.

Não envia texto inicial, prova social, frasco, preço, pedido de nome, uso, Dropi ou conteúdo de Vit Power.

## Proteções

- A entrada é persistida antes do primeiro envio.
- Mensagem do cliente ou assunção humana cancela o áudio pendente.
- A fila global entrega uma mídia por vez, com separação aleatória de 4 a 9 segundos entre clientes simultâneos; nenhuma rajada é liberada na mesma marca de tempo.
- Em pico, todos os primeiros áudios têm prioridade na fila. O segundo áudio só é enviado após o primeiro daquele cliente e dentro da janela absoluta da entrada.
- Quando a camada `two_audio_only` está ativa, o worker aceita somente jobs com essa marca. Fluxos antigos não são reativados.
- Falha de envio não avança para o próximo áudio; após as tentativas, o caso é atribuído ao humano.
- Áudios aprovados são exclusivos de Nitrix EC.

## Liberação

Permanece desativada até teste controlado e ativação explícita no VPS:

```dotenv
NITRIX_FAST_STATE_ENABLED=true
NITRIX_FAST_STATE_ROLLOUT_MODE=full
NITRIX_FAST_STATE_ENTRY_LAYER=two_audio_only
NITRIX_FAST_STATE_ENTRY_AUDIO_01_MIN_MS=5000
NITRIX_FAST_STATE_ENTRY_AUDIO_01_MAX_MS=30000
NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_ENTRY_MIN_MS=35000
NITRIX_FAST_STATE_ENTRY_AUDIO_02_AFTER_ENTRY_MAX_MS=59000
NITRIX_FAST_STATE_GLOBAL_MEDIA_MIN_GAP_MS=4000
NITRIX_FAST_STATE_GLOBAL_MEDIA_MAX_GAP_MS=9000
```

Para QA, manter `NITRIX_FAST_STATE_ROLLOUT_MODE=qa` e preencher somente o telefone de teste permitido.
