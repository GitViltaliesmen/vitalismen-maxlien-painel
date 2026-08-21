# Freeze V31 — áudio de orientação de uso do Tex Ultra

Data: 2026-08-21

País: EC

Produto: Tex Ultra Ecuador (`tex_ultra_ec`)

Base de produção: `7cd02383911f4660a577d84e58c58d0d00396d27`

Pai: `media-durability-auth-v30-20260821`

## Autorização e mídia

O operador forneceu e aprovou nesta tarefa o arquivo `MODO DE USO TEX ULTRA.mp3` para orientação de uso exclusiva do Tex Ultra e autorizou finalizar a correção sem interrupções repetidas.

- MP3 preservado: SHA-256 `5bd4a1661f0ee3dee7b45cd146ba0b37d6776339f1835bda4613949d71a38a8a`, 468.498 bytes, 28,24 segundos, mono, 44,1 kHz, 128 kbps.
- OGG de envio: SHA-256 `c232e5fff4d9418698397e2aa736e56446fff211d62a2943ea53860d1a909d1d`, 169.021 bytes, Opus 48 kHz mono.
- Nome técnico único: `MODO_DE_USO_TEX_ULTRA`.

## Contrato autorizado

1. Após confirmação real de retirada/entrega, o pós-venda oficial seleciona `MODO_DE_USO_TEX_ULTRA` apenas quando o pedido é Tex Ultra.
2. Perguntas `como se toma`, `como se usa`, `como tomar`, `como usar`, `modo de uso`, `dosis` ou `posologia` recebem o mesmo áudio pelo funil isolado Tex Ultra.
3. Os dois gatilhos compartilham uma chave persistente em `OutboundDedupe`; um envio confirmado por qualquer gatilho bloqueia repetição automática pelo outro.
4. A memória do contato registra pedido, estado e data em `metadata.perAgentMemory.tex_ultra_ec.howToUseAudio`.
5. Falha de transporte permanece retentável; mídia ausente falha fechado e não usa Vit Power, Nitrix ou TTS como fallback.
6. A lógica existente de retirada, bônus, locks, histórico e `automation.sentAudioLog` permanece ativa.

## Preservado

- Z-API continua sendo o transporte oficial.
- Não há scheduler novo, disparo em massa ou varredura retroativa de clientes.
- Nenhum preço, oferta, VSL, pedido, Dropi, Meta/CAPI, pixel, número WhatsApp, checkout ou ficha foi alterado.
- Vit Power continua usando `COMO_SE_TOMA_VIT_POWER`.
- Nitrix continua usando `NITRIX_USO_OXIDE_EC`.
- A V30 de mídia inbound e painel autenticado continua integralmente preservada.

## Comprovação inbound restante

O arquivo anexado à tarefa chegou pelo Codex e não percorreu o webhook Z-API. Portanto, ele não comprova o último elo inbound do provider.

A prova final exige um único canário controlado:

1. registrar o horário inicial e o estado atual do storage;
2. enviar uma mídia nova pelo WhatsApp de teste ao número oficial;
3. localizar a mensagem pelo `providerMessageId` sem expor URL temporária;
4. confirmar transições `RECEIVED → FETCHING → STORED → READY`;
5. confirmar arquivo em `/opt/vitalismen-automacao/shared/media/inbound` com tamanho e SHA-256;
6. abrir a mesma bolha no painel autenticado e reproduzir/visualizar via Blob Bearer;
7. não usar cliente real nem fazer disparo em massa.

## Rollback

Retornar à release `/opt/vitalismen-automacao/releases/20260821T185008Z_production-20260821-7cd0238`. Não apagar o storage compartilhado de mídia inbound. Registros aditivos de dedupe/memória podem permanecer para auditoria.
