# V152-E-R4 — Persistent WhatsApp Web Shadow Worker

Data: 2026-09-12/13

Base imutável: `33e4e69aace895dc2fe4f16f5856d1c824c96900`

Fase: `V152-E-R4_PERSISTENT_SHADOW_WORKER`

## Escopo autorizado

A R4 transforma a sessão Web de teste já pareada em um worker persistente,
supervisionável e estritamente shadow. O processo restaura exclusivamente a sessão
`V152_TEST_WEB_01`, armazenada fora da release em
`/var/lib/vitalismen-whatsapp-web-sessions/V152_TEST_WEB_01`, e valida no próprio
socket autenticado o telefone `5531983002800`.

A prontidão do auth state reutiliza a inspeção estrutural congelada na R3
(`noiseKey`, identity/pre-key, metadados de registro, `account`, `me` e
`signalIdentities`). Ela não depende isoladamente do booleano `registered`, pois a
sessão R3 validada e restaurável persiste esse campo como falso na Baileys 6.7.24.

Nenhuma rota de pareamento é criada. `printQRInTerminal` permanece falso, não existe
chamada a pairing code e qualquer evento QR inesperado encerra o socket em fail-closed
com ação manual obrigatória. A sessão e os secrets de autenticação não entram em log,
receipt, painel ou estado de health.

## Supervisor e ciclo de vida

O artefato `ops/ecosystem.v152-e-r4.config.cjs` declara um único processo PM2 em
modo `fork`, uma instância, autorestart e desligamento gracioso por `SIGTERM`/`SIGINT`.
Esta candidata não registra nem inicia esse processo na produção; o arquivo é apenas
a configuração congelada para aprovação posterior.

O worker mantém no máximo um socket. Quedas transitórias conhecidas usam backoff
exponencial com jitter, janela de tentativas, limite e cooldown. `loggedOut`,
`badSession`, `connectionReplaced`, sessão revogada, incompatibilidade multidevice,
telefone divergente e QR inesperado são terminais e nunca entram em loop automático.

O health sanitizado é publicado em
`/var/lib/vitalismen-whatsapp-web-shadow-state/V152_TEST_WEB_01/health.json`, fora da
release e separado do auth state. Ele contém somente status operacional allowlisted,
heartbeat, timestamps e contadores; nunca contém QR, corpo de mensagem, chave,
cookie, token ou segredo de sessão.

## Shadow absoluto

O worker não importa dispatcher, fila outbound, bot, pedido, Dropi ou pós-venda e não
possui chamada de envio. Um inbound eventualmente observado incrementa apenas um
contador sanitizado e não persiste nem encaminha o conteúdo. O canal fica fixo em:

```text
shadow=true
draining=true
weight=0
capacity=0
```

Logo, consumo de fila outbound, roteamento inbound comercial, roteamento de cliente,
handoff, failover e cutover permanecem zero. Z-API `5531971862958` continua como
provedor oficial de produção e não é desligada ou drenada.

## Projeção no painel

A região Conexões passa a projetar quatro entradas, nesta ordem:

1. `LEGACY_ZAPI_PRIMARY`;
2. `V152_TEST_WEB_01`, derivado do heartbeat real sanitizado;
3. `WHATSAPP_WEB_TEMPLATE`;
4. `OLD_BLOCKED_PHONE`.

O canal Web só aparece `ACTIVE/PASS` quando o heartbeat está fresco e informa
`CONNECTED/PASS`. Estado ausente ou stale falha fechado. Os botões permanecem sem
ação e nenhuma outra região do painel é alterada pela R4.

## Validação e rollback

Os testes cobrem start–stop–start, restauração sem QR, telefone exato, socket único,
reconnect transitório limitado, cooldown, falhas terminais, health allowlisted e
projeção das quatro conexões. O teste real da candidata deve usar a sessão já pareada,
sem mensagem inbound/outbound e sem registrar processo no PM2 de produção.

Rollback de código: abandonar a candidata e manter o commit R3. Rollback operacional
futuro, caso a ativação seja aprovada: parar somente
`vitalismen-whatsapp-web-shadow-v152-e-r4`; nunca reiniciar ou alterar o processo
Z-API oficial. Nova tentativa de pairing ou qualquer cutover exige autorização nova e
explícita.
